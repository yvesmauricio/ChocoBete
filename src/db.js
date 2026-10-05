import Dexie from 'dexie'

const DB_NAME = 'chocobeteDB_v2'
const LEGACY_DB_NAME = 'chocobeteDB'
const MIGRATION_FLAG = '__legacy_migrated__'

export const db = new Dexie(DB_NAME)

db.version(1).stores({
  produtos:  'uuid, nome',
  receitas:  'uuid, nome',
  producoes: 'uuid, data_producao',
  config:    'chave'
})

db.version(2).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, descricao, mes_ref, &hash_duplicidade',
  config:     'chave'
})

db.version(3).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, tipo, categoria, natureza, descricao, mes_ref, &hash_duplicidade',
  config:     'chave'
})

db.version(4).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  config:     'chave'
})

db.version(5).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_id, data',
  config:     'chave'
})

db.version(6).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_uuid, data',
  config:     'chave'
})

db.version(7).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_uuid, data',
  notas_fiscais: 'uuid, chave_acesso, data_compra, emitente_cnpj',
  config:     'chave'
})

// v8: remove tabela notas_fiscais (funcionalidade de NF removida)
db.version(8).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_uuid, data',
  notas_fiscais: null,
  config:     'chave'
})

// v9: adiciona tabelas da Caderneta (fiados da Bete) no mesmo banco
db.version(9).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_uuid, data',
  // ── Caderneta ──
  cad_lojas:    '++id, nome',
  cad_clientes: '++id, lojaId, nome',
  cad_fiados:   '++id, clienteId, lojaId, status, dataVenc',
  config:     'chave'
})

// db.js - versão 10 com novos campos
db.version(10).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao, origem, gerar_financeiro',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_uuid, data',
  cad_lojas:    '++id, nome',
  cad_clientes: '++id, lojaId, nome',
  cad_fiados:   '++id, clienteId, lojaId, status, dataVenc',
  config:     'chave'
})

// v11: adiciona tabela de pedidos do balcão (cardápio interativo usado em
// tela cheia, com o cliente na sua frente) — guarda cliente, itens, valores
// e status, pra consultar depois o que falta produzir.
db.version(11).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao, origem, gerar_financeiro',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_uuid, data',
  cad_lojas:    '++id, nome',
  cad_clientes: '++id, lojaId, nome',
  cad_fiados:   '++id, clienteId, lojaId, status, dataVenc',
  cardapio_pedidos: 'uuid, cardapioId, status, criadoEm',
  config:     'chave'
})

// v12: adiciona histórico de preço de VENDA das receitas (preco_sugerido) —
// separado do historico_precos, que registra o custo de COMPRA dos
// ingredientes. Toda vez que o preço sugerido de uma receita muda (seja
// editado direto na tela de Receitas, seja pelo Cardápio) fica registrado
// aqui, com a data, pra dar pra acompanhar a evolução do preço de venda.
db.version(12).stores({
  produtos:   'uuid, nome',
  receitas:   'uuid, nome',
  producoes:  'uuid, data_producao, origem, gerar_financeiro',
  financeiro: '++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',
  historico_precos: '++id, produto_uuid, data',
  cad_lojas:    '++id, nome',
  cad_clientes: '++id, lojaId, nome',
  cad_fiados:   '++id, clienteId, lojaId, status, dataVenc',
  cardapio_pedidos: 'uuid, cardapioId, status, criadoEm',
  historico_precos_venda: '++id, receita_uuid, data',
  config:     'chave'
})

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readAllFromStore(idb, storeName) {
  if (!idb.objectStoreNames.contains(storeName)) return []
  const tx = idb.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  return promisifyRequest(store.getAll())
}

async function openLegacyDatabase() {
  const exists = await Dexie.exists(LEGACY_DB_NAME).catch(() => false)
  if (!exists) return null

  const request = indexedDB.open(LEGACY_DB_NAME)
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      request.transaction?.abort()
      resolve(null)
    }
  })
}

function normalizeProduto(produto) {
  return {
    ...produto,
    uuid: produto.uuid || randomId()
  }
}

function normalizeReceita(receita, produtoIdMap, receitaIdMap) {
  return {
    ...receita,
    uuid: receita.uuid || receitaIdMap.get(receita.id) || randomId(),
    ingredientes: (receita.ingredientes || []).map(ing => ({
      ...ing,
      id: ing.tipo === 'receita'
        ? (receitaIdMap.get(ing.id) || ing.id)
        : (produtoIdMap.get(ing.id) || ing.id)
    }))
  }
}

function normalizeProducao(producao, receitaIdMap) {
  return {
    ...producao,
    uuid: producao.uuid || randomId(),
    receita_id: receitaIdMap.get(producao.receita_id) || producao.receita_id,
    data_producao: producao.data_producao || new Date().toISOString()
  }
}

async function importLegacyData(legacyData) {
  const produtoIdMap = new Map()
  const receitaIdMap = new Map()

  const produtos = (legacyData.produtos || []).map(produto => {
    const normalized = normalizeProduto(produto)
    if (produto.id != null) produtoIdMap.set(produto.id, normalized.uuid)
    if (produto.uuid) produtoIdMap.set(produto.uuid, normalized.uuid)
    return normalized
  })

  const receitasBase = legacyData.receitas || []
  for (const receita of receitasBase) {
    const uuid = receita.uuid || randomId()
    if (receita.id != null) receitaIdMap.set(receita.id, uuid)
    if (receita.uuid) receitaIdMap.set(receita.uuid, uuid)
    else if (receita.id == null) receitaIdMap.set(uuid, uuid)
  }

  const receitas = receitasBase.map(receita => normalizeReceita(receita, produtoIdMap, receitaIdMap))
  const producoes = (legacyData.producoes || []).map(producao => normalizeProducao(producao, receitaIdMap))
  const config = (legacyData.config || []).filter(row => row?.chave)

  await db.transaction('rw', db.tables, async () => {
    await db.produtos.bulkPut(produtos)
    await db.receitas.bulkPut(receitas)
    await db.producoes.bulkPut(producoes)
    if (config.length) await db.config.bulkPut(config)
    await db.config.put({ chave: MIGRATION_FLAG, valor: true })
  })
}

export async function migrateLegacyDbIfNeeded() {
  await db.open()

  const alreadyMigrated = await db.config.get(MIGRATION_FLAG).catch(() => null)
  if (alreadyMigrated?.valor) return

  const currentCounts = await Promise.all([
    db.produtos.count(),
    db.receitas.count(),
    db.producoes.count(),
    db.financeiro.count(),
    db.config.count()
  ])

  const hasCurrentData = currentCounts.some(count => count > 0)
  if (hasCurrentData) {
    await db.config.put({ chave: MIGRATION_FLAG, valor: true })
    return
  }

  const legacyDb = await openLegacyDatabase()
  if (!legacyDb) {
    await db.config.put({ chave: MIGRATION_FLAG, valor: true })
    return
  }

  try {
    const legacyData = {
      produtos: await readAllFromStore(legacyDb, 'produtos'),
      receitas: await readAllFromStore(legacyDb, 'receitas'),
      producoes: await readAllFromStore(legacyDb, 'producoes'),
      config: await readAllFromStore(legacyDb, 'config')
    }
    await importLegacyData(legacyData)
  } finally {
    legacyDb.close()
  }
}

// ─── Config local ──────────────────────────────────────────────
export async function configGet(chave, fallback = null) {
  try {
    const row = await db.config.get(chave)
    return row?.valor ?? fallback
  } catch {
    return fallback
  }
}

export async function configSet(chave, valor) {
  try {
    const valorSerializavel = valor == null ? valor : JSON.parse(JSON.stringify(valor))
    await db.config.put({ chave, valor: valorSerializavel })
  } catch {}
}

// ─── Pedidos do balcão (cardápio interativo em tela cheia) ────────────────
/** Salva um pedido fechado ao vivo, no balcão — cliente, itens, valores e
 *  status "pendente" (ainda não agendado nem entregue). Essa tela não tem
 *  nenhuma ligação com a produção (isso fica na aba Produção); "agendado"
 *  aqui é só o combinado de data/hora com o cliente pra esse pedido, e
 *  "entregue" marca que ele já foi retirado/entregue. */
export async function salvarPedidoCardapio(pedido) {
  const registro = {
    status: 'pendente',
    agendadoPara: null,
    horaAgendada: null,
    ...pedido,
    uuid: pedido?.uuid || randomId(),
    criadoEm: pedido?.criadoEm || new Date().toISOString(),
  }
  await db.cardapio_pedidos.put(registro)
  return registro
}

/** Lista todos os pedidos salvos, do mais recente pro mais antigo. */
export async function listarPedidosCardapio() {
  try {
    const todos = await db.cardapio_pedidos.toArray()
    return todos.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
  } catch {
    return []
  }
}

/** Atualiza o status do pedido ('pendente' | 'agendado' | 'entregue').
 *  `campos` é opcional e só sobrescreve o que for passado (ex.: ao agendar,
 *  manda { agendadoPara, horaAgendada }; ao marcar entregue, não precisa
 *  passar nada — a data/hora combinada continua salva no pedido). */
export async function atualizarStatusPedidoCardapio(uuid, status, campos = {}) {
  try { await db.cardapio_pedidos.update(uuid, { status, ...campos }) } catch {}
}

export async function excluirPedidoCardapio(uuid) {
  try { await db.cardapio_pedidos.delete(uuid) } catch {}
}

// ─── Rotina de Backup Forte ─────────────────────────────────────
export async function exportarDados() {
  const backup = {}
  await db.open()
  for (const table of db.tables) {
    backup[table.name] = await table.toArray()
  }
  return backup
}

export async function importarDados(backup) {
  return db.transaction('rw', db.tables, async () => {
    for (const tabela of db.tables.map(table => table.name)) {
      await db[tabela].clear()
      const rows = Array.isArray(backup?.[tabela]) ? backup[tabela] : []
      if (rows.length) await db[tabela].bulkPut(rows)
    }
    await db.config.put({ chave: MIGRATION_FLAG, valor: true })
  })
}

export async function garantirPersistencia() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted()
    if (!isPersisted) {
      const granted = await navigator.storage.persist()
      return granted
    }
    return true
  }
  return false
}