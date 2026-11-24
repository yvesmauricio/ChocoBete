import { saveAs } from 'file-saver'
import {
  planejarFolhas,
  montarPdfEtiquetas,
  montarPdfTeste,
  montarSvgsEtiquetas,
  montarSvgTeste,
  CALIBRACAO_PADRAO
} from './etiquetasPdfCore.js'

// ─────────────────────────────────────────────────────────────────────────────
// Formas de gerar as etiquetas (a escolhida fica salva POR APARELHO):
//   'direta' → abre na hora o diálogo de impressão do Android (padrão)
//   'pdf'    → gera um PDF e abre o "Compartilhar" (ou baixa, no computador)
//   'docx'   → o arquivo Word de sempre (plano B)
//
// A calibração também é por aparelho E por forma de imprimir: cada caminho
// (diálogo direto, PDF → app de impressão) pode escalar de um jeito.
// ─────────────────────────────────────────────────────────────────────────────
export const METODOS = ['direta', 'pdf', 'docx']
const CHAVE_METODO = 'choco_etq_metodo_v1'

export function lerMetodo() {
  try {
    const m = localStorage.getItem(CHAVE_METODO)
    if (METODOS.includes(m)) return m
  } catch { /* sem storage: usa o padrão */ }
  return 'direta'
}

export function salvarMetodo(m) {
  if (!METODOS.includes(m)) return
  try { localStorage.setItem(CHAVE_METODO, m) } catch { /* ignora */ }
}

const chaveCalibracao = (metodo) => (metodo === 'pdf' ? 'choco_etq_calibracao_pdf_v1' : 'choco_etq_calibracao_direta_v1')

export function lerCalibracao(metodo = 'direta') {
  try {
    const j = JSON.parse(localStorage.getItem(chaveCalibracao(metodo)) || 'null')
    if (j && [j.sx, j.sy, j.ox, j.oy].every(Number.isFinite)) return { sx: j.sx, sy: j.sy, ox: j.ox, oy: j.oy }
  } catch { /* sem calibração salva */ }
  return { ...CALIBRACAO_PADRAO }
}

export function salvarCalibracao(c, metodo = 'direta') {
  localStorage.setItem(chaveCalibracao(metodo), JSON.stringify({ sx: c.sx, sy: c.sy, ox: c.ox, oy: c.oy }))
}

export function limparCalibracao(metodo = 'direta') {
  try { localStorage.removeItem(chaveCalibracao(metodo)) } catch { /* ignora */ }
}

export function calibracaoAtiva(c) {
  return Math.abs(c.sx - 1) > 1e-6 || Math.abs(c.sy - 1) > 1e-6 || Math.abs(c.ox) > 1e-6 || Math.abs(c.oy) > 1e-6
}

const fmt = (v, casas = 1) => v.toFixed(casas).replace('.', ',')
export function descreverCalibracao(c) {
  const sinal = (v) => (v >= 0 ? '+' : '−') + fmt(Math.abs(v))
  return `escala ${fmt(c.sx * 100)}% × ${fmt(c.sy * 100)}% · deslocamento X ${sinal(c.ox)} mm, Y ${sinal(c.oy)} mm`
}

// ── Impressão direta (diálogo do Android) ───────────────────────────────────
const ID_ESTILO = 'etq-print-style'
const ID_RAIZ = 'etq-print-root'

/**
 * Monta a folha (SVG em milímetros) numa área só visível na impressão e chama window.print().
 * O conteúdo FICA no documento depois de imprimir (escondido na tela): no Android o diálogo
 * monta a pré-visualização depois do print() retornar, e remover antes deixaria a folha em branco.
 * É trocado na próxima impressão.
 */
function abrirImpressao(svgs) {
  document.getElementById(ID_RAIZ)?.remove()
  document.getElementById(ID_ESTILO)?.remove()

  const estilo = document.createElement('style')
  estilo.id = ID_ESTILO
  estilo.textContent = `
    #${ID_RAIZ} { display: none; }
    @page { size: 210mm 297mm; margin: 0; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; background: #fff !important; }
      body > *:not(#${ID_RAIZ}) { display: none !important; }
      #${ID_RAIZ} { display: block !important; position: static !important; }
      #${ID_RAIZ} .etq-pg { width: 210mm; height: 297mm; overflow: hidden; break-after: page; page-break-after: always; }
      #${ID_RAIZ} .etq-pg:last-child { break-after: auto; page-break-after: auto; }
      #${ID_RAIZ} svg { display: block; width: 210mm; height: 297mm; }
    }`

  const raiz = document.createElement('div')
  raiz.id = ID_RAIZ
  raiz.setAttribute('aria-hidden', 'true')
  raiz.innerHTML = svgs.map(s => `<div class="etq-pg">${s}</div>`).join('')

  document.head.appendChild(estilo)
  document.body.appendChild(raiz)
  // dá um respiro para o navegador aplicar o estilo antes de capturar a folha
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { window.print(); resolve() })))
}

function validar(etiquetas, mapaPosicoes) {
  if (!mapaPosicoes && !etiquetas.length) return { ok: false, erro: 'Não há etiquetas válidas para gerar.' }
  if (mapaPosicoes && mapaPosicoes.size === 0) return { ok: false, erro: 'Marque pelo menos uma posição na folha para gerar.' }
  return null
}

/**
 * Mesma assinatura de gerarArquivoEtiquetas (.docx). Abre o diálogo de impressão do Android
 * já com a folha, aplicando a calibração salva para a impressão direta.
 */
export async function imprimirEtiquetas(etiquetas, contato, startPos, _nomeArquivoBase, mapaPosicoes = null) {
  const invalida = validar(etiquetas, mapaPosicoes)
  if (invalida) return invalida
  try {
    const plano = planejarFolhas(etiquetas, contato, startPos, mapaPosicoes)
    await abrirImpressao(montarSvgsEtiquetas(plano, lerCalibracao('direta')))
    return { ok: true, novaPosicao: plano.novaPosicao, totalFolhas: plano.totalFolhas }
  } catch (err) {
    console.error(err)
    return { ok: false, erro: err.message || 'Erro ao abrir a impressão.' }
  }
}

// ── PDF (compartilhar / baixar) ─────────────────────────────────────────────
/**
 * No celular abre o "Compartilhar" (dá para mandar para o HP Smart, Drive, ou qualquer app
 * que imprima); no computador, baixa o arquivo.
 * @returns {Promise<{ ok: boolean, cancelado?: boolean }>}
 */
async function entregarPdf(bytes, nomeArquivo, titulo) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  if (mobile && typeof File === 'function' && navigator.canShare && navigator.share) {
    try {
      const arquivo = new File([blob], `${nomeArquivo}.pdf`, { type: 'application/pdf' })
      if (navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: titulo })
        return { ok: true }
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return { ok: false, cancelado: true }
      // qualquer outro erro: cai no download normal
    }
  }
  saveAs(blob, `${nomeArquivo}.pdf`)
  return { ok: true }
}

/** PDF das etiquetas, já com a calibração salva para o caminho "PDF". */
export async function gerarPdfEtiquetas(etiquetas, contato, startPos, nomeArquivoBase = 'etiquetas', mapaPosicoes = null) {
  const invalida = validar(etiquetas, mapaPosicoes)
  if (invalida) return invalida
  try {
    const plano = planejarFolhas(etiquetas, contato, startPos, mapaPosicoes)
    const bytes = montarPdfEtiquetas(plano, lerCalibracao('pdf'))
    const r = await entregarPdf(bytes, nomeArquivoBase, 'Etiquetas')
    if (r.cancelado) return { ok: false, erro: 'Envio cancelado. Nenhuma etiqueta foi marcada como usada.' }
    return { ok: true, novaPosicao: plano.novaPosicao, totalFolhas: plano.totalFolhas }
  } catch (err) {
    console.error(err)
    return { ok: false, erro: err.message || 'Erro ao gerar o PDF das etiquetas.' }
  }
}

/** Folha de teste para calibrar, pelo MESMO caminho que será usado (nunca aplica calibração). */
export async function imprimirFolhaTeste(metodo = 'direta') {
  try {
    if (metodo === 'pdf') {
      const r = await entregarPdf(montarPdfTeste(), 'folha-de-teste-etiquetas', 'Folha de teste')
      return r.cancelado ? { ok: false, erro: 'Envio cancelado.' } : { ok: true }
    }
    await abrirImpressao(montarSvgTeste())
    return { ok: true }
  } catch (err) {
    console.error(err)
    return { ok: false, erro: err.message || 'Erro ao gerar a folha de teste.' }
  }
}
