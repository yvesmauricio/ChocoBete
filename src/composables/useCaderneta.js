// composables/useCaderneta.js
// Lógica da Caderneta (fiados) integrada ao banco Dexie do Receitas
// Usa as tabelas cad_lojas, cad_clientes, cad_fiados do mesmo banco.

import { liveQuery } from 'dexie'
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

/** Prévia do que uma renomeação vai tocar — usada nos avisos da tela, ANTES de gravar. */
export async function previaRenomearLoja(id, novoNome) {
  const atual = id != null ? await db.cad_lojas.get(id) : null
  const nome = String(novoNome || '').trim().replace(/\s+/g, ' ')
  const dup = nome ? await acharLojaDuplicada(nome, id ?? null) : null
  const mudou = !!atual && nome !== atual.nome
  const r = atual ? await resumoLoja(id) : { clientes: 0, vendas: 0, abertas: 0, saldo: 0 }
  return { atual, mudou, dup, ...r }
}

// Histórico das renomeações (fica em `config`, então entra no backup/sync).
const CHAVE_LOG_RENOMEACAO = 'cad_log_renomeacao_loja'
const LOG_RENOMEACAO_MAX = 30

export async function getLogRenomeacoesLoja() {
  const row = await db.config.get(CHAVE_LOG_RENOMEACAO).catch(() => null)
  return Array.isArray(row?.valor) ? row.valor : []
}

const somaSaldos = lista => centavos(lista.reduce((t, f) => t + Number(f.saldo || 0), 0))

/** Salva a loja (nova ou edição) com todas as travas, numa ÚNICA transação:
 *  1. nome vazio é recusado;
 *  2. nome repetido (sem acento/caixa/espaços, inclusive loja arquivada) é recusado;
 *  3. ao renomear, o novo nome é copiado para TODAS as vendas da loja (abertas e pagas);
 *  4. antes de concluir, confere que nenhuma venda sumiu, que a soma dos saldos continua
 *     igual e que todas as vendas da loja ficaram com o nome novo. Se qualquer conferência
 *     falhar, lança erro e o banco volta ao estado anterior (nada é gravado pela metade);
 *  5. registra a renomeação no histórico (de → para, quantas vendas).
 *  Só o campo `lojaNome` das vendas é tocado — valores, saldos, vencimentos e pagamentos não. */
export async function salvarLojaValidada(obj) {
  return db.transaction('rw', db.cad_lojas, db.cad_fiados, db.config, async () => {
    const atual = obj.id != null ? await db.cad_lojas.get(obj.id) : null
    if (obj.id != null && !atual) throw new Error('LOJA_NAO_ENCONTRADA')
    const final = { ...(atual || {}), ...obj }
    final.nome = String(final.nome || '').trim().replace(/\s+/g, ' ')
    if (!final.nome) throw new Error('NOME_VAZIO')

    const dup = await acharLojaDuplicada(final.nome, final.id ?? null)
    if (dup) return { ok: false, dup }

    const renomeou = !!atual && atual.nome !== final.nome

    // Retrato antes de mexer (só quando há renomeação)
    let antes = null
    if (renomeou) {
      const todos = await db.cad_fiados.toArray()
      const daLoja = todos.filter(f => f.lojaId === final.id)
      antes = { total: todos.length, saldo: somaSaldos(todos), daLoja: daLoja.length }
    }

    const id = await db.cad_lojas.put(final)

    if (renomeou) {
      await db.cad_fiados.where('lojaId').equals(id).modify({ lojaNome: final.nome })

      const depois = await db.cad_fiados.toArray()
      const daLojaDepois = depois.filter(f => f.lojaId === id)
      if (
        depois.length !== antes.total ||
        somaSaldos(depois) !== antes.saldo ||
        daLojaDepois.length !== antes.daLoja ||
        daLojaDepois.some(f => f.lojaNome !== final.nome)
      ) {
        throw new Error('RENOMEACAO_INCONSISTENTE')   // desfaz tudo
      }

      const log = await getLogRenomeacoesLoja()
      log.unshift({
        lojaId: id, de: atual.nome, para: final.nome,
        vendas: antes.daLoja, em: new Date().toISOString(),
      })
      await db.config.put({ chave: CHAVE_LOG_RENOMEACAO, valor: log.slice(0, LOG_RENOMEACAO_MAX) })
    }

    return { ok: true, id, renomeou, vendasAtualizadas: antes?.daLoja || 0 }
  })
}

/** Conserta, sem apagar nada, vendas cujo nome de loja ficou desatualizado (renomeações
 *  feitas antes dessa proteção existir). Só altera `lojaNome`, e só em vendas cuja loja
 *  ainda existe. Devolve quantas vendas foram acertadas. */
export async function reconciliarNomesLojas() {
  return db.transaction('rw', db.cad_lojas, db.cad_fiados, async () => {
    const lojas = await db.cad_lojas.toArray()
    let acertadas = 0
    for (const l of lojas) {
      acertadas += await db.cad_fiados.where('lojaId').equals(l.id)
        .filter(f => f.lojaNome !== l.nome)
        .modify({ lojaNome: l.nome })
    }
    return acertadas
  })
}

/** Nome vigente da loja (cadastro é a fonte da verdade; o nome nas vendas é só cópia). */
export async function getNomesLojas() {
  const lojas = await db.cad_lojas.toArray()
  return Object.fromEntries(lojas.map(l => [l.id, l.nome]))
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

// ── FUNÇÕES (cargo da cliente na loja) ───────────────────────
// Serve só para diferenciar duas clientes com o mesmo nome (ex.: duas "Juliana"
// na mesma loja). Aparece nas listas e Cobranças, mas NUNCA entra nas mensagens
// enviadas por WhatsApp — elas usam apenas o nome.
export const FUNCOES_PADRAO = ['Vendedor(a)', 'Gerente', 'Estoquista']

/** Texto limpo: sem espaços repetidos/nas pontas. */
export const limparFuncao = v => String(v || '').trim().replace(/\s+/g, ' ')

/** Mesma função? (ignora acento, caixa e espaços) */
export const mesmaFuncao = (a, b) => chaveNome(limparFuncao(a)) === chaveNome(limparFuncao(b))

/** Opções para escolher: as padrão + as que as clientes ativas já usam.
 *  Uma função nova digitada fica disponível para as próximas clientes enquanto
 *  alguém a usar; se ninguém mais usar, ela some sozinha (não acumula erro de digitação). */
export async function getFuncoes() {
  const clientes = await db.cad_clientes.toArray()
  const lista = [...FUNCOES_PADRAO]
  clientes.filter(c => !c.arquivado).forEach(c => {
    const f = limparFuncao(c.funcao)
    if (f && !lista.some(x => mesmaFuncao(x, f))) lista.push(f)
  })
  return lista
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
 *  Sem telefone, só considera duplicado o mesmo nome E a mesma função dentro da mesma loja. */
export async function acharClienteDuplicado({ nome, telefone, lojaId, funcao }, idIgnorar = null) {
  const tel = chaveTelefone(telefone)
  const todos = (await db.cad_clientes.toArray()).filter(c => c.id !== idIgnorar)
  if (tel) {
    const porTel = todos.find(c => chaveTelefone(c.telefone) === tel)
    return porTel ? { cliente: porTel, motivo: 'telefone' } : null
  }
  // Duas clientes com o mesmo nome na mesma loja só são "a mesma" se tiverem também a mesma função
  // (ex.: "Juliana · Gerente" e "Juliana · Vendedor(a)" podem coexistir, mesmo sem telefone).
  const chave = chaveNome(nome)
  const porNome = todos.find(c => c.lojaId === lojaId && chaveNome(c.nome) === chave && mesmaFuncao(c.funcao, funcao))
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

// Todos os lançamentos de um cliente (índice clienteId) — usado na tela Nova Venda
// para conferir "já lancei?" e avisar de venda repetida.
export async function getFiadosDoCliente(clienteId) {
  if (clienteId == null) return []
  return db.cad_fiados.where('clienteId').equals(clienteId).toArray()
}

// Carrega apenas fiados abertos usando índice — rápido independente do volume total
export async function getFiadosAbertos() {
  return db.cad_fiados.where('status').equals('aberto').toArray()
}

/** Observa os fiados abertos e avisa `onChange({ [clienteId]: saldoTotal })` na hora e a cada
 *  alteração de saldo (venda nova, pagamento, edição, exclusão, restauração de backup…).
 *  Devolve a função para parar de observar. */
export function observarSaldosClientes(onChange) {
  const sub = liveQuery(() => getFiadosAbertos()).subscribe({
    next: fiados => {
      const bruto = {}
      fiados.forEach(f => {
        if (f.saldo > 0.01) bruto[f.clienteId] = (bruto[f.clienteId] || 0) + Number(f.saldo)
      })
      const mapa = {}
      Object.keys(bruto).forEach(id => { mapa[id] = centavos(bruto[id]) })
      onChange(mapa)
    },
    error: e => console.warn('observarSaldosClientes', e),
  })
  return () => sub.unsubscribe()
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
  // `changes` pode vir de dados reativos do Vue (Proxy), que o IndexedDB não
  // consegue clonar (DataCloneError) — por isso "achatamos" pra dado puro.
  const changesPuras = JSON.parse(JSON.stringify(changes))
  // Leitura + gravação na mesma transação: não pisa numa alteração simultânea
  // (ex.: renomeação de loja acontecendo ao mesmo tempo).
  return db.transaction('rw', db.cad_fiados, async () => {
    const atual = await db.cad_fiados.get(id)
    if (!atual) return
    await db.cad_fiados.put({ ...atual, ...changesPuras })
  })
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
    qtdCompras: await db.cad_fiados.count(),
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

/** Recebe um valor PARCIAL de um cliente que tem várias compras em aberto e reagenda o
 *  restante para outra data.
 *
 *  Garantias de integridade:
 *   • Tudo numa ÚNICA transação: ou grava tudo, ou não grava nada (sem "meio pago").
 *   • Relê os saldos do banco dentro da transação (não confia no que está na tela).
 *   • Reaproveita `aplicarPagamento` — cada compra ganha o mesmo registro de pagamento do
 *     recebimento individual (valor, saldoAntes, saldoDepois, data/hora).
 *   • Abate da compra mais ANTIGA para a mais nova; nenhum valor é criado nem perdido.
 *   • Antes de concluir, confere que (soma dos saldos antes − depois) == valor recebido.
 *     Se não bater, lança erro e a transação inteira é desfeita.
 *   • `total`, itens e demais campos das compras não são tocados — só saldo, status,
 *     pagamentos, pagoEm e (nas compras que continuam abertas) dataVenc.
 *   • Não muda o esquema do banco: nenhuma migração necessária.
 *
 *  `novaDataVenc` (AAAA-MM-DD): vencimento do que sobrar. Obrigatório quando sobra saldo. */
export async function receberParcialCliente(ids, valor, novaDataVenc = null) {
  const pedido = centavos(valor)
  if (!(pedido > 0)) throw new Error('Informe um valor maior que zero.')
  const idsLimpos = [...new Set((ids || []).filter(i => i !== null && i !== undefined))]
  if (!idsLimpos.length) throw new Error('Nenhuma compra selecionada.')

  return db.transaction('rw', db.cad_fiados, async () => {
    const abertas = (await db.cad_fiados.bulkGet(idsLimpos))
      .filter(f => f && f.status === 'aberto' && Number(f.saldo) > 0.01)
    if (!abertas.length) throw new Error('Essas compras já estão quitadas.')

    // mais antiga primeiro (data + hora; id como desempate estável)
    abertas.sort((a, b) =>
      String(a.dataVenda || '').localeCompare(String(b.dataVenda || '')) ||
      String(a.horaVenda || '').localeCompare(String(b.horaVenda || '')) ||
      (a.id - b.id))

    const saldoAntes = somaSaldos(abertas)
    if (pedido > saldoAntes + 0.005) {
      throw new Error(`O valor (R$ ${fmt(pedido)}) é maior que o saldo em aberto (R$ ${fmt(saldoAntes)}).`)
    }
    // Valor praticamente igual ao saldo = quitação total (mesma tolerância do resto do app).
    const alvo = pedido >= saldoAntes - 0.01 ? saldoAntes : pedido
    const sobra = centavos(saldoAntes - alvo)
    if (sobra > 0.01 && !/^\d{4}-\d{2}-\d{2}$/.test(String(novaDataVenc || ''))) {
      throw new Error('Escolha a data para receber o restante.')
    }

    let faltaAbater = alvo
    const gravadas = []
    for (const f of abertas) {
      const parte = centavos(Math.min(faltaAbater, Number(f.saldo)))
      let mud = {}
      if (parte > 0) {
        mud = aplicarPagamento(f, parte)
        faltaAbater = centavos(faltaAbater - parte)
      }
      const continuaAberta = (mud.saldo ?? Number(f.saldo)) > 0.01
      if (continuaAberta && sobra > 0.01) mud.dataVenc = novaDataVenc
      const nova = { ...f, ...mud }
      await db.cad_fiados.put(nova)
      gravadas.push(nova)
    }

    // Conferência final — qualquer divergência desfaz tudo.
    const saldoDepois = somaSaldos(gravadas)
    if (faltaAbater > 0.005 || Math.abs(centavos(saldoAntes - saldoDepois) - alvo) > 0.005) {
      throw new Error('A conferência dos valores falhou. Nada foi alterado.')
    }

    return {
      recebido: alvo,
      restante: saldoDepois,
      quitouTudo: saldoDepois <= 0.01,
      compras: abertas.length,
      comprasQuitadas: gravadas.filter(f => f.status === 'pago').length,
      comprasEmAberto: gravadas.filter(f => f.status === 'aberto').length,
    }
  })
}

/** Estorna (desfaz) UM pagamento registrado por engano numa compra.
 *
 *  Garantias de integridade:
 *   • Tudo numa ÚNICA transação: ou grava tudo, ou não grava nada.
 *   • Relê a compra do banco dentro da transação (não confia no que está na tela).
 *   • Só remove o pagamento que bate com o que o usuário viu (valor + data/hora, e
 *     `criadoEm` quando existe). Se já não existir, não mexe em nada.
 *   • O valor estornado volta ao saldo (nunca passando do total da compra); se a compra
 *     estava quitada, ela é reaberta (status 'aberto', pagoEm limpo).
 *   • Os demais pagamentos, itens, total, vencimento etc. não são tocados.
 *   • Guarda um registro em `estornos` (trilha de auditoria) — campo novo e opcional;
 *     não muda o esquema do banco: nenhuma migração necessária.
 *   • Confere o resultado antes de concluir; se algo não bater, lança erro e a
 *     transação inteira é desfeita.
 *
 *  `alvo`: { idx, valor, data, hora, criadoEm } do pagamento mostrado na tela. */
export async function estornarPagamento(fiadoId, alvo) {
  if (fiadoId === null || fiadoId === undefined) throw new Error('Compra não informada.')
  if (!alvo) throw new Error('Pagamento não informado.')

  return db.transaction('rw', db.cad_fiados, async () => {
    const atual = await db.cad_fiados.get(fiadoId)
    if (!atual) throw new Error('Essa compra não existe mais. Nada foi alterado.')

    const lista = Array.isArray(atual.pagamentos) ? atual.pagamentos : []
    const bate = (p) =>
      !!p &&
      Math.abs(centavos(p.valor) - centavos(alvo.valor)) < 0.005 &&
      String(p.data || '') === String(alvo.data || '') &&
      String(p.hora || '') === String(alvo.hora || '')

    // 1º: pelo carimbo `criadoEm` (único); 2º: pela posição, só se os dados ainda baterem.
    let idx = -1
    if (alvo.criadoEm) {
      idx = lista.findIndex(p => p && p.criadoEm === alvo.criadoEm && bate(p))
    } else if (Number.isInteger(alvo.idx) && bate(lista[alvo.idx])) {
      idx = alvo.idx
    }
    if (idx < 0) throw new Error('Esse pagamento já não existe (a tela estava desatualizada). Nada foi alterado.')

    const removido = lista[idx]
    const valor = centavos(removido.valor)
    if (!(valor >= 0)) throw new Error('Pagamento com valor inválido. Nada foi alterado.')

    const saldoAntes = centavos(atual.saldo)
    const totalCompra = Number(atual.total)
    let novoSaldo = centavos(saldoAntes + valor)
    if (totalCompra > 0) novoSaldo = Math.min(novoSaldo, centavos(totalCompra))

    const continuaAberta = novoSaldo > 0.01
    const novosPagamentos = lista.filter((_, i) => i !== idx)
    const estorno = {
      valor,
      pagamentoData: removido.data || null,
      pagamentoHora: removido.hora || null,
      pagamentoCriadoEm: removido.criadoEm || null,
      data: hoje(),
      hora: horaAtual(),
      criadoEm: new Date().toISOString(),
    }

    const nova = {
      ...atual,
      saldo: novoSaldo,
      status: continuaAberta ? 'aberto' : 'pago',
      pagamentos: novosPagamentos,
      pagoEm: continuaAberta ? null : (atual.pagoEm || null),
      estornos: [...(Array.isArray(atual.estornos) ? atual.estornos : []), estorno],
    }
    await db.cad_fiados.put(nova)

    // Conferência final — qualquer divergência desfaz tudo.
    const gravada = await db.cad_fiados.get(fiadoId)
    if (
      !gravada ||
      (gravada.pagamentos || []).length !== lista.length - 1 ||
      Math.abs(centavos(gravada.saldo) - novoSaldo) > 0.005
    ) {
      throw new Error('A conferência dos valores falhou. Nada foi alterado.')
    }

    return { valor, saldo: novoSaldo, reabriu: atual.status === 'pago' && continuaAberta, fiado: gravada }
  })
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