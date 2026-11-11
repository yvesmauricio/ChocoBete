import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const mem = new Map(); globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }
const { db } = await import('../src/db.js')
const { criarD1 } = await import('./d1shim.mjs')
const { onRequestPost } = await import('../functions/api/caderneta/ops.js')
const { onRequestGet: eu } = await import('../functions/api/caderneta/eu.js')
const { enfileirar, descarregar, estadoFila, _usarFetch } = await import('../src/services/filaOperacoes.js')
const { podeNoServidor, atualizarAcesso, acessoRef } = await import('../src/services/acessoServidor.js')
const { instalarTravaPorPapel } = await import('../src/services/travaPorPapel.js')
const { definirCadernetaNoServidor, comEscritaLocalLiberada } = await import('../src/services/modoServidor.js')

const adm = { papel: 'admin', permissoes: ['loja.salvar', 'venda.criar', 'pagamento.estornar', 'venda.cancelar', 'venda.corrigir'] }
const bete = { usuario: 'bete@x', papel: 'vendas', permissoes: ['loja.salvar', 'venda.criar'], janela_desfazer_min: 15 }
const agora = Date.parse('2026-11-10T12:00:00Z')

test('botões: Admin vê tudo; Vendas só o dia a dia; cancelar/corrigir só a própria venda recente e sem pagamento', () => {
  assert.equal(podeNoServidor('pagamento.estornar', null, agora, adm), true)
  assert.equal(podeNoServidor('pagamento.estornar', null, agora, bete), false)
  assert.equal(podeNoServidor('venda.criar', null, agora, bete), true)
  const propria = { usuario: 'bete@x', criadoEm: '2026-11-10T11:55:00Z', pagamentos: [] }
  assert.equal(podeNoServidor('venda.cancelar', propria, agora, bete), true)
  assert.equal(podeNoServidor('venda.corrigir', propria, agora, bete), true)
  assert.equal(podeNoServidor('venda.cancelar', { ...propria, criadoEm: '2026-11-10T11:30:00Z' }, agora, bete), false)    // passou de 15 min
  assert.equal(podeNoServidor('venda.cancelar', { ...propria, usuario: 'dono@x' }, agora, bete), false)                    // de outra pessoa
  assert.equal(podeNoServidor('venda.cancelar', { ...propria, pagamentos: [{ valor: 1 }] }, agora, bete), false)           // já recebeu
  assert.equal(podeNoServidor('venda.cancelar', propria, agora, null), false)                                              // perfil desconhecido: o mais restrito
  assert.equal(podeNoServidor('pagamento.estornar', null, agora, { ...bete, permissoes: [...bete.permissoes, 'pagamento.estornar'] }), true)   // liberado por configuração
})

test('/eu → aparelho guarda o perfil; sem login mantém o que já sabia', async () => {
  const env = { DB: criarD1(), ADMIN_TOKEN: 'x'.repeat(40), PAPEL_VENDAS_EMAILS: 'bete@x' }
  let logado = true
  _usarFetch(async (url, init = {}) => {
    const req = new Request('https://app.test' + url, { ...init, headers: { ...(init.headers || {}), ...(logado ? { authorization: `Bearer ${env.ADMIN_TOKEN}` } : {}) } })
    return url.startsWith('/api/caderneta/eu') ? eu({ request: req, env }) : onRequestPost({ request: req, env })
  })
  assert.equal((await atualizarAcesso()).papel, 'admin')
  logado = false
  assert.equal((await atualizarAcesso()).papel, 'admin')            // 401: não apaga o que já sabia
})

test('login sem perfil (403 SEM_PERFIL): fila guarda tudo e o indicador explica, sem pedir "login" à toa', async () => {
  const env = { DB: criarD1(), PAPEL_ADMIN_EMAILS: 'dono@x' }          // ninguém com perfil configurado
  // simula Access: o servidor autentica por token, mas aqui forçamos "access" sem lista → usamos chamada direta que devolve 403
  _usarFetch(async () => new Response(JSON.stringify({ erro: 'x', codigo: 'SEM_PERFIL' }), { status: 403, headers: { 'content-type': 'application/json' } }))
  await enfileirar('loja.salvar', { uid: 'loja-sem-perfil-01', nome: 'X' })
  await descarregar()
  assert.equal(estadoFila.semPerfil, true); assert.equal(estadoFila.semLogin, false); assert.equal(estadoFila.pendentes, 1)
  assert.match(estadoFila.ultimoErro, /perfil/)
})

test('trava local: aparelho "admin" não grava cobrança no modo antigo, mas a ponte grava no modo servidor (o servidor decide pelo perfil)', async () => {
  instalarTravaPorPapel(db, { obterPapel: () => 'admin' })
  definirCadernetaNoServidor(false)
  await assert.rejects(() => db.cad_lojas.add({ uid: 'loja-trava-0001', nome: 'A' }), /consulta/i)
  definirCadernetaNoServidor(true)
  await assert.rejects(() => db.cad_lojas.add({ uid: 'loja-trava-0002', nome: 'B' }))          // fora da ponte: barrado (trava/guarda)
  await comEscritaLocalLiberada(() => db.cad_lojas.add({ uid: 'loja-trava-0003', nome: 'C' }))   // pela ponte: passa
  assert.equal(await db.cad_lojas.count(), 1)
})
