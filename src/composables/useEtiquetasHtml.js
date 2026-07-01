/**
 * Gera uma página HTML para impressão direta da folha Pimaco A5Q-1226.
 *
 * Dimensões oficiais (tabela OpenOffice Pimaco):
 *   Folha A5:            148,5 × 210,0 mm
 *   Etiqueta (L × A):    26,0  ×  12,0 mm
 *   Espaço horizontal:    2,80 mm  (gap entre colunas)
 *   Espaço vertical:      1,20 mm  (gap entre linhas)
 *   Margem esquerda:      0,80 mm
 *   Margem superior:      0,86 mm
 *   Grade:                7 colunas × 11 linhas = 77 etiquetas
 *
 * IMPORTANTE: o driver HP no Android só aceita papel A4 (210 × 297mm).
 * O HTML usa @page A4 com margem zero. O grid de etiquetas é posicionado
 * no canto superior esquerdo exatamente onde a folha A5 física fica quando
 * inserida na impressora — a área abaixo (297-210=87mm) fica em branco.
 * Imprimir com escala 100%, sem "ajustar à página".
 */
export function gerarHtmlEtiquetas(etiquetas, contato) {
  // Garante array de exatamente 77 posições
  const cells = Array.from({ length: 77 }, (_, i) => etiquetas[i] || '')

  const rows = []
  for (let r = 0; r < 11; r++) {
    const cols = []
    for (let c = 0; c < 7; c++) {
      const idx = r * 7 + c
      const texto = cells[idx]
      cols.push(texto
        ? `<div class="etq">
            <div class="sabor">${escHtml(texto)}</div>
            <div class="contato">${escHtml(contato)}</div>
           </div>`
        : `<div class="etq vazia"></div>`
      )
    }
    rows.push(`<div class="row">${cols.join('')}</div>`)
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Etiquetas ChocoBete</title>
<style>
  /* ── Reset ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Página A4 sem margens — driver HP Android só aceita A4 ── */
  @page {
    size: 210mm 297mm;
    margin: 0;
  }

  html, body {
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Grade principal ── */
  .sheet {
    position: absolute;
    top: 0.86mm;
    left: 0.80mm;
    display: flex;
    flex-direction: column;
    gap: 1.20mm;
  }

  .row {
    display: flex;
    flex-direction: row;
    gap: 2.80mm;
  }

  /* ── Célula de etiqueta ── */
  .etq {
    width: 26.0mm;
    height: 12.0mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.8mm 0.6mm;
    /* borda fina visível só em tela para alinhamento — não imprime */
    outline: 0.2mm solid #e0e0e0;
  }

  @media print {
    .etq { outline: none; }
  }

  .etq.vazia { /* célula em branco — sem borda impressa */ }

  .sabor {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 5.2pt;
    font-weight: 700;
    color: #1a1a1a;
    text-align: center;
    line-height: 1.15;
    word-break: break-word;
    width: 100%;
  }

  .contato {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 4.0pt;
    color: #555;
    text-align: center;
    line-height: 1.1;
    margin-top: 0.4mm;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Barra de controle (visível só em tela, some ao imprimir) ── */
  .print-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: #1e120a;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px 20px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 9999;
  }
  .print-bar button {
    background: #c9a84c;
    color: #1e120a;
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }
  .print-bar button:active { opacity: .85; }
  @media print { .print-bar { display: none; } }
</style>
</head>
<body>
<div class="sheet">
${rows.join('\n')}
</div>

<div class="print-bar">
  <span>A4 · retrato · 100% · sem margens</span>
  <label>
    ↕ <input id="adjTop" type="number" value="0" step="0.1" style="width:52px;text-align:center"> mm
  </label>
  <label>
    ↔ <input id="adjLeft" type="number" value="0" step="0.1" style="width:52px;text-align:center"> mm
  </label>
  <button onclick="aplicarAjuste()">Aplicar</button>
  <button onclick="window.print()">🖨️ Imprimir</button>
</div>

<script>
  function aplicarAjuste() {
    const top = parseFloat(document.getElementById('adjTop').value) || 0
    const left = parseFloat(document.getElementById('adjLeft').value) || 0
    document.querySelector('.sheet').style.top = (0.86 + top) + 'mm'
    document.querySelector('.sheet').style.left = (0.80 + left) + 'mm'
  }
  window.addEventListener('load', () => setTimeout(() => window.print(), 400))
<\/script>
</body>
</html>`
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Monta o array de 77 posições a partir dos dados do wizard de etiquetas.
 *
 * @param {string[]}          listaPlana    - Textos dos sabores (um por etiqueta)
 * @param {number}            startPos      - Posição inicial 0-based (modo sequencial)
 * @param {Map<number,string>} mapaPosicoes - Modo manual: posição global → texto
 */
export function montarCelulasHtml(listaPlana, startPos = 0, mapaPosicoes = null) {
  const cells = Array(77).fill('')

  if (mapaPosicoes && mapaPosicoes.size > 0) {
    // Modo manual: posiciona cada sabor na célula marcada
    const posOrdenadas = [...mapaPosicoes.keys()].sort((a, b) => a - b)
    posOrdenadas.forEach((posGlobal, idx) => {
      const celulaLocal = posGlobal % 77 // só a primeira folha nesta implementação inicial
      if (celulaLocal >= 0 && celulaLocal < 77 && idx < listaPlana.length) {
        cells[celulaLocal] = listaPlana[idx]
      }
    })
    return cells
  }

  // Modo sequencial: começa na startPos, preenche em ordem
  listaPlana.forEach((texto, idx) => {
    const pos = startPos + idx
    if (pos < 77) cells[pos] = texto
  })
  return cells
}
