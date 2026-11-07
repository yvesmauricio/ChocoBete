// Trava de gravação por papel, com Dexie de verdade (IndexedDB simulado).
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import { instalarTravaPorPapel, liberarEscrita, SomenteConsultaError } from '../src/services/travaPorPapel.js'

const CHAVES_APARELHO = ['sync_ts', 'papel_aparelho']

async function novoBanco(papelInicial) {
  const db = new Dexie('t' + Math.random())
  db.version(1).stores({ receitas: 'uuid', cad_fiados: '++id, status', config: 'chave' })
  await db.open()
  const ctx = { papel: papelInicial, avisos: [] }
  instalarTravaPorPapel(db, { obterPapel: () => ctx.papel, chavesDoAparelho: CHAVES_APARELHO, aoBloquear: e => ctx.avisos.push(e.tabela) })
  return { db, ctx }
}
const falha = async (fn) => { try { await fn() } catch (e) { return e } return null }

test('Admin: não grava em cobranças (add, put, update, delete, bulkPut, modify)', async () => {
  const { db, ctx } = await novoBanco('admin')
  // dados já existentes, escritos com a escrita liberada (como faz um sync)
  await db.transaction('rw', db.tables, async () => { liberarEscrita(); await db.cad_fiados.put({ id: 1, status: 'aberto' }) })
  for (const op of [
    () => db.cad_fiados.add({ status: 'aberto' }),
    () => db.cad_fiados.put({ id: 1, status: 'pago' }),
    () => db.cad_fiados.update(1, { status: 'pago' }),
    () => db.cad_fiados.delete(1),
    () => db.cad_fiados.bulkPut([{ id: 1, status: 'pago' }]),
    () => db.cad_fiados.where('status').equals('aberto').modify({ status: 'pago' }),
  ]) {
    const e = await falha(op)
    assert.ok(e, 'deveria falhar')
  }
  assert.deepEqual(await db.cad_fiados.toArray(), [{ id: 1, status: 'aberto' }], 'nada mudou')
  assert.ok(ctx.avisos.length >= 6)
})

test('Admin grava normalmente nas áreas dele', async () => {
  const { db } = await novoBanco('admin')
  await db.receitas.put({ uuid: 'a', nome: 'x' })
  await db.config.put({ chave: 'company', valor: 1 })
  assert.equal(await db.receitas.count(), 1)
})

test('Vendas: grava cobranças, não grava receitas nem config de negócio', async () => {
  const { db } = await novoBanco('vendas')
  await db.cad_fiados.add({ status: 'aberto' })
  assert.ok(await falha(() => db.receitas.put({ uuid: 'a' })))
  assert.ok(await falha(() => db.config.put({ chave: 'company', valor: 1 })))
  assert.equal(await db.cad_fiados.count(), 1)
  assert.equal(await db.receitas.count(), 0)
})

test('Chaves do aparelho (sync_*, papel) sempre gravam, em qualquer papel', async () => {
  for (const papel of ['admin', 'vendas', null]) {
    const { db } = await novoBanco(papel)
    await db.config.put({ chave: 'sync_ts', valor: 'x' })
    await db.config.put({ chave: 'papel_aparelho', valor: 'vendas' })
  }
})

test('Sem papel definido: nada grava (exceto chaves do aparelho)', async () => {
  const { db } = await novoBanco(null)
  assert.ok(await falha(() => db.cad_fiados.add({ status: 'aberto' })))
  assert.ok(await falha(() => db.receitas.put({ uuid: 'a' })))
})

test('Transação liberada (importação) grava em tudo — e só ela', async () => {
  const { db } = await novoBanco('admin')
  await db.transaction('rw', db.tables, async () => {
    liberarEscrita()
    await db.cad_fiados.bulkPut([{ id: 1, status: 'aberto' }, { id: 2, status: 'pago' }])
  })
  assert.equal(await db.cad_fiados.count(), 2)
  // fora da transação liberada, volta a travar
  assert.ok(await falha(() => db.cad_fiados.put({ id: 3, status: 'aberto' })))
  assert.equal(await db.cad_fiados.count(), 2)
})

test('Erro é do tipo SomenteConsultaError com mensagem em português', async () => {
  const { db } = await novoBanco('admin')
  const e = await falha(() => db.cad_fiados.add({ status: 'aberto' }))
  assert.ok(e, 'deveria falhar')
  assert.match(e.message, /Somente consulta/)
  assert.ok(e.name === 'SomenteConsultaError' || e.inner?.name === 'SomenteConsultaError' || e instanceof SomenteConsultaError)
})

test('clear() numa tabela travada também é bloqueado', async () => {
  const { db } = await novoBanco('admin')
  await db.transaction('rw', db.tables, async () => { liberarEscrita(); await db.cad_fiados.put({ id: 1, status: 'aberto' }) })
  const e = await falha(() => db.cad_fiados.clear())
  assert.ok(e, 'clear() deveria falhar')
  assert.equal(await db.cad_fiados.count(), 1)
})
