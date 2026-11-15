import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { criarD1 } from './d1shim.mjs'
import { migrarCaderneta } from '../scripts/migrar-caderneta.mjs'
import { conferenciaCaderneta, aplicarOperacao } from '../functions/_lib/caderneta.js'
import { gerarSqlZerar } from '../scripts/ensaio/zerar-caderneta.mjs'
import { verificarRestauracao } from '../scripts/backup/verificar-restauracao.mjs'

const legado = {
  cad_lojas: [{ id: 1, uid: 'loja-zr-0001', nome: 'Padaria' }],
  cad_clientes: [{ id: 1, uid: 'cli-zr-00001', lojaId: 1, nome: 'Ana', telefone: '(21) 99943-0023' }],
  cad_fiados: [{ id: 1, uid: 'venda-zr-001', clienteId: 1, lojaId: 1, itens: [{ nome: 'T', qty: 1, preco: 50 }], total: 50, saldo: 20, status: 'aberto', dataVenda: '2026-10-01', pagamentos: [{ valor: 30, data: '2026-10-05', criadoEm: '2026-10-05T13:00:00.000Z' }] }],
}
const U = (s) => `${s}-0000000000000000`.slice(0, 24)

test('recusa sem a confirmação explícita', () => {
  const r = spawnSync('node', [new URL('../scripts/ensaio/zerar-caderneta.mjs', import.meta.url).pathname], { encoding: 'utf8' })
  assert.equal(r.status, 2); assert.match(r.stderr, /confirmo-apagar-tudo/)
})

test('zera só a Caderneta (cardápio e registro de backups ficam), mantém as regras idênticas, e permite reimportar do zero', async () => {
  const D1 = criarD1()
  D1.raw.exec(migrarCaderneta(JSON.parse(JSON.stringify(legado)), { agora: 1_700_000_000_000 }).sql)
  await aplicarOperacao(D1, { op_id: 'op-ensaio-000000001', tipo: 'pagamento.registrar', dados: { uid: U('pag-ens'), venda_uid: 'venda-zr-001', valor_centavos: 500 } }, { usuario: 'teste', papel: 'admin' })
  const cardapiosAntes = D1.raw.prepare('SELECT COUNT(*) n FROM cardapios').get().n
  D1.raw.exec("UPDATE cardapios SET html = '<p>publicado</p>' WHERE id = (SELECT id FROM cardapios LIMIT 1)")
  D1.raw.exec("INSERT INTO backups_registro (feito_em, arquivo, bytes, sha256, resumo) VALUES (1,'x',1,'" + 'a'.repeat(64) + "','{}')")
  const antes = await conferenciaCaderneta(D1); assert.ok(antes.contagens.vendas > 0 && antes.contagens.operacoes > 0)

  D1.raw.exec(gerarSqlZerar())
  const zero = await conferenciaCaderneta(D1)
  assert.deepEqual(Object.values(zero.contagens), [0, 0, 0, 0, 0, 0, 0]); assert.equal(zero.ok, true); assert.equal(zero.saldo_aberto_centavos, 0)
  assert.equal(D1.raw.prepare('SELECT COUNT(*) n FROM cardapios').get().n, cardapiosAntes)          // cardápio intacto
  assert.equal(D1.raw.prepare("SELECT COUNT(*) n FROM cardapios WHERE html = '<p>publicado</p>'").get().n, 1)
  assert.equal(D1.raw.prepare('SELECT COUNT(*) n FROM backups_registro').get().n, 1)   // registro de backups intacto
  assert.equal(D1.raw.prepare("SELECT COUNT(*) n FROM mudancas").get().n, 0)

  // as regras (gatilhos) depois de zerar são EXATAMENTE as do repositório: o verificador de esquema confirma
  const dumpPseudo = (() => { const o = D1.raw.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all().map(r => r.sql + ';'); return o.join('\n') })()
  const v = await verificarRestauracao(dumpPseudo, { semComparacao: true })
  const falhas = v.checks.filter(c => !c.ok).map(c => c.nome)
  // banco vazio: as sondas de regra e "há dados" precisam de linhas, então só elas podem falhar; esquema e gatilhos têm de ser idênticos
  assert.deepEqual(falhas.filter(n => !/há dados|^regra:/.test(n)), [])
  assert.ok(v.checks.find(c => /idênticos/.test(c.nome)).ok); assert.ok(v.checks.find(c => /todas as tabelas/.test(c.nome)).ok)

  // e dá para reimportar o backup final por cima, do zero, com os mesmos números
  D1.raw.exec(migrarCaderneta(JSON.parse(JSON.stringify(legado)), { agora: 1_800_000_000_000 }).sql)
  const depois = await conferenciaCaderneta(D1)
  assert.equal(depois.contagens.vendas, 1); assert.equal(depois.saldo_aberto_centavos, 2000); assert.equal(depois.ok, true)
  assert.equal(D1.raw.prepare('SELECT MIN(seq) s FROM mudancas').get().s, 1)            // diário recomeça limpo
})

test('o histórico continua imutável depois de recriar', async () => {
  const D1 = criarD1(); D1.raw.exec(gerarSqlZerar())
  D1.raw.exec(migrarCaderneta(JSON.parse(JSON.stringify(legado)), { agora: 1_700_000_000_000 }).sql)   // com linhas, o gatilho tem o que proteger
  assert.throws(() => D1.raw.exec('DELETE FROM cad_pagamentos'), /E_HISTORICO_IMUTAVEL/)
  assert.throws(() => D1.raw.exec('DELETE FROM cad_vendas'), /E_SEM_EXCLUSAO/)
})
