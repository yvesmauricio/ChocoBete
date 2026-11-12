import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarD1 } from './d1shim.mjs'
import { onRequestGet, onRequestPost } from '../functions/api/caderneta/backup.js'
import { onRequestGet as conferencia } from '../functions/api/caderneta/conferencia.js'
import { statusBackup } from '../functions/_lib/caderneta.js'

const BK = 'b'.repeat(40), ADM = 'a'.repeat(40)
const mk = () => ({ DB: criarD1(), BACKUP_TOKEN: BK, ADMIN_TOKEN: ADM })
const req = (token, corpo) => new Request('https://app.test/api/caderneta/backup', { method: corpo ? 'POST' : 'GET', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, ...(corpo ? { body: JSON.stringify(corpo) } : {}) })
const ok = { arquivo: 'diario/2026/11/chocobete-20261111.sql.gpg', bytes: 4096, sha256: 'a'.repeat(64), resumo: { vendas: 138, pagamentos: 125, saldo_aberto_centavos: 21000 } }

test('sem backup registrado: atrasado; chave errada ou curta: 401', async () => {
  const env = mk()
  const r = await onRequestGet({ request: req(BK), env }); assert.equal(r.status, 200)
  const j = await r.json(); assert.equal(j.backup.atrasado, true); assert.equal(j.backup.ultimo, null); assert.equal(j.ok, true)
  assert.equal((await onRequestGet({ request: req('x'.repeat(40)), env })).status, 401)
  assert.equal((await onRequestGet({ request: req(null), env })).status, 401)
  assert.equal((await onRequestGet({ request: req('curta'), env: { ...env, BACKUP_TOKEN: 'curta' } })).status, 401)   // configuração fraca recusa tudo
})

test('registrar: grava, fica em dia; o GET não expõe dados pessoais (só números)', async () => {
  const env = mk()
  assert.equal((await onRequestPost({ request: req(BK, ok), env })).status, 201)
  const j = await (await onRequestGet({ request: req(BK), env })).json()
  assert.equal(j.backup.atrasado, false); assert.equal(j.backup.ultimo.resumo.vendas, 138); assert.equal(j.backup.ultimo.sha256, 'a'.repeat(64))
  assert.doesNotMatch(JSON.stringify(j), /nome|telefone|loja_nome|cliente/i.source ? /nome|telefone|loja_nome/i : /x/)
  assert.deepEqual(Object.keys(j.contagens).sort(), ['clientes', 'estornos', 'itens', 'lojas', 'operacoes', 'pagamentos', 'vendas'])
})

test('registro inválido é recusado (422) e histórico de backups é imutável', async () => {
  const env = mk()
  for (const ruim of [{ ...ok, sha256: 'zz' }, { ...ok, bytes: 0 }, { ...ok, arquivo: '' }, { ...ok, resumo: { nome: 'Ana' } }, { ...ok, resumo: null }])
    assert.equal((await onRequestPost({ request: req(BK, ruim), env })).status, 422)
  await onRequestPost({ request: req(BK, ok), env })
  assert.throws(() => env.DB.raw.prepare('DELETE FROM backups_registro').run(), /E_HISTORICO_IMUTAVEL/)
  assert.throws(() => env.DB.raw.prepare('UPDATE backups_registro SET bytes = 1').run(), /E_HISTORICO_IMUTAVEL/)
})

test('atraso: passou de 30 h = atrasado', async () => {
  const env = mk(); await onRequestPost({ request: req(BK, ok), env })
  const agora = Date.now()
  assert.equal((await statusBackup(env.DB, agora + 29 * 3_600_000)).atrasado, false)
  assert.equal((await statusBackup(env.DB, agora + 31 * 3_600_000)).atrasado, true)
})

test('a chave de backup NÃO abre a Caderneta (só admin/Access abre /conferencia)', async () => {
  const env = mk()
  const r = await conferencia({ request: new Request('https://app.test/api/caderneta/conferencia', { headers: { authorization: `Bearer ${BK}` } }), env })
  assert.equal(r.status, 401)
})
