/**
 * useGerarDocumento.js
 * Gerador de documentos oficiais MEI
 *
 * Livro Caixa  — Resolução CGSN nº 140/2018, art. 26-A
 * DASN-SIMEI   — IN RFB nº 2.110/2022 / LC nº 123/2006 art. 18-A § 15
 */

// ── Helpers (local para o composable) ────────────────────────────────────────────────────────
const BRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtData = (iso) => {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}

const hoje = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

function abrirJanela(html, titulo) {
  const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
  if (!win) { alert('Permita pop-ups para gerar o documento.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}

// ── CSS COMPARTILHADO ───────────────────────────────────────────────
const CSS_BASE = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Source Serif 4', 'Times New Roman', Georgia, serif;
    font-size: 9.5pt;
    color: #000;
    background: #f4f4f4;
  }
  .pagina {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 14mm 20mm;
    margin: 8mm auto;
    background: #fff;
    box-shadow: 0 2px 16px rgba(0,0,0,.18);
    position: relative;
    page-break-after: always;
  }
  @media print {
    body { background: #fff; }
    .pagina {
      margin: 0;
      box-shadow: none;
      page-break-after: always;
    }
    .no-print { display: none !important; }
  }

  /* ── Cabeçalho oficial ── */
  .doc-topo {
    display: flex;
    align-items: flex-start;
    gap: 14pt;
    border-bottom: 3px solid #003580;
    padding-bottom: 10pt;
    margin-bottom: 10pt;
  }
  .brasao {
    width: 56pt;
    height: 56pt;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #003580;
    font-size: 28pt;
    border-radius: 50%;
    color: #003580;
    background: #f0f4ff;
  }
  .doc-topo-texto { flex: 1; }
  .gov-linha { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #003580; }
  .doc-titulo {
    font-size: 14pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .4px;
    color: #000;
    line-height: 1.2;
    margin: 3pt 0 2pt;
  }
  .doc-subtitulo { font-size: 8.5pt; color: #333; }

  /* ── Caixa de identificação ── */
  .id-box {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #000;
    margin-bottom: 8pt;
    font-size: 8.5pt;
  }
  .id-box td, .id-box th {
    border: 1px solid #555;
    padding: 4pt 6pt;
    vertical-align: top;
  }
  .id-box th {
    background: #e8edf5;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .4px;
    white-space: nowrap;
    color: #000;
  }
  .id-box td { font-weight: 400; }
  .id-box td strong { font-weight: 700; }

  /* ── Seção / Quadro ── */
  .quadro-titulo {
    background: #003580;
    color: #fff;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
    padding: 4pt 7pt;
    margin-top: 10pt;
  }
  .quadro-subtitulo {
    background: #d4ddf0;
    font-size: 7.5pt;
    font-style: italic;
    padding: 3pt 7pt;
    border-left: 1.5px solid #003580;
    border-right: 1.5px solid #003580;
    color: #000;
    margin-bottom: 0;
  }

  /* ── Tabelas ── */
  .tabela {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 0;
  }
  .tabela th {
    background: #e8edf5;
    border: 1px solid #333;
    padding: 4pt 5pt;
    text-align: center;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .3px;
  }
  .tabela td {
    border: 1px solid #888;
    padding: 3.5pt 5pt;
    vertical-align: top;
  }
  .tabela .num { text-align: right; font-family: 'Courier New', monospace; font-size: 8.5pt; white-space: nowrap; }
  .tabela .cen { text-align: center; }
  .tabela tr.subtotal td {
    background: #f5f5f5;
    font-weight: 700;
    border-top: 1.5px solid #333;
  }
  .tabela tr.total td {
    background: #e8edf5;
    font-weight: 700;
    border-top: 2px solid #003580;
    border-bottom: 2px solid #003580;
  }
  .tabela tr.vazio td {
    height: 14pt;
    background: #fafafa;
  }
  .tabela tr:nth-child(even) td { background: #fafafa; }
  .tabela tr.subtotal td, .tabela tr.total td { background: inherit; }

  /* ── Resumo final ── */
  .resumo-box {
    border: 1.5px solid #003580;
    margin-top: 8pt;
    font-size: 8.5pt;
  }
  .resumo-box .resumo-titulo {
    background: #003580;
    color: #fff;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
    padding: 3pt 7pt;
  }
  .resumo-linha {
    display: flex;
    justify-content: space-between;
    padding: 3.5pt 7pt;
    border-bottom: 1px solid #ddd;
  }
  .resumo-linha:last-child { border-bottom: none; }
  .resumo-linha span { color: #333; }
  .resumo-linha strong { font-family: 'Courier New', monospace; }
  .resumo-linha.destaque { background: #e8edf5; font-weight: 700; }
  .resumo-linha.destaque span, .resumo-linha.destaque strong { color: #000; }

  /* ── Assinaturas / rodapé ── */
  .assinatura-area {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20pt;
    margin-top: 20pt;
  }
  .assinatura-campo {
    border-top: 1px solid #333;
    padding-top: 4pt;
    font-size: 7.5pt;
    color: #444;
    text-align: center;
  }
  .rodape {
    margin-top: 12pt;
    padding-top: 6pt;
    border-top: 1px solid #ccc;
    font-size: 7pt;
    color: #555;
    line-height: 1.5;
  }

  /* ── Nota legal ── */
  .nota-legal {
    margin-top: 8pt;
    padding: 5pt 7pt;
    background: #fffbe6;
    border-left: 3px solid #c8890a;
    font-size: 7.5pt;
    color: #444;
    line-height: 1.5;
  }

  /* ── Botão flutuante no-print ── */
  .toolbar-flutuante {
    position: fixed;
    top: 14px;
    right: 14px;
    display: flex;
    gap: 8px;
    z-index: 9999;
  }
  .toolbar-flutuante button {
    padding: 9px 18px;
    background: #003580;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,50,.3);
  }
  .toolbar-flutuante button:hover { background: #002060; }
  .toolbar-flutuante .btn-fechar { background: #666; }

  /* ── Status MEI ── */
  .status-ok   { color: #1a7a45; font-weight: 700; }
  .status-warn { color: #c45a09; font-weight: 700; }
  .status-err  { color: #c41c1c; font-weight: 700; }

  /* ── Checkbox simulado ── */
  .check { display: inline-block; width: 10pt; height: 10pt; border: 1px solid #333; margin-right: 4pt; vertical-align: middle; text-align: center; font-size: 8pt; line-height: 10pt; }
  .check.sim { background: #003580; color: #fff; }
`

// ══════════════════════════════════════════════════════════════════
// LIVRO CAIXA MEI — Resolução CGSN nº 140/2018, art. 26-A
// ══════════════════════════════════════════════════════════════════
export function gerarLivroCaixa({
  mes_ref,
  empresa,
  entradas,
  naoMei,
  saidas,
  totais,
  acumulado,
  incluirNaoMei = true
}) {
  const nomeEmpresa = empresa?.razao_social || empresa?.nome || 'Microempreendedor Individual'
  const [mesSel, anoSel] = (mes_ref || '').split('/')
  const nomeMes = mesSel
    ? new Date(Number(anoSel), Number(mesSel) - 1, 1)
        .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    : mes_ref

  // Monta linhas unificadas com saldo corrente
  const linhas = []
  let saldo = 0
  const seq = { n: 0 }

  const addLinha = (item, tipo) => {
    seq.n++
    // Para manter o saldo correto, usamos o valor real (negativo para saídas)
    const valReal = item.valor || 0
    saldo += valReal

    // No Livro Caixa, um valor positivo em uma coluna de saída é uma dedução
    const isDeduction = (tipo === 'saida' && valReal > 0) || (tipo === 'entrada' && valReal < 0)
    const valDisplay = Math.abs(valReal)

    linhas.push({ 
      seq: seq.n, 
      data: item.data, 
      desc: item.descricao, 
      cat: item.categoria, 
      tipo, 
      val: isDeduction ? -valDisplay : valDisplay, 
      saldo 
    })
  }

  const listaEntradas = incluirNaoMei ? [...entradas, ...naoMei] : entradas
  const ordenados = [...listaEntradas, ...saidas]
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''))

  ordenados.forEach(it => {
    // Agrupamento por natureza para bater com os totais do Store
    let colTipo = 'saida'
    if (it.natureza === 'entrada') colTipo = 'entrada'
    else if (it.natureza === 'pessoal' && it.valor > 0) colTipo = 'entrada'
    else if (it.natureza === 'operacional') colTipo = 'saida'
    
    if (it.natureza === 'interna') return 
    addLinha(it, colTipo)
  })

  // Preencher com linhas vazias até mínimo de 20 (padrão livro caixa)
  const LINHAS_MIN = Math.max(linhas.length + 3, 18)
  while (linhas.length < LINHAS_MIN) {
    linhas.push(null)
  }

  const linhasHTML = linhas.map((l, i) => {
    if (!l) return `<tr class="vazio"><td>${''}</td><td></td><td></td><td class="num"></td><td class="num"></td><td class="num"></td></tr>`
    const entrada = l.tipo === 'entrada' ? (l.val < 0 ? `(${BRL(Math.abs(l.val))})` : BRL(l.val)) : ''
    const saida   = l.tipo === 'saida'   ? (l.val < 0 ? `(${BRL(Math.abs(l.val))})` : BRL(l.val)) : ''
    const saldoStr = l.saldo < 0
      ? `<span style="color:#c41c1c">(${BRL(Math.abs(l.saldo))})</span>`
      : BRL(l.saldo)
    return `
      <tr>
        <td class="cen">${l.seq}</td>
        <td class="cen">${fmtData(l.data)}</td>
        <td>${escHtml(l.desc)}${l.cat ? ` <span style="font-size:7pt;color:#666">· ${escHtml(l.cat)}</span>` : ''}</td>
        <td class="num">${entrada}</td>
        <td class="num">${saida}</td>
        <td class="num">${saldoStr}</td>
      </tr>`
  }).join('')

  // Totais do rodapé da tabela devem refletir exatamente o que está nas linhas acima
  const totalEntradasTabela = incluirNaoMei 
    ? (totais.receitas_mei || 0) + (totais.outras_entradas_nao_mei || 0)
    : (totais.receitas_mei || 0)
  const totalSaidasTabela = incluirNaoMei
    ? (totais.saidas_operacionais || 0) + (totais.saidas_pessoais || 0)
    : (totais.saidas_operacionais || 0)
  const saldoFinal    = totais.saldo_mes ?? (totais.saldo_operacional ?? 0)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Livro Caixa MEI – ${mes_ref}</title>
<style>${CSS_BASE}</style>
</head>
<body>

<div class="toolbar-flutuante no-print">
  <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  <button class="btn-fechar" onclick="window.close()">✕ Fechar</button>
</div>

<div class="pagina">

  <!-- ── Cabeçalho ── -->
  <div class="doc-topo">
    <div class="brasao">🇧🇷</div>
    <div class="doc-topo-texto">
      <div class="gov-linha">República Federativa do Brasil · Secretaria Especial da Receita Federal do Brasil</div>
      <div class="doc-titulo">Livro Caixa do Microempreendedor Individual</div>
      <div class="doc-subtitulo">
        Nos termos da <strong>Resolução CGSN nº 140/2018, art. 26-A</strong> · 
        Lei Complementar nº 123, de 14 de dezembro de 2006
      </div>
    </div>
  </div>

  <!-- ── Identificação ── -->
  <table class="id-box">
    <tr>
      <th style="width:45%">Razão Social / Nome do MEI</th>
      <th style="width:30%">CPF / CNPJ (MEI)</th>
      <th style="width:25%">Competência (Mês/Ano)</th>
    </tr>
    <tr>
      <td><strong>${escHtml(nomeEmpresa)}</strong></td>
      <td><strong>${escHtml(empresa?.cnpj || empresa?.cpf || 'Não informado')}</strong></td>
      <td class="cen"><strong>${mes_ref || ''}</strong></td>
    </tr>
    <tr>
      <th colspan="2">Município / UF</th>
      <th>Atividade Econômica Principal (CNAE)</th>
    </tr>
    <tr>
      <td colspan="2"><strong>${escHtml(empresa?.municipio || '—')} / ${escHtml(empresa?.uf || '—')}</strong></td>
      <td><strong>${escHtml(empresa?.cnae || '1091-1/01')}</strong></td>
    </tr>
  </table>

  <!-- ── Quadro 1 – Movimentação ── -->
  <div class="quadro-titulo">Quadro 1 — Movimentação de Caixa · ${nomeMes}</div>
  <div class="quadro-subtitulo">
    Registro cronológico de todas as receitas e despesas do mês, conforme art. 26-A da Resolução CGSN nº 140/2018
  </div>

  <table class="tabela">
    <thead>
      <tr>
        <th style="width:5%">Nº</th>
        <th style="width:9%">Data</th>
        <th>Histórico / Descrição do Lançamento</th>
        <th style="width:13%">Receitas (R$)</th>
        <th style="width:13%">Despesas (R$)</th>
        <th style="width:13%">Saldo (R$)</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHTML}
      <tr class="subtotal">
        <td colspan="3" style="text-align:right">TOTAL ACUMULADO NO MÊS</td>
        <td class="num">${BRL(totalEntradasTabela)}</td>
        <td class="num">${BRL(totalSaidasTabela)}</td>
        <td class="num">${saldoFinal < 0 ? `<span style="color:#c41c1c">(${BRL(Math.abs(saldoFinal))})</span>` : BRL(saldoFinal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ── Quadro 2 – Resumo mensal ── -->
  <div class="quadro-titulo" style="margin-top:12pt">Quadro 2 — Resumo do Mês · ${mes_ref}</div>
  <div class="resumo-box">
    <div class="resumo-linha">
      <span>Receita Bruta MEI (faturamento tributável para fins de LC 123/2006)</span>
      <strong>${BRL(totais.receitas_mei || 0)}</strong>
    </div>
    ${incluirNaoMei && totais.outras_entradas_nao_mei ? `
    <div class="resumo-linha">
      <span>Outras entradas não-MEI (rendimentos pessoais — não compõem faturamento tributável)</span>
      <strong>${BRL(totais.outras_entradas_nao_mei)}</strong>
    </div>` : ''}
    <div class="resumo-linha">
      <span>Rendimentos financeiros registrados</span>
      <strong>${BRL(totais.rendimento_financeiro || 0)}</strong>
    </div>
    <div class="resumo-linha">
      <span>( − ) Total de despesas operacionais do mês</span>
      <strong>${BRL(totais.saidas_operacionais || 0)}</strong>
    </div>
    <div class="resumo-linha destaque">
      <span>= Resultado Operacional do Mês</span>
      <strong>${BRL(totais.saldo_operacional || 0)}</strong>
    </div>
    <div class="resumo-linha">
      <span>Retiradas pessoais / Pró-labore do titular</span>
      <strong>${BRL(totais.saidas_pessoais || 0)}</strong>
    </div>
    <div class="resumo-linha destaque">
      <span>= Saldo Final do Mês (caixa disponível)</span>
      <strong>${BRL(saldoFinal)}</strong>
    </div>
  </div>

  <!-- ── Quadro 3 – Acumulado do ano ── -->
  <div class="quadro-titulo" style="margin-top:12pt">Quadro 3 — Acumulado do Ano-Calendário ${anoSel} até ${mes_ref}</div>
  <table class="tabela">
    <thead>
      <tr>
        <th>Faturamento MEI acumulado (Receita Bruta)</th>
        <th>Despesas operacionais acumuladas</th>
        <th>Resultado operacional acumulado</th>
        <th>Utilização do Teto MEI (R$ 81.000,00)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="num">${BRL(acumulado.receitas_mei)}</td>
        <td class="num">${BRL(acumulado.saidas_operacionais)}</td>
        <td class="num ${acumulado.saldo_operacional >= 0 ? '' : 'status-err'}">${BRL(acumulado.saldo_operacional)}</td>
        <td class="cen ${acumulado.pct_teto >= 90 ? 'status-err' : acumulado.pct_teto >= 70 ? 'status-warn' : 'status-ok'}">
          ${acumulado.pct_teto.toFixed(1)}%
        </td>
      </tr>
    </tbody>
  </table>

  <!-- ── Notas ── -->
  <div class="nota-legal" style="margin-top:10pt">
    <strong>Nota:</strong> Este Livro Caixa é elaborado em conformidade com o art. 26-A da Resolução CGSN nº 140, de 22 de maio de 2018. 
    O MEI está dispensado de escrituração contábil formal, devendo manter este registro por 5 (cinco) anos para fins de fiscalização. 
    Os valores de receita aqui consignados são a base de cálculo para verificação do limite de faturamento previsto no art. 18-A, 
    § 1º, da Lei Complementar nº 123/2006 (R$ 81.000,00 no ano-calendário).
  </div>

  <!-- ── Assinatura ── -->
  <div class="assinatura-area">
    <div class="assinatura-campo">
      Local e data: _________________________________, ${hoje()}
    </div>
    <div class="assinatura-campo">
      Assinatura do Microempreendedor Individual
      <div style="margin-top:18pt">_____________________________________________</div>
      <div style="margin-top:4pt">${escHtml(nomeEmpresa)}</div>
    </div>
  </div>

  <!-- ── Rodapé ── -->
  <div class="rodape">
    Documento gerado eletronicamente em ${hoje()} · 
    Base legal: Res. CGSN nº 140/2018 (art. 26-A) · LC nº 123/2006 · 
    O MEI deve manter os comprovantes originais dos lançamentos por 5 anos. · 
    Para entrega do DAS-MEI e DASN-SIMEI acesse: <strong>gov.br/mei</strong>
  </div>

</div><!-- /pagina -->
</body>
</html>`

  abrirJanela(html, `Livro Caixa MEI – ${mes_ref}`)
}


// ══════════════════════════════════════════════════════════════════
// DASN-SIMEI — Declaração Anual Simplificada
// IN RFB nº 2.110/2022 · LC nº 123/2006 art. 18-A § 15
// ══════════════════════════════════════════════════════════════════
export function gerarDASNSIMEI({
  ano,
  empresa,
  meses,
  totais,
  tetoAnual,
  pctTeto,
  incluirNaoMei = true
}) {
  const nomeEmpresa = empresa?.razao_social || empresa?.nome || 'Microempreendedor Individual'
  const dentroTeto  = (totais.receitas || 0) <= (tetoAnual || 81000)
  const statusTeto  = pctTeto >= 100 ? 'status-err' : pctTeto >= 90 ? 'status-warn' : 'status-ok'
  const statusTexto = pctTeto >= 100
    ? 'ACIMA DO TETO — Providencie regularização com contador'
    : pctTeto >= 90
      ? 'ATENÇÃO: Mais de 90% do teto atingido'
      : 'Dentro do limite anual permitido'

  const NOMES_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  // Montar todos os 12 meses (preencher ausentes com zero)
  const mesesCompletos = Array.from({ length: 12 }, (_, i) => {
    const mesNum = String(i + 1).padStart(2, '0')
    const ref    = `${mesNum}/${ano}`
    const found  = (meses || []).find(m => m.mes_ref === ref)
    return {
      ref,
      nome: NOMES_MESES[i],
      receitas_mei: found?.receitas_mei || 0,
      outras_entradas: found?.outras_entradas_nao_mei || 0,
      saidas_op: found?.saidas_operacionais || 0,
      saidas_pes: found?.saidas_pessoais || 0,
      saldo_op: found?.saldo_operacional || 0,
    }
  })

  const linhasQ1 = mesesCompletos.map((m, i) => `
    <tr ${i % 2 === 1 ? 'style="background:#f9f9f9"' : ''}>
      <td>${m.nome}</td>
      <td class="num">${m.receitas_mei > 0 ? BRL(m.receitas_mei) : '—'}</td>
      <td class="num">${BRL(0)}</td>
      <td class="num">${BRL(0)}</td>
      <td class="num"><strong>${m.receitas_mei > 0 ? BRL(m.receitas_mei) : '—'}</strong></td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DASN-SIMEI ${ano} – ${nomeEmpresa}</title>
<style>${CSS_BASE}
.dasn-aviso {
  background: #fffbe6;
  border: 1.5px solid #c8890a;
  padding: 8pt 10pt;
  font-size: 8pt;
  margin-bottom: 10pt;
  color: #7a4a00;
  line-height: 1.5;
}
.dasn-aviso strong { color: #3d1f07; }
</style>
</head>
<body>

<div class="toolbar-flutuante no-print">
  <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  <button class="btn-fechar" onclick="window.close()">✕ Fechar</button>
</div>

<div class="pagina">

  <!-- ── Cabeçalho ── -->
  <div class="doc-topo">
    <div class="brasao">🇧🇷</div>
    <div class="doc-topo-texto">
      <div class="gov-linha">República Federativa do Brasil · Secretaria Especial da Receita Federal do Brasil</div>
      <div class="doc-titulo">DASN-SIMEI — Declaração Anual do Simples Nacional</div>
      <div class="doc-subtitulo">
        Microempreendedor Individual · 
        <strong>IN RFB nº 2.110/2022</strong> · 
        Lei Complementar nº 123/2006, art. 18-A, § 15 · 
        Prazo de entrega: <strong>31 de maio</strong> do ano seguinte ao ano-calendário
      </div>
    </div>
  </div>

  <!-- ── Aviso ── -->
  <div class="dasn-aviso">
    <strong>⚠️ IMPORTANTE:</strong> Este documento é um espelho de apoio gerado a partir dos seus lançamentos. 
    A DASN-SIMEI oficial <strong>deve ser transmitida obrigatoriamente pelo portal <u>gov.br/mei</u></strong> (PGMEI) até <strong>31/05/${Number(ano) + 1}</strong>. 
    A não entrega sujeita o MEI à multa mínima de R$ 50,00 (art. 37, § 1º, LC 123/2006). 
    Confira os valores abaixo com seu contador antes de transmitir.
  </div>

  <!-- ── Seção 1: Identificação ── -->
  <div class="quadro-titulo">Seção 1 — Identificação do Declarante</div>
  <table class="id-box">
    <tr>
      <th style="width:40%">Nome / Razão Social do MEI</th>
      <th style="width:25%">CNPJ do MEI</th>
      <th style="width:15%">Ano-Calendário</th>
      <th style="width:20%">Data de Transmissão</th>
    </tr>
    <tr>
      <td><strong>${escHtml(nomeEmpresa)}</strong></td>
      <td><strong>${escHtml(empresa?.cnpj || '—')}</strong></td>
      <td class="cen"><strong>${ano}</strong></td>
      <td class="cen"><em style="color:#777">__/__/____</em></td>
    </tr>
    <tr>
      <th colspan="2">CPF do Titular</th>
      <th>Código CNAE Principal</th>
      <th>Situação da Empresa</th>
    </tr>
    <tr>
      <td colspan="2"><strong>${escHtml(empresa?.cpf || '—')}</strong></td>
      <td><strong>${escHtml(empresa?.cnae || '1091-1/01')}</strong></td>
      <td>Ativa</td>
    </tr>
  </table>

  <!-- ── Seção 2: Situação de Empregado ── -->
  <div class="quadro-titulo">Seção 2 — Contratação de Empregado (art. 18-C da LC nº 123/2006)</div>
  <table class="tabela">
    <thead>
      <tr>
        <th>Pergunta</th>
        <th style="width:12%">Sim</th>
        <th style="width:12%">Não</th>
        <th>Observação</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>O MEI possui ou possuiu empregado registrado em algum mês do ano-calendário de ${ano}?</td>
        <td class="cen"><span class="check"></span></td>
        <td class="cen"><span class="check sim">✓</span></td>
        <td style="font-size:7.5pt;color:#555">
          O MEI pode ter 1 (um) empregado registrado, com salário de 1 SM ou piso da categoria.
          Se houver empregado, informar os meses e o valor pago.
        </td>
      </tr>
    </tbody>
  </table>
  <div style="font-size:7.5pt;color:#777;padding:3pt 7pt;border:1px solid #ddd;border-top:none;margin-bottom:0">
    <em>Caso tenha tido empregado, altere a marcação acima e informe a remuneração no campo "Observação" antes de imprimir.</em>
  </div>

  <!-- ── Seção 3: Quadro 1 – Receita Bruta ── -->
  <div class="quadro-titulo" style="margin-top:10pt">Seção 3 — Quadro 1: Receita Bruta Auferida no Ano-Calendário ${ano}</div>
  <div class="quadro-subtitulo">
    Art. 18-A, § 1º, da LC nº 123/2006 — Somente receitas tributáveis pelo SIMEI (faturamento MEI). 
    Rendimentos pessoais, transferências e outras entradas não-MEI não são informados neste quadro.
  </div>
  <table class="tabela">
    <thead>
      <tr>
        <th style="width:14%">Mês de Competência</th>
        <th style="width:21%">Receita de Vendas de Mercadorias (R$)</th>
        <th style="width:21%">Receita de Prestação de Serviços (R$)</th>
        <th style="width:21%">Outras Receitas (R$)</th>
        <th style="width:23%">Total do Mês (R$)</th>
      </tr>
    </thead>
    <tbody>
      ${linhasQ1}
      <tr class="total">
        <td><strong>TOTAL ANUAL</strong></td>
        <td class="num"><strong>${BRL(totais.receitas || 0)}</strong></td>
        <td class="num"><strong>${BRL(0)}</strong></td>
        <td class="num"><strong>${BRL(0)}</strong></td>
        <td class="num"><strong>${BRL(totais.receitas || 0)}</strong></td>
      </tr>
    </tbody>
  </table>
  <div style="padding:4pt 7pt;border:1px solid #ddd;border-top:none;font-size:7.5pt;color:#555;margin-bottom:0">
    <em>
      ℹ️ Distribua os valores entre "Vendas de Mercadorias" e "Prestação de Serviços" conforme a natureza das suas atividades 
      para preenchimento correto no PGMEI. Este espelho soma tudo em "Vendas de Mercadorias" por padrão.
    </em>
  </div>

  <!-- ── Seção 4: Resultado Final ── -->
  <div class="quadro-titulo" style="margin-top:10pt">Seção 4 — Resultado do Exercício ${ano} e Verificação do Teto MEI</div>
  <div class="resumo-box">
    <div class="resumo-linha">
      <span><strong>Receita Bruta MEI Total (faturamento tributável)</strong></span>
      <strong>${BRL(totais.receitas || 0)}</strong>
    </div>
    ${incluirNaoMei && totais.outras_entradas ? `
    <div class="resumo-linha">
      <span>Outras entradas não-MEI (informativo — NÃO compõem faturamento)</span>
      <strong>${BRL(totais.outras_entradas)}</strong>
    </div>` : ''}
    <div class="resumo-linha">
      <span>( − ) Total de Despesas Operacionais do Exercício</span>
      <strong>${BRL(totais.operacional || 0)}</strong>
    </div>
    <div class="resumo-linha destaque">
      <span>= Resultado Líquido do Negócio em ${ano}</span>
      <strong>${BRL(totais.saldo || 0)}</strong>
    </div>
    <div class="resumo-linha">
      <span>Limite anual de faturamento MEI (Res. CGSN — Portaria CGSN nº 3/2023)</span>
      <strong>R$ ${BRL(tetoAnual || 81000)}</strong>
    </div>
    <div class="resumo-linha destaque">
      <span>Percentual do teto MEI utilizado em ${ano}</span>
      <strong class="${statusTeto}">${pctTeto.toFixed(2)}% — ${statusTexto}</strong>
    </div>
  </div>

  <!-- ── Seção 5: Declaração ── -->
  <div class="quadro-titulo" style="margin-top:12pt">Seção 5 — Declaração e Assinatura</div>
  <div style="border:1.5px solid #003580;padding:8pt 10pt;font-size:8.5pt;line-height:1.7">
    <p>
      Declaro, sob as penas da lei, que as informações acima prestadas são a expressão da verdade, 
      que a empresa não se enquadra em nenhuma das vedações previstas no § 4º do art. 18-A da LC nº 123/2006, 
      e que os valores de receita bruta declarados correspondem à movimentação financeira do MEI no ano-calendário de <strong>${ano}</strong>.
    </p>
    <p style="margin-top:6pt;font-size:7.5pt;color:#555">
      O declarante é responsável pela veracidade e exatidão das informações prestadas (art. 37 da LC nº 123/2006). 
      A transmissão da DASN-SIMEI é feita exclusivamente pelo portal <strong>gov.br/mei</strong> ou pelo PGMEI 
      (Programa Gerador do Documento de Arrecadação do MEI). Este espelho não substitui a declaração oficial.
    </p>
  </div>

  <div class="assinatura-area" style="margin-top:16pt">
    <div class="assinatura-campo">
      Local e data: _________________________________, ${hoje()}
    </div>
    <div class="assinatura-campo">
      Assinatura do Microempreendedor Individual Titular
      <div style="margin-top:18pt">_____________________________________________</div>
      <div style="margin-top:4pt">${escHtml(nomeEmpresa)}</div>
      <div style="margin-top:2pt;font-size:7pt">CPF: ${escHtml(empresa?.cpf || '—')} · CNPJ: ${escHtml(empresa?.cnpj || '—')}</div>
    </div>
  </div>

  <!-- ── Rodapé ── -->
  <div class="rodape">
    Espelho DASN-SIMEI gerado em ${hoje()} · Ano-calendário: ${ano} · 
    Base legal: IN RFB nº 2.110/2022 · LC nº 123/2006 art. 18-A § 15 · Res. CGSN nº 140/2018 · 
    <strong>ATENÇÃO: Este documento é apenas um espelho de apoio. A declaração oficial deve ser transmitida pelo portal gov.br/mei até 31/05/${Number(ano) + 1}.</strong>
  </div>

</div><!-- /pagina -->
</body>
</html>`

  abrirJanela(html, `DASN-SIMEI ${ano}`)
}

// ══════════════════════════════════════════════════════════════════
// RELATÓRIO TÉCNICO DE RECEITAS
// ══════════════════════════════════════════════════════════════════
export function gerarRelatorioReceitas({ empresa, receitas, produtos, todasReceitas }) {
  const nomeEmpresa = empresa?.razao_social || empresa?.nome || 'chocobete'
  
  const receitasHtml = receitas.map(r => {
    const ingredientesHtml = (r.ingredientes || []).map(ing => {
      const alvo = ing.tipo === 'receita' 
        ? (todasReceitas || receitas).find(x => x.uuid === ing.id) 
        : produtos.find(x => x.uuid === ing.id)
      const nome = alvo?.nome || 'Item removido'
      const unidade = ing.tipo === 'receita' ? alvo?.unidade_rendimento : alvo?.unidade_base
      const qtd = Number(ing.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
      
      return `
        <tr>
          <td>${escHtml(nome)}</td>
          <td class="cen">${qtd}</td>
          <td class="cen">${escHtml(unidade || '')}</td>
        </tr>`
    }).join('')

    return `
      <div style="page-break-inside: avoid; margin-bottom: 25pt; border: 1px solid #003580; border-radius: 4pt; overflow: hidden;">
        <div class="quadro-titulo">${escHtml(r.nome)}</div>
        <div class="quadro-subtitulo">${escHtml(r.categoria || 'Sem categoria')}</div>
        <table class="id-box" style="margin-bottom: 0; border: none; border-top: 1px solid #003580;">
          <tr>
            <th style="width:30%">Rendimento</th>
            <th style="width:30%">Peso Unitário</th>
            <th style="width:40%">Preço de Venda</th>
          </tr>
          <tr>
            <td class="cen"><strong>${r.rendimento || '-'} ${escHtml(r.unidade_rendimento || '')}</strong></td>
            <td class="cen">${r.peso_unitario ? r.peso_unitario + ' g' : '-'}</td>
            <td class="cen">R$ ${BRL(r.preco_sugerido)}</td>
          </tr>
        </table>
        <table class="tabela">
          <thead>
            <tr>
              <th>Ingrediente / Base</th>
              <th style="width:15%">Qtd</th>
              <th style="width:15%">Unidade</th>
            </tr>
          </thead>
          <tbody>
            ${ingredientesHtml || '<tr><td colspan="3" class="cen">Nenhum ingrediente cadastrado.</td></tr>'}
          </tbody>
        </table>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Receitas – ${escHtml(nomeEmpresa)}</title>
<style>${CSS_BASE}</style>
</head>
<body>
<div class="toolbar-flutuante no-print">
  <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  <button class="btn-fechar" onclick="window.close()">✕ Fechar</button>
</div>
<div class="pagina">
  <div class="doc-topo">
    <div class="brasao">📖</div>
    <div class="doc-topo-texto">
      <div class="gov-linha">${escHtml(nomeEmpresa)}</div>
      <div class="doc-titulo">Relatório Técnico de Receitas</div>
      <div class="doc-subtitulo">Relação completa de insumos, rendimentos e precificação · Gerado em ${hoje()}</div>
    </div>
  </div>
  ${receitasHtml}
</div>
</body>
</html>`

  abrirJanela(html, `Relatório de Receitas`)
}

// ══════════════════════════════════════════════════════════════════
// RELATÓRIO DE PRODUÇÃO
// ══════════════════════════════════════════════════════════════════
export function gerarRelatorioProducao({ empresa, grupos, periodo }) {
  const nomeEmpresa = empresa?.razao_social || empresa?.nome || 'chocobete'

  const gruposHtml = grupos.map(g => {
    const itensHtml = g.itens.map(item => `
      <tr>
        <td>${escHtml(item.nome)}</td>
        <td class="cen">${item.qtd}</td>
        <td class="num">${BRL(item.custo)}</td>
        <td class="num">${BRL(item.venda)}</td>
        <td class="num">${BRL((item.lucro || 0))}</td>
      </tr>`).join('')

    return `
      <div style="page-break-inside: avoid; margin-bottom: 20pt; border: 1px solid #003580; border-radius: 4pt; overflow: hidden;">
        <div class="quadro-titulo">Lote: ${g.data} ${g.duracao ? `· Duração: ${g.duracao}` : ''}</div>
        <table class="tabela">
          <thead>
            <tr>
              <th>Receita</th>
              <th style="width:15%">Qtd</th>
              <th style="width:18%">Custo Total (R$)</th>
              <th style="width:18%">Venda Total (R$)</th>
              <th style="width:18%">Lucro (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${itensHtml}
            <tr class="total">
              <td colspan="2" style="text-align:right">TOTAIS DO LOTE</td>
              <td class="num">${BRL(g.custoTotal)}</td>
              <td class="num">${BRL(g.vendaTotal)}</td>
              <td class="num">${BRL(g.lucroTotal || ( (g.vendaTotal||0) - (g.custoTotal||0) ))}</td>
            </tr>
          </tbody>
        </table>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Produção – ${escHtml(nomeEmpresa)}</title>
<style>${CSS_BASE}</style>
</head>
<body>
<div class="toolbar-flutuante no-print">
  <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  <button class="btn-fechar" onclick="window.close()">✕ Fechar</button>
</div>
<div class="pagina">
  <div class="doc-topo">
    <div class="brasao">🏭</div>
    <div class="doc-topo-texto">
      <div class="gov-linha">${escHtml(nomeEmpresa)}</div>
      <div class="doc-titulo">Relatório de Produção</div>
      <div class="doc-subtitulo">Período: ${periodo} · Gerado em ${hoje()}</div>
    </div>
  </div>
  ${gruposHtml || '<p class="cen">Nenhuma produção encontrada no período.</p>'}
</div>
</body>
</html>`

  abrirJanela(html, `Relatório de Produção`)
}

// Escape HTML helper
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
