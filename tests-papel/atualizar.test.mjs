// Botão "Atualizar" do modo somente consulta: traz o que o outro aparelho gravou.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'; import fs from 'node:fs'; import os from 'node:os'
import { criarAmbiente } from './harness/aparelho.mjs'

let amb, drive
before(async () => { amb = await criarAmbiente(); drive = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atl-')), 'drive.json') })
after(() => amb.fechar())

const SEMENTE = `
  const l = await db.cad_lojas.add({ uid: 'L1', nome: 'Loja A' })
  const c = await db.cad_clientes.add({ uid: 'C1', lojaId: l, nome: 'Ana' })
  await db.cad_fiados.add({ uid: 'F1', clienteId: c, lojaId: l, total: 100, saldo: 100, status: 'aberto', pagamentos: [], dataVenda: '2026-11-01' })
  s.agendarSync(); await s.syncImediato({ manual: true })`

test('Admin (somente consulta) atualiza manualmente e passa a ver o que a Vendas gravou', async () => {
  const V = new amb.Ap(drive), A = new amb.Ap(drive)
  await V.init('vendas'); await A.init('admin')
  assert.equal(await A.store(`return db.cad_fiados.count()`), 0)

  await V.store(SEMENTE)
  assert.equal(await A.store(`return db.cad_fiados.count()`), 0, 'ainda não atualizou')
  const antes = await A.store(`return s.ultimaChecagemSync`)
  await new Promise(r => setTimeout(r, 30))

  assert.equal(await A.store(`return s.atualizarAgora()`), 'ok')
  assert.equal(await A.store(`return db.cad_fiados.count()`), 1, 'agora vê a venda')
  assert.ok((await A.store(`return s.ultimaChecagemSync`)) > (antes || ''), 'registrou quando conferiu')
})

test('atualizar sem novidades também conta como "atualizado agora" e não mexe em nada', async () => {
  const V = new amb.Ap(drive), A = new amb.Ap(drive)
  await V.init('vendas'); await A.init('admin')
  assert.equal(await A.store(`return s.atualizarAgora()`), 'ok')
  const t1 = await A.store(`return s.ultimaChecagemSync`)
  await new Promise(r => setTimeout(r, 30))
  assert.equal(await A.store(`return s.atualizarAgora()`), 'ok')
  const t2 = await A.store(`return s.ultimaChecagemSync`)
  assert.ok(t2 > t1, 'a conferência foi registrada de novo')
  assert.equal(await A.store(`return db.cad_fiados.count()`), 1)
})

test('o aparelho em consulta continua sem conseguir editar depois de atualizar', async () => {
  const A = new amb.Ap(drive); await A.init('admin'); await A.store(`await s.atualizarAgora()`)
  const r = await A.cmd({ cmd: 'dados', codigo: `await db.cad_fiados.update(1, { saldo: 0, status: 'pago' })` })
  assert.equal(r.gravou, false); assert.match(r.erro, /Somente consulta/)
})

test('sem internet: avisa em vez de tentar', async () => {
  const A = new amb.Ap(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atl-')), 'd.json')); await A.init('admin')
  await A.store(`navigator.onLine = false`)
  assert.equal(await A.store(`return s.atualizarAgora()`), 'offline')
})
