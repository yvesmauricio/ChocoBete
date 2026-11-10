// Ponta a ponta: fila do celular (IndexedDB de mentira) ⇄ servidor de verdade (SQLite + gatilhos).
import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarD1 } from './d1shim.mjs'
import { onRequestPost } from '../functions/api/caderneta/ops.js'
import { onRequestGet } from '../functions/api/caderneta/estado.js'
import { enfileirar, descarregar, puxarEstado, estadoFila, recontar, filaDb, _usarFetch, dispensarRejeitada } from '../src/services/filaOperacoes.js'

const TOKEN = 'x'.repeat(40)
const DB = criarD1()
const env = { DB, ADMIN_TOKEN: TOKEN }
let online = true, perderResposta = false
// "rede": entrega a requisição à função do servidor, como o Cloudflare faria
_usarFetch(async (url, init = {}) => {
  if (!online) throw new TypeError('offline')
  const req = new Request('https://app.test' + url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${TOKEN}` } })
  const resp = url.startsWith('/api/caderneta/ops') ? await onRequestPost({ request: req, env }) : await onRequestGet({ request: req, env })
  if (perderResposta) { perderResposta = false; throw new TypeError('sinal caiu depois do servidor aplicar') }
  return resp
})
const venda = (u) => DB.raw.prepare('SELECT * FROM cad_vendas WHERE uid=?').get(u) ?? null

test('offline: grava na fila, mostra pendentes; ao voltar o sinal envia tudo em ordem', async () => {
  online = false
  await enfileirar('loja.salvar', { uid: 'loja-offline-1', nome: 'Padaria Sol' })
  await enfileirar('cliente.salvar', { uid: 'cli-offline-1', loja_uid: 'loja-offline-1', nome: 'Ana', telefone: '(21) 99943-0023' })
  await enfileirar('venda.criar', { uid: 'venda-offline-1', cliente_uid: 'cli-offline-1', data_venda: '2026-11-09', itens: [{ nome: 'Trufa', qtd: 4, preco_centavos: 500 }], total_centavos: 2000 })
  await enfileirar('pagamento.registrar', { uid: 'pag-offline-1', venda_uid: 'venda-offline-1', valor_centavos: 800 })
  await descarregar()
  assert.equal(estadoFila.pendentes, 4); assert.match(estadoFila.ultimoErro, /Sem conexão/)
  assert.equal(venda('venda-offline-1'), null)
  online = true
  await descarregar()
  assert.equal(estadoFila.pendentes, 0); assert.equal(estadoFila.rejeitadas.length, 0)
  const v = venda('venda-offline-1'); assert.deepEqual([v.saldo_centavos, v.status], [1200, 'aberto'])
})

test('sinal cai DEPOIS do servidor aplicar: reenvio não lança o pagamento duas vezes', async () => {
  perderResposta = true
  await enfileirar('pagamento.registrar', { uid: 'pag-offline-2', venda_uid: 'venda-offline-1', valor_centavos: 200 })
  await descarregar()
  assert.equal(venda('venda-offline-1').saldo_centavos, 1000)       // servidor aplicou
  assert.equal(estadoFila.pendentes, 1)                              // aparelho ainda acha que falta enviar
  await descarregar()
  assert.equal(estadoFila.pendentes, 0)
  assert.equal(venda('venda-offline-1').saldo_centavos, 1000)       // continua 1000, não 800
})

test('recusa do servidor não some: fica visível com o motivo até dispensar', async () => {
  await enfileirar('pagamento.registrar', { uid: 'pag-offline-3', venda_uid: 'venda-offline-1', valor_centavos: 99999 })
  await descarregar()
  assert.equal(estadoFila.pendentes, 0); assert.equal(estadoFila.rejeitadas.length, 1)
  assert.match(estadoFila.rejeitadas[0].motivo, /maior que o saldo/)
  assert.equal(venda('venda-offline-1').saldo_centavos, 1000)
  await dispensarRejeitada(estadoFila.rejeitadas[0].op_id)
  assert.equal(estadoFila.rejeitadas.length, 0)
})

test('leitura incremental: espelho do aparelho reflete o servidor', async () => {
  const r = await puxarEstado()
  assert.ok(r.alteradas > 0)
  const v = await filaDb.espelho.get(['vendas', 'venda-offline-1'])
  assert.equal(v.saldo_centavos, 1000); assert.equal(v.itens.length, 1)
  assert.equal((await filaDb.espelho.where('tabela').equals('pagamentos').count()), 2)
  assert.equal((await puxarEstado()).alteradas, 0)                  // nada novo
})

test('sem login (401): nada é perdido e a tela sabe pedir login', async () => {
  const antes = env.ADMIN_TOKEN; env.ADMIN_TOKEN = 'y'.repeat(40)
  await enfileirar('venda.vencimento', { venda_uid: 'venda-offline-1', data_venc: '2026-12-01' })
  await descarregar()
  assert.equal(estadoFila.semLogin, true); assert.equal(estadoFila.pendentes, 1)
  env.ADMIN_TOKEN = antes; await descarregar()
  assert.equal(estadoFila.pendentes, 0); assert.equal(venda('venda-offline-1').data_venc, '2026-12-01')
})
