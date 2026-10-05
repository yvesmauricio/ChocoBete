// composables/useCaderneta.js
// Lógica da Caderneta (fiados) integrada ao banco Dexie do Receitas
// Usa as tabelas cad_lojas, cad_clientes, cad_fiados do mesmo banco.

import { db } from '../db.js'

// ── Helpers ──────────────────────────────────────────────────
export const hoje = () => new Date().toLocaleDateString('sv')
export const horaAtual = () => new Date().toTimeString().slice(0, 5)

export function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function fmtBR(raw) {
  if (!raw) return '--/--'
  const b = String(raw).split('T')[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(b) ? b.split('-').reverse().join('/') : '--/--'
}
export function fmtHora(raw) {
  return /^\d{2}:\d{2}/.test(String(raw || '')) ? String(raw).slice(0, 5) : ''
}
export function iniciais(nome) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
export function normalizar(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── Valores em centavos ───────────────────────────────────────
// Evita sobra de centavos de ponto flutuante (ex.: 0.1 + 0.2 = 0.30000000000000004).
export const centavos = v => Math.round((Number(v) || 0) * 100) / 100

// ── Comparação de nomes e telefones ──────────────────────────
// Nome "comparável": sem acento, caixa e espaços repetidos.
const chaveNome = v => normalizar(v).replace(/\s+/g, ' ').trim()

function digitosTelefone(v) {
  let d = String(v || '').replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  return d
}

// Telefone "comparável": DDD + últimos 8 dígitos. Assim "(21) 99943-0023" e
// "(21) 9943-0023" (com e sem o nono dígito) são reconhecidos como o mesmo número.
export function chaveTelefone(v) {
  const d = digitosTelefone(v)
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d
}

/** '' se o telefone é válido (ou vazio); senão a mensagem de erro. */
export function validarTelefone(v) {
  const d = digitosTelefone(v)
  if (!d) return ''
  if (d.length !== 10 && d.length !== 11) return 'Telefone incompleto. Use o DDD + número (10 ou 11 dígitos).'
  if (d[0] === '0' || d[1] === '0') return 'DDD inválido.'
  if (d.length === 11 && d[2] !== '9') return 'Celular com 11 dígitos precisa começar com 9 depois do DDD.'
  return ''
}

// ── LOJAS ────────────────────────────────────────────────────
// "Arquivada" = some das listas, mas o histórico e as cobranças continuam.
export async function getLojas({ incluirArquivadas = false } = {}) {
  const todas = await db.cad_lojas.orderBy('nome').toArray()
  return incluirArquivadas ? todas : todas.filter(l => !l.arquivado)
}

/** Loja com o mesmo nome (inclui arquivadas), ignorando `idIgnorar`. */
export async function acharLojaDuplicada(nome, idIgnorar = null) {
  const chave = chaveNome(nome)
  if (!chave) return null
  const lojas = await db.cad_lojas.toArray()
  return lojas.find(l => l.id !== idIgnorar && chaveNome(l.nome) === chave) || null
}

/** Salva a loja checando duplicidade dentro da mesma transação (à prova de clique duplo)
 *  e propaga o novo nome para as vendas já lançadas. */
export async function salvarLojaValidada(obj) {
  return db.transaction('rw', db.cad_lojas, db.cad_fiados, async () => {
    const atual = obj.id != null ? await db.cad_lojas.get(obj.id) : null
    const final = { ...(atual || {}), ...obj }
    const dup = await acharLojaDuplicada(final.nome, final.id ?? null)
    if (dup) return { ok: false, dup }
    const id = await db.cad_lojas.put(final)
    if (final.id != null) {
      await db.cad_fiados.where('lojaId').equals(id).modify({ lojaNome: final.nome })
    }
    return { ok: true, id }
  })
}

export async function resumoLoja(id) {
  const clientes = await db.cad_clientes.where('lojaId').equals(id).count()
  const fiados = await db.cad_fiados.where('lojaId').equals(id).toArray()
  const abertos = fiados.filter(f => f.status === 'aberto')
  return {
    clientes,
    vendas: fiados.length,
    abertas: abertos.length,
    saldo: centavos(abertos.reduce((s, f) => s + Number(f.saldo || 0), 0)),
  }
}

export async function arquivarLoja(id, arquivar = true) {
  await db.cad_lojas.update(id, arquivar ? { arquivado: true, arquivadoEm: new Date().toISOString() } : { arquivado: false, arquivadoEm: null })
}

/** Exclusão definitiva: só para loja sem clientes e sem vendas. Do contrário, arquive. */
export async function excluirLoja(id) {
  return db.transaction('rw', db.cad_lojas, db.cad_clientes, db.cad_fiados, async () => {
    const [nClientes, nFiados] = await Promise.all([
      db.cad_clientes.where('lojaId').equals(id).count(),
      db.cad_fiados.where('lojaId').equals(id).count(),
    ])
    if (nClientes || nFiados) throw new Error('LOJA_COM_HISTORICO')
    await db.cad_lojas.delete(id)
  })
}

// ── CLIENTES ─────────────────────────────────────────────────
export async function getClientes(lojaId, { incluirArquivados = false } = {}) {
  const todos = await db.cad_clientes.where('lojaId').equals(lojaId).sortBy('nome')
  return incluirArquivados ? todos : todos.filter(c => !c.arquivado)
}
export async function getTodosClientes() {
  return db.cad_clientes.toArray()
}

/** Cliente já cadastrado (em QUALQUER loja, inclusive arquivado) com o mesmo telefone.
 *  Sem telefone, só considera duplicado o mesmo nome dentro da mesma loja. */
export async function acharClienteDuplicado({ nome, telefone, lojaId }, idIgnorar = null) {
  const tel = chaveTelefone(telefone)
  const todos = (await db.cad_clientes.toArray()).filter(c => c.id !== idIgnorar)
  if (tel) {
    const porTel = todos.find(c => chaveTelefone(c.telefone) === tel)
    return porTel ? { cliente: porTel, motivo: 'telefone' } : null
  }
  const chave = chaveNome(nome)
  const porNome = todos.find(c => c.lojaId === lojaId && chaveNome(c.nome) === chave)
  return porNome ? { cliente: porNome, motivo: 'nome' } : null
}

/** Salva (ou edita) o cliente. Tudo numa transação: confere duplicidade, grava,
 *  atualiza o nome nas vendas e — se mudou de loja e `moverAbertos` — leva junto
 *  as vendas em aberto. Vendas já pagas ficam na loja onde aconteceram. */
export async function salvarClienteValidado(obj, { moverAbertos = false } = {}) {
  return db.transaction('rw', db.cad_clientes, db.cad_fiados, db.cad_lojas, async () => {
    const atual = obj.id != null ? await db.cad_clientes.get(obj.id) : null
    const final = { ...(atual || {}), ...obj }
    const dup = await acharClienteDuplicado(final, final.id ?? null)
    if (dup) return { ok: false, dup }
    const id = await db.cad_clientes.put(final)
    if (atual) {
      if (atual.nome !== final.nome) {
        await db.cad_fiados.where('clienteId').equals(id).modify({ clienteNome: final.nome })
      }
      if (moverAbertos && atual.lojaId !== final.lojaId) {
        const loja = await db.cad_lojas.get(final.lojaId)
        await db.cad_fiados.where('clienteId').equals(id)
          .filter(f => f.status === 'aberto')
          .modify({ lojaId: final.lojaId, lojaNome: loja?.nome || '' })
      }
    }
    return { ok: true, id }
  })
}

export async function resumoCliente(id) {
  const fiados = await db.cad_fiados.where('clienteId').equals(id).toArray()
  const abertos = fiados.filter(f => f.status === 'aberto')
  return {
    vendas: fiados.length,
    abertas: abertos.length,
    saldo: centavos(abertos.reduce((s, f) => s + Number(f.saldo || 0), 0)),
  }
}

export async function arquivarCliente(id, arquivar = true) {
  await db.cad_clientes.update(id, arquivar ? { arquivado: true, arquivadoEm: new Date().toISOString() } : { arquivado: false, arquivadoEm: null })
}

/** Exclusão definitiva: só para cliente sem nenhuma venda. Do contrário, arquive. */
export async function excluirCliente(id) {
  return db.transaction('rw', db.cad_clientes, db.cad_fiados, async () => {
    const n = await db.cad_fiados.where('clienteId').equals(id).count()
    if (n) throw new Error('CLIENTE_COM_HISTORICO')
    await db.cad_clientes.delete(id)
  })
}

// ── CADASTROS REPETIDOS (já existentes) ──────────────────────
/** Agrupa lojas com mesmo nome e clientes com mesmo telefone, com contagem de vendas. */
export async function listarDuplicados() {
  const [lojas, clientes, fiados] = await Promise.all([
    db.cad_lojas.toArray(), db.cad_clientes.toArray(), db.cad_fiados.toArray(),
  ])
  const vendasPorCliente = {}, vendasPorLoja = {}
  fiados.forEach(f => {
    vendasPorCliente[f.clienteId] = (vendasPorCliente[f.clienteId] || 0) + 1
    vendasPorLoja[f.lojaId] = (vendasPorLoja[f.lojaId] || 0) + 1
  })
  const nomeLoja = Object.fromEntries(lojas.map(l => [l.id, l.nome]))
  const agrupar = (lista, chaveFn) => {
    const mapa = new Map()
    lista.forEach(i => { const k = chaveFn(i); if (k) mapa.set(k, [...(mapa.get(k) || []), i]) })
    return [...mapa.values()].filter(g => g.length > 1)
  }
  return {
    lojas: agrupar(lojas, l => chaveNome(l.nome))
      .map(g => g.map(l => ({ ...l, vendas: vendasPorLoja[l.id] || 0 }))),
    clientes: agrupar(clientes, c => chaveTelefone(c.telefone))
      .map(g => g.map(c => ({ ...c, lojaNome: nomeLoja[c.lojaId] || '—', vendas: vendasPorCliente[c.id] || 0 }))),
  }
}

/** Junta cadastros de cliente: todas as vendas dos `removerIds` passam para `manterId`
 *  (cada venda continua na loja em que foi feita) e os cadastros repetidos são excluídos. */
export async function juntarClientes(manterId, removerIds) {
  return db.transaction('rw', db.cad_clientes, db.cad_fiados, async () => {
    const manter = await db.cad_clientes.get(manterId)
    if (!manter) throw new Error('CLIENTE_NAO_ENCONTRADO')
    for (const id of removerIds.filter(i => i !== manterId)) {
      await db.cad_fiados.where('clienteId').equals(id).modify({ clienteId: manterId, clienteNome: manter.nome })
      await db.cad_clientes.delete(id)
    }
  })
}

/** Junta lojas: clientes e vendas dos `removerIds` passam para `manterId`. */
export async function juntarLojas(manterId, removerIds) {
  return db.transaction('rw', db.cad_lojas, db.cad_clientes, db.cad_fiados, async () => {
    const manter = await db.cad_lojas.get(manterId)
    if (!manter) throw new Error('LOJA_NAO_ENCONTRADA')
    for (const id of removerIds.filter(i => i !== manterId)) {
      await db.cad_clientes.where('lojaId').equals(id).modify({ lojaId: manterId })
      await db.cad_fiados.where('lojaId').equals(id).modify({ lojaId: manterId, lojaNome: manter.nome })
      await db.cad_lojas.delete(id)
    }
  })
}

// ── FIADOS ───────────────────────────────────────────────────

// Carrega TODOS os fiados (histórico completo) — use apenas em modo histórico
export async function getFiados() {
  return db.cad_fiados.toArray()
}

// Carrega apenas fiados abertos usando índice — rápido independente do volume total
export async function getFiadosAbertos() {
  return db.cad_fiados.where('status').equals('aberto').toArray()
}

// Alertas do dia: usa índice dataVenc — não carrega tabela inteira
export async function getFiadosVencendoHoje() {
  const hj = hoje()
  return db.cad_fiados
    .where('dataVenc').equals(hj)
    .filter(f => f.saldo > 0.01)
    .toArray()
}

export async function salvarFiado(obj) {
  return db.cad_fiados.put(obj)
}
export async function atualizarFiado(id, changes) {
  const atual = await db.cad_fiados.get(id)
  if (!atual) return
  // `changes` pode vir de dados reativos do Vue (ex.: um fiado lido da tela
  // e reenviado depois de aplicarPagamento). Objetos reativos (Proxy) não
  // podem ser gravados direto no IndexedDB — o navegador não consegue
  // clonar um Proxy (erro "DataCloneError"). Por isso sempre "achatamos"
  // pra dado puro antes de salvar.
  const changesPuras = JSON.parse(JSON.stringify(changes))
  await db.cad_fiados.put({ ...atual, ...changesPuras })
}
export async function excluirFiado(id) {
  return db.cad_fiados.delete(id)
}

// ── RESUMO / STATS ───────────────────────────────────────────
// Usa getFiadosAbertos() — consulta por índice, não full scan
export async function getStats() {
  const abertos = await getFiadosAbertos()
  const hj = hoje()
  return {
    totalAberto:  centavos(abertos.reduce((s, f) => s + f.saldo, 0)),
    totalVencido: centavos(abertos
      .filter(f => f.dataVenc && f.dataVenc < hj)
      .reduce((s, f) => s + f.saldo, 0)),
    qtdAbertos: abertos.length,
  }
}

// ── PAGAMENTO ────────────────────────────────────────────────
export function dadosPagamento(valor, saldoAntes, saldoDepois) {
  return {
    valor,
    data: hoje(),
    hora: horaAtual(),
    saldoAntes,
    saldoDepois,
    criadoEm: new Date().toISOString()
  }
}
export function aplicarPagamento(fiado, pago) {
  pago = centavos(Math.min(Number(pago) || 0, fiado.saldo))
  const novoSaldo = centavos(Math.max(0, fiado.saldo - pago))
  const pagamentos = [...(fiado.pagamentos || []), dadosPagamento(pago, fiado.saldo, novoSaldo)]
  const quitado = novoSaldo <= 0.01
  return {
    saldo: novoSaldo,
    status: quitado ? 'pago' : 'aberto',
    pagamentos,
    pagoEm: quitado ? new Date().toISOString() : (fiado.pagoEm || null)
  }
}

// ── TAXAS (config caderneta) ───────────────────────────────────
const CHAVE_TAXAS = 'cad_taxas'

export async function getTaxas() {
  const row = await db.config.get(CHAVE_TAXAS).catch(() => null)
  return row?.valor || { debito: 2.98, credito_avista: 6.17 }
}

export async function salvarTaxas(t) {
  await db.config.put({ chave: CHAVE_TAXAS, valor: t })
}

// ── PREÇOS POR CATEGORIA (Nova Venda simplificada) ─────────────
// Cada categoria (Trufa, Cone, Barra, Bolo, Torta, Brownie) tem um preço
// único, independente do sabor. Fica no mesmo `config` do banco, então
// entra no backup/sync junto com o resto.
const CHAVE_PRECOS_CAT = 'cad_precos_categorias'

export async function getPrecosCategorias() {
  const row = await db.config.get(CHAVE_PRECOS_CAT).catch(() => null)
  return row?.valor || {}
}

export async function salvarPrecosCategorias(precos) {
  await db.config.put({ chave: CHAVE_PRECOS_CAT, valor: JSON.parse(JSON.stringify(precos)) })
}

// ── RESUMO ITENS ─────────────────────────────────────────────
export function resumoItens(itens) {
  if (!itens?.length) return ''
  return itens.map(i => {
    const emoji = i.emoji || '📦'
    return `${emoji} ${i.qtd || i.qty || 0}x ${i.nome}`
  }).join('\n')
}