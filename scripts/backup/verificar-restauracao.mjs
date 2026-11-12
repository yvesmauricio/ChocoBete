#!/usr/bin/env node
// Prova que um backup (.sql exportado pelo `wrangler d1 export`) RESTAURA de verdade, num banco limpo:
//
//   node scripts/backup/verificar-restauracao.mjs <dump.sql> [--antes=antes.json] [--depois=depois.json] [--saida=relatorio.json]
//   (simulado de restauração com um backup antigo: --simulado dispensa a comparação com a produção)
//
//   1. o arquivo aplica inteiro num banco vazio, sem erro (dump truncado/corrompido falha aqui);
//   2. integridade do SQLite e das chaves estrangeiras;
//   3. mesmas tabelas e MESMOS gatilhos do repositório (se alguém mexeu nas regras em produção, aparece aqui);
//   4. as conferências da Caderneta fecham com zero violações (saldo = total − pagamentos, pago ⇔ saldo 0…);
//   5. as regras continuam valendo no banco restaurado (tentativa de violar é recusada);
//   6. nada se perdeu: nada é apagado no banco, então cada contagem restaurada precisa estar entre a leitura
//      de ANTES e a de DEPOIS da exportação (arquivos JSON do GET /api/caderneta/backup).
// Saída 0 = backup bom. Qualquer outra coisa = NÃO guarde este backup como bom.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { criarD1 } from '../../tests-servidor/d1shim.mjs'
import { conferenciaCaderneta } from '../../functions/_lib/caderneta.js'

const normalizar = (s) => String(s).replace(/\s+/g, ' ').trim()
const MIGRACOES = new URL('../../migrations/', import.meta.url).pathname

export async function verificarRestauracao(sqlDump, { antes = null, depois = null, semComparacao = false } = {}) {
  const checks = []
  const ok = (nome, passou, detalhe = '') => checks.push({ nome, ok: !!passou, detalhe: String(detalhe) })
  const out = { checks, resumo: null, ok: false }

  // 1) restaura num banco vazio
  const D1 = criarD1(null)
  const db = D1.raw
  try { db.exec(sqlDump); ok('restaura inteiro num banco limpo', true) }
  catch (e) { ok('restaura inteiro num banco limpo', false, e.message); return out }

  // 2) integridade
  const integ = db.prepare('PRAGMA integrity_check').all().map(r => Object.values(r)[0])
  ok('integridade do banco (integrity_check)', integ.length === 1 && integ[0] === 'ok', integ.join('; '))
  const fk = db.prepare('PRAGMA foreign_key_check').all()
  ok('chaves estrangeiras consistentes', fk.length === 0, `${fk.length} violações`)

  // 3) mesmo esquema e MESMAS regras que o repositório
  const ref = criarD1().raw
  const objetos = (d) => d.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").all()
  const meu = new Map(objetos(db).map(o => [`${o.type}:${o.name}`, o]))
  const faltando = [], diferentes = []
  for (const o of objetos(ref)) {
    const m = meu.get(`${o.type}:${o.name}`)
    if (!m) faltando.push(`${o.type} ${o.name}`)
    else if (o.type === 'trigger' && normalizar(m.sql) !== normalizar(o.sql)) diferentes.push(o.name)
  }
  ok('todas as tabelas, índices e gatilhos do repositório existem', faltando.length === 0, faltando.join(', '))
  ok('gatilhos (as regras) idênticos aos do repositório', diferentes.length === 0, diferentes.join(', '))

  // 4) conferências da Caderneta
  let conf
  try { conf = await conferenciaCaderneta(D1) }
  catch (e) { ok('conferências da Caderneta executam', false, e.message); return out }   // esquema incompleto: já falhou acima; não travar
  ok('conferências da Caderneta: zero violações', conf.ok, JSON.stringify(Object.fromEntries(Object.entries(conf.violacoes).filter(([, v]) => v))))
  ok('há dados (vendas e pagamentos não vazios)', conf.contagens.vendas > 0, `vendas=${conf.contagens.vendas}`)

  // 5) as regras valem no banco restaurado
  const tenta = (sql) => { try { db.exec('SAVEPOINT sonda'); db.exec(sql); db.exec('ROLLBACK TO sonda'); db.exec('RELEASE sonda'); return false } catch { db.exec('ROLLBACK TO sonda'); db.exec('RELEASE sonda'); return true } }
  ok('regra: não aceita saldo negativo', tenta("UPDATE cad_vendas SET saldo_centavos = -1 WHERE uid = (SELECT uid FROM cad_vendas LIMIT 1)"))
  ok('regra: não aceita apagar pagamento (histórico imutável)', conf.contagens.pagamentos === 0 || tenta('DELETE FROM cad_pagamentos'))
  ok('regra: não aceita apagar venda', tenta('DELETE FROM cad_vendas'))

  // 6) nada se perdeu (contagens entre ANTES e DEPOIS da exportação)
  if (antes && depois) {
    for (const k of Object.keys(antes.contagens)) {
      const r = conf.contagens[k], a = antes.contagens[k], d = depois.contagens[k]
      ok(`nada perdido: ${k} (${a} ≤ ${r} ≤ ${d})`, r >= a && r <= d, `restaurado=${r} antes=${a} depois=${d}`)
    }
  } else if (semComparacao) ok('comparação com o banco em produção (não se aplica ao simulado)', true)
  else ok('comparação com o banco em produção', false, 'faltam --antes e --depois (rotina diária sempre informa)')

  out.resumo = { ...conf.contagens, saldo_aberto_centavos: conf.saldo_aberto_centavos }
  out.ok = checks.every(c => c.ok)
  return out
}

// "executado direto?" por caminho REAL (um atalho/symlink não pode fazer o script sair com sucesso sem rodar nada)
const executadoDireto = (() => { try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()
if (executadoDireto) {
  const arg = process.argv.slice(2)
  const arq = arg.find(a => !a.startsWith('--'))
  const op = (n) => arg.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=')
  if (!arq) { console.error('Uso: node scripts/backup/verificar-restauracao.mjs <dump.sql> [--antes=a.json --depois=d.json] [--saida=r.json]'); process.exit(2) }
  const lerJson = (f) => (f ? JSON.parse(readFileSync(f, 'utf8')) : null)
  const r = await verificarRestauracao(readFileSync(arq, 'utf8'), { antes: lerJson(op('antes')), depois: lerJson(op('depois')), semComparacao: arg.includes('--simulado') })
  for (const c of r.checks) console.log(`${c.ok ? '✅' : '❌'} ${c.nome}${!c.ok && c.detalhe ? ` — ${c.detalhe}` : ''}`)
  if (r.resumo) console.log('\nResumo restaurado:', JSON.stringify(r.resumo))
  if (op('saida')) writeFileSync(op('saida'), JSON.stringify(r, null, 2))
  console.log(r.ok ? '\nBACKUP VERIFICADO: restaura e confere.' : '\nBACKUP COM PROBLEMA: não guarde como bom.')
  process.exit(r.ok ? 0 : 1)
}
