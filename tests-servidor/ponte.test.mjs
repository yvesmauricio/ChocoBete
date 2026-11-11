// Ponte da Caderneta: banco local (Dexie, formato legado) ⇄ fila ⇄ servidor de verdade (SQLite + gatilhos).
import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarD1 } from './d1shim.mjs'
import { migrarCaderneta } from '../scripts/migrar-caderneta.mjs'
import { aplicarOperacao } from '../functions/_lib/caderneta.js'
import { onRequestPost } from '../functions/api/caderneta/ops.js'
import { onRequestGet } from '../functions/api/caderneta/estado.js'
import { db } from '../src/db.js'
import { descarregar, puxarEstado, estadoFila, _usarFetch, filaDb, dispensarRejeitada } from '../src/services/filaOperacoes.js'
import { receberPagamentoServidor, quitarTudoServidor, receberParcialServidor, estornarServidor, alterarVencimentoServidor, projetarServidorNoLocal } from '../src/services/cadernetaServidor.js'

const TOKEN = 'x'.repeat(40)
const DB = criarD1()
const env = { DB, ADMIN_TOKEN: TOKEN }
let online = true
_usarFetch(async (url, init = {}) => {
  if (!online) throw new TypeError('offline')
  const req = new Request('https://app.test' + url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${TOKEN}` } })
  return url.startsWith('/api/caderneta/ops') ? onRequestPost({ request: req, env }) : onRequestGet({ request: req, env })
})

// ── dados legados (formato do app antigo) ──
const legado = {
  cad_lojas: [{ id: 1, uid: 'lg:cad_lojas:1', nome: 'Padaria Sol' }],
  cad_clientes: [
    { id: 1, uid: 'lg:cad_clientes:1', lojaId: 1, nome: 'Ana', telefone: '(21) 99943-0023' },
    { id: 2, uid: 'lg:cad_clientes:2', lojaId: 1, nome: 'Caio', telefone: '' },
  ],
  cad_fiados: [
    { id: 1, uid: 'lg:cad_fiados:1', clienteId: 1, lojaId: 1, clienteNome: 'Ana', lojaNome: 'Padaria Sol', itens: [{ id: 'a', nome: 'Trufa', qty: 10, preco: 10 }],
      total: 100, saldo: 70, status: 'aberto', dataVenda: '2026-10-01', dataVenc: '2026-10-20', pagamentos: [{ valor: 30, data: '2026-10-05', hora: '10:00', criadoEm: '2026-10-05T13:00:00.000Z' }], estornos: [] },
    { id: 2, uid: 'lg:cad_fiados:2', clienteId: 2, lojaId: 1, clienteNome: 'Caio', lojaNome: 'Padaria Sol', itens: [{ nome: 'Bolo', qty: 1, preco: 40 }],
      total: 40, saldo: 40, status: 'aberto', dataVenda: '2026-10-02', dataVenc: '2026-10-22', pagamentos: [], estornos: [] },
    { id: 3, uid: 'lg:cad_fiados:3', clienteId: 2, lojaId: 1, clienteNome: 'Caio', lojaNome: 'Padaria Sol', itens: [{ nome: 'Torta', qty: 1, preco: 60 }],
      total: 60, saldo: 60, status: 'aberto', dataVenda: '2026-10-03', dataVenc: '2026-10-23', pagamentos: [], estornos: [] },
  ],
}
const local = (id) => db.cad_fiados.get(id)
const srv = (uid) => DB.raw.prepare('SELECT * FROM cad_vendas WHERE uid=?').get(uid) ?? null
const sincronizar = async () => { online = true; await descarregar(); await puxarEstado(); return projetarServidorNoLocal() }

test('preparação: importa no servidor, aparelho com dados legados, projeção deixa o local igual', async () => {
  const r = migrarCaderneta(JSON.parse(JSON.stringify(legado)), { agora: 1_700_000_000_000 })
  assert.equal(r.quarentena.length, 0); DB.raw.exec(r.sql)
  for (const t of ['cad_lojas', 'cad_clientes', 'cad_fiados']) await db[t].bulkAdd(JSON.parse(JSON.stringify(legado[t])))
  await sincronizar()
  const f1 = await local(1)
  assert.equal(f1.saldo, 70); assert.equal(f1.uid, 'lg:cad_fiados:1')            // identidade local preservada
  assert.ok(f1.pagamentos[0].uid, 'o pagamento migrado ganhou o uid do servidor')
  assert.equal(await db.cad_fiados.count(), 3)                                    // nada duplicado
})

test('pagamento OFFLINE: aparece na hora, fica na fila, e ao voltar o sinal o servidor aplica uma vez', async () => {
  online = false
  await receberPagamentoServidor(await local(1), 20)
  assert.equal((await local(1)).saldo, 50)                                        // otimista
  assert.equal((await filaDb.fila.count()), 1)
  const m = await projetarServidorNoLocal()                                       // leitura com op pendente não pisa no otimismo
  assert.equal((await local(1)).saldo, 50)
  assert.equal(srv('lg_cad_fiados_1').saldo_centavos, 7000)                       // servidor ainda não sabe
  await sincronizar()
  assert.equal(srv('lg_cad_fiados_1').saldo_centavos, 5000)
  assert.equal(estadoFila.pendentes, 0); assert.equal((await local(1)).saldo, 50)
})

test('estorno de pagamento migrado: histórico fica no servidor, local reabre o saldo', async () => {
  const f = await local(1), alvo = f.pagamentos.find(p => p.valor === 30)
  assert.ok(alvo?.uid)
  await estornarServidor(f, alvo)
  await sincronizar()
  assert.equal(srv('lg_cad_fiados_1').saldo_centavos, 8000)
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM cad_pagamentos WHERE venda_uid='lg_cad_fiados_1'").get().n, 2)   // o pagamento de 30 continua lá
  const g = await local(1); assert.equal(g.saldo, 80); assert.equal(g.estornos.length, 1); assert.equal(g.pagamentos.length, 1)
})

test('recebimento parcial: abate da compra mais antiga e o pagamento criado pode ser estornado', async () => {
  const caio = [await local(2), await local(3)]
  await receberParcialServidor(caio, 55, '2026-12-15')
  await sincronizar()
  assert.deepEqual([srv('lg_cad_fiados_2').saldo_centavos, srv('lg_cad_fiados_3').saldo_centavos], [0, 4500])   // 40 + 15
  const a = await local(2), b = await local(3)
  assert.deepEqual([a.saldo, a.status, b.saldo, b.dataVenc], [0, 'pago', 45, '2026-12-15'])
  await estornarServidor(b, b.pagamentos[0])
  await sincronizar()
  assert.equal(srv('lg_cad_fiados_3').saldo_centavos, 6000)
})

test('quitar tudo e alterar vencimento', async () => {
  await quitarTudoServidor([await local(3)])
  await alterarVencimentoServidor(await local(1), '2026-12-31')
  await sincronizar()
  assert.deepEqual([srv('lg_cad_fiados_3').status, srv('lg_cad_fiados_3').saldo_centavos], ['pago', 0])
  assert.equal((await local(1)).dataVenc, '2026-12-31')
})

test('venda lançada em OUTRO aparelho aparece aqui (loja/cliente/venda criados a partir do servidor)', async () => {
  const cx = { usuario: 'bete@x', aparelho: 'outro', agora: 1_800_000_000_000 }
  const ops = [
    ['loja.salvar', { uid: 'loja-nova-0001', nome: 'Mercado Lua' }],
    ['cliente.salvar', { uid: 'cli-novo-00001', loja_uid: 'loja-nova-0001', nome: 'Duda', telefone: '' }],
    ['venda.criar', { uid: 'venda-nova-0001', cliente_uid: 'cli-novo-00001', data_venda: '2026-11-09', data_venc: '2026-11-30', itens: [{ nome: 'Cone', qtd: 2, preco_centavos: 1250 }] }],
  ]
  for (const [i, [tipo, dados]] of ops.entries()) assert.equal((await aplicarOperacao(DB, { op_id: `op-outro-aparelho-${i}`, tipo, dados }, { ...cx, agora: cx.agora + i })).status, 'aplicada')
  await sincronizar()
  const v = (await db.cad_fiados.toArray()).find(x => x.uid === 'venda-nova-0001')
  assert.equal(v.total, 25); assert.equal(v.clienteNome, 'Duda'); assert.equal(v.itens[0].qty, 2)
  const duda = (await db.cad_clientes.toArray()).find(c => c.nome === 'Duda')
  const lojaNova = (await db.cad_lojas.toArray()).find(l => l.nome === 'Mercado Lua')
  assert.ok(duda && lojaNova)
  assert.equal(v.clienteId, duda.id); assert.equal(v.lojaId, lojaNova.id); assert.equal(duda.lojaId, lojaNova.id)   // ligações locais corretas
  assert.equal(await db.cad_lojas.count(), 2)
})

test('o servidor vence: pagamento recusado (outro aparelho já recebeu) desfaz o otimismo local', async () => {
  const f = (await db.cad_fiados.toArray()).find(x => x.uid === 'venda-nova-0001')
  online = false
  await receberPagamentoServidor(f, 25)                                           // aparelho A recebe tudo, sem sinal
  assert.equal((await db.cad_fiados.get(f.id)).saldo, 0)
  await aplicarOperacao(DB, { op_id: 'op-outro-quita-0001', tipo: 'pagamento.registrar', dados: { uid: 'pag-outro-0001', venda_uid: 'venda-nova-0001', valor_centavos: 2500 } }, { usuario: 'x', agora: 1_900_000_000_000 })
  await sincronizar()                                                              // A volta: servidor recusa ("já quitada")
  assert.equal(estadoFila.rejeitadas.length, 1); assert.match(estadoFila.rejeitadas[0].motivo, /quitada/)
  const g = await db.cad_fiados.get(f.id)
  assert.deepEqual([g.saldo, g.pagamentos.length], [0, 1])                        // 1 pagamento só (o do outro aparelho): sem dinheiro em dobro
  assert.equal(srv('venda-nova-0001').saldo_centavos, 0)
})

test('estorno sem uid do servidor é barrado com mensagem clara (nada é enfileirado)', async () => {
  const antes = await filaDb.fila.count()
  await assert.rejects(async () => estornarServidor({ id: 1 }, { valor: 1, data: '2026-01-01' }), /ainda não foi sincronizado/)
  assert.equal(await filaDb.fila.count(), antes)
})

test('a tela entrega um resumo sem uid: a ponte relê a venda do banco local', async () => {
  const real = (await db.cad_fiados.toArray()).find(x => x.uid === 'lg:cad_fiados:1')
  await alterarVencimentoServidor({ id: real.id, saldo: real.saldo }, '2027-01-10')
  await sincronizar()
  assert.equal(srv('lg_cad_fiados_1').data_venc, '2027-01-10')
  await assert.rejects(async () => alterarVencimentoServidor({ id: 99999 }, '2027-01-10'), /identificador/)
})

// ── Parte 2: lançar, cancelar, corrigir ──
import { lancarVendaServidor, cancelarVendaServidor, corrigirVendaServidor, listarCorrecoes } from '../src/services/cadernetaServidor.js'
const caio = () => db.cad_clientes.toArray().then(l => l.find(c => c.nome === 'Caio'))
const novaTela = async (extra = {}) => {
  const c = await caio()
  return { clienteId: c.id, clienteNome: c.nome, lojaId: c.lojaId, lojaNome: 'Padaria Sol', itens: [{ id: 'cat1', nome: 'Trufa', emoji: '🍫', qty: 3, preco: 7.5 }],
    descricaoLivre: null, total: 22.5, saldo: 22.5, status: 'aberto', dataVenda: '2026-11-09', horaVenda: '10:30', dataVenc: '2026-11-30', criadoEm: new Date().toISOString(), ...extra }
}

test('lançar venda OFFLINE (o caso da sua esposa): grava local na hora, vai ao servidor quando voltar o sinal', async () => {
  online = false
  const v = await lancarVendaServidor(await novaTela())
  assert.ok(v.id && v.uid)
  assert.equal((await db.cad_fiados.get(v.id)).total, 22.5)
  assert.equal(srv(v.uid), null)                                   // ainda não chegou
  await sincronizar()
  const s = srv(v.uid); assert.deepEqual([s.total_centavos, s.saldo_centavos, s.status, s.cliente_nome], [2250, 2250, 'aberto', 'Caio'])
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM cad_venda_itens WHERE venda_uid=?').get(v.uid).n, 1)
  assert.equal(await db.cad_fiados.filter(x => x.uid === v.uid).count(), 1)   // projeção não duplicou
})

test('lançar com desconto, e total da tela que não bate com os itens é barrado antes de enfileirar', async () => {
  const antes = await filaDb.fila.count()
  await assert.rejects(async () => lancarVendaServidor(await novaTela({ total: 99 })), /não bate/)
  assert.equal(await filaDb.fila.count(), antes)
  const v = await lancarVendaServidor(await novaTela({ desconto: 2.5, descontoMotivo: 'cliente antigo', total: 20, saldo: 20 }))
  await sincronizar()
  assert.deepEqual([srv(v.uid).bruto_centavos, srv(v.uid).desconto_centavos, srv(v.uid).total_centavos], [2250, 250, 2000])
})

test('cancelar (era "excluir"): sai da cobrança local, fica no servidor com motivo; com pagamento, barra', async () => {
  const v = await lancarVendaServidor(await novaTela())
  await sincronizar()
  await cancelarVendaServidor(await db.cad_fiados.get(v.id), 'lançada sem querer')
  assert.equal(await db.cad_fiados.get(v.id), undefined)
  await sincronizar()
  assert.ok(srv(v.uid).cancelada_em); assert.equal(srv(v.uid).motivo_cancelamento, 'lançada sem querer')
  assert.equal(await db.cad_fiados.filter(x => x.uid === v.uid).count(), 0)   // projeção não ressuscita
  const pago = await lancarVendaServidor(await novaTela())
  await receberPagamentoServidor(await db.cad_fiados.get(pago.id), 5)
  await assert.rejects(async () => cancelarVendaServidor(await db.cad_fiados.get(pago.id)), /Estorne os pagamentos/)
})

test('corrigir valor/itens: a errada fica cancelada com rastro, a certa assume; vale offline', async () => {
  const errada = await lancarVendaServidor(await novaTela({ itens: [{ id: 'cat1', nome: 'Trufa', qty: 30, preco: 7.5 }], total: 225, saldo: 225 }))   // digitou 30 em vez de 3
  await sincronizar()
  online = false
  const certa = await corrigirVendaServidor(await db.cad_fiados.get(errada.id), { itens: [{ id: 'cat1', nome: 'Trufa', emoji: '🍫', qty: 3, preco: 7.5, subtotal: 22.5 }], total: 22.5, saldo: 22.5 })
  assert.equal(await db.cad_fiados.get(errada.id), undefined); assert.equal((await db.cad_fiados.get(certa.id)).total, 22.5)
  await sincronizar()
  assert.match(srv(errada.uid).motivo_cancelamento, /Corrigida/); assert.equal(srv(errada.uid).total_centavos, 22500)   // a errada continua registrada
  assert.deepEqual([srv(certa.uid).total_centavos, srv(certa.uid).substitui_uid], [2250, errada.uid])
  const lista = await listarCorrecoes()
  assert.ok(lista.some(x => x.tipo === 'corrigida' && x.valor === 225))
})

test('corrigir com pagamento ativo é barrado no aparelho; estornando antes, corrige', async () => {
  const v = await lancarVendaServidor(await novaTela())
  await receberPagamentoServidor(await db.cad_fiados.get(v.id), 5)
  await sincronizar()
  await assert.rejects(async () => corrigirVendaServidor(await db.cad_fiados.get(v.id), { total: 10 }), /Estorne os pagamentos antes de corrigir/)
  const f = await db.cad_fiados.get(v.id)
  await estornarServidor(f, f.pagamentos[0]); await sincronizar()
  const ok = await corrigirVendaServidor(await db.cad_fiados.get(v.id), { itens: [{ id: 'cat1', nome: 'Trufa', qty: 2, preco: 7.5 }], total: 15, saldo: 15 })
  await sincronizar()
  assert.equal(srv(ok.uid).total_centavos, 1500)
  assert.ok((await listarCorrecoes()).some(x => x.tipo === 'estorno'))
})

test('nota livre (sem itens) vira item único no servidor', async () => {
  const v = await lancarVendaServidor(await novaTela({ itens: [], descricaoLivre: 'Bolo de aniversário', total: 80, saldo: 80 }))
  await sincronizar()
  const it = DB.raw.prepare('SELECT nome, subtotal_centavos FROM cad_venda_itens WHERE venda_uid=?').get(v.uid)
  assert.deepEqual([it.nome, it.subtotal_centavos], ['Bolo de aniversário', 8000])
})

// ── Parte 3: loja e cliente ──
import { salvarLojaServidor, salvarClienteServidor, arquivarLojaServidor, excluirLojaServidor, arquivarClienteServidor, excluirClienteServidor } from '../src/services/cadernetaServidor.js'
const lojaPorNome = (n) => db.cad_lojas.toArray().then(l => l.find(x => x.nome === n))
const cliPorNome = (n) => db.cad_clientes.toArray().then(l => l.find(x => x.nome === n))
const srvLoja = (nome) => DB.raw.prepare('SELECT * FROM cad_lojas WHERE nome=?').get(nome) ?? null
const srvCli = (nome) => DB.raw.prepare('SELECT * FROM cad_clientes WHERE nome=?').get(nome) ?? null

test('TUDO sem sinal: cadastra loja, cliente e lança fiado; ao voltar o sinal chega na ordem certa, sem duplicar', async () => {
  online = false
  const l = await salvarLojaServidor({ nome: '  Floricultura   Rosa ' })
  assert.equal(l.ok, true)
  const c = await salvarClienteServidor({ lojaId: l.id, nome: 'Marta', telefone: '(21) 98888-1111', funcao: 'Gerente' })
  assert.equal(c.ok, true)
  const v = await lancarVendaServidor({ clienteId: c.id, clienteNome: 'Marta', lojaId: l.id, lojaNome: 'Floricultura Rosa', itens: [{ id: 'x', nome: 'Trufa', qty: 2, preco: 7 }],
    total: 14, saldo: 14, status: 'aberto', dataVenda: '2026-11-10', dataVenc: '2026-11-30', criadoEm: new Date().toISOString() })
  assert.equal(estadoFila.pendentes >= 3, true)
  await sincronizar()
  assert.equal(srvLoja('Floricultura Rosa').nome_chave, 'floricultura rosa')
  assert.deepEqual([srvCli('Marta').funcao, srv(v.uid).cliente_nome, srv(v.uid).loja_nome], ['Gerente', 'Marta', 'Floricultura Rosa'])
  assert.equal((await db.cad_lojas.filter(x => x.nome === 'Floricultura Rosa').count()), 1)      // não duplicou
  assert.equal((await db.cad_clientes.filter(x => x.nome === 'Marta').count()), 1)
  assert.equal((await db.cad_fiados.filter(x => x.uid === v.uid).count()), 1)
  assert.equal((await projetarServidorNoLocal()).vendas, 0)                                       // projeção só grava o que mudou
})

test('renomear loja e cliente: servidor guarda o nome da época na venda; a tela mostra o nome atual (inclusive offline)', async () => {
  online = false
  const l = await lojaPorNome('Floricultura Rosa'), c = await cliPorNome('Marta')
  const r = await salvarLojaServidor({ id: l.id, nome: 'Floricultura Rosa Azul' })
  assert.deepEqual([r.ok, r.renomeou, r.vendasAtualizadas], [true, true, 1])
  await salvarClienteServidor({ id: c.id, nome: 'Marta Souza' })
  const fi = (await db.cad_fiados.toArray()).find(f => f.clienteId === c.id)
  assert.deepEqual([fi.lojaNome, fi.clienteNome], ['Floricultura Rosa Azul', 'Marta Souza'])      // otimista
  await sincronizar()
  const f2 = (await db.cad_fiados.toArray()).find(f => f.clienteId === c.id)
  assert.deepEqual([f2.lojaNome, f2.clienteNome], ['Floricultura Rosa Azul', 'Marta Souza'])      // servidor não desfaz
  const sv = DB.raw.prepare('SELECT loja_nome, cliente_nome FROM cad_vendas WHERE uid=?').get(fi.uid)
  assert.deepEqual([sv.loja_nome, sv.cliente_nome], ['Floricultura Rosa', 'Marta'])               // histórico da época preservado
})

test('renomeação pendente (sem sinal) não é desfeita por uma leitura do servidor', async () => {
  const l = await lojaPorNome('Floricultura Rosa Azul')
  online = false
  await salvarLojaServidor({ id: l.id, nome: 'Floricultura Rosa Verde' })
  await puxarEstado().catch(() => {}); await projetarServidorNoLocal()
  assert.equal((await db.cad_lojas.get(l.id)).nome, 'Floricultura Rosa Verde')
  await sincronizar()
  assert.equal(srvLoja('Floricultura Rosa Verde')?.nome, 'Floricultura Rosa Verde')
})

test('mudar cliente de loja levando as vendas em aberto; as pagas ficam onde aconteceram', async () => {
  const mercado = await lojaPorNome('Mercado Lua'), c = await cliPorNome('Marta Souza')
  const paga = await lancarVendaServidor({ clienteId: c.id, clienteNome: c.nome, lojaId: c.lojaId, lojaNome: 'x', itens: [{ nome: 'Y', qty: 1, preco: 10 }], total: 10, saldo: 10, status: 'aberto', dataVenda: '2026-11-10', dataVenc: '2026-11-30' })
  await receberPagamentoServidor(await db.cad_fiados.get(paga.id), 10)
  await sincronizar()
  const r = await salvarClienteServidor({ id: c.id, lojaId: mercado.id }, { moverAbertos: true })
  assert.equal(r.ok, true); await sincronizar()
  const abertas = DB.raw.prepare("SELECT loja_nome, status FROM cad_vendas WHERE cliente_uid=(SELECT uid FROM cad_clientes WHERE nome='Marta Souza')").all()
  assert.ok(abertas.some(v => v.status === 'aberto' && v.loja_nome === 'Mercado Lua'))
  assert.ok(abertas.some(v => v.status === 'pago' && v.loja_nome !== 'Mercado Lua'))
})

test('telefone repetido: barrado no aparelho; se outro aparelho cadastrou antes, o servidor recusa e o cadastro some daqui', async () => {
  const mercado = await lojaPorNome('Mercado Lua')
  const r = await salvarClienteServidor({ lojaId: mercado.id, nome: 'Outra Marta', telefone: '21 98888-1111' })
  assert.equal(r.ok, false); assert.equal(r.dup.motivo, 'telefone')
  // outro aparelho cadastra "Nina" com um telefone novo enquanto este (sem sinal) cadastra "Nina Bis" com o MESMO telefone
  online = false
  const mine = await salvarClienteServidor({ lojaId: mercado.id, nome: 'Nina Bis', telefone: '(21) 97777-2222' })
  assert.equal(mine.ok, true)
  await aplicarOperacao(DB, { op_id: 'op-outro-nina-0001', tipo: 'cliente.salvar', dados: { uid: 'cli-nina-outro-01', loja_uid: (await lojaPorNome('Mercado Lua')).uid, nome: 'Nina', telefone: '(21) 97777-2222' } }, { usuario: 'x', agora: 2_000_000_000_000 })
  await sincronizar()
  assert.equal(estadoFila.rejeitadas.some(o => /telefone já está cadastrado/i.test(o.motivo)), true)
  assert.equal(await cliPorNome('Nina Bis'), undefined)               // otimismo desfeito
  assert.ok(await cliPorNome('Nina'))                                  // o cadastro do outro aparelho veio
  for (const o of estadoFila.rejeitadas) await dispensarRejeitada(o.op_id)
})

test('arquivar/reativar e "excluir": nada é apagado no servidor; com histórico, excluir é barrado', async () => {
  const vazia = await salvarLojaServidor({ nome: 'Loja Vazia' })
  await sincronizar()
  await excluirLojaServidor(vazia.id)                                  // vira arquivada
  await sincronizar()
  assert.ok(srvLoja('Loja Vazia').arquivada_em); assert.equal((await db.cad_lojas.get(vazia.id)).arquivado, true)
  await arquivarLojaServidor(vazia.id, false); await sincronizar()
  assert.equal(srvLoja('Loja Vazia').arquivada_em, null)
  const rosa = await lojaPorNome('Floricultura Rosa Verde')
  await assert.rejects(async () => excluirLojaServidor(rosa.id), /LOJA_COM_HISTORICO/)
  const nina = await cliPorNome('Nina')
  await excluirClienteServidor(nina.id); await sincronizar()
  assert.ok(srvCli('Nina').arquivado_em)
  await salvarClienteServidor({ id: nina.id, arquivado: false }); await sincronizar()      // reativar pelo caminho da tela
  assert.equal(srvCli('Nina').arquivado_em, null)
  const marta = await cliPorNome('Marta Souza')
  await assert.rejects(async () => excluirClienteServidor(marta.id), /CLIENTE_COM_HISTORICO/)
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM cad_lojas').get().n >= 4, true)
})

test('conferência final do servidor depois de tudo: zero violações', async () => {
  const { conferenciaCaderneta } = await import('../functions/_lib/caderneta.js')
  const c = await conferenciaCaderneta(DB)
  assert.equal(c.ok, true, JSON.stringify(c.violacoes))
})
