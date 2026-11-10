import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrarCaderneta, montarRelatorio } from '../scripts/migrar-caderneta.mjs'
import { criarD1 } from './d1shim.mjs'
import { conferenciaCaderneta } from '../functions/_lib/caderneta.js'

const AGORA = 1_700_000_000_000
const backup = () => ({
  cad_lojas: [
    { id: 1, uid: 'lg:cad_lojas:1', nome: 'Padaria Sol' }, { id: 2, uid: 'u-loja-2', nome: 'Mercado Lua' },
    { id: 3, uid: 'u-loja-3', nome: 'padaria  sol' },                       // duplicada (sem caixa/espaços)
    { id: 4, uid: 'u-loja-4', nome: 'Velha', arquivado: true, arquivadoEm: '2026-01-05T10:00:00Z' },
  ],
  cad_clientes: [
    { id: 1, uid: 'lg:cad_clientes:1', lojaId: 1, nome: 'Ana', telefone: '(21) 99943-0023', funcao: 'Gerente' },
    { id: 2, uid: 'cliente-2', lojaId: 2, nome: 'Bia', telefone: '21 9943-0023' },           // mesmo telefone da Ana (sem nono dígito)
    { id: 3, uid: 'cliente-3', lojaId: 3, nome: 'Zé', telefone: '' },                        // loja duplicada, não entrou
    { id: 4, uid: 'cliente-4', lojaId: 2, nome: 'Caio', telefone: '' },
  ],
  cad_fiados: [
    // 1) normal, parcialmente pago, com float clássico
    { id: 1, uid: 'venda-f1', clienteId: 1, lojaId: 1, clienteNome: 'Ana', lojaNome: 'Padaria Sol', itens: [{ id: 'a', nome: 'Trufa', qty: 3, preco: 0.1 + 0.2 }, { id: 'b', nome: 'Cone', qty: 1, preco: 9.1 }],
      total: 10, desconto: 0, saldo: 7.5, status: 'aberto', dataVenda: '2026-10-01', dataVenc: '2026-10-20',
      pagamentos: [{ valor: 2.5, data: '2026-10-05', hora: '10:00', criadoEm: '2026-10-05T13:00:00Z' }] },
    // 2) quitada com desconto
    { id: 2, uid: 'venda-f2', clienteId: 2, lojaId: 2, itens: [{ nome: 'Bolo', qty: 1, preco: 50 }], total: 45, desconto: 5, saldo: 0, status: 'pago', dataVenda: '2026-10-02',
      pagamentos: [{ valor: 20, data: '2026-10-03', criadoEm: '2026-10-03T12:00:00Z' }, { valor: 25, data: '2026-10-04', criadoEm: '2026-10-04T12:00:00Z' }] },
    // 3) com estorno antigo (pagamento foi removido da lista): pago 30 e estornado, 0 pagamentos ativos
    { id: 3, uid: 'venda-f3', clienteId: 4, lojaId: 2, itens: [{ nome: 'Torta', qty: 1, preco: 30 }], total: 30, saldo: 30, status: 'aberto', dataVenda: '2026-10-06', pagamentos: [],
      estornos: [{ valor: 30, pagamentoData: '2026-10-07', pagamentoHora: '09:00', pagamentoCriadoEm: '2026-10-07T12:00:00Z', data: '2026-10-08', hora: '11:00', criadoEm: '2026-10-08T14:00:00Z' }] },
    // 4) divergente: saldo não bate com pagamentos
    { id: 4, uid: 'venda-f4', clienteId: 1, lojaId: 1, itens: [{ nome: 'X', qty: 1, preco: 100 }], total: 100, saldo: 40, status: 'aberto', dataVenda: '2026-10-09',
      pagamentos: [{ valor: 50, data: '2026-10-10', criadoEm: '2026-10-10T12:00:00Z' }] },
    // 5) resíduo de 1 centavo marcado como pago (tolerância antiga)
    { id: 5, uid: 'venda-f5', clienteId: 1, lojaId: 1, itens: [{ nome: 'Y', qty: 1, preco: 10 }], total: 10, saldo: 0.01, status: 'pago', dataVenda: '2026-10-11',
      pagamentos: [{ valor: 9.99, data: '2026-10-12', criadoEm: '2026-10-12T12:00:00Z' }] },
    // 6) cliente de loja que não entrou
    { id: 6, uid: 'venda-f6', clienteId: 3, lojaId: 3, itens: [{ nome: 'Z', qty: 1, preco: 20 }], total: 20, saldo: 20, status: 'aberto', dataVenda: '2026-10-13', pagamentos: [] },
    // 7) itens não somam o bruto
    { id: 7, uid: 'venda-f7', clienteId: 4, lojaId: 2, itens: [{ nome: 'W', qty: 1, preco: 10 }], total: 99, saldo: 99, status: 'aberto', dataVenda: '2026-10-14', pagamentos: [] },
    // 8) valor com 3 casas
    { id: 8, uid: 'venda-f8', clienteId: 4, lojaId: 2, itens: [{ nome: 'V', qty: 1, preco: 1.005 }], total: 1.005, saldo: 1.005, status: 'aberto', dataVenda: '2026-10-15', pagamentos: [] },
  ],
})

test('migração: o que é consistente entra; o resto vai para quarentena com motivo', async () => {
  const r = migrarCaderneta(backup(), { agora: AGORA })
  const rel = await montarRelatorio(r)
  assert.equal(rel.depois.contagens.vendas, 3)                                   // f1, f2, f3
  assert.deepEqual(r.quarentena.filter(q => q.tabela === 'cad_fiados').map(q => q.registro.id).sort(), [4, 5, 6, 7, 8])
  assert.equal(r.quarentena.filter(q => q.tabela === 'cad_lojas').length, 1)     // loja duplicada
  assert.equal(r.quarentena.filter(q => q.tabela === 'cad_clientes').length, 1)  // cliente da loja que não entrou
  assert.ok(r.avisos.some(a => a.tipo === 'telefone_duplicado'))
  assert.equal(rel.checks.saldo_confere, true, JSON.stringify(rel.checks))       // legado = importado + quarentena, ao centavo
  assert.equal(rel.checks.sem_violacoes_no_banco, true)
  assert.equal(rel.checks.pagamentos_confere, true)
  assert.equal(rel.ok_para_prosseguir, false)                                    // há quarentena: decisão humana
})

test('migração: valores e histórico ficam corretos', async () => {
  const r = migrarCaderneta(backup(), { agora: AGORA })
  const q = (s, ...a) => r.D1.raw.prepare(s).all(...a)
  const f1 = q("SELECT * FROM cad_vendas WHERE uid='venda-f1'")[0]
  assert.deepEqual([f1.total_centavos, f1.saldo_centavos, f1.status], [1000, 750, 'aberto'])
  assert.equal(q("SELECT subtotal_centavos s FROM cad_venda_itens WHERE venda_uid='venda-f1' AND pos=0")[0].s, 90)   // 0.1+0.2 → 30 centavos × 3
  const f2 = q("SELECT * FROM cad_vendas WHERE uid='venda-f2'")[0]
  assert.deepEqual([f2.bruto_centavos, f2.desconto_centavos, f2.saldo_centavos, f2.status], [5000, 500, 0, 'pago'])
  const f3 = q("SELECT * FROM cad_vendas WHERE uid='venda-f3'")[0]
  assert.deepEqual([f3.saldo_centavos, f3.status], [3000, 'aberto'])
  assert.equal(q("SELECT COUNT(*) n FROM cad_pagamentos WHERE venda_uid='venda-f3'")[0].n, 1)   // pagamento recuperado...
  assert.equal(q("SELECT COUNT(*) n FROM cad_estornos WHERE venda_uid='venda-f3'")[0].n, 1)     // ...e estornado, sem sumir
  assert.ok(JSON.parse(f1.origem_json).uid === 'venda-f1')                                      // registro original guardado
  assert.equal(q("SELECT arquivada_em a FROM cad_lojas WHERE uid='u-loja-4'")[0].a, Date.parse('2026-01-05T10:00:00Z'))
})

test('migração: o SQL gerado aplica limpo em banco novo e dá os mesmos números', async () => {
  const r = migrarCaderneta(backup(), { agora: AGORA })
  const novo = criarD1()
  novo.raw.exec(r.sql)
  const a = await conferenciaCaderneta(novo), b = await conferenciaCaderneta(r.D1)
  assert.deepEqual(a, b); assert.equal(a.ok, true)
})

test('migração: backup 100% consistente fecha sem pendências', async () => {
  const b = backup(); b.cad_lojas = b.cad_lojas.filter(l => l.id !== 3); b.cad_clientes = b.cad_clientes.filter(c => c.id !== 3)
  b.cad_clientes[1].telefone = ''; b.cad_fiados = b.cad_fiados.filter(f => [1, 2, 3].includes(f.id))
  const r = migrarCaderneta(b, { agora: AGORA })
  const rel = await montarRelatorio(r)
  assert.equal(r.quarentena.length, 0); assert.equal(rel.ok_para_prosseguir, true)
})

test('migração: pagamento duplicado (idêntico) só é descartado com a opção explícita', async () => {
  const dup = () => {
    const b = backup(); b.cad_lojas = b.cad_lojas.filter(l => l.id !== 3); b.cad_clientes = b.cad_clientes.filter(c => c.id !== 3); b.cad_clientes[1].telefone = ''
    const p = { valor: 7, data: '2026-10-30', saldoAntes: 7, saldoDepois: 0 }
    b.cad_fiados = [{ id: 9, uid: 'venda-dup1', clienteId: 4, lojaId: 2, clienteNome: 'Caio', itens: [{ nome: 'Trufa', qty: 1, preco: 7 }], total: 7, saldo: 0, status: 'pago',
      dataVenda: '2026-10-15', pagamentos: [{ ...p, criadoEm: '2026-10-30T14:20:28Z' }, { ...p, criadoEm: '2026-10-30T14:32:17Z' }] }]
    return b
  }
  const sem = migrarCaderneta(dup(), { agora: AGORA })
  assert.equal(sem.quarentena.length, 1)                                           // por padrão NÃO corrige sozinho
  const com = migrarCaderneta(dup(), { agora: AGORA, descartarPagamentosDuplicados: true })
  const rel = await montarRelatorio(com)
  assert.equal(com.quarentena.length, 0); assert.equal(com.ajustes.length, 1)
  assert.equal(com.D1.raw.prepare("SELECT COUNT(*) n FROM cad_pagamentos WHERE venda_uid='venda-dup1'").get().n, 1)
  assert.equal(JSON.parse(com.D1.raw.prepare("SELECT origem_json o FROM cad_vendas WHERE uid='venda-dup1'").get().o).pagamentos.length, 2) // original preservado
  assert.equal(rel.ok_para_prosseguir, true, JSON.stringify(rel.checks))
  // pagamentos parecidos mas com saldoAntes diferente (pagamento legítimo em duas vezes) NÃO são tocados
  const b = dup(); b.cad_fiados[0].total = 14; b.cad_fiados[0].itens[0].qty = 2; b.cad_fiados[0].pagamentos[0].saldoAntes = 14; b.cad_fiados[0].pagamentos[0].saldoDepois = 7
  const legit = migrarCaderneta(b, { agora: AGORA, descartarPagamentosDuplicados: true })
  assert.equal(legit.ajustes.length, 0); assert.equal(legit.quarentena.length, 0)
})
