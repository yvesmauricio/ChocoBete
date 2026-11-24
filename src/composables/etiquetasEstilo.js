// ─────────────────────────────────────────────────────────────────────────────
// Estilo visual das etiquetas (fonte, tamanho, cor, alinhamento, posição).
//
// Módulo puro, sem dependências: o editor da tela, o gerador de PDF/SVG
// (etiquetasPdfCore.js) e o gerador de .docx (useEtiquetas.js) leem DAQUI as
// mesmas definições — assim o que aparece no editor é o que sai na folha.
//
// O estilo é guardado em company.etiqueta_estilo (viaja no backup e no sync,
// porque é a "cara" da sua etiqueta e deve ser igual em todos os aparelhos).
// O ajuste de IMPRESSÃO (calibração A/B/C/D) continua separado e por aparelho.
// ─────────────────────────────────────────────────────────────────────────────

/** Estilo de fábrica = exatamente o template original (sabor 9 pt negrito marrom, contato 7 pt). */
export const ESTILO_PADRAO = Object.freeze({
  fonte: 'sans',          // 'sans' | 'serif' | 'mono' | 'manuscrita'
  alinhamento: 'center',  // 'left' | 'center' | 'right'
  tamSabor: 9,            // pt
  tamContato: 7,          // pt
  corSabor: '#523023',
  corContato: '#000000',
  dx: 0,                  // deslocamento horizontal, mm
  dy: 0,                  // deslocamento vertical, mm
  negrito: true,          // negrito no sabor
  maiusculas: false,      // sabor em MAIÚSCULAS
  mostrarContato: true
})

export const LIMITES = Object.freeze({
  tamSabor: { min: 6, max: 12, passo: 0.5 },
  tamContato: { min: 5, max: 9, passo: 0.5 },
  desloc: { min: -2, max: 2, passo: 0.25 }
})

export const CORES = Object.freeze([
  { hex: '#523023', nome: 'Marrom' },
  { hex: '#000000', nome: 'Preto' },
  { hex: '#7a1f3d', nome: 'Vinho' },
  { hex: '#2f5d3a', nome: 'Verde' },
  { hex: '#1f3a5f', nome: 'Azul' },
  { hex: '#666666', nome: 'Cinza' }
])

export const ALINHAMENTOS = Object.freeze([
  { id: 'left', icone: 'fas fa-align-left', nome: 'Esquerda' },
  { id: 'center', icone: 'fas fa-align-center', nome: 'Centro' },
  { id: 'right', icone: 'fas fa-align-right', nome: 'Direita' }
])

// ── Larguras (AFM, 1000 unidades/em) dos caracteres ASCII 32–126 ────────────
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
const HELV_B = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]
const TIMES = [250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444, 921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500, 333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541]
const TIMES_B = [250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500, 930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500, 333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520]
const COURIER = 600 // monoespaçada: todo caractere mede 600

/**
 * Fontes oferecidas. No PDF só existem as 14 fontes-padrão (Helvetica, Times, Courier),
 * então "manuscrita" vira Times itálico no PDF; já na impressão direta e no Word ela usa
 * uma fonte cursiva de verdade, se o aparelho tiver uma.
 *
 *  altLinha / ascent: medidas verticais (fração do corpo) das fontes que o Word/LibreOffice
 *  usam no lugar (Liberation Sans/Serif/Mono) — servem para centralizar o bloco na etiqueta.
 *  fator: folga de segurança na largura (fonte cursiva do aparelho é imprevisível, então
 *  o ajuste automático "enxerga" o texto um pouco mais largo e encolhe um pouco antes).
 */
export const FONTES = Object.freeze({
  sans: {
    id: 'sans', rotulo: 'Sem serifa (Arial)',
    css: "Arial, Helvetica, 'Liberation Sans', Roboto, sans-serif",
    docx: 'Liberation Sans', pdf: { reg: 'F1', bold: 'F2' },
    larg: { reg: HELV, bold: HELV_B }, altLinha: 1.117, ascent: 0.905, fator: 1
  },
  serif: {
    id: 'serif', rotulo: 'Serifada (Times)',
    css: "'Times New Roman', Times, 'Liberation Serif', serif",
    docx: 'Times New Roman', pdf: { reg: 'F3', bold: 'F4' },
    larg: { reg: TIMES, bold: TIMES_B }, altLinha: 1.107, ascent: 0.891, fator: 1
  },
  mono: {
    id: 'mono', rotulo: 'Máquina de escrever (Courier)',
    css: "'Courier New', Courier, 'Liberation Mono', monospace",
    docx: 'Courier New', pdf: { reg: 'F5', bold: 'F6' },
    larg: { reg: COURIER, bold: COURIER }, altLinha: 1.133, ascent: 0.833, fator: 1
  },
  manuscrita: {
    id: 'manuscrita', rotulo: 'Manuscrita (cursiva)',
    css: "'Brush Script MT', 'Segoe Script', cursive",
    docx: 'Brush Script MT', pdf: { reg: 'F7', bold: 'F8' },
    larg: { reg: TIMES, bold: TIMES_B }, altLinha: 1.107, ascent: 0.891, fator: 1.12
  }
})

/** As 8 fontes-padrão do PDF usadas acima (nome interno → BaseFont). */
export const FONTES_PDF = Object.freeze([
  ['F1', 'Helvetica'], ['F2', 'Helvetica-Bold'],
  ['F3', 'Times-Roman'], ['F4', 'Times-Bold'],
  ['F5', 'Courier'], ['F6', 'Courier-Bold'],
  ['F7', 'Times-Italic'], ['F8', 'Times-BoldItalic']
])

export const fonteDe = (id) => FONTES[id] || FONTES.sans

function larguraChar(ch, fonte, bold) {
  const tab = bold ? fonte.larg.bold : fonte.larg.reg
  if (typeof tab === 'number') return tab
  const c = ch.charCodeAt(0)
  if (c >= 32 && c <= 126) return tab[c - 32]
  const base = ch.normalize('NFD').charCodeAt(0) // é → e, ç → c, ã → a …
  if (base >= 32 && base <= 126) return tab[base - 32]
  return 556
}

/** Largura REAL do texto, em pontos (usada para centralizar no PDF). */
export function larguraPt(texto, fonteId, bold, tamanho) {
  const fonte = fonteDe(fonteId)
  let w = 0
  for (const ch of String(texto).normalize('NFC')) w += larguraChar(ch, fonte, bold)
  return (w * tamanho) / 1000
}

// ── Validação ───────────────────────────────────────────────────────────────
const ajustarNum = (v, def, { min, max, passo }) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  const preso = Math.min(max, Math.max(min, n))
  return Math.round(preso / passo) * passo
}
const ajustarCor = (v, def) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : def)

/** Aceita qualquer coisa (null, lixo, backup antigo) e devolve um estilo completo e válido. */
export function normalizarEstilo(bruto) {
  const e = bruto && typeof bruto === 'object' ? bruto : {}
  const P = ESTILO_PADRAO
  return {
    fonte: FONTES[e.fonte] ? e.fonte : P.fonte,
    alinhamento: ['left', 'center', 'right'].includes(e.alinhamento) ? e.alinhamento : P.alinhamento,
    tamSabor: ajustarNum(e.tamSabor, P.tamSabor, LIMITES.tamSabor),
    tamContato: ajustarNum(e.tamContato, P.tamContato, LIMITES.tamContato),
    corSabor: ajustarCor(e.corSabor, P.corSabor),
    corContato: ajustarCor(e.corContato, P.corContato),
    dx: ajustarNum(e.dx, P.dx, LIMITES.desloc),
    dy: ajustarNum(e.dy, P.dy, LIMITES.desloc),
    negrito: typeof e.negrito === 'boolean' ? e.negrito : P.negrito,
    maiusculas: typeof e.maiusculas === 'boolean' ? e.maiusculas : P.maiusculas,
    mostrarContato: typeof e.mostrarContato === 'boolean' ? e.mostrarContato : P.mostrarContato
  }
}

export function estiloEhPadrao(estilo) {
  const e = normalizarEstilo(estilo)
  return Object.keys(ESTILO_PADRAO).every(k => e[k] === ESTILO_PADRAO[k])
}

const nomeCor = (hex) => CORES.find(c => c.hex === hex)?.nome.toLowerCase() || hex
const fmt = (v) => String(v).replace('.', ',')

/** Resumo em uma frase, para mostrar na tela de gerar. */
export function descreverEstilo(estilo) {
  const e = normalizarEstilo(estilo)
  const alin = ALINHAMENTOS.find(a => a.id === e.alinhamento)?.nome.toLowerCase()
  const partes = [
    FONTES[e.fonte].rotulo.split(' (')[0].toLowerCase(),
    `sabor ${fmt(e.tamSabor)} pt${e.negrito ? ' negrito' : ''}${e.maiusculas ? ' maiúsculas' : ''} ${nomeCor(e.corSabor)}`,
    e.mostrarContato ? `contato ${fmt(e.tamContato)} pt ${nomeCor(e.corContato)}` : 'sem contato',
    `alinhado ${e.alinhamento === 'center' ? 'ao centro' : 'à ' + alin}`
  ]
  if (e.dx || e.dy) partes.push(`deslocado ${fmt(e.dx)} / ${fmt(e.dy)} mm`)
  const txt = partes.join(' · ')
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

// ── Conversões de cor ───────────────────────────────────────────────────────
/** '#523023' → [0.32, 0.19, 0.137] (PDF). */
export function hexParaRgb01(hex) {
  const h = ajustarCor(hex, '#000000').slice(1)
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
}
/** '#523023' → '523023' (Word). */
export const hexParaDocx = (hex) => ajustarCor(hex, '#000000').slice(1).toUpperCase()
