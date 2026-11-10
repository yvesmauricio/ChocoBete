// services/filaOperacoes.js
// Fila de envio da Caderneta (servidor = fonte única da verdade).
//
// O app NÃO decide saldo nem status: ele grava a OPERAÇÃO ("recebi R$ 20 da venda X") neste aparelho,
// mostra "N alterações aguardando" e envia quando houver sinal. Quem aplica (ou recusa) é o servidor.
//   · offline: enfileirar() grava na hora e nunca falha por falta de internet;
//   · reenvio seguro: cada operação tem um op_id; se o sinal cair depois de o servidor aplicar, o reenvio
//     devolve "duplicada" e nada é lançado duas vezes;
//   · recusa não some: uma operação que o servidor recusa fica visível (com o motivo) até a pessoa dispensar;
//   · não há token no aparelho: o login é o do Cloudflare Access (cookie da mesma origem).
//
// Fica num banco próprio (`chocobeteFila`), de propósito fora do chocobeteDB_v2: assim não entra no
// backup/merge do Drive (é estado deste aparelho) e não exige mexer no esquema atual.
import Dexie from 'dexie'

export const filaDb = new Dexie('chocobeteFila')
filaDb.version(1).stores({
  fila: '++seq, &op_id, estado',            // estado: 'pendente' | 'rejeitada'
  espelho: '[tabela+uid], tabela',         // cópia de leitura do que o servidor mandou
  meta: 'chave',                           // cursor da leitura incremental
})

const TAMANHO_LOTE = 50
const TIPOS_FINAIS = new Set(['aplicada', 'duplicada'])

// Estado observável (objeto simples; a tela usa useFilaOps() para torná-lo reativo)
export const estadoFila = { pendentes: 0, rejeitadas: [], enviando: false, semLogin: false, ultimoErro: '' }
const ouvintes = new Set()
const avisar = () => ouvintes.forEach(fn => { try { fn({ ...estadoFila }) } catch { /* ouvinte com erro não derruba a fila */ } })
export const aoMudarFila = (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn) }

export async function recontar() {
  estadoFila.pendentes = await filaDb.fila.where('estado').equals('pendente').count()
  estadoFila.rejeitadas = await filaDb.fila.where('estado').equals('rejeitada').toArray()
  avisar()
}

const novoId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `op-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`)
export const novoUid = novoId // uid de registro novo (venda, pagamento, estorno…) gerado no aparelho

let aparelho = ''
export const definirAparelho = (nome) => { aparelho = String(nome || '').slice(0, 60) }

/** Grava a operação neste aparelho (sempre funciona, com ou sem internet) e tenta enviar. Retorna a operação. */
export async function enfileirar(tipo, dados) {
  const op = { op_id: novoId(), tipo, dados: JSON.parse(JSON.stringify(dados)), criado_no_aparelho: Date.now(), estado: 'pendente', motivo: null, tentativas: 0 }
  await filaDb.fila.add(op)
  await recontar()
  descarregar().catch(() => {})
  return op
}

let emAndamento = null
let fetchImpl = (...a) => fetch(...a)
export const _usarFetch = (fn) => { fetchImpl = fn } // só para testes

/** Envia o que está pendente, em ordem. Seguro de chamar de vários lugares ao mesmo tempo. Nunca lança. */
export function descarregar() {
  if (emAndamento) return emAndamento
  emAndamento = (async () => {
    estadoFila.enviando = true; avisar()
    try {
      for (;;) {
        const lote = await filaDb.fila.where('estado').equals('pendente').sortBy('seq')
        if (!lote.length) { estadoFila.ultimoErro = ''; estadoFila.semLogin = false; break }
        const envio = lote.slice(0, TAMANHO_LOTE)
        let resp
        try {
          resp = await fetchImpl('/api/caderneta/ops', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aparelho, ops: envio.map(({ op_id, tipo, dados, criado_no_aparelho }) => ({ op_id, tipo, dados, criado_no_aparelho })) }),
          })
        } catch { estadoFila.ultimoErro = 'Sem conexão. As alterações continuam guardadas neste aparelho.'; break }
        if (resp.status === 401 || resp.status === 403) { estadoFila.semLogin = true; estadoFila.ultimoErro = 'Faça login de novo para enviar.'; break }
        let corpo = null
        try { corpo = await resp.json() } catch { /* servidor fora do ar */ }
        if (!corpo || !Array.isArray(corpo.resultados)) { estadoFila.ultimoErro = 'O servidor não respondeu. Vamos tentar de novo.'; break }

        let progresso = false
        for (const r of corpo.resultados) {
          const op = envio.find(o => o.op_id === r.op_id)
          if (!op) continue
          if (r.status === 'aplicada' || (r.status === 'duplicada' && r.resultado !== 'rejeitada')) { await filaDb.fila.delete(op.seq); progresso = true }
          else if (r.status === 'rejeitada' || r.status === 'duplicada') { await filaDb.fila.update(op.seq, { estado: 'rejeitada', motivo: r.motivo || 'Recusada pelo servidor.' }); progresso = true }
          else { await filaDb.fila.update(op.seq, { tentativas: (op.tentativas || 0) + 1 }) } // tentar_de_novo
        }
        await recontar()
        if (!progresso || corpo.erro) { if (corpo.erro) estadoFila.ultimoErro = 'Falha temporária no servidor. Vamos tentar de novo.'; break }
      }
    } finally { estadoFila.enviando = false; await recontar() }
    return { ...estadoFila }
  })().finally(() => { emAndamento = null })
  return emAndamento
}

/** Dispensa uma operação recusada (depois que a pessoa viu o motivo). Só some da lista de avisos. */
export async function dispensarRejeitada(op_id) {
  await filaDb.fila.where('op_id').equals(op_id).delete()
  await recontar()
}

// ───────────────────────── leitura: o que o servidor tem ─────────────────────────
const TABELAS = ['lojas', 'clientes', 'vendas', 'pagamentos', 'estornos']

/** Traz as mudanças do servidor desde o último cursor e guarda no espelho. O cursor só avança depois de gravar. */
export async function puxarEstado() {
  let cursor = (await filaDb.meta.get('cursor_caderneta'))?.valor || 0
  let alteradas = 0
  for (let volta = 0; volta < 20; volta++) {
    let corpo
    try {
      const r = await fetchImpl(`/api/caderneta/estado?desde=${cursor}`, { credentials: 'same-origin' })
      if (!r.ok) break
      corpo = await r.json()
    } catch { break }
    await filaDb.transaction('rw', filaDb.espelho, filaDb.meta, async () => {
      for (const t of TABELAS) for (const row of corpo[t] || []) await filaDb.espelho.put({ tabela: t, uid: row.uid, ...row })
      // itens vêm junto da venda: guardados dentro dela, sem tabela própria
      const porVenda = new Map()
      for (const it of corpo.itens || []) { if (!porVenda.has(it.venda_uid)) porVenda.set(it.venda_uid, []); porVenda.get(it.venda_uid).push(it) }
      for (const [vuid, itens] of porVenda) {
        const v = await filaDb.espelho.get(['vendas', vuid])
        if (v) await filaDb.espelho.put({ ...v, itens })
      }
      await filaDb.meta.put({ chave: 'cursor_caderneta', valor: corpo.cursor })
    })
    alteradas += TABELAS.reduce((s, t) => s + (corpo[t]?.length || 0), 0)
    cursor = corpo.cursor
    if (!corpo.mais) break
  }
  return { cursor, alteradas }
}

// ───────────────────────── gatilhos automáticos ─────────────────────────
/** Envia ao voltar o sinal, ao reabrir o app e de tempos em tempos. Retorna função que desliga tudo. */
export function iniciarFila({ intervaloMs = 30_000, aparelho: nome = '', aposPuxar = null } = {}) {
  definirAparelho(nome)
  const rodar = () => { if (typeof navigator !== 'undefined' && navigator.onLine === false) return; descarregar().then(() => puxarEstado()).then(r => aposPuxar?.(r)).catch(() => {}) }
  const aoVoltar = () => { if (document.visibilityState === 'visible') rodar() }
  const timer = setInterval(rodar, intervaloMs)
  const inicio = setTimeout(rodar, 1500)
  recontar().catch(() => {})
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('online', rodar)
  return () => { clearInterval(timer); clearTimeout(inicio); document.removeEventListener('visibilitychange', aoVoltar); window.removeEventListener('online', rodar) }
}
