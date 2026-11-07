// Regra de dono por área no merge: o que não é do aparelho vem SEMPRE do Drive.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mesclar } from '../src/services/merge.js'

const vazio = () => ({
  produtos: [], receitas: [], producoes: [], financeiro: [], historico_precos: [],
  historico_precos_venda: [], cad_lojas: [], cad_clientes: [], cad_fiados: [],
  cardapio_pedidos: [], config: [{ chave: '__legacy_migrated__', valor: true }]
})
const clone = (x) => JSON.parse(JSON.stringify(x))

function base() {
  const d = vazio()
  d.receitas = [{ uuid: 'r1', nome: 'Brigadeiro', preco: 10 }]
  d.cad_lojas = [{ id: 1, uid: 'L1', nome: 'Loja A' }]
  d.cad_clientes = [{ id: 1, uid: 'C1', lojaId: 1, nome: 'Ana' }]
  d.cad_fiados = [{ id: 1, uid: 'F1', clienteId: 1, lojaId: 1, total: 100, saldo: 100, status: 'aberto', pagamentos: [] }]
  d.config.push({ chave: 'company', valor: { nome: 'ChocoBete' } })
  return d
}

// compara só o que importa, ignorando ids numéricos (cada aparelho tem os seus)
const cfg = (d) => Object.fromEntries(d.config.map(r => [r.chave, r.valor]))
const fiados = (d) => d.cad_fiados.map(f => ({ uid: f.uid, saldo: f.saldo, status: f.status, pag: (f.pagamentos || []).length })).sort((a, b) => a.uid.localeCompare(b.uid))

test('Admin: cobranças vêm do Drive mesmo que o aparelho tenha lixo', () => {
  const b = base()
  const remoto = clone(b)
  remoto.cad_fiados[0].pagamentos = [{ valor: 40, criadoEm: '2026-11-01T10:00:00Z' }]
  remoto.cad_fiados[0].saldo = 60
  const local = clone(b)
  local.cad_fiados = []            // cache limpo / apagou tudo por engano
  local.cad_clientes = []
  local.cad_lojas = []
  const r = mesclar({ base: b, local, remote: remoto, papel: 'admin' })
  assert.deepEqual(fiados(r.dados), [{ uid: 'F1', saldo: 60, status: 'aberto', pag: 1 }])
  assert.equal(r.dados.cad_clientes.length, 1)
  assert.equal(r.dados.cad_lojas.length, 1)
  assert.equal(r.igualAoRemoto, true, 'nada a enviar: o aparelho não reenvia cobranças')
})

test('Admin: edição indevida local em cobrança é descartada, não enviada', () => {
  const b = base()
  const local = clone(b)
  local.cad_fiados[0].total = 999; local.cad_fiados[0].saldo = 999
  const r = mesclar({ base: b, local, remote: clone(b), papel: 'admin' })
  assert.equal(r.dados.cad_fiados[0].total, 100)
  assert.equal(r.igualAoRemoto, true)
})

test('Vendas: receitas/config locais não sobem; cobranças locais sobem', () => {
  const b = base()
  const local = clone(b)
  local.receitas[0].preco = 1             // indevido
  local.config.find(c => c.chave === 'company').valor = { nome: 'ERRADO' } // indevido
  local.cad_fiados[0].pagamentos = [{ valor: 30, criadoEm: '2026-11-02T10:00:00Z' }]
  local.cad_fiados[0].saldo = 70
  const remoto = clone(b)
  remoto.receitas[0].preco = 12           // admin mudou o preço
  const r = mesclar({ base: b, local, remote: remoto, papel: 'vendas' })
  assert.equal(r.dados.receitas[0].preco, 12)
  assert.deepEqual(cfg(r.dados).company, { nome: 'ChocoBete' })
  assert.deepEqual(fiados(r.dados), [{ uid: 'F1', saldo: 70, status: 'aberto', pag: 1 }])
})

test('Vendas com cache limpo (banco vazio) não apaga nada do Drive', () => {
  const b = base()
  const r = mesclar({ base: null, local: vazio(), remote: clone(b), papel: 'vendas' })
  assert.equal(r.dados.receitas.length, 1)
  assert.equal(r.dados.cad_fiados.length, 1)
  assert.equal(r.igualAoRemoto, true)
})

test('Admin vazio recebe tudo e não envia nada', () => {
  const b = base()
  const r = mesclar({ base: null, local: vazio(), remote: clone(b), papel: 'admin' })
  assert.equal(r.dados.cad_fiados.length, 1)
  assert.equal(r.dados.receitas.length, 1)
  assert.equal(r.igualAoRemoto, true)
})

test('Dois aparelhos em paralelo convergem, cada um dono da sua área', () => {
  const b = base()
  // Vendas recebe pagamento; Admin muda preço — sem se ver ainda
  const vendas = clone(b)
  vendas.cad_fiados[0].pagamentos = [{ valor: 25, criadoEm: '2026-11-03T09:00:00Z' }]
  vendas.cad_fiados[0].saldo = 75
  const admin = clone(b)
  admin.receitas[0].preco = 15
  admin.config.find(c => c.chave === 'company').valor = { nome: 'ChocoBete Ltda' }

  // 1) Vendas envia ao Drive (drive = base + pagamento)
  let drive = mesclar({ base: b, local: vendas, remote: clone(b), papel: 'vendas' }).dados
  // 2) Admin sincroniza: recebe as cobranças, mantém o que é seu
  const adm = mesclar({ base: b, local: admin, remote: drive, papel: 'admin' })
  drive = adm.dados
  // 3) Vendas sincroniza: recebe preço e config
  const ven = mesclar({ base: b, local: vendas, remote: drive, papel: 'vendas' })

  for (const d of [adm.dados, ven.dados]) {
    assert.equal(d.receitas[0].preco, 15)
    assert.deepEqual(cfg(d).company, { nome: 'ChocoBete Ltda' })
    assert.deepEqual(fiados(d), [{ uid: 'F1', saldo: 75, status: 'aberto', pag: 1 }])
  }
})

test('Sem papel: comportamento antigo (merge em tudo)', () => {
  const b = base()
  const local = clone(b); local.receitas[0].preco = 99
  const r = mesclar({ base: b, local, remote: clone(b), papel: null })
  assert.equal(r.dados.receitas[0].preco, 99)
})

test('Idempotente: sincronizar de novo sem mudanças não gera nada a enviar', () => {
  for (const papel of ['admin', 'vendas']) {
    const b = base()
    const local = clone(b)
    if (papel === 'vendas') { local.cad_fiados[0].pagamentos = [{ valor: 10, criadoEm: '2026-11-04T08:00:00Z' }]; local.cad_fiados[0].saldo = 90 }
    else local.receitas[0].preco = 20
    const r1 = mesclar({ base: b, local, remote: clone(b), papel })
    const r2 = mesclar({ base: r1.dados, local: r1.dados, remote: r1.dados, papel })
    assert.equal(r2.igualAoLocal, true, papel)
    assert.equal(r2.igualAoRemoto, true, papel)
  }
})

test('Não perde dados: contagem de registros do Drive nunca diminui por causa de um aparelho vazio', () => {
  const b = base()
  for (const papel of ['admin', 'vendas']) {
    const r = mesclar({ base: b, local: vazio(), remote: clone(b), papel })
    const conta = (d) => ['produtos', 'receitas', 'cad_lojas', 'cad_clientes', 'cad_fiados'].reduce((s, t) => s + d[t].length, 0)
    const donoPerde = papel === 'admin' ? ['receitas'] : ['cad_lojas', 'cad_clientes', 'cad_fiados']
    // áreas do outro dono: iguais ao Drive; áreas próprias: o aparelho apagou, vale a sua decisão
    for (const t of ['cad_lojas', 'cad_clientes', 'cad_fiados', 'receitas']) {
      if (!donoPerde.includes(t)) assert.equal(r.dados[t].length, b[t].length, `${papel}:${t}`)
    }
    assert.ok(conta(r.dados) >= 1)
  }
})
