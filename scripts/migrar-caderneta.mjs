#!/usr/bin/env node
// Migra a Caderneta do backup JSON do app antigo para o banco novo (D1/SQLite).
//
//   node scripts/migrar-caderneta.mjs <backup.json> [--saida=./saida-migracao] [--agora=<ms>]
//
// Gera na pasta de saída:
//   importar-caderneta.sql   o que pode entrar, JÁ TESTADO contra o esquema real (mesmos gatilhos do D1)
//   relatorio.md / .json     contagens antes e depois, saldos ao centavo, e a lista de divergências
//   quarentena.json          registros originais que NÃO entraram (e por quê)
//
// Princípios: não corrige nada sozinho; o que viola uma regra fica em quarentena, listado, para decisão humana.
// Cada venda entra por inteiro ou não entra (savepoint). Estornos antigos (que no app removiam o pagamento)
// viram DUAS linhas: pagamento + estorno, com efeito líquido igual ao do app. O registro original de cada venda
// fica em `origem_json`.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { criarD1 } from '../tests-servidor/d1shim.mjs'
import { uidServidor } from '../src/services/uidServidor.js'
import { conferenciaCaderneta, chaveNome, chaveTelefone, limparTexto } from '../functions/_lib/caderneta.js'

// ───────────────────────── utilitários ─────────────────────────
const lit = (v) => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('número inválido'); return String(v) }
  return `'${String(v).replace(/'/g, "''")}'`
}
const inserir = (tabela, o) => `INSERT INTO ${tabela} (${Object.keys(o).join(', ')}) VALUES (${Object.values(o).map(lit).join(', ')});`
const slug = (u) => String(u).replace(/[^0-9A-Za-z_-]/g, '_')
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/
const cent = (v) => Math.round((Number(v) || 0) * 100)
const temMaisDeDuasCasas = (v) => Math.abs(Number(v) * 100 - Math.round(Number(v) * 100)) > 1e-4
const ms = (iso, fallback) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : fallback }
const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function migrarCaderneta(backup, { agora = Date.now(), descartarPagamentosDuplicados = false } = {}) {
  const dados = backup?.cad_fiados || backup?.cad_lojas ? backup : (backup?.dados || backup?.tables || backup || {})
  const lojasL = dados.cad_lojas || [], clientesL = dados.cad_clientes || [], fiadosL = dados.cad_fiados || []

  const D1 = criarD1()
  const raw = D1.raw
  const sqlSaida = []
  const quarentena = [], avisos = [], ajustes = []
  let descartadosTotal = 0
  const mapLoja = new Map(), mapCliente = new Map(), usados = new Set()

  const novoUid = (legado, tabela) => {
    let u = uidServidor(legado, tabela)
    if (usados.has(u)) { avisos.push({ tipo: 'uid_repetido', tabela, uid: legado }); u = `${u.slice(0, 50)}_dup${usados.size}` }
    usados.add(u); return u
  }
  /** Executa o grupo de SQLs num savepoint. Retorna null se entrou, ou o motivo se falhou. */
  const tentar = (sqls, conferir = null) => {
    raw.exec('SAVEPOINT s')
    try {
      for (const q of sqls) raw.exec(q)
      const erro = conferir?.()
      if (erro) throw new Error(erro)
      raw.exec('RELEASE s'); sqlSaida.push(...sqls); return null
    } catch (e) { raw.exec('ROLLBACK TO s'); raw.exec('RELEASE s'); return String(e.message || e).replace(/^.*?(E_[A-Z_]+).*$/s, '$1') }
  }

  // ── Lojas ──
  for (const l of lojasL) {
    const uid = novoUid(l.uid, 'loja')
    const nome = limparTexto(l.nome)
    const quando = ms(l.arquivadoEm, agora)
    const erro = tentar([inserir('cad_lojas', { uid, nome, nome_chave: chaveNome(nome), arquivada_em: l.arquivado ? quando : null, criado_em: agora, atualizado_em: agora })])
    if (erro) quarentena.push({ tabela: 'cad_lojas', motivo: `Loja não entrou: ${erro}`, registro: l })
    else mapLoja.set(l.id, { uid, nome })
  }

  // ── Clientes ──
  for (const c of clientesL) {
    const loja = mapLoja.get(c.lojaId)
    if (!loja) { quarentena.push({ tabela: 'cad_clientes', motivo: 'Loja do cliente não entrou (ou não existe).', registro: c }); continue }
    const uid = novoUid(c.uid, 'cliente')
    const nome = limparTexto(c.nome), funcao = limparTexto(c.funcao)
    const base = { uid, loja_uid: loja.uid, nome, nome_chave: chaveNome(nome), telefone: limparTexto(c.telefone) || null,
      telefone_chave: chaveTelefone(c.telefone) || null, funcao: funcao || null, funcao_chave: chaveNome(funcao),
      arquivado_em: c.arquivado ? agora : null, criado_em: agora, atualizado_em: agora }
    let erro = tentar([inserir('cad_clientes', base)])
    if (erro && base.telefone_chave) {
      // mesmo telefone em dois cadastros: entra sem a trava de telefone, para as vendas não se perderem, e fica avisado
      erro = tentar([inserir('cad_clientes', { ...base, telefone_chave: null })])
      if (!erro) avisos.push({ tipo: 'telefone_duplicado', cliente: nome, telefone: c.telefone, detalhe: 'Importado sem a trava de unicidade do telefone. Decidir se junta os cadastros.' })
    }
    if (erro) quarentena.push({ tabela: 'cad_clientes', motivo: `Cliente não entrou: ${erro}`, registro: c })
    else mapCliente.set(c.id, { uid, nome, lojaUid: loja.uid })
  }

  // ── Vendas (cada uma por inteiro ou nada) ──
  let pagamentosAtivosLegado = 0, estornosLegado = 0, saldoLegado = 0
  const saldoLegadoPorLoja = new Map()
  for (const f of fiadosL) {
    const pagsOriginais = (Array.isArray(f.pagamentos) ? f.pagamentos : []).slice()
      .sort((a, b) => String(a.criadoEm || a.data || '').localeCompare(String(b.criadoEm || b.data || '')))
    const ests = Array.isArray(f.estornos) ? f.estornos : []
    pagamentosAtivosLegado += pagsOriginais.length; estornosLegado += ests.length
    // Ajuste OPT-IN (--aceitar-pagamentos-duplicados): descarta pagamento IDÊNTICO ao anterior (mesmo valor, data,
    // saldoAntes e saldoDepois) — assinatura do lançamento duplicado por erro de sincronização. O descartado
    // continua guardado em `origem_json` e fica listado no relatório. Qualquer outra divergência segue em quarentena.
    let pags = pagsOriginais
    if (descartarPagamentosDuplicados) {
      const mantidos = [], descartados = []
      for (const p of pagsOriginais) {
        const ant = mantidos[mantidos.length - 1]
        const igual = ant && cent(ant.valor) === cent(p.valor) && ant.data === p.data &&
          cent(ant.saldoAntes) === cent(p.saldoAntes) && cent(ant.saldoDepois) === cent(p.saldoDepois)
        if (igual) descartados.push(p); else mantidos.push(p)
      }
      if (descartados.length) {
        pags = mantidos; descartadosTotal += descartados.length
        ajustes.push({ tipo: 'pagamento_duplicado_descartado', cliente: f.clienteNome, venda: f.dataVenda, total_centavos: cent(f.total),
          mantido: { valor_centavos: cent(mantidos[0]?.valor), criadoEm: mantidos[0]?.criadoEm },
          descartados: descartados.map(p => ({ valor_centavos: cent(p.valor), data: p.data, criadoEm: p.criadoEm })) })
      }
    }
    const saldoC = cent(f.saldo); saldoLegado += saldoC
    const nomeLoja = mapLoja.get(f.lojaId)?.nome || f.lojaNome || String(f.lojaId)
    saldoLegadoPorLoja.set(nomeLoja, (saldoLegadoPorLoja.get(nomeLoja) || 0) + saldoC)

    const rejeita = (motivo) => quarentena.push({ tabela: 'cad_fiados', motivo, saldo_legado_centavos: saldoC, registro: f })
    const cli = mapCliente.get(f.clienteId), loja = mapLoja.get(f.lojaId)
    if (!cli) { rejeita('Cliente da venda não entrou (ou não existe).'); continue }
    if (!loja) { rejeita('Loja da venda não entrou (ou não existe).'); continue }
    if ([f.total, f.saldo, f.desconto || 0, ...(f.itens || []).map(i => i.preco), ...pags.map(p => p.valor), ...ests.map(e => e.valor)].some(temMaisDeDuasCasas)) {
      rejeita('Há valor com mais de 2 casas decimais (não cabe em centavos exatos).'); continue
    }
    const totalC = cent(f.total), descC = cent(f.desconto), brutoC = totalC + descC
    const itens = (f.itens || []).map((i, pos) => {
      const preco = cent(i.preco), qtd = Number(i.qty ?? i.qtd)
      return { pos, item_id: i.id ?? null, nome: limparTexto(i.nome) || '(sem nome)', emoji: i.emoji || null, qtd, preco_centavos: preco, subtotal_centavos: Math.round(qtd * preco) }
    })
    const somaItens = itens.reduce((s, i) => s + i.subtotal_centavos, 0)
    if (!itens.length) { rejeita('Venda sem itens.'); continue }
    if (somaItens !== brutoC) { rejeita(`Itens somam ${reais(somaItens)}, mas total + desconto = ${reais(brutoC)}.`); continue }
    const somaPag = pags.reduce((s, p) => s + cent(p.valor), 0)
    if (saldoC !== totalC - somaPag) { rejeita(`Saldo ${reais(saldoC)} não bate com total − pagamentos (${reais(totalC - somaPag)}). Diferença: ${reais(saldoC - (totalC - somaPag))}.`); continue }
    if ((f.status === 'pago') !== (saldoC === 0)) { rejeita(`Status "${f.status}" com saldo ${reais(saldoC)}.`); continue }

    const uid = novoUid(f.uid, 'venda')
    const criado = ms(f.criadoEm, ms(f.dataVenda, agora))
    const dataVenda = RE_DATA.test(f.dataVenda || '') ? f.dataVenda : null
    if (!dataVenda) { rejeita('Data da venda inválida.'); continue }
    const sqls = [inserir('cad_vendas', {
      uid, cliente_uid: cli.uid, loja_uid: loja.uid, cliente_nome: limparTexto(f.clienteNome) || cli.nome, loja_nome: limparTexto(f.lojaNome) || loja.nome,
      bruto_centavos: brutoC, desconto_centavos: descC, desconto_motivo: limparTexto(f.descontoMotivo) || null, total_centavos: totalC, saldo_centavos: totalC,
      status: 'aberto', data_venda: dataVenda, hora_venda: f.horaVenda || null, data_venc: RE_DATA.test(f.dataVenc || '') ? f.dataVenc : null,
      usuario: 'migracao', criado_em: criado, atualizado_em: criado, origem_json: JSON.stringify(f).slice(0, 20000) }),
      ...itens.map(i => inserir('cad_venda_itens', { venda_uid: uid, ...i }))]
    const dh = (o) => ({ data: RE_DATA.test(o.data || '') ? o.data : dataVenda, hora: o.hora || null })
    // estornos antigos: o app removia o pagamento; aqui ele volta como pagamento + estorno (efeito líquido zero)
    ests.forEach((e, k) => {
      const v = cent(e.valor), p = dh({ data: e.pagamentoData, hora: e.pagamentoHora }), q = dh(e)
      const puid = `${uid}-pe${k}`.slice(0, 64), tPag = ms(e.pagamentoCriadoEm, criado), tEst = ms(e.criadoEm, tPag + 1)
      sqls.push(inserir('cad_pagamentos', { uid: puid, venda_uid: uid, valor_centavos: v, saldo_antes_centavos: totalC, saldo_depois_centavos: totalC - v, data: p.data, hora: p.hora, usuario: 'migracao', criado_em: tPag }),
        inserir('cad_estornos', { uid: `${uid}-e${k}`.slice(0, 64), pagamento_uid: puid, venda_uid: uid, valor_centavos: v, motivo: 'Estorno migrado do sistema antigo', data: q.data, hora: q.hora, usuario: 'migracao', criado_em: tEst }))
    })
    let saldoCorrente = totalC
    pags.forEach((p, k) => {
      const v = cent(p.valor), d = dh(p)
      sqls.push(inserir('cad_pagamentos', { uid: `${uid}-p${k}`.slice(0, 64), venda_uid: uid, valor_centavos: v, saldo_antes_centavos: saldoCorrente, saldo_depois_centavos: saldoCorrente - v,
        data: d.data, hora: d.hora, usuario: 'migracao', criado_em: ms(p.criadoEm, ms(d.data, criado)) }))
      saldoCorrente -= v
    })
    const erro = tentar(sqls, () => {
      const g = raw.prepare('SELECT saldo_centavos s, status FROM cad_vendas WHERE uid=?').get(uid)
      return g.s !== saldoC || g.status !== f.status ? `Depois de importar: saldo ${g.s}/${g.status}, esperado ${saldoC}/${f.status}.` : null
    })
    if (erro) rejeita(`O banco recusou a venda (${erro}).`)
  }

  return { sql: sqlSaida.join('\n') + '\n', quarentena, avisos, ajustes, descartadosTotal, D1, legado: {
    lojas: lojasL.length, clientes: clientesL.length, vendas: fiadosL.length, pagamentos_ativos: pagamentosAtivosLegado, estornos: estornosLegado,
    saldo_aberto_centavos: saldoLegado, saldo_por_loja: Object.fromEntries([...saldoLegadoPorLoja].filter(([, v]) => v > 0)) } }
}

export async function montarRelatorio(r) {
  const c = await conferenciaCaderneta(r.D1)
  const quarVendas = r.quarentena.filter(q => q.tabela === 'cad_fiados')
  const saldoQuar = quarVendas.reduce((s, q) => s + q.saldo_legado_centavos, 0)
  const checks = {
    saldo_confere: r.legado.saldo_aberto_centavos === c.saldo_aberto_centavos + saldoQuar,
    sem_violacoes_no_banco: c.ok,
    vendas_confere: r.legado.vendas === c.contagens.vendas + quarVendas.length,
    pagamentos_confere: c.contagens.pagamentos === r.legado.pagamentos_ativos + r.legado.estornos - quarVendas.reduce((s, q) => s + (q.registro.pagamentos?.length || 0) + (q.registro.estornos?.length || 0), 0) - r.descartadosTotal,
  }
  return { gerado_em: new Date().toISOString(), antes: r.legado, depois: c, em_quarentena: { vendas: quarVendas.length, saldo_centavos: saldoQuar, total_registros: r.quarentena.length },
    avisos: r.avisos, ajustes_aprovados: r.ajustes, checks, ok_para_prosseguir: Object.values(checks).every(Boolean) && r.quarentena.length === 0 }
}

export function relatorioMd(rel, quarentena) {
  const L = [], f = reais
  L.push('# Relatório de migração — Caderneta', '', `Gerado em ${rel.gerado_em}`, '',
    `**Resultado:** ${rel.ok_para_prosseguir ? '✅ tudo confere, sem pendências' : (Object.values(rel.checks).every(Boolean) ? '⚠️ confere, mas há registros em quarentena para decidir' : '❌ NÃO CONFERE — não prosseguir')}`, '',
    '## Antes × depois', '', '| Item | Sistema antigo | Banco novo |', '|---|---|---|',
    `| Lojas | ${rel.antes.lojas} | ${rel.depois.contagens.lojas} |`, `| Clientes | ${rel.antes.clientes} | ${rel.depois.contagens.clientes} |`,
    `| Vendas | ${rel.antes.vendas} | ${rel.depois.contagens.vendas} (+${rel.em_quarentena.vendas} em quarentena) |`,
    `| Pagamentos ativos (sistema antigo) × linhas de pagamento (novo)* | ${rel.antes.pagamentos_ativos} | ${rel.depois.contagens.pagamentos} |`, `| Estornos | ${rel.antes.estornos} | ${rel.depois.contagens.estornos} |`,
    `| Saldo em aberto | ${f(rel.antes.saldo_aberto_centavos)} | ${f(rel.depois.saldo_aberto_centavos)} (+${f(rel.em_quarentena.saldo_centavos)} em quarentena) |`, '',
    '\\* no banco novo, cada estorno antigo volta como pagamento + estorno; vendas em quarentena não entram na contagem.', '', '## Conferências', '',
    ...Object.entries(rel.checks).map(([k, v]) => `- ${v ? '✅' : '❌'} ${k}`),
    ...Object.entries(rel.depois.violacoes).map(([k, v]) => `- ${v === 0 ? '✅' : '❌'} ${k}: ${v}`), '',
    '## Saldo em aberto por loja (banco novo)', '', ...rel.depois.saldo_aberto_por_loja.map(l => `- ${l.loja_nome}: ${f(l.saldo_centavos)}`), '')
  if (rel.ajustes_aprovados?.length) L.push('## Ajustes aprovados (pagamentos duplicados descartados)', '',
    ...rel.ajustes_aprovados.map(a => `- ${a.cliente}, venda de ${a.venda} (${f(a.total_centavos)}): mantido 1 pagamento de ${f(a.mantido.valor_centavos)}; descartado${a.descartados.length > 1 ? 's' : ''} ${a.descartados.map(d => `${f(d.valor_centavos)} de ${d.criadoEm || d.data}`).join(', ')}. O original continua em origem_json.`),
    '', `Total descartado: ${f(rel.ajustes_aprovados.reduce((t, a) => t + a.descartados.reduce((u, d) => u + d.valor_centavos, 0), 0))}`, '')
  if (rel.avisos.length) L.push('## Avisos', '', ...rel.avisos.map(a => `- ${a.tipo}: ${a.cliente || a.tabela || ''} ${a.detalhe || ''}`), '')
  if (quarentena.length) L.push('## Em quarentena (não entraram; decidir caso a caso)', '', ...quarentena.map(q => `- **${q.tabela}** — ${q.motivo}${q.registro?.clienteNome ? ` (cliente ${q.registro.clienteNome}, venda ${q.registro.dataVenda})` : ''}`), '')
  return L.join('\n')
}

// ───────────────────────── execução por linha de comando ─────────────────────────
// "executado direto?" por caminho REAL (um atalho/symlink não pode fazer o script sair com sucesso sem rodar nada)
const executadoDireto = (() => { try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()
if (executadoDireto) {
  const arg = process.argv.slice(2)
  const arquivo = arg.find(a => !a.startsWith('--'))
  if (!arquivo) { console.error('Uso: node scripts/migrar-caderneta.mjs <backup.json> [--saida=pasta]'); process.exit(2) }
  const saida = (arg.find(a => a.startsWith('--saida=')) || '--saida=./saida-migracao').split('=')[1]
  const agoraArg = arg.find(a => a.startsWith('--agora='))
  const r = migrarCaderneta(JSON.parse(readFileSync(arquivo, 'utf8')), { ...(agoraArg ? { agora: Number(agoraArg.split('=')[1]) } : {}), descartarPagamentosDuplicados: arg.includes('--aceitar-pagamentos-duplicados') })
  const rel = await montarRelatorio(r)
  mkdirSync(saida, { recursive: true })
  writeFileSync(join(saida, 'importar-caderneta.sql'), r.sql)
  writeFileSync(join(saida, 'relatorio.json'), JSON.stringify(rel, null, 2))
  writeFileSync(join(saida, 'relatorio.md'), relatorioMd(rel, r.quarentena))
  writeFileSync(join(saida, 'quarentena.json'), JSON.stringify(r.quarentena, null, 2))
  console.log(relatorioMd(rel, r.quarentena))
  process.exit(Object.values(rel.checks).every(Boolean) ? 0 : 1)
}
