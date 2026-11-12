import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarD1 } from './d1shim.mjs'
import { migrarCaderneta } from '../scripts/migrar-caderneta.mjs'
import { conferenciaCaderneta } from '../functions/_lib/caderneta.js'
import { verificarRestauracao } from '../scripts/backup/verificar-restauracao.mjs'

const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
/** Faz um dump no formato do `wrangler d1 export`: tabelas, dados, e só DEPOIS índices e gatilhos. */
function dump(raw, { semGatilhos = false } = {}) {
  const obj = raw.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all()
  const sql = [], tabelas = obj.filter(o => o.type === 'table')
  for (const t of tabelas) sql.push(t.sql + ';')
  for (const t of tabelas) for (const r of raw.prepare(`SELECT * FROM "${t.name}"`).all()) sql.push(`INSERT INTO "${t.name}" (${Object.keys(r).map(k => `"${k}"`).join(',')}) VALUES(${Object.values(r).map(lit).join(',')});`)
  for (const o of obj.filter(o => o.type !== 'table' && !(semGatilhos && o.type === 'trigger'))) sql.push(o.sql + ';')
  return sql.join('\n')
}

/** Dump no estilo do export real: cada tabela seguida dos seus dados, com `pedido_itens` ANTES de `pedidos` (ordem alfabética),
 *  e só no fim índices e gatilhos. Foi esse formato que derrubou o primeiro backup de verdade ("no such table: main.pedidos"). */
function dumpIntercalado(raw) {
  const obj = raw.prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all()
  const tabelas = obj.filter(o => o.type === 'table').sort((a, b) => a.name.localeCompare(b.name))
  const sql = ['PRAGMA defer_foreign_keys=TRUE;']
  for (const t of tabelas) {
    sql.push(t.sql + ';')
    for (const r of raw.prepare(`SELECT * FROM "${t.name}"`).all()) sql.push(`INSERT INTO "${t.name}" (${Object.keys(r).map(k => `"${k}"`).join(',')}) VALUES(${Object.values(r).map(lit).join(',')});`)
  }
  for (const o of obj.filter(o => o.type !== 'table')) sql.push(o.sql + ';')
  return sql.join('\n')
}

const legado = {
  cad_lojas: [{ id: 1, uid: 'loja-bk-0001', nome: 'Padaria Sol' }],
  cad_clientes: [{ id: 1, uid: 'cli-bk-00001', lojaId: 1, nome: 'Ana', telefone: '(21) 99943-0023' }],
  cad_fiados: [{ id: 1, uid: 'venda-bk-001', clienteId: 1, lojaId: 1, itens: [{ nome: 'Trufa', qty: 10, preco: 10 }], total: 100, saldo: 70, status: 'aberto', dataVenda: '2026-10-01',
    pagamentos: [{ valor: 30, data: '2026-10-05', criadoEm: '2026-10-05T13:00:00.000Z' }] }],
}
const bancoReal = () => { const D1 = criarD1(); D1.raw.exec(migrarCaderneta(JSON.parse(JSON.stringify(legado)), { agora: 1_700_000_000_000 }).sql); return D1 }
const ref = async (D1) => ({ contagens: (await conferenciaCaderneta(D1)).contagens })

test('backup bom: restaura, confere e a contagem fica entre antes e depois', async () => {
  const D1 = bancoReal(), r0 = await ref(D1)
  const v = await verificarRestauracao(dump(D1.raw), { antes: r0, depois: r0 })
  assert.equal(v.ok, true, JSON.stringify(v.checks.filter(c => !c.ok)))
  assert.equal(v.resumo.saldo_aberto_centavos, 7000)
})

test('backup no formato do export real (tabela filha antes da mãe, com linhas) restaura e confere', async () => {
  const D1 = bancoReal(), r0 = await ref(D1)
  D1.raw.exec(`INSERT INTO pedidos (uuid, cardapio_id, origem, subtotal_centavos, total_centavos, criado_em, atualizado_em) VALUES ('ped-0001', 'diaadia', 'site', 1000, 1000, 1, 1);
               INSERT INTO pedido_itens (pedido_uuid, item_uuid, nome, categoria, preco_centavos, qtd) VALUES ('ped-0001', 'it-1', 'Trufa', 'doces', 500, 2);`)
  const d = dumpIntercalado(D1.raw)
  assert.ok(d.indexOf('CREATE TABLE pedido_itens') < d.indexOf('CREATE TABLE pedidos'), 'o dump de teste precisa ter a filha antes da mãe')
  const v = await verificarRestauracao(d, { antes: r0, depois: r0 })
  assert.equal(v.ok, true, JSON.stringify(v.checks.filter(c => !c.ok)))
})

test('com as chaves desligadas na carga, linha órfã (filha sem mãe) continua sendo RECUSADA', async () => {
  const D1 = bancoReal(), r0 = await ref(D1)
  const d = dumpIntercalado(D1.raw) + "\nINSERT INTO pedido_itens (pedido_uuid, item_uuid, nome, categoria, preco_centavos, qtd) VALUES ('nao-existe', 'i1', 'X', 'c', 1, 1);"
  const v = await verificarRestauracao(d, { antes: r0, depois: r0 })
  assert.equal(v.ok, false); assert.ok(v.checks.some(c => !c.ok && /chaves estrangeiras/.test(c.nome)))
})

test('sem os arquivos de antes/depois a rotina NÃO considera o backup verificado', async () => {
  const v = await verificarRestauracao(dump(bancoReal().raw))
  assert.equal(v.ok, false); assert.ok(v.checks.some(c => !c.ok && /comparação com o banco em produção/.test(c.nome)))
})

test('arquivo cortado no meio (download/exportação interrompida) é recusado', async () => {
  const D1 = bancoReal(), r0 = await ref(D1), d = dump(D1.raw)
  const v = await verificarRestauracao(d.slice(0, Math.floor(d.length * 0.6)), { antes: r0, depois: r0 })
  assert.equal(v.ok, false)
})

test('backup SEM os gatilhos (regras) é recusado, mesmo com dados certos', async () => {
  const D1 = bancoReal(), r0 = await ref(D1)
  const v = await verificarRestauracao(dump(D1.raw, { semGatilhos: true }), { antes: r0, depois: r0 })
  assert.equal(v.ok, false); assert.ok(v.checks.some(c => !c.ok && /tabelas, índices e gatilhos/.test(c.nome)))
})

test('regra alterada em produção (gatilho diferente do repositório) é detectada', async () => {
  const D1 = bancoReal(), r0 = await ref(D1)
  D1.raw.exec('DROP TRIGGER trg_pag_upd; CREATE TRIGGER trg_pag_upd BEFORE UPDATE ON cad_pagamentos BEGIN SELECT 1; END;')   // enfraquece a regra
  const v = await verificarRestauracao(dump(D1.raw), { antes: r0, depois: r0 })
  assert.equal(v.ok, false); assert.ok(v.checks.some(c => !c.ok && /idênticos/.test(c.nome)))
})

test('dado adulterado (saldo que não bate com os pagamentos) é detectado', async () => {
  const D1 = bancoReal(), r0 = await ref(D1)
  D1.raw.exec('DROP TRIGGER trg_vendas_upd; DROP TRIGGER trg_vendas_coerencia; UPDATE cad_vendas SET saldo_centavos = 10')
  const v = await verificarRestauracao(dump(D1.raw), { antes: r0, depois: r0 })
  assert.equal(v.ok, false); assert.ok(v.checks.some(c => !c.ok && /zero violações/.test(c.nome)))
})

test('linhas perdidas (restaurado tem menos que o banco tinha ANTES) é detectado; linhas a mais que o DEPOIS também', async () => {
  const D1 = bancoReal(), r0 = await ref(D1)
  const maior = { contagens: { ...r0.contagens, pagamentos: r0.contagens.pagamentos + 1 } }          // produção tinha 1 pagamento a mais do que a cópia
  assert.equal((await verificarRestauracao(dump(D1.raw), { antes: maior, depois: maior })).ok, false)
  const menor = { contagens: { ...r0.contagens, vendas: 0 } }                                          // cópia tem mais do que produção terminou com
  assert.equal((await verificarRestauracao(dump(D1.raw), { antes: menor, depois: menor })).ok, false)
})

test('lixo no lugar do arquivo não derruba o verificador: ele reprova com explicação', async () => {
  const v = await verificarRestauracao('isto não é sql', { antes: { contagens: {} }, depois: { contagens: {} } })
  assert.equal(v.ok, false); assert.equal(v.checks[0].ok, false)
})

import { spawnSync } from 'node:child_process'
import { mkdtempSync, symlinkSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('CLI: roda de verdade mesmo chamado por um atalho (symlink); com backup ruim sai com código ≠ 0 e NUNCA "passa em silêncio"', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bk-'))
  symlinkSync(new URL('../scripts', import.meta.url).pathname, join(dir, 'scripts'))
  const D1 = bancoReal(), r0 = await ref(D1)
  writeFileSync(join(dir, 'bom.sql'), dump(D1.raw)); writeFileSync(join(dir, 'ruim.sql'), 'lixo'); writeFileSync(join(dir, 'a.json'), JSON.stringify(r0))
  const rodar = (arq, extra = []) => spawnSync('node', [join(dir, 'scripts/backup/verificar-restauracao.mjs'), join(dir, arq), ...extra], { cwd: dir, encoding: 'utf8' })
  const bom = rodar('bom.sql', [`--antes=${join(dir, 'a.json')}`, `--depois=${join(dir, 'a.json')}`, `--saida=${join(dir, 'rel.json')}`])
  assert.equal(bom.status, 0, bom.stdout + bom.stderr); assert.match(bom.stdout, /BACKUP VERIFICADO/)
  assert.equal(JSON.parse(readFileSync(join(dir, 'rel.json'), 'utf8')).ok, true)                // relatório gravado
  const ruim = rodar('ruim.sql', ['--simulado'])
  assert.notEqual(ruim.status, 0); assert.match(ruim.stdout, /BACKUP COM PROBLEMA/)
  assert.equal(rodar('bom.sql', ['--simulado']).status, 0)                                          // simulado dispensa o antes/depois
  assert.equal(rodar('bom.sql').status, 1)                                                          // sem antes/depois e sem --simulado: não é "verificado"
})
