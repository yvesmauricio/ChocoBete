import { saveAs } from 'file-saver'
import {
  planejarFolhas,
  montarPdfEtiquetas,
  montarPdfTeste,
  CALIBRACAO_PADRAO
} from './etiquetasPdfCore.js'

// A calibração é POR APARELHO (cada celular/impressora/app de impressão escala de um jeito),
// por isso fica no localStorage deste aparelho e não na conta.
const CHAVE_CALIBRACAO = 'choco_etq_calibracao_pdf_v1'

export function lerCalibracao() {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_CALIBRACAO) || 'null')
    if (j && [j.sx, j.sy, j.ox, j.oy].every(Number.isFinite)) return { sx: j.sx, sy: j.sy, ox: j.ox, oy: j.oy }
  } catch { /* sem calibração salva */ }
  return { ...CALIBRACAO_PADRAO }
}

export function salvarCalibracao(c) {
  localStorage.setItem(CHAVE_CALIBRACAO, JSON.stringify({ sx: c.sx, sy: c.sy, ox: c.ox, oy: c.oy }))
}

export function limparCalibracao() {
  try { localStorage.removeItem(CHAVE_CALIBRACAO) } catch { /* ignora */ }
}

export function calibracaoAtiva(c) {
  return Math.abs(c.sx - 1) > 1e-6 || Math.abs(c.sy - 1) > 1e-6 || Math.abs(c.ox) > 1e-6 || Math.abs(c.oy) > 1e-6
}

const fmt = (v, casas = 1) => v.toFixed(casas).replace('.', ',')
export function descreverCalibracao(c) {
  const sinal = (v) => (v >= 0 ? '+' : '−') + fmt(Math.abs(v))
  return `escala ${fmt(c.sx * 100)}% × ${fmt(c.sy * 100)}% · deslocamento X ${sinal(c.ox)} mm, Y ${sinal(c.oy)} mm`
}

/**
 * Entrega o PDF: no celular abre o "Compartilhar" (dá para mandar para o HP Smart, Drive,
 * ou qualquer app que imprima); no computador, baixa o arquivo.
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

/**
 * Mesma assinatura de gerarArquivoEtiquetas (.docx), mas gera um PDF em milímetros,
 * já aplicando a calibração salva neste aparelho.
 * @returns {Promise<{ ok: boolean, novaPosicao?: number, totalFolhas?: number, erro?: string }>}
 */
export async function gerarPdfEtiquetas(etiquetas, contato, startPos, nomeArquivoBase = 'etiquetas', mapaPosicoes = null) {
  if (!mapaPosicoes && !etiquetas.length) return { ok: false, erro: 'Não há etiquetas válidas para gerar.' }
  if (mapaPosicoes && mapaPosicoes.size === 0) return { ok: false, erro: 'Marque pelo menos uma posição na folha para gerar.' }
  try {
    const plano = planejarFolhas(etiquetas, contato, startPos, mapaPosicoes)
    const bytes = montarPdfEtiquetas(plano, lerCalibracao())
    const r = await entregarPdf(bytes, nomeArquivoBase, 'Etiquetas')
    if (r.cancelado) return { ok: false, erro: 'Envio cancelado. Nenhuma etiqueta foi marcada como usada.' }
    return { ok: true, novaPosicao: plano.novaPosicao, totalFolhas: plano.totalFolhas }
  } catch (err) {
    console.error(err)
    return { ok: false, erro: err.message || 'Erro ao gerar o PDF das etiquetas.' }
  }
}

/** Folha de teste para calibrar (nunca aplica calibração). */
export async function gerarPdfTeste() {
  try {
    const r = await entregarPdf(montarPdfTeste(), 'folha-de-teste-etiquetas', 'Folha de teste')
    return r.cancelado ? { ok: false, erro: 'Envio cancelado.' } : { ok: true }
  } catch (err) {
    console.error(err)
    return { ok: false, erro: err.message || 'Erro ao gerar a folha de teste.' }
  }
}
