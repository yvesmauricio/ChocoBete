import test from 'node:test'
import assert from 'node:assert/strict'
import { resumir, verificarQueda, problemasNovos, conferir } from '../src/services/validacaoDados.js'

const clone = (x) => JSON.parse(JSON.stringify(x))
function dados(nFiados = 20) {
  const d = { cad_lojas: [{ id: 1, uid: 'L1' }], cad_clientes: [], cad_fiados: [], receitas: [], produtos: [], producoes: [], financeiro: [], cardapio_pedidos: [] }
  for (let i = 1; i <= 5; i++) d.cad_clientes.push({ id: i, uid: 'C' + i, lojaId: 1, nome: 'C' + i })
  for (let i = 1; i <= nFiados; i++) d.cad_fiados.push({ id: i, uid: 'F' + i, clienteId: (i % 5) + 1, lojaId: 1, total: 100, saldo: 60, status: 'aberto', pagamentos: [{ valor: 40 }] })
  return d
}

test('resumo: contagens e saldo em aberto', () => {
  const r = resumir(dados(3))
  assert.equal(r.cad_fiados, 3); assert.equal(r.fiadosAbertos, 3); assert.equal(r.saldoAberto, 180)
})
test('queda: banco vazio contra 20 vendas é apontado', () => {
  const q = verificarQueda(dados(20), { cad_fiados: [] })
  assert.ok(q.some(x => x.tabela === 'cad_fiados'))
})
test('queda: perder 1 de 20 não é alarme; perder 10 é', () => {
  const a = dados(20)
  const b1 = clone(a); b1.cad_fiados.pop()
  assert.equal(verificarQueda(a, b1).length, 0)
  const b10 = clone(a); b10.cad_fiados.length = 10
  assert.equal(verificarQueda(a, b10).length, 1)
})
test('queda: base pequena (ex.: 4 lojas → 2) só alerta se perder fração E mínimo', () => {
  const a = { cad_lojas: [1, 2, 3, 4].map(id => ({ id })) }
  assert.equal(verificarQueda(a, { cad_lojas: [{ id: 1 }, { id: 2 }] }).length, 0, 'perdeu 2 (<3)')
})
test('crescer nunca alerta', () => {
  assert.equal(verificarQueda(dados(5), dados(30)).length, 0)
})
test('problemas: só os NOVOS contam — dado antigo incoerente não trava', () => {
  const antes = dados(3); antes.cad_fiados[0].saldo = 55            // já era incoerente
  const depois = clone(antes)
  assert.equal(problemasNovos(antes, depois).length, 0)
  depois.cad_fiados[1].saldo = 10                                    // novo: não fecha com pagamentos
  const n = problemasNovos(antes, depois)
  assert.equal(n.length, 1); assert.match(n[0], /não bate com total/)
})
test('problemas: venda sem cliente, saldo negativo, status incoerente', () => {
  const antes = dados(3)
  const d = clone(antes)
  d.cad_fiados[0].clienteId = 999
  d.cad_fiados[1].saldo = -5; d.cad_fiados[1].pagamentos = []; d.cad_fiados[1].total = 100
  d.cad_fiados[2].status = 'pago'
  const n = problemasNovos(antes, d).join(' | ')
  assert.match(n, /sem cliente/); assert.match(n, /saldo negativo/); assert.match(n, /status "pago"/)
})
test('pagamento normal e quitação não geram problema', () => {
  const antes = dados(3)
  const d = clone(antes)
  d.cad_fiados[0].pagamentos.push({ valor: 60 }); d.cad_fiados[0].saldo = 0; d.cad_fiados[0].status = 'pago'
  assert.equal(problemasNovos(antes, d).length, 0)
  assert.equal(conferir(antes, d).ok, true)
})
test('conferir: devolve frases prontas para a tela', () => {
  const r = conferir(dados(20), { ...dados(20), cad_fiados: [] })
  assert.equal(r.ok, false)
  assert.match(r.linhas[0], /vendas fiadas: de 20 para 0/)
})
test('saldo aberto mesmo com tudo pago é apontado', () => {
  const antes = dados(2)
  const d = clone(antes)
  d.cad_fiados[0].pagamentos = [{ valor: 100 }]; d.cad_fiados[0].saldo = 50   // total == pago, mas saldo 50
  assert.match(problemasNovos(antes, d).join('|'), /não bate com total/)
})
