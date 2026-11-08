// Integração: o store.js REAL sincronizando dois aparelhos (processos separados,
// IndexedDB próprio cada um) através de um Drive falso fiel ao real.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { construir } from './harness/construir.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-'))
const bundle = path.join(tmp, 'device.bundle.mjs')
const procs = []

class Aparelho {
  constructor(drive) {
    this.p = spawn(process.execPath, [bundle], { env: { ...process.env, DRIVE_FILE: drive }, stdio: ['pipe', 'pipe', 'inherit'] })
    this.esperas = new Map(); this.n = 0
    this.pronto = new Promise(res => { this.res = res })
    readline.createInterface({ input: this.p.stdout }).on('line', (l) => {
      let m; try { m = JSON.parse(l) } catch { return }
      if (m.pronto) return this.res()
      this.esperas.get(m.id)?.(m); this.esperas.delete(m.id)
    })
    procs.push(this.p)
  }
  async enviar(cmd) {
    await this.pronto
    const id = ++this.n
    const r = await new Promise(res => { this.esperas.set(id, res); this.p.stdin.write(JSON.stringify({ id, ...cmd }) + '\n') })
    assert.ok(!r.erroFatal, r.erroFatal)
    return r
  }
  init(papel) { return this.enviar({ cmd: 'init', papel }) }
  dados(codigo) { return this.enviar({ cmd: 'dados', codigo }) }
  ver(codigo) { return this.enviar({ cmd: 'ver', codigo }).then(r => r.dados) }
  sync(o = {}) { return this.enviar({ cmd: 'sync', ...o }) }
  resumo() { return this.enviar({ cmd: 'resumo' }).then(r => r.resumo) }
}
const novoDrive = () => path.join(fs.mkdtempSync(path.join(tmp, 'd-')), 'drive.json')
const drive = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

before(async () => { await construir(bundle) })
after(() => { procs.forEach(p => p.kill()); fs.rmSync(tmp, { recursive: true, force: true }) })

const SEMENTE = `
  const l = await db.cad_lojas.add({ uid: 'L1', nome: 'Loja A' })
  const c = await db.cad_clientes.add({ uid: 'C1', lojaId: l, nome: 'Ana' })
  await db.cad_fiados.add({ uid: 'F1', clienteId: c, lojaId: l, total: 100, saldo: 100, status: 'aberto', pagamentos: [], dataVenda: '2026-11-01' })
`

test('Vendas cria cobranças; Admin recebe; Admin NÃO consegue editá-las', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await A.init('admin')
  assert.equal((await V.dados(SEMENTE)).gravou, true)
  assert.equal((await V.sync()).status === 'ok' || (await V.sync()).status === 'idle', true)
  await A.sync()
  assert.equal((await A.resumo()).cad_fiados, 1, 'Admin recebeu a venda')
  const r = await A.dados(`await db.cad_fiados.update(1, { saldo: 0, status: 'pago' })`)
  assert.equal(r.gravou, false); assert.match(r.erro, /Somente consulta/)
  const [fi] = await A.ver(`return db.cad_fiados.toArray()`)
  assert.equal(fi.saldo, 100)
})

test('Vendas não consegue editar receitas; Admin não envia cobranças', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await A.init('admin')
  const r = await V.dados(`await db.receitas.put({ uuid: 'r1', nome: 'X' })`)
  assert.equal(r.gravou, false); assert.match(r.erro, /Somente consulta/)
  const r2 = await V.dados(`await db.config.put({ chave: 'company', valor: { nome: 'x' } })`)
  assert.equal(r2.gravou, false)
})

test('Os dois trabalham em paralelo e convergem (pagamento x receita)', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await A.init('admin')
  await V.dados(SEMENTE); await V.sync(); await A.sync()
  await V.dados(`await db.cad_fiados.update(1, { pagamentos: [{ valor: 30, criadoEm: '2026-11-02T10:00:00Z' }], saldo: 70 })`)
  await A.dados(`await db.receitas.put({ uuid: 'r1', nome: 'Brigadeiro', preco: 10 })`)
  await A.sync(); await V.sync(); await A.sync()
  for (const X of [V, A]) {
    const [fi] = await X.ver(`return db.cad_fiados.toArray()`)
    assert.equal(fi.saldo, 70); assert.equal(fi.pagamentos.length, 1)
    assert.equal((await X.resumo()).receitas, 1)
  }
  const d = drive(f).backup
  assert.equal(d.cad_fiados[0].saldo, 70); assert.equal(d.receitas.length, 1)
})

test('INCIDENTE: aparelho restaurado/vazio não apaga nem sobrescreve o Drive', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await A.init('admin')
  await V.dados(SEMENTE); await A.dados(`await db.receitas.put({ uuid: 'r1', nome: 'B', preco: 1 })`)
  await V.sync(); await A.sync(); await V.sync()
  const antes = JSON.stringify(drive(f).backup)

  // Admin "perde o cache" e reabre com banco vazio (mesmo papel); Vendas idem
  const A2 = new Aparelho(f); const V2 = new Aparelho(f)
  await A2.init('admin'); await V2.init('vendas')
  await A2.sync(); await V2.sync()
  const depois = drive(f).backup
  assert.equal(depois.cad_fiados.length, 1); assert.equal(depois.receitas.length, 1)
  assert.equal(depois.cad_clientes.length, 1); assert.equal(depois.cad_lojas.length, 1)
  assert.equal((await A2.resumo()).cad_fiados, 1, 'Admin vazio recebeu tudo')
  assert.equal((await V2.resumo()).receitas, 1, 'Vendas vazio recebeu tudo')
  assert.equal(JSON.stringify(depois.cad_fiados.map(x => x.saldo)), JSON.stringify(JSON.parse(antes).cad_fiados.map(x => x.saldo)))
})

test('Sem papel definido o aparelho não sincroniza nem grava', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const N = new Aparelho(f)
  await V.init('vendas'); await V.dados(SEMENTE); await V.sync()
  await N.init(null)
  const r = await N.sync()
  assert.equal(drive(f).backup.cad_fiados.length, 1)
  assert.notEqual(r.status, 'syncing')
  assert.equal((await N.dados(`await db.receitas.put({ uuid: 'z', nome: 'z' })`)).gravou, false)
  assert.equal((await N.resumo()).cad_fiados, 0, 'não baixou nada sem saber quem é')
})

test('Queda brusca: envio é pausado, nada muda no Drive, e só segue com confirmação', async () => {
  const f = novoDrive(); const V = new Aparelho(f)
  await V.init('vendas')
  await V.dados(`
    const l = await db.cad_lojas.add({ uid: 'L1', nome: 'Loja A' })
    const c = await db.cad_clientes.add({ uid: 'C1', lojaId: l, nome: 'Ana' })
    for (let i = 1; i <= 14; i++) await db.cad_fiados.add({ uid: 'F' + i, clienteId: c, lojaId: l, total: 10, saldo: 10, status: 'aberto', pagamentos: [], dataVenda: '2026-11-01' })`)
  await V.sync()
  assert.equal(drive(f).backup.cad_fiados.length, 14)
  const n1 = drive(f).n

  await V.dados(`await db.cad_fiados.where('id').above(2).delete()`) // apaga 12 de 14 (aparelho dono, a trava deixa)
  const r = await V.sync()
  assert.equal(r.status, 'conflict'); assert.ok(r.alerta?.linhas.join(' ').match(/vendas fiadas: de 14 para 2/))
  assert.equal(drive(f).n, n1, 'Drive intacto')
  assert.equal(drive(f).backup.cad_fiados.length, 14)

  // pessoa vê e recusa → continua parado
  const r2 = await V.sync({ manual: true, confirmar: false })
  assert.equal(r2.status, 'conflict'); assert.equal(drive(f).backup.cad_fiados.length, 14)
  // pessoa confirma → segue
  const r3 = await V.sync({ manual: true, confirmar: true })
  assert.notEqual(r3.status, 'conflict')
  assert.equal(drive(f).backup.cad_fiados.length, 2)
})

// Cenários em que a trava local é CONTORNADA (restauração de cache/backup velho grava via
// importarDados): aí quem protege é a regra de dono no merge e no envio.
const INJETAR_TOTAL_ERRADO = `
  const d = await exportarDados()
  d.cad_fiados = d.cad_fiados.map(f => ({ ...f, total: 999, saldo: 999 }))
  await importarDados(d)`

test('Restauração velha no Admin (merge): cobranças adulteradas localmente NÃO sobem', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await A.init('admin')
  await V.dados(SEMENTE); await V.sync(); await A.sync()
  await V.dados(`await db.cad_fiados.update(1, { pagamentos: [{ valor: 30, criadoEm: '2026-11-02T10:00:00Z' }], saldo: 70 })`)
  await V.sync()                                    // Drive mudou
  await A.ver(INJETAR_TOTAL_ERRADO)                  // Admin com cobrança adulterada (contornando a trava)
  await A.dados(`await db.receitas.put({ uuid: 'r1', nome: 'B', preco: 1 })`)
  await A.sync()
  const d = drive(f).backup
  assert.equal(d.cad_fiados[0].total, 100, 'total do Drive não foi adulterado')
  assert.equal(d.cad_fiados[0].saldo, 70)
  assert.equal(d.receitas.length, 1, 'a receita do Admin subiu normalmente')
  const [fi] = await A.ver(`return db.cad_fiados.toArray()`)
  assert.equal(fi.total, 100, 'o Admin voltou a ter a versão correta')
})

test('Restauração velha no Admin (Drive sem mudança): cobranças adulteradas NÃO sobem', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await A.init('admin')
  await V.dados(SEMENTE); await V.sync(); await A.sync()
  await A.ver(INJETAR_TOTAL_ERRADO)
  await A.dados(`await db.receitas.put({ uuid: 'r1', nome: 'B', preco: 1 })`)
  await A.sync()
  const d = drive(f).backup
  assert.equal(d.cad_fiados[0].total, 100)
  assert.equal(d.receitas.length, 1)
})

test('Restauração velha no Vendas: receitas/config adulteradas NÃO sobem', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await A.init('admin')
  await A.dados(`await db.receitas.put({ uuid: 'r1', nome: 'Certo', preco: 10 })`)
  await A.sync(); await V.sync()
  await V.ver(`const d = await exportarDados(); d.receitas = d.receitas.map(r => ({ ...r, nome: 'ERRADO', preco: 1 })); await importarDados(d)`)
  await V.dados(SEMENTE)
  await V.sync()
  const d = drive(f).backup
  assert.equal(d.receitas[0].nome, 'Certo'); assert.equal(d.receitas[0].preco, 10)
  assert.equal(d.cad_fiados.length, 1, 'a cobrança do Vendas subiu')
})

test('Admin recém-aberto (banco vazio) recebe tudo e não envia nada', async () => {
  const f = novoDrive(); const V = new Aparelho(f); const A = new Aparelho(f)
  await V.init('vendas'); await V.dados(SEMENTE); await V.sync()
  const n = drive(f).n
  await A.init('admin'); await A.sync()
  assert.equal(drive(f).backup.cad_fiados.length, 1)
  assert.equal(drive(f).n, n, 'nenhuma gravação nova no Drive')
  assert.equal((await A.resumo()).cad_fiados, 1)
})
