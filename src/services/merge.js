// ─────────────────────────────────────────────────────────────────────────
// Merge de 3 vias entre o que está neste aparelho (local), o que está no Drive
// (remoto) e o ponto em comum da última sincronização (base).
//
// Por quê 3 vias: com só duas versões não dá pra saber se um registro que
// existe de um lado e não do outro foi CRIADO lá ou APAGADO aqui, nem qual
// lado alterou um campo. Com a base, cada diferença tem dono:
//   • igual à base num lado  → vale o outro lado;
//   • mudou nos dois lados   → junta campo a campo (e lista a lista); só um
//                              mesmo campo alterado nos dois cai em "conflito"
//                              e vale o lado mais recente (`preferirLocal`);
//   • apagado de um lado e alterado do outro → vale a alteração (nunca se
//     perde um trabalho por causa de uma exclusão feita em outro aparelho).
//
// Registros são casados pelo `uid` (ou `uuid`), nunca pelo `id` numérico, que
// cada aparelho gera sozinho e colide. As ligações numéricas entre tabelas
// (cliente→loja, fiado→cliente/loja) são convertidas pra uid, mescladas e
// convertidas de volta pros ids deste aparelho — que NUNCA mudam pra
// registros que já existiam aqui (a tela aberta, ids em memória etc. seguem
// valendo).
//
// Módulo puro: sem acesso a banco, rede ou relógio.
// ─────────────────────────────────────────────────────────────────────────
import { TABELAS_COM_UID, uidLegado } from '../uids.js'

// Tabelas cuja chave primária já é um UUID (iguais em todos os aparelhos).
const TABELAS_UUID = ['produtos', 'receitas', 'producoes', 'cardapio_pedidos']

// Ligações numéricas: tabela → { campo: tabelaPai }. Pais antes de filhos.
const FKS = {
  cad_clientes: { lojaId: 'cad_lojas' },
  cad_fiados: { clienteId: 'cad_clientes', lojaId: 'cad_lojas' },
}
const ORDEM_PAIS_PRIMEIRO = ['cad_lojas', 'cad_clientes', 'cad_fiados']

const centavos = (n) => Math.round((Number(n) || 0) * 100) / 100

// Recalcula o que é derivado depois de juntar dois registros alterados nos
// dois aparelhos. Ex.: duas pessoas receberam parcelas diferentes da MESMA
// compra → a lista de pagamentos é a união das duas, mas o saldo (um número)
// não pode ser escolhido de um lado: é o total menos tudo que foi pago.
const RECONCILIAR = {
  cad_fiados(r) {
    if (!Array.isArray(r.pagamentos) || !Number.isFinite(Number(r.total))) return r
    const pago = r.pagamentos.reduce((s, p) => s + (Number(p?.valor) || 0), 0)
    r.saldo = centavos(Math.max(0, Number(r.total) - pago))
    r.status = r.saldo <= 0.01 ? 'pago' : 'aberto'
    if (r.status === 'aberto') r.pagoEm = null
    else if (!r.pagoEm) {
      const ultimo = [...r.pagamentos].reverse().find(p => p?.criadoEm)
      r.pagoEm = ultimo?.criadoEm || null
    }
    return r
  },
}

// ── igualdade e utilidades ───────────────────────────────────────────────
const ehObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Date)

export function igual(a, b) {
  if (a === b) return true
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!igual(a[i], b[i])) return false
    return true
  }
  if (ehObj(a) && ehObj(b)) {
    const ka = Object.keys(a).filter(k => a[k] !== undefined)
    const kb = Object.keys(b).filter(k => b[k] !== undefined)
    if (ka.length !== kb.length) return false
    for (const k of ka) if (!igual(a[k], b[k])) return false
    return true
  }
  return Number.isNaN(a) && Number.isNaN(b)
}

function estavel(x) {
  if (x instanceof Date) return `d:${x.getTime()}`
  if (Array.isArray(x)) return `[${x.map(estavel).join(',')}]`
  if (ehObj(x)) {
    return `{${Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${estavel(x[k])}`).join(',')}}`
  }
  return JSON.stringify(x) ?? 'undefined'
}

// ── merge de valores ─────────────────────────────────────────────────────
function chaveItem(it) {
  if (ehObj(it)) {
    if (it.uid != null) return `uid:${it.uid}`
    if (it.uuid != null) return `uuid:${it.uuid}`
    if (it.id != null) return `id:${it.id}`
    if (it.criadoEm) return `c:${it.criadoEm}`
    return `h:${estavel(it)}`
  }
  return `p:${estavel(it)}`
}

function mapaPorChave(arr) {
  const m = new Map()
  for (const it of arr) {
    const k = chaveItem(it)
    if (m.has(k)) return null // chave repetida: não dá pra identificar itens
    m.set(k, it)
  }
  return m
}

// Lista de itens com identidade (pagamentos, itens de venda, ingredientes…):
// cada item é mesclado pela própria chave — adicionar de um lado e editar de
// outro não conflita; remover de um lado só vale se o outro não mexeu nele.
function mesclarLista(b, l, r, ctx) {
  const mb = mapaPorChave(Array.isArray(b) ? b : [])
  const ml = mapaPorChave(l)
  const mr = mapaPorChave(r)
  if (!mb || !ml || !mr) return null
  const ordem = [...ml.keys(), ...[...mr.keys()].filter(k => !ml.has(k))]
  const out = []
  for (const k of ordem) {
    const m = mesclarValor(mb.get(k), ml.get(k), mr.get(k), ctx)
    if (m !== undefined) out.push(m)
  }
  // Pagamentos, estornos etc.: em ordem cronológica (e igual nos dois aparelhos).
  if (out.length > 1 && out.every(it => ehObj(it) && typeof it.criadoEm === 'string')) {
    out.sort((x, y) => (x.criadoEm < y.criadoEm ? -1 : x.criadoEm > y.criadoEm ? 1 : 0))
  }
  return out
}

function mesclarValor(b, l, r, ctx) {
  if (igual(l, r)) return l
  if (igual(b, l)) return r // só o remoto mexeu
  if (igual(b, r)) return l // só o local mexeu
  if (l === undefined) return r // apagado aqui, alterado lá → fica a alteração
  if (r === undefined) return l
  if (ehObj(l) && ehObj(r)) {
    const bb = ehObj(b) ? b : {}
    const out = {}
    const chaves = new Set([...Object.keys(bb), ...Object.keys(l), ...Object.keys(r)])
    for (const k of chaves) {
      const m = mesclarValor(bb[k], l[k], r[k], ctx)
      if (m !== undefined) out[k] = m
    }
    return out
  }
  if (Array.isArray(l) && Array.isArray(r)) {
    const m = mesclarLista(b, l, r, ctx)
    if (m) return m
  }
  // Mesmo campo alterado nos dois aparelhos, sem como juntar: vale o mais recente.
  ctx.conflitos++
  return ctx.preferirLocal ? l : r
}

// ── normalização (trabalha em "espaço de uid") ──────────────────────────
function uidDe(tabela, r) {
  if (TABELAS_UUID.includes(tabela)) return r.uuid
  if (tabela === 'financeiro' && r.hash_duplicidade) return `h:${r.hash_duplicidade}`
  return r.uid || uidLegado(tabela, r)
}

// Só tabelas que o merge conhece. Qualquer outra (futura) é repassada como
// está no local, em vez de arriscar descartar linhas que não sabe identificar.
function nomesDeTabelas() {
  return [...TABELAS_UUID, ...TABELAS_COM_UID]
}

function normalizar(snap, tabelas) {
  const tab = {}
  const idParaUid = {}
  for (const nome of tabelas) {
    const rows = Array.isArray(snap?.[nome]) ? snap[nome] : []
    const m = new Map()
    const ids = new Map()
    const comUid = TABELAS_COM_UID.includes(nome)
    for (const r of rows) {
      if (!r) continue
      const uid = uidDe(nome, r)
      if (uid == null) continue
      if (comUid && r.id != null) ids.set(r.id, uid)
      m.set(uid, r)
    }
    tab[nome] = m
    idParaUid[nome] = ids
  }
  // ids numéricos → uid nas ligações; o próprio id/uid sai do registro
  for (const nome of tabelas) {
    if (!TABELAS_COM_UID.includes(nome)) continue
    for (const [uid, r] of tab[nome]) {
      const c = { ...r }
      delete c.id
      delete c.uid
      for (const [campo, pai] of Object.entries(FKS[nome] || {})) {
        if (c[campo] != null) c[campo] = idParaUid[pai]?.get(c[campo]) ?? `?${c[campo]}`
      }
      tab[nome].set(uid, c)
    }
  }
  const config = new Map()
  for (const row of Array.isArray(snap?.config) ? snap.config : []) {
    if (row?.chave != null) config.set(row.chave, row.valor)
  }
  return { tab, config, idParaUid }
}

// ── API ──────────────────────────────────────────────────────────────────
/**
 * @param base   dados da última sincronização (mesmo formato de exportarDados) ou null
 * @param local  dados deste aparelho
 * @param remote dados do Drive (podem ter ids de outro aparelho)
 * @param preferirLocal  em conflito de um mesmo campo, vale o local?
 * @returns { dados, igualAoLocal, igualAoRemoto, resumo }
 *   `dados` está no espaço de ids DESTE aparelho (ids existentes preservados).
 */
export function mesclar({ base, local, remote, preferirLocal = false }) {
  const tabelas = nomesDeTabelas()
  const B = normalizar(base || {}, tabelas)
  const L = normalizar(local, tabelas)
  const R = normalizar(remote, tabelas)
  const ctx = { conflitos: 0, preferirLocal }

  // 1) merge registro a registro, por uid
  const M = {}
  for (const nome of tabelas) {
    const out = new Map()
    const uids = new Set([...B.tab[nome].keys(), ...L.tab[nome].keys(), ...R.tab[nome].keys()])
    for (const uid of [...uids].sort()) {
      const b = B.tab[nome].get(uid), l = L.tab[nome].get(uid), r = R.tab[nome].get(uid)
      let m = mesclarValor(b, l, r, ctx)
      const ambosMudaram = l !== undefined && r !== undefined && !igual(l, r) && !igual(b, l) && !igual(b, r)
      if (m !== undefined && ambosMudaram && RECONCILIAR[nome]) m = RECONCILIAR[nome]({ ...m })
      if (m !== undefined) out.set(uid, m)
    }
    M[nome] = out
  }

  // 2) integridade: filho nunca fica sem pai. Pai apagado de um lado mas ainda
  //    usado por um registro que sobrou volta (a versão mais nova que existir).
  let ressuscitados = 0
  for (const filho of [...ORDEM_PAIS_PRIMEIRO].reverse()) {
    for (const [campo, pai] of Object.entries(FKS[filho] || {})) {
      for (const r of M[filho].values()) {
        const uidPai = r[campo]
        if (uidPai == null || String(uidPai).startsWith('?') || M[pai].has(uidPai)) continue
        const cand = L.tab[pai].get(uidPai) ?? R.tab[pai].get(uidPai) ?? B.tab[pai].get(uidPai)
        if (cand) { M[pai].set(uidPai, cand); ressuscitados++ }
      }
    }
  }

  // 3) config: valor por chave, mesmo merge
  const cfg = new Map()
  for (const chave of [...new Set([...B.config.keys(), ...L.config.keys(), ...R.config.keys()])].sort()) {
    const m = mesclarValor(B.config.get(chave), L.config.get(chave), R.config.get(chave), ctx)
    if (m !== undefined) cfg.set(chave, m)
  }

  // comparações em espaço de uid (ids de aparelhos diferentes não são comparáveis)
  const mesmo = (X) => tabelas.every(n => igual([...M[n].entries()].sort(), [...X.tab[n].entries()].sort())) &&
    igual([...cfg.entries()].sort(), [...X.config.entries()].sort())
  const igualAoLocal = mesmo(L)
  const igualAoRemoto = mesmo(R)

  // 4) volta pros ids deste aparelho
  const dados = {}
  const idPorUid = {}
  for (const nome of ORDEM_PAIS_PRIMEIRO.concat(tabelas.filter(n => !ORDEM_PAIS_PRIMEIRO.includes(n)))) {
    if (!tabelas.includes(nome)) continue
    if (!TABELAS_COM_UID.includes(nome)) {
      dados[nome] = [...M[nome].values()].map(r => ({ ...r }))
      continue
    }
    const idsLocais = new Map()
    let max = 0
    for (const [id, uid] of L.idParaUid[nome] ? [...L.idParaUid[nome].entries()] : []) {
      idsLocais.set(uid, id)
      if (typeof id === 'number' && id > max) max = id
    }
    const ids = new Map()
    for (const uid of M[nome].keys()) {
      ids.set(uid, idsLocais.has(uid) ? idsLocais.get(uid) : ++max)
    }
    idPorUid[nome] = ids
    const rows = []
    for (const [uid, r] of M[nome]) {
      const c = { ...r, id: ids.get(uid), uid }
      for (const [campo, pai] of Object.entries(FKS[nome] || {})) {
        const v = c[campo]
        if (v == null) continue
        const s = String(v)
        c[campo] = s.startsWith('?') ? (isNaN(Number(s.slice(1))) ? s.slice(1) : Number(s.slice(1))) : (idPorUid[pai]?.get(v) ?? v)
      }
      rows.push(c)
    }
    dados[nome] = rows.sort((a, b) => a.id - b.id)
  }
  dados.config = [...cfg.entries()].map(([chave, valor]) => ({ chave, valor }))
  for (const k of Object.keys(local || {})) {
    if (k !== 'config' && !tabelas.includes(k)) dados[k] = local[k]
  }

  const contar = (X) => tabelas.reduce((s, n) => s + X.tab[n].size, 0)
  return {
    dados,
    igualAoLocal,
    igualAoRemoto,
    resumo: {
      conflitos: ctx.conflitos,
      ressuscitados,
      registrosLocal: contar(L),
      registrosRemoto: contar(R),
      registrosMesclado: tabelas.reduce((s, n) => s + M[n].size, 0),
    },
  }
}
