// ─────────────────────────────────────────────────────────────────────────────
// Núcleo do PDF de etiquetas (sem dependências, funciona no navegador e no Node).
//
// Por que existe: ao imprimir um PDF pelo celular (Android/HP Smart), o sistema de
// impressão costuma "ajustar à página" e encolhe a folha — e etiqueta adesiva não
// perdoa 1 mm. Aqui o PDF é desenhado em milímetros, na mesma geometria do
// template etiqueta.docx (Pimaco A5Q-1226, 7 x 11 = 77 etiquetas, A4) e aceita
// uma calibração (escala + deslocamento) que compensa o que o celular faz.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ESTILO_PADRAO, FONTES_PDF, fonteDe, normalizarEstilo, hexParaRgb01,
  larguraPt as larguraPtFonte
} from './etiquetasEstilo.js'

const PT = 72 / 25.4 // pontos por milímetro

export const PAGE = { w: 210, h: 297 }

// Geometria medida no template etiqueta.docx renderizado pelo LibreOffice (mm).
export const GRADE = {
  colunas: 7,
  linhas: 11,
  porFolha: 77,
  x0: 7.18,                                                    // borda esquerda da 1ª coluna
  larguras: [27.73, 28.10, 28.08, 27.71, 28.12, 27.99, 28.03], // 1572…1589 twips
  centrosX: [21.04, 48.94, 77.04, 104.95, 132.85, 160.92, 188.93],
  topo: 8.608,                                                 // margem superior (488 twips)
  alturaLinha: 11.994,                                         // 680 twips, altura exata
  paddingLateral: 1.658                                        // POR LADO: (57 margem da célula + 37 recuo) twips = 94 twips
}

// Estilo dos textos: vem de etiquetasEstilo.js (padrão = igual ao template:
// sabor 9pt negrito marrom; contato 7pt preto). O usuário pode mudar no editor.
const AJUSTE_Y = 0.057   // ajuste fino medido contra o LibreOffice (mm)
const ENTRELINHA = 0.085 // espaço extra entre o sabor e o contato (mm)

// Folha de teste para calibrar (moldura de 190 x 270 mm em (10, 10)).
export const TESTE = { x: 10, y: 10, w: 190, h: 270 }

export const CALIBRACAO_PADRAO = Object.freeze({ sx: 1, sy: 1, ox: 0, oy: 0 })

/** Largura do texto em pontos (Helvetica por padrão; passe a fonte do estilo para as outras). */
export function larguraPt(texto, bold, tamanho, fonteId = 'sans') {
  return larguraPtFonte(texto, fonteId, bold, tamanho)
}
const larguraMm = (t, bold, tam, fonteId = 'sans') => larguraPtFonte(t, fonteId, bold, tam) / PT

// ── Texto → bytes do PDF (WinAnsi / cp1252) ─────────────────────────────────
const CP1252 = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f
}
function codificar(texto) {
  let out = ''
  for (const ch of String(texto).normalize('NFC')) {
    const c = ch.codePointAt(0)
    let b
    if (c < 32) continue
    if (c < 256 && !(c >= 0x80 && c <= 0x9f)) b = c
    else if (CP1252[ch] !== undefined) b = CP1252[ch]
    else b = 63 // "?"
    const chr = String.fromCharCode(b)
    out += chr === '\\' || chr === '(' || chr === ')' ? '\\' + chr : chr
  }
  return out
}

const num = (v) => String(Math.round(v * 1000) / 1000)

// ── Página: desenha em mm (origem no canto superior esquerdo) com calibração ──
// texto(ax, yBase, str, opts): `ax` é o ponto de ancoragem horizontal e `ancora` diz
// se é o começo ('start'), o meio ('middle') ou o fim ('end') do texto.
function criarPagina(cal) {
  const ops = []
  const X = (x) => ((x - cal.ox) / cal.sx) * PT
  const Y = (y) => (PAGE.h - (y - cal.oy) / cal.sy) * PT
  return {
    ops,
    texto(ax, yBase, str, { bold = false, tamanho = 9, cor = [0, 0, 0], fonte = 'sans', ancora = 'start' } = {}) {
      if (!str) return
      const w = larguraMm(str, bold, tamanho, fonte)
      const x = ancora === 'middle' ? ax - w / 2 : ancora === 'end' ? ax - w : ax
      const f = fonteDe(fonte).pdf[bold ? 'bold' : 'reg']
      ops.push(
        `BT /${f} ${num(tamanho / cal.sx)} Tf ${cor.map(num).join(' ')} rg ${num(X(x))} ${num(Y(yBase))} Td (${codificar(str)}) Tj ET`
      )
    },
    retangulo(x, y, w, h, { largura = 0.2, cor = [0, 0, 0] } = {}) {
      ops.push(`${cor.map(num).join(' ')} RG ${num((largura / cal.sx) * PT)} w ${num(X(x))} ${num(Y(y + h))} ${num((w / cal.sx) * PT)} ${num((h / cal.sy) * PT)} re S`)
    },
    linha(x1, y1, x2, y2, { largura = 0.2, cor = [0, 0, 0] } = {}) {
      ops.push(`${cor.map(num).join(' ')} RG ${num((largura / cal.sx) * PT)} w ${num(X(x1))} ${num(Y(y1))} m ${num(X(x2))} ${num(Y(y2))} l S`)
    },
    conteudo() { return ops.join('\n') }
  }
}

// ── Página SVG (impressão direta pelo diálogo do Android) ───────────────────
// Mesma interface de criarPagina(), mas gera SVG em milímetros (viewBox 210 x 297).
// A calibração vira uma transformação do grupo: q = (d - o) / s.
const n5 = (v) => String(Math.round(v * 100000) / 100000)
const escXml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const rgbCss = (c) => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`

function criarPaginaSvg(cal) {
  const els = []
  return {
    texto(ax, yBase, str, { bold = false, tamanho = 9, cor = [0, 0, 0], fonte = 'sans', ancora = 'start' } = {}) {
      if (!str) return
      els.push(
        `<text x="${num(ax)}" y="${num(yBase)}" font-size="${num((tamanho * 25.4) / 72)}"${fonte !== 'sans' ? ` font-family="${fonteDe(fonte).css}"` : ''}` +
        `${bold ? ' font-weight="700"' : ''} fill="${rgbCss(cor)}"${ancora !== 'start' ? ` text-anchor="${ancora}"` : ''}>${escXml(str)}</text>`
      )
    },
    retangulo(x, y, w, h, { largura = 0.2, cor = [0, 0, 0] } = {}) {
      els.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="none" stroke="${rgbCss(cor)}" stroke-width="${num(largura)}"/>`)
    },
    linha(x1, y1, x2, y2, { largura = 0.2, cor = [0, 0, 0] } = {}) {
      els.push(`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${rgbCss(cor)}" stroke-width="${num(largura)}"/>`)
    },
    corpo() { return els.join('') },
    svg() {
      const t = `scale(${n5(1 / cal.sx)} ${n5(1 / cal.sy)}) translate(${n5(-cal.ox)} ${n5(-cal.oy)})`
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="${PAGE.w}mm" height="${PAGE.h}mm" ` +
        `font-family="${fonteDe('sans').css}"><g transform="${t}">${els.join('')}</g></svg>`
      )
    }
  }
}

// ── Quebra de linha e ajuste de fonte para caber na etiqueta ────────────────
// `fonteId` e `fator` (folga de largura da fonte, ver etiquetasEstilo.js) entram em todo
// cálculo de encaixe; a centralização no PDF usa a largura REAL (sem folga).
function quebrar(texto, bold, tamanho, larguraMax, fonteId, fator) {
  const palavras = String(texto).trim().split(/\s+/).filter(Boolean)
  const linhas = []
  let atual = ''
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p
    if (!atual || larguraMm(tentativa, bold, tamanho, fonteId) * fator <= larguraMax) atual = tentativa
    else { linhas.push(atual); atual = p }
  }
  if (atual) linhas.push(atual)
  return linhas
}
const caber = (linhas, bold, tam, larg, fonteId, fator) => linhas.every(l => larguraMm(l, bold, tam, fonteId) * fator <= larg)
const altLinha = (tam, fonte) => (fonte.altLinha * tam) / PT // altura de linha (mm)

/**
 * Calcula as linhas e tamanhos de uma etiqueta (como o Word faz: quebra em até 2 linhas).
 * Parte dos tamanhos do estilo e encolhe de 0,5 em 0,5 pt até caber na largura e na altura.
 * O texto do sabor já deve vir em maiúsculas, se o estilo pedir.
 */
export function layoutEtiqueta(sabor, contato, larguraMax, estiloBruto = ESTILO_PADRAO) {
  const estilo = normalizarEstilo(estiloBruto)
  const fonte = fonteDe(estilo.fonte)
  const bS = estilo.negrito
  const contatoVisivel = estilo.mostrarContato ? contato : ''
  const fator = fonte.fator
  let tamS = estilo.tamSabor
  let tamC = estilo.tamContato
  const alturaMax = GRADE.alturaLinha - 0.6
  let linhasS = quebrar(sabor, bS, tamS, larguraMax, estilo.fonte, fator)
  let linhasC = contatoVisivel ? quebrar(contatoVisivel, false, tamC, larguraMax, estilo.fonte, fator) : []

  for (let i = 0; i < 40; i++) {
    const okS = linhasS.length <= 2 && caber(linhasS, bS, tamS, larguraMax, estilo.fonte, fator)
    const okC = linhasC.length <= 2 && caber(linhasC, false, tamC, larguraMax, estilo.fonte, fator)
    const alt = linhasS.length * altLinha(tamS, fonte) + linhasC.length * altLinha(tamC, fonte) + (linhasC.length ? ENTRELINHA : 0)
    if (okS && okC && alt <= alturaMax) break
    if (!okS || alt > alturaMax) tamS = Math.max(5.5, tamS - 0.5)
    if (!okC || alt > alturaMax) tamC = Math.max(4.5, tamC - 0.5)
    linhasS = quebrar(sabor, bS, tamS, larguraMax, estilo.fonte, fator)
    linhasC = contatoVisivel ? quebrar(contatoVisivel, false, tamC, larguraMax, estilo.fonte, fator) : []
    if (tamS <= 5.5 && tamC <= 4.5) break
  }
  return { linhasS, linhasC, tamS, tamC }
}

// ── Plano de folhas (mesma lógica do .docx) ─────────────────────────────────
/**
 * @returns {{ folhas: Array<Array<{sabor:string,contato:string}|null>>, novaPosicao:number, totalFolhas:number }}
 */
export function planejarFolhas(etiquetas, contato, startPos = 0, mapaPosicoes = null) {
  const POR = GRADE.porFolha
  const folhas = []

  if (mapaPosicoes && mapaPosicoes.size > 0) {
    const maiorPos = Math.max(...mapaPosicoes.keys())
    const totalFolhas = Math.max(1, Math.ceil((maiorPos + 1) / POR))
    for (let f = 0; f < totalFolhas; f++) {
      const cel = []
      for (let i = 0; i < POR; i++) {
        const pos = f * POR + i
        cel.push(mapaPosicoes.has(pos) ? { sabor: mapaPosicoes.get(pos), contato } : null)
      }
      folhas.push(cel)
    }
    const novaPosicao = (maiorPos % POR) + 2 > POR ? 1 : (maiorPos % POR) + 2
    return { folhas, novaPosicao, totalFolhas }
  }

  const total = etiquetas.length
  const totalFolhas = Math.max(1, Math.ceil((startPos + total) / POR))
  for (let f = 0; f < totalFolhas; f++) {
    const inicio = f * POR - startPos
    const cel = []
    for (let i = 0; i < POR; i++) {
      const idx = inicio + i
      cel.push(idx >= 0 && idx < total ? { sabor: etiquetas[idx], contato } : null)
    }
    folhas.push(cel)
  }
  return { folhas, novaPosicao: ((startPos + total) % POR) + 1, totalFolhas }
}

// ── Desenho da folha de etiquetas ───────────────────────────────────────────
const colunaEsquerda = (col) => GRADE.x0 + GRADE.larguras.slice(0, col).reduce((a, b) => a + b, 0)

function desenharFolha(pg, celulas, estiloBruto = ESTILO_PADRAO) {
  const estilo = normalizarEstilo(estiloBruto)
  const fonte = fonteDe(estilo.fonte)
  const corS = hexParaRgb01(estilo.corSabor)
  const corC = hexParaRgb01(estilo.corContato)
  const ancora = estilo.alinhamento === 'left' ? 'start' : estilo.alinhamento === 'right' ? 'end' : 'middle'

  celulas.forEach((c, i) => {
    if (!c || !String(c.sabor || '').trim()) return
    const col = i % GRADE.colunas
    const lin = Math.floor(i / GRADE.colunas)
    const larguraMax = GRADE.larguras[col] - 2 * GRADE.paddingLateral
    const sabor = estilo.maiusculas ? String(c.sabor).toLocaleUpperCase('pt-BR') : String(c.sabor)
    const { linhasS, linhasC, tamS, tamC } = layoutEtiqueta(sabor, c.contato, larguraMax, estilo)

    // Ponto de ancoragem horizontal: meio da coluna, ou a borda do miolo (descontado o recuo)
    const esq = colunaEsquerda(col)
    const ax = (ancora === 'start'
      ? esq + GRADE.paddingLateral
      : ancora === 'end'
        ? esq + GRADE.larguras[col] - GRADE.paddingLateral
        : GRADE.centrosX[col]) + estilo.dx

    const topoLinha = GRADE.topo + lin * GRADE.alturaLinha
    const centro = topoLinha + GRADE.alturaLinha / 2
    const hS = altLinha(tamS, fonte)
    const hC = altLinha(tamC, fonte)
    const altura = linhasS.length * hS + linhasC.length * hC + (linhasC.length ? ENTRELINHA : 0)
    let y = centro - altura / 2 + AJUSTE_Y + estilo.dy

    for (const l of linhasS) {
      pg.texto(ax, y + (fonte.ascent * tamS) / PT, l, { bold: estilo.negrito, tamanho: tamS, cor: corS, fonte: estilo.fonte, ancora })
      y += hS
    }
    y += linhasC.length ? ENTRELINHA : 0
    for (const l of linhasC) {
      pg.texto(ax, y + (fonte.ascent * tamC) / PT, l, { bold: false, tamanho: tamC, cor: corC, fonte: estilo.fonte, ancora })
      y += hC
    }
  })
}

// ── Pré-visualização (editor de estilo) ─────────────────────────────────────
/**
 * SVG de 3 etiquetas lado a lado (colunas 1–3 da folha), com o MESMO motor da impressão:
 * a quebra de linha e o encolhimento automático que aparecem aqui são os que saem no papel.
 * Medidas em mm (o SVG escala sozinho). Devolve também o que foi reduzido, para avisar.
 * @param {string[]} sabores  até 3 textos (o do meio é o "amostra")
 */
export function montarSvgPreview(sabores, contato, estiloBruto = ESTILO_PADRAO) {
  const estilo = normalizarEstilo(estiloBruto)
  const celulas = sabores.slice(0, 3).map(sabor => ({ sabor, contato }))
  const pg = criarPaginaSvg(CALIBRACAO_PADRAO)
  desenharFolha(pg, celulas, estilo)

  const larguras = GRADE.larguras.slice(0, celulas.length)
  const w = larguras.reduce((a, b) => a + b, 0)
  let x = GRADE.x0
  const molduras = larguras.map(l => {
    const r = `<rect x="${num(x + 0.1)}" y="${num(GRADE.topo + 0.1)}" width="${num(l - 0.2)}" height="${num(GRADE.alturaLinha - 0.2)}" rx="0.8" fill="#fff" stroke="#bbb" stroke-width="0.15" stroke-dasharray="0.7 0.5"/>`
    x += l
    return r
  }).join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(GRADE.x0)} ${num(GRADE.topo)} ${num(w)} ${num(GRADE.alturaLinha)}" ` +
    `width="100%" preserveAspectRatio="xMidYMid meet" font-family="${fonteDe('sans').css}">${molduras}${pg.corpo()}</svg>`
  )
}

/** Quanto o sistema precisa reduzir um sabor para caber: { cabe, estoura, tamS, tamC } (cabe = sem redução). */
export function medirEncaixe(sabor, contato, estiloBruto = ESTILO_PADRAO, coluna = 1) {
  const estilo = normalizarEstilo(estiloBruto)
  const texto = estilo.maiusculas ? String(sabor).toLocaleUpperCase('pt-BR') : String(sabor)
  const larguraMax = GRADE.larguras[coluna] - 2 * GRADE.paddingLateral
  const { tamS, tamC, linhasS, linhasC } = layoutEtiqueta(texto, contato, larguraMax, estilo)
  const cabe = tamS === estilo.tamSabor && (!estilo.mostrarContato || !contato || tamC === estilo.tamContato)
  // estoura: mesmo no tamanho mínimo ainda passa de 2 linhas (o texto fica cortado na etiqueta)
  const estoura = linhasS.length > 2 || linhasC.length > 2
  return { cabe, estoura, tamS, tamC, linhasS: linhasS.length, linhasC: linhasC.length }
}

// ── Folha de teste (sempre SEM calibração) ──────────────────────────────────
function desenharTeste(pg) {
  // moldura de referência 190 x 270 mm, com marcas a cada 10 mm
  pg.retangulo(TESTE.x, TESTE.y, TESTE.w, TESTE.h, { largura: 0.4 })
  for (let d = 0; d <= TESTE.w; d += 10) {
    const t = d % 50 === 0 ? 4 : 2
    pg.linha(TESTE.x + d, TESTE.y, TESTE.x + d, TESTE.y + t, { largura: 0.2 })
    pg.linha(TESTE.x + d, TESTE.y + TESTE.h, TESTE.x + d, TESTE.y + TESTE.h - t, { largura: 0.2 })
  }
  for (let d = 0; d <= TESTE.h; d += 10) {
    const t = d % 50 === 0 ? 4 : 2
    pg.linha(TESTE.x, TESTE.y + d, TESTE.x + t, TESTE.y + d, { largura: 0.2 })
    pg.linha(TESTE.x + TESTE.w, TESTE.y + d, TESTE.x + TESTE.w - t, TESTE.y + d, { largura: 0.2 })
  }

  const linhas = [
    ['FOLHA DE TESTE DE IMPRESSAO', true, 15],
    ['Imprima em papel comum, tamanho A4. Se aparecer "100%" ou "tamanho real", escolha.', false, 9],
    ['', false, 8],
    ['Com uma regua, meca em milimetros (as linhas pretas da moldura):', true, 10.5],
    ['', false, 5],
    ['A)  Largura da moldura (da linha esquerda ate a direita):  ________ mm   (ideal 190)', false, 10],
    ['B)  Altura da moldura (da linha de cima ate a de baixo):    ________ mm   (ideal 270)', false, 10],
    ['C)  Da BORDA ESQUERDA do papel ate a moldura:               ________ mm   (ideal 10)', false, 10],
    ['D)  Da BORDA DE CIMA do papel ate a moldura:                 ________ mm   (ideal 10)', false, 10],
    ['', false, 8],
    ['Depois digite A, B, C e D no app:  Etiquetas > Gerar > Ajuste de impressao do PDF.', false, 9.5],
    ['Meca sempre a partir da borda do PAPEL, nao da margem da impressora.', false, 9.5]
  ]
  let y = 60
  for (const [t, bold, tam] of linhas) {
    if (t) pg.texto(TESTE.x + 10, y, t, { bold, tamanho: tam })
    y += tam * 0.62 + 4.5
  }
}

// ── Montagem do arquivo PDF ─────────────────────────────────────────────────
function montarPdf(conteudos) {
  const n = conteudos.length
  const nFontes = FONTES_PDF.length            // objetos 3 … 2+nFontes são as fontes
  const primeiraPagina = 3 + nFontes
  const objs = []
  objs[1] = '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>'
  objs[2] = `<< /Type /Pages /Kids [${conteudos.map((_, i) => `${primeiraPagina + i * 2} 0 R`).join(' ')}] /Count ${n} >>`
  FONTES_PDF.forEach(([, base], i) => {
    objs[3 + i] = `<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`
  })
  const recursos = FONTES_PDF.map(([nome], i) => `/${nome} ${3 + i} 0 R`).join(' ')
  const wPt = num(PAGE.w * PT)
  const hPt = num(PAGE.h * PT)
  conteudos.forEach((c, i) => {
    const pageId = primeiraPagina + i * 2
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /Font << ${recursos} >> >> /Contents ${pageId + 1} 0 R >>`
    objs[pageId + 1] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`
  })

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets = []
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = pdf.length
    pdf += `${id} 0 obj\n${objs[id]}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objs.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff
  return bytes
}

/** PDF das etiquetas. `cal` = { sx, sy, ox, oy } (calibração do celular/impressora); `estilo` = estilo da etiqueta. */
export function montarPdfEtiquetas(plano, cal = CALIBRACAO_PADRAO, estilo = ESTILO_PADRAO) {
  const conteudos = plano.folhas.map(celulas => {
    const pg = criarPagina(cal)
    desenharFolha(pg, celulas, estilo)
    return pg.conteudo()
  })
  return montarPdf(conteudos)
}

/** Páginas SVG das etiquetas (uma string por folha) para a impressão direta. */
export function montarSvgsEtiquetas(plano, cal = CALIBRACAO_PADRAO, estilo = ESTILO_PADRAO) {
  return plano.folhas.map(celulas => {
    const pg = criarPaginaSvg(cal)
    desenharFolha(pg, celulas, estilo)
    return pg.svg()
  })
}

/** Folha de teste em SVG (nunca usa calibração). */
export function montarSvgTeste() {
  const pg = criarPaginaSvg(CALIBRACAO_PADRAO)
  desenharTeste(pg)
  return [pg.svg()]
}

/** PDF da folha de teste (nunca usa calibração). */
export function montarPdfTeste() {
  const pg = criarPagina(CALIBRACAO_PADRAO)
  desenharTeste(pg)
  return montarPdf([pg.conteudo()])
}

/**
 * Converte as 4 medidas feitas com régua na folha de teste em calibração.
 * O celular transforma cada ponto assim:  impresso = escala * pdf + deslocamento.
 * @param {{larguraMm:number, alturaMm:number, esquerdaMm:number, topoMm:number}} m
 */
export function calcularCalibracao(m) {
  const { larguraMm: W, alturaMm: H, esquerdaMm: L, topoMm: T } = m
  const ok = [W, H, L, T].every(v => Number.isFinite(v))
  if (!ok) return { erro: 'Preencha as quatro medidas (use ponto ou vírgula).' }
  if (W < 120 || W > 230 || H < 180 || H > 310) return { erro: 'Largura/altura fora do esperado (a moldura tem 190 × 270 mm). Confira a medida.' }
  if (L < -5 || L > 60 || T < -5 || T > 60) return { erro: 'Distância até a borda fora do esperado (ideal: perto de 10 mm).' }
  const sx = W / TESTE.w
  const sy = H / TESTE.h
  const ox = L - TESTE.x * sx
  const oy = T - TESTE.y * sy
  return { sx, sy, ox, oy }
}
