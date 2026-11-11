import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarD1 } from './d1shim.mjs'
import { papelDoUsuario, autorizarOperacao, permissoesDoPapel, descreverAcesso, janelaDesfazerMs } from '../functions/_lib/papeis.js'
import { processarOps } from '../functions/_lib/cadernetaHttp.js'
import { onRequestGet as eu } from '../functions/api/caderneta/eu.js'
import { onRequestGet as conferencia } from '../functions/api/caderneta/conferencia.js'
import { onRequestGet as estado } from '../functions/api/caderneta/estado.js'

const ENV = { PAPEL_ADMIN_EMAILS: 'Dono@Loja.com', PAPEL_VENDAS_EMAILS: 'bete@loja.com; outra@loja.com', ADMIN_TOKEN: 'x'.repeat(40) }
const adm = { ok: true, modo: 'access', usuario: 'dono@loja.com' }
const bete = { ok: true, modo: 'access', usuario: 'bete@loja.com' }
const intruso = { ok: true, modo: 'access', usuario: 'estranho@x.com' }
const U = (s) => `${s}-0000000000000000`.slice(0, 24)
let n = 0
const op = (tipo, dados) => ({ op_id: U('op' + ++n), tipo, dados, criado_no_aparelho: 1_700_000_000_000 })
const T0 = 1_700_000_000_000
const lote = (DB, quem, ops, env = ENV, agora = T0) => processarOps({ DB, quem, papel: papelDoUsuario(quem, env), env, corpo: { aparelho: 'a', ops }, agora })

async function base() {
  const DB = criarD1()
  const r = await lote(DB, adm, [
    op('loja.salvar', { uid: U('loja1'), nome: 'Padaria' }),
    op('cliente.salvar', { uid: U('cli1'), loja_uid: U('loja1'), nome: 'Ana', telefone: '' }),
  ])
  assert.deepEqual(r.corpo.resultados.map(x => x.status), ['aplicada', 'aplicada'])
  return DB
}
const venda = (DB, uid, quem, extra = {}) => op('venda.criar', { uid, cliente_uid: U('cli1'), data_venda: '2026-11-10', itens: [{ nome: 'Trufa', qtd: 2, preco_centavos: 700 }], ...extra })

test('perfil vem do e-mail (sem diferenciar caixa); token = admin; desconhecido = nenhum', () => {
  assert.equal(papelDoUsuario(adm, ENV), 'admin'); assert.equal(papelDoUsuario(bete, ENV), 'vendas')
  assert.equal(papelDoUsuario({ ok: true, modo: 'access', usuario: 'OUTRA@loja.com' }, ENV), 'vendas')
  assert.equal(papelDoUsuario({ ok: true, modo: 'token', usuario: 'administrador' }, ENV), 'admin')
  assert.equal(papelDoUsuario(intruso, ENV), null)
  assert.equal(papelDoUsuario(bete, {}), null)                       // variáveis não configuradas: falha fechada
  assert.equal(papelDoUsuario({ ok: false }, ENV), null)
  assert.equal(papelDoUsuario({ ok: true, modo: 'access', usuario: 'dono@loja.com' }, { PAPEL_ADMIN_EMAILS: 'dono@loja.com', PAPEL_VENDAS_EMAILS: 'dono@loja.com' }), 'admin')   // nas duas listas: vale o mais alto
})

test('Vendas faz o dia a dia: lançar fiado, receber, cadastrar', async () => {
  const DB = await base()
  const r = await lote(DB, bete, [
    venda(DB, U('v1')), op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 500 }),
    op('loja.salvar', { uid: U('loja2'), nome: 'Mercado' }), op('venda.vencimento', { venda_uid: U('v1'), data_venc: '2026-12-01' }),
  ])
  assert.deepEqual(r.corpo.resultados.map(x => x.status), ['aplicada', 'aplicada', 'aplicada', 'aplicada'])
  assert.equal(DB.raw.prepare("SELECT papel FROM operacoes WHERE tipo='venda.criar'").get().papel, 'vendas')   // auditoria
})

test('Vendas NÃO estorna pagamento: recusado, registrado, e o dinheiro não muda', async () => {
  const DB = await base()
  await lote(DB, adm, [venda(DB, U('v1')), op('pagamento.registrar', { uid: U('p1'), venda_uid: U('v1'), valor_centavos: 500 })])
  const o = op('pagamento.estornar', { uid: U('e1'), pagamento_uid: U('p1') })
  const r = await lote(DB, bete, [o])
  assert.equal(r.corpo.resultados[0].status, 'rejeitada'); assert.match(r.corpo.resultados[0].motivo, /administrador/)
  assert.equal(DB.raw.prepare('SELECT saldo_centavos s FROM cad_vendas').get().s, 900)
  const reg = DB.raw.prepare('SELECT resultado, papel, usuario FROM operacoes WHERE op_id=?').get(o.op_id)
  assert.deepEqual({ ...reg }, { resultado: 'rejeitada', papel: 'vendas', usuario: 'bete@loja.com' })
  assert.equal((await lote(DB, adm, [op('pagamento.estornar', { uid: U('e2'), pagamento_uid: U('p1') })])).corpo.resultados[0].status, 'aplicada')   // Admin pode
})

test('Vendas desfaz/corrige a PRÓPRIA venda nos primeiros minutos; depois, ou de outra pessoa, ou com pagamento: só Admin', async () => {
  const DB = await base()
  await lote(DB, bete, [venda(DB, U('v1'))], ENV, T0)                          // da Bete
  await lote(DB, adm, [venda(DB, U('v2'))], ENV, T0)                           // do Admin
  const st = async (quem, ops, t) => (await lote(DB, quem, ops, ENV, t)).corpo.resultados.map(x => x.status)
  assert.deepEqual(await st(bete, [op('venda.cancelar', { venda_uid: U('v2') })], T0 + 60_000), ['rejeitada'])                 // não é dela
  assert.deepEqual(await st(bete, [op('venda.corrigir', { venda_uid: U('v1'), nova: { uid: U('v1b'), data_venda: '2026-11-10', itens: [{ nome: 'Trufa', qtd: 3, preco_centavos: 700 }] } })], T0 + 5 * 60_000), ['aplicada'])   // dela, 5 min
  assert.deepEqual(await st(bete, [op('venda.cancelar', { venda_uid: U('v1b') })], T0 + 5 * 60_000 + 20 * 60_000), ['rejeitada'])   // fora da janela (15 min)
  assert.deepEqual(await st(bete, [op('venda.cancelar', { venda_uid: U('v1b') })], T0 + 5 * 60_000 + 10 * 60_000), ['aplicada'])    // dentro da janela
  await lote(DB, bete, [venda(DB, U('v3')), op('pagamento.registrar', { uid: U('p3'), venda_uid: U('v3'), valor_centavos: 100 })], ENV, T0)
  assert.deepEqual(await st(bete, [op('venda.cancelar', { venda_uid: U('v3') })], T0 + 60_000), ['rejeitada'])                 // já tem pagamento
  assert.deepEqual(await st(adm, [op('venda.cancelar', { venda_uid: U('v2') })], T0 + 3_600_000), ['aplicada'])                // Admin sempre
})

test('janela configurável e desligável; permissões extras por variável', async () => {
  assert.equal(janelaDesfazerMs({}), 15 * 60_000); assert.equal(janelaDesfazerMs({ CADERNETA_JANELA_DESFAZER_MIN: '0' }), 0); assert.equal(janelaDesfazerMs({ CADERNETA_JANELA_DESFAZER_MIN: '5' }), 5 * 60_000)
  const DB = await base()
  const env0 = { ...ENV, CADERNETA_JANELA_DESFAZER_MIN: '0' }
  await lote(DB, bete, [venda(DB, U('v1'))], env0, T0)
  assert.equal((await lote(DB, bete, [op('venda.cancelar', { venda_uid: U('v1') })], env0, T0 + 1000)).corpo.resultados[0].status, 'rejeitada')   // janela desligada
  const envX = { ...ENV, CADERNETA_VENDAS_TAMBEM_PODE: 'venda.cancelar' }
  assert.equal((await lote(DB, bete, [op('venda.cancelar', { venda_uid: U('v1') })], envX, T0 + 3_600_000)).corpo.resultados[0].status, 'aplicada')    // liberado por configuração
  assert.ok(permissoesDoPapel('vendas', envX).includes('venda.cancelar')); assert.ok(!permissoesDoPapel('vendas', ENV).includes('venda.cancelar'))
})

test('login sem perfil: nada é gravado e a recusa é clara', async () => {
  const DB = await base()
  const aut = await autorizarOperacao({ papel: null, usuario: 'x', op: { tipo: 'venda.criar' }, DB })
  assert.equal(aut.ok, false); assert.match(aut.motivo, /perfil/)
  const r = await lote(DB, intruso, [venda(DB, U('v9'))])
  assert.equal(r.corpo.resultados[0].status, 'rejeitada')
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM cad_vendas').get().n, 0)
})

const req = (path, headers = {}) => new Request('https://app.test' + path, { headers })
test('rotas: 401 sem login; /eu informa o perfil; /conferencia só Admin; /estado exige perfil', async () => {
  const DB = criarD1(); const env = { ...ENV, DB }
  const bearer = { authorization: `Bearer ${ENV.ADMIN_TOKEN}` }
  assert.equal((await eu({ request: req('/api/caderneta/eu'), env })).status, 401)
  const a = await (await eu({ request: req('/api/caderneta/eu', bearer), env })).json()
  assert.equal(a.papel, 'admin'); assert.ok(a.permissoes.includes('pagamento.estornar')); assert.equal(a.janela_desfazer_min, 15)
  assert.equal((await conferencia({ request: req('/api/caderneta/conferencia', bearer), env })).status, 200)
  assert.equal((await estado({ request: req('/api/caderneta/estado', bearer), env })).status, 200)
  // Sem as variáveis de perfil, quem entra por Access (e-mail) é barrado:
  const d = descreverAcesso(bete, {}); assert.equal(d.papel, null); assert.deepEqual(d.permissoes, [])
})
