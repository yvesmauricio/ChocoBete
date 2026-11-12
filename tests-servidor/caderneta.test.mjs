import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarD1 } from './d1shim.mjs'
import { aplicarOperacao, lerEstado, conferenciaCaderneta } from '../functions/_lib/caderneta.js'

const U = (s) => `${s}-0000000000000000`.slice(0, 24)   // uuid curto válido p/ uuidOk (8–64)
let n = 0
const novo = () => ({ DB: criarD1(), ctx: { usuario: 'teste@x', aparelho: 'a1', agora: 1_700_000_000_000 } })
const op = (tipo, dados, extra = {}) => ({ op_id: U('op' + ++n), tipo, dados, criado_no_aparelho: 1_700_000_000_000, ...extra })
const rodar = (e, o) => aplicarOperacao(e.DB, o, { ...e.ctx, agora: (e.ctx.agora += 1000) })

async function cenario() {
  const e = novo()
  await rodar(e, op('loja.salvar', { uid: U('loja1'), nome: 'Padaria Sol' }))
  await rodar(e, op('cliente.salvar', { uid: U('cli1'), loja_uid: U('loja1'), nome: 'Ana', telefone: '(21) 99943-0023', funcao: 'Gerente' }))
  const r = await rodar(e, op('venda.criar', {
    uid: U('v1'), cliente_uid: U('cli1'), data_venda: '2026-11-01', data_venc: '2026-11-20',
    itens: [{ id: 'p1', nome: 'Trufa', qtd: 10, preco_centavos: 350 }, { id: 'p2', nome: 'Cone', qtd: 2, preco_centavos: 1250 }],
    desconto_centavos: 500, total_centavos: 3500 + 2500 - 500,
  }))
  assert.equal(r.status, 'aplicada', r.motivo)
  return e
}
const venda = (e, uid = U('v1')) => e.DB.raw.prepare('SELECT * FROM cad_vendas WHERE uid=?').get(uid)

test('venda: total e saldo calculados pelo servidor em centavos', async () => {
  const e = await cenario()
  const v = venda(e)
  assert.equal(v.bruto_centavos, 6000); assert.equal(v.total_centavos, 5500); assert.equal(v.saldo_centavos, 5500); assert.equal(v.status, 'aberto')
})

test('venda: total divergente do aparelho é rejeitado', async () => {
  const e = await cenario()
  const r = await rodar(e, op('venda.criar', { uid: U('v2'), cliente_uid: U('cli1'), data_venda: '2026-11-02', itens: [{ nome: 'X', qtd: 1, preco_centavos: 100 }], total_centavos: 99 }))
  assert.equal(r.status, 'rejeitada')
})

test('venda: preço em reais decimais (float) é rejeitado', async () => {
  const e = await cenario()
  const r = await rodar(e, op('venda.criar', { uid: U('v2'), cliente_uid: U('cli1'), data_venda: '2026-11-02', itens: [{ nome: 'X', qtd: 1, preco_centavos: 3.5 }] }))
  assert.equal(r.status, 'rejeitada')
})

test('pagamento parcial e quitação: pago só com saldo zero', async () => {
  const e = await cenario()
  assert.equal((await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 2000 }))).status, 'aplicada')
  assert.deepEqual([venda(e).saldo_centavos, venda(e).status], [3500, 'aberto'])
  assert.equal((await rodar(e, op('pagamento.registrar', { uid: U('p2'), venda_uid: U('v1'), valor_centavos: 3500 }))).status, 'aplicada')
  const v = venda(e); assert.deepEqual([v.saldo_centavos, v.status], [0, 'pago']); assert.ok(v.pago_em)
})

test('pagamento maior que o saldo é rejeitado e nada muda', async () => {
  const e = await cenario()
  const r = await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 5501 }))
  assert.equal(r.status, 'rejeitada'); assert.equal(venda(e).saldo_centavos, 5500)
})

test('idempotência: reenviar a mesma operação não paga duas vezes', async () => {
  const e = await cenario()
  const o = op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 1000 })
  assert.equal((await rodar(e, o)).status, 'aplicada')
  assert.equal((await rodar(e, o)).status, 'duplicada')
  assert.equal(venda(e).saldo_centavos, 4500)
})

test('estorno: pagamento continua no histórico, saldo volta, venda reabre', async () => {
  const e = await cenario()
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 5500 }))
  assert.equal(venda(e).status, 'pago')
  const r = await rodar(e, op('pagamento.estornar', { uid: U('e1'), pagamento_uid: U('p1'), motivo: 'lançado errado' }))
  assert.equal(r.status, 'aplicada', r.motivo)
  const v = venda(e); assert.deepEqual([v.saldo_centavos, v.status, v.pago_em], [5500, 'aberto', null])
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) n FROM cad_pagamentos').get().n, 1)   // não apagou
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) n FROM cad_estornos').get().n, 1)
  assert.equal((await rodar(e, op('pagamento.estornar', { uid: U('e2'), pagamento_uid: U('p1') }))).status, 'rejeitada') // 2º estorno
})

test('recebimento parcial: abate da mais antiga e reagenda o restante', async () => {
  const e = await cenario()
  await rodar(e, op('venda.criar', { uid: U('v2'), cliente_uid: U('cli1'), data_venda: '2026-11-05', data_venc: '2026-11-25', itens: [{ nome: 'Y', qtd: 1, preco_centavos: 4000 }] }))
  const r = await rodar(e, op('recebimento.parcial', { uid: U('rec1'), venda_uids: [U('v2'), U('v1')], valor_centavos: 7000, nova_data_venc: '2026-12-10' }))
  assert.equal(r.status, 'aplicada', r.motivo)
  assert.deepEqual([venda(e, U('v1')).saldo_centavos, venda(e, U('v1')).status], [0, 'pago'])        // mais antiga quitada
  assert.equal(venda(e, U('v2')).saldo_centavos, 2500); assert.equal(venda(e, U('v2')).data_venc, '2026-12-10')
  assert.equal((await conferenciaCaderneta(e.DB)).ok, true)
})

test('recebimento parcial acima do saldo é rejeitado inteiro', async () => {
  const e = await cenario()
  const r = await rodar(e, op('recebimento.parcial', { uid: U('rec1'), venda_uids: [U('v1')], valor_centavos: 9999, nova_data_venc: '2026-12-10' }))
  assert.equal(r.status, 'rejeitada'); assert.equal(venda(e).saldo_centavos, 5500)
})

test('renomear loja não reescreve o histórico das vendas', async () => {
  const e = await cenario()
  await rodar(e, op('loja.salvar', { uid: U('loja1'), nome: 'Padaria Lua' }))
  assert.equal(venda(e).loja_nome, 'Padaria Sol')
})

test('unicidade: loja (sem acento/caixa) e telefone (com/sem nono dígito)', async () => {
  const e = await cenario()
  assert.equal((await rodar(e, op('loja.salvar', { uid: U('loja2'), nome: '  padaria  SOL ' }))).status, 'rejeitada')
  await rodar(e, op('loja.salvar', { uid: U('loja2'), nome: 'Mercado' }))
  const r = await rodar(e, op('cliente.salvar', { uid: U('cli2'), loja_uid: U('loja2'), nome: 'Bia', telefone: '21 9943-0023' }))
  assert.equal(r.status, 'rejeitada')
})

test('cancelar: só sem pagamento ativo; depois não aceita pagamento', async () => {
  const e = await cenario()
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 100 }))
  assert.equal((await rodar(e, op('venda.cancelar', { venda_uid: U('v1') }))).status, 'rejeitada')
  await rodar(e, op('pagamento.estornar', { uid: U('e1'), pagamento_uid: U('p1') }))
  assert.equal((await rodar(e, op('venda.cancelar', { venda_uid: U('v1'), motivo: 'engano' }))).status, 'aplicada')
  assert.equal((await rodar(e, op('pagamento.registrar', { uid: U('p2'), venda_uid: U('v1'), valor_centavos: 100 }))).status, 'rejeitada')
})

test('operação rejeitada fica registrada e não é reaplicada', async () => {
  const e = await cenario()
  const o = op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 999999 })
  assert.equal((await rodar(e, o)).status, 'rejeitada')
  const again = await rodar(e, o); assert.equal(again.status, 'duplicada'); assert.equal(again.resultado, 'rejeitada')
})

test('leitura incremental por cursor', async () => {
  const e = await cenario()
  const a = await lerEstado(e.DB, 0)
  assert.equal(a.vendas.length, 1); assert.equal(a.itens.length, 2); assert.equal(a.lojas.length, 1)
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 100 }))
  const b = await lerEstado(e.DB, a.cursor)
  assert.equal(b.pagamentos.length, 1); assert.equal(b.vendas[0].saldo_centavos, 5400); assert.equal(b.lojas.length, 0)
  assert.equal((await lerEstado(e.DB, b.cursor)).vendas.length, 0)
})

test('leitura completa (desde=0) com mais de 100 vendas não estoura o limite de 100 valores do D1', async () => {
  const e = await cenario()   // já tem 1 venda
  for (let i = 2; i <= 144; i++) {
    const r = await rodar(e, op('venda.criar', { uid: U('vv' + i), cliente_uid: U('cli1'), data_venda: '2026-11-01',
      itens: [{ id: 'p1', nome: 'Trufa', qtd: 1, preco_centavos: 700 }], desconto_centavos: 0, total_centavos: 700 }))
    assert.equal(r.status, 'aplicada', r.motivo)
    if (i % 2 === 0) await rodar(e, op('pagamento.registrar', { uid: U('pg' + i), venda_uid: U('vv' + i), valor_centavos: 100 }))
  }
  const a = await lerEstado(e.DB, 0)
  assert.equal(a.vendas.length, 144)
  assert.equal(a.itens.length, 2 + 143)
  assert.equal(a.pagamentos.length, 72)
  assert.equal(a.mais, false)
  // as vendas voltam com o saldo certo (pagamentos parciais aplicados)
  assert.equal(a.vendas.filter(v => v.saldo_centavos === 600).length, 72)
})

// ── O BANCO se defende sozinho: SQL direto, ignorando toda a camada acima ──
const tenta = (e, sql, ...a) => assert.throws(() => e.DB.raw.prepare(sql).run(...a), /E_|constraint/i)

test('banco: não deixa alterar saldo/status na mão', async () => {
  const e = await cenario()
  tenta(e, "UPDATE cad_vendas SET saldo_centavos = 0, status = 'pago' WHERE uid = ?", U('v1'))     // incoerente
  tenta(e, 'UPDATE cad_vendas SET saldo_centavos = -1 WHERE uid = ?', U('v1'))
  tenta(e, 'UPDATE cad_vendas SET saldo_centavos = 999999 WHERE uid = ?', U('v1'))
  tenta(e, "UPDATE cad_vendas SET status = 'pago' WHERE uid = ?", U('v1'))                          // pago com saldo > 0
  tenta(e, 'UPDATE cad_vendas SET total_centavos = 1, bruto_centavos = 1, desconto_centavos = 0 WHERE uid = ?', U('v1'))
  assert.equal(venda(e).saldo_centavos, 5500)
})

test('banco: histórico imutável e sem exclusão', async () => {
  const e = await cenario()
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 100 }))
  tenta(e, 'DELETE FROM cad_pagamentos WHERE uid = ?', U('p1'))
  tenta(e, 'UPDATE cad_pagamentos SET valor_centavos = 1 WHERE uid = ?', U('p1'))
  tenta(e, 'DELETE FROM cad_vendas WHERE uid = ?', U('v1'))
  tenta(e, 'DELETE FROM cad_lojas WHERE uid = ?', U('loja1'))
  tenta(e, 'DELETE FROM cad_venda_itens WHERE venda_uid = ?', U('v1'))
  tenta(e, 'DELETE FROM operacoes')
  assert.equal(venda(e).saldo_centavos, 5400)
})

test('banco: pagamento direto maior que o saldo ou com saldo_antes velho é recusado', async () => {
  const e = await cenario()
  const ins = `INSERT INTO cad_pagamentos (uid,venda_uid,valor_centavos,saldo_antes_centavos,saldo_depois_centavos,data,criado_em) VALUES (?,?,?,?,?,?,?)`
  tenta(e, ins, 'x1', U('v1'), 6000, 6000, 0, '2026-11-01', 1)
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) n FROM cad_pagamentos').get().n, 0)
  e.DB.raw.prepare(ins).run('ok1', U('v1'), 1000, 5500, 4500, '2026-11-01', 1)
  tenta(e, ins, 'x2', U('v1'), 1000, 5500, 4500, '2026-11-01', 2)         // saldo_antes desatualizado
  assert.equal(venda(e).saldo_centavos, 4500)
})

test('banco: dinheiro não aceita texto/decimal nas contas de centavos', async () => {
  const e = await cenario()
  tenta(e, `INSERT INTO cad_vendas (uid,cliente_uid,loja_uid,cliente_nome,loja_nome,bruto_centavos,desconto_centavos,total_centavos,saldo_centavos,status,data_venda,criado_em,atualizado_em)
            VALUES ('z',?,?,'a','b',100,0,100,100,'aberto','01/11/2026',1,1)`, U('cli1'), U('loja1'))   // data fora do padrão
})

test('conferência geral fecha em zero violações', async () => {
  const e = await cenario()
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 1500 }))
  await rodar(e, op('pagamento.estornar', { uid: U('e1'), pagamento_uid: U('p1') }))
  await rodar(e, op('pagamento.registrar', { uid: U('p2'), venda_uid: U('v1'), valor_centavos: 500 }))
  const c = await conferenciaCaderneta(e.DB)
  assert.equal(c.ok, true); assert.equal(c.saldo_aberto_centavos, 5000); assert.deepEqual(c.contagens.pagamentos, 2)
})

test('banco: estorno direto com valor errado ou de pagamento de outra venda é recusado', async () => {
  const e = await cenario()
  await rodar(e, op('venda.criar', { uid: U('v2'), cliente_uid: U('cli1'), data_venda: '2026-11-05', itens: [{ nome: 'Y', qtd: 1, preco_centavos: 4000 }] }))
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 1000 }))
  const ins = `INSERT INTO cad_estornos (uid,pagamento_uid,venda_uid,valor_centavos,data,criado_em) VALUES (?,?,?,?,?,?)`
  tenta(e, ins, 'e1', U('p1'), U('v1'), 999, '2026-11-01', 1)          // valor diferente do pagamento
  tenta(e, ins, 'e2', U('p1'), U('v2'), 1000, '2026-11-01', 1)         // pagamento é de outra venda
  assert.equal(venda(e).saldo_centavos, 4500); assert.equal(venda(e, U('v2')).saldo_centavos, 4000)
})

test('pagamento criado por recebimento parcial pode ser estornado depois', async () => {
  const e = await cenario()
  await rodar(e, op('venda.criar', { uid: U('v2'), cliente_uid: U('cli1'), data_venda: '2026-11-05', itens: [{ nome: 'Y', qtd: 1, preco_centavos: 4000 }] }))
  await rodar(e, op('recebimento.parcial', { uid: U('rec1'), venda_uids: [U('v1'), U('v2')], valor_centavos: 5500, nova_data_venc: '2026-12-10' }))
  const pags = e.DB.raw.prepare("SELECT uid, venda_uid FROM cad_pagamentos ORDER BY uid").all()
  assert.ok(pags.length >= 1)
  const r = await rodar(e, op('pagamento.estornar', { uid: U('est1'), pagamento_uid: pags[0].uid }))
  assert.equal(r.status, 'aplicada', r.motivo)
  assert.equal((await conferenciaCaderneta(e.DB)).ok, true)
})

// ── Correção = cancelar a errada + lançar a certa ──
const certa = (uid, extra = {}) => ({ uid, data_venda: '2026-11-01', data_venc: '2026-11-25', itens: [{ nome: 'Trufa', qtd: 12, preco_centavos: 350 }], ...extra })

test('corrigir: cancela a errada e lança a certa, com ligação e sem apagar nada', async () => {
  const e = await cenario()
  const r = await rodar(e, op('venda.corrigir', { venda_uid: U('v1'), nova: certa(U('v1b')) }))
  assert.equal(r.status, 'aplicada', r.motivo)
  const velha = venda(e), nova = venda(e, U('v1b'))
  assert.ok(velha.cancelada_em); assert.match(velha.motivo_cancelamento, /Corrigida/); assert.equal(velha.total_centavos, 5500)   // histórico intacto
  assert.deepEqual([nova.total_centavos, nova.saldo_centavos, nova.substitui_uid, nova.cliente_uid], [4200, 4200, U('v1'), U('cli1')])
  assert.equal((await conferenciaCaderneta(e.DB)).saldo_aberto_centavos, 4200)       // só a certa conta no saldo em aberto
})

test('corrigir é tudo-ou-nada: com pagamento ativo recusa e NÃO cria a nova', async () => {
  const e = await cenario()
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 100 }))
  const r = await rodar(e, op('venda.corrigir', { venda_uid: U('v1'), nova: certa(U('v1b')) }))
  assert.equal(r.status, 'rejeitada'); assert.match(r.motivo, /estorne/i)
  assert.equal(venda(e, U('v1b')), undefined); assert.equal(venda(e).cancelada_em, null)
})

test('corrigir: nova com dado inválido recusa e a antiga continua aberta; depois de estornar, corrige', async () => {
  const e = await cenario()
  assert.equal((await rodar(e, op('venda.corrigir', { venda_uid: U('v1'), nova: certa(U('v1b'), { itens: [{ nome: 'X', qtd: 1, preco_centavos: 1.5 }] }) }))).status, 'rejeitada')
  assert.equal(venda(e).cancelada_em, null)
  await rodar(e, op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 100 }))
  await rodar(e, op('pagamento.estornar', { uid: U('e1'), pagamento_uid: U('p1') }))
  assert.equal((await rodar(e, op('venda.corrigir', { venda_uid: U('v1'), nova: certa(U('v1c')) }))).status, 'aplicada')
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) n FROM cad_pagamentos').get().n, 1)   // pagamento estornado continua no histórico
})

test('corrigir duas vezes a mesma venda: a segunda é recusada (já cancelada)', async () => {
  const e = await cenario()
  await rodar(e, op('venda.corrigir', { venda_uid: U('v1'), nova: certa(U('v1b')) }))
  assert.equal((await rodar(e, op('venda.corrigir', { venda_uid: U('v1'), nova: certa(U('v1c')) }))).status, 'rejeitada')
  assert.equal(venda(e, U('v1c')), undefined)
})
