// Cronômetro de produção x edição de data do lote (reproduz o relato: iniciar, pausar, editar a data).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import readline from 'node:readline'
import { construir } from './harness/construir.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-'))
const bundle = path.join(tmp, 'device.bundle.mjs'); const procs = []
class Ap {
  constructor() {
    this.p = spawn(process.execPath, [bundle], { env: { ...process.env, DRIVE_FILE: path.join(fs.mkdtempSync(path.join(tmp, 'drv-')), 'd.json') }, stdio: ['pipe', 'pipe', 'inherit'] })
    this.w = new Map(); this.n = 0; this.pronto = new Promise(r => { this.r = r })
    readline.createInterface({ input: this.p.stdout }).on('line', l => { let m; try { m = JSON.parse(l) } catch { return } if (m.pronto) return this.r(); this.w.get(m.id)?.(m); this.w.delete(m.id) })
    procs.push(this.p)
  }
  async cmd(c) { await this.pronto; const id = ++this.n; const r = await new Promise(res => { this.w.set(id, res); this.p.stdin.write(JSON.stringify({ id, ...c }) + '\n') }); assert.ok(!r.erroFatal, r.erroFatal); return r }
  store(codigo) { return this.cmd({ cmd: 'store', codigo }).then(r => r.r) }
}
before(async () => { await construir(bundle) })
after(() => { procs.forEach(p => p.kill()); fs.rmSync(tmp, { recursive: true, force: true }) })

const LOTE = '2026-11-07T10:00:00.000Z', NOVA = '2026-11-07T15:30:00.000Z'
const PREPARA = `
  await db.producoes.put({ uuid: 'p1', data_producao: '${LOTE}', receita_id: 'r1', receita_nome: 'Brigadeiro', quantidade_produzida: 10 })
  await s.carregarProducoes(0)`
const ESTADO = `return { ativo: s.timer.activeLoteId, rodando: s.timer.isRunning, acum: s.timer.accumulatedMs, existe: s.producoes.some(p => p.data_producao === s.timer.activeLoteId) }`

test('iniciar → pausar → editar a data do lote: o cronômetro acompanha o lote', async () => {
  const A = new Ap(); await A.cmd({ cmd: 'init', papel: 'admin' })
  await A.store(PREPARA)
  await A.store(`s.startTimer('${LOTE}'); await new Promise(r => setTimeout(r, 1200)); s.pauseTimer()`)
  const antes = await A.store(ESTADO)
  assert.equal(antes.ativo, LOTE); assert.equal(antes.rodando, false); assert.ok(antes.acum >= 1000)

  await A.store(`await s.atualizarLoteProducao('${LOTE}', { data_producao_nova: '${NOVA}' })`)
  const depois = await A.store(ESTADO)
  console.log('   depois de editar a data:', JSON.stringify(depois))
  assert.equal(depois.existe, true, 'o cronômetro ficou apontando para um lote que não existe mais (preso)')
  assert.equal(depois.ativo, NOVA)
  assert.ok(depois.acum >= 1000, 'o tempo já contado foi preservado')
})

test('depois de editar a data, dá para retomar e parar, e o tempo vai para o lote novo', async () => {
  const A = new Ap(); await A.cmd({ cmd: 'init', papel: 'admin' })
  await A.store(PREPARA)
  await A.store(`s.startTimer('${LOTE}'); s.pauseTimer(); s.timer.accumulatedMs = 5 * 60000; await s.atualizarLoteProducao('${LOTE}', { data_producao_nova: '${NOVA}' })`)
  await A.store(`s.startTimer(s.timer.activeLoteId); await s.stopTimer()`)
  const r = await A.store(`return { timer: s.timer.activeLoteId, itens: (await db.producoes.toArray()).map(p => ({ d: p.data_producao, t: p.tempo_real_min })) }`)
  assert.equal(r.timer, null, 'cronômetro encerrado')
  assert.equal(r.itens[0].d, NOVA)
  assert.ok(r.itens[0].t >= 5, 'os 5 min registrados foram para o lote editado')
})

test('cronômetro ativo cujo lote não existe (apagado/estornado) não bloqueia iniciar outro', async () => {
  const A = new Ap(); await A.cmd({ cmd: 'init', papel: 'admin' })
  await A.store(PREPARA)
  await A.store(`s.startTimer('${LOTE}'); s.pauseTimer(); await db.producoes.delete('p1'); await s.carregarProducoes(0)`)
  const r = await A.store(`return { orfao: s.timerOrfao }`)
  assert.equal(r.orfao, true, 'deve reconhecer o cronômetro órfão')
})
