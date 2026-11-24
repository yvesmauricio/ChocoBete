import { saveAs } from 'file-saver'
import { configGet, configSet } from '../db.js'
import {
  planejarFolhas,
  montarPdfEtiquetas,
  montarPdfTeste,
  montarSvgsEtiquetas,
  montarSvgTeste,
  CALIBRACAO_PADRAO
} from './etiquetasPdfCore.js'
import { ESTILO_PADRAO } from './etiquetasEstilo.js'

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

// ── Onde ficam salvos ───────────────────────────────────────────────────────
// Antes: só no localStorage, que o Android limpa com facilidade (e que o app não
// protegia) — por isso o ajuste "sumia" ao fechar e abrir. Agora o dado principal
// fica no IndexedDB (o mesmo banco do resto do app, que já pede armazenamento
// persistente) e o localStorage vira cópia de segurança. A chave está em
// CONFIG_CHAVES_DO_APARELHO (db.js): não entra no backup nem no sync, porque cada
// celular/impressora tem o seu ajuste.
// A API continua síncrona (lê de um cache em memória); a gravação é que é assíncrona.
const CHAVE_DB = 'etq_impressao_aparelho'
const CHAVE_METODO = 'choco_etq_metodo_v1'
const chaveCalibracao = (metodo) => (metodo === 'pdf' ? 'choco_etq_calibracao_pdf_v1' : 'choco_etq_calibracao_direta_v1')
const chaveMedidas = (metodo) => (metodo === 'pdf' ? 'choco_etq_medidas_pdf_v1' : 'choco_etq_medidas_direta_v1')

const numOk = (v) => typeof v === 'number' && Number.isFinite(v)
const calValida = (j) => !!j && [j.sx, j.sy, j.ox, j.oy].every(numOk)
const medValida = (j) => !!j && ['larguraMm', 'alturaMm', 'esquerdaMm', 'topoMm'].every(k => numOk(j[k]))

function lsGet(chave) {
  try { return JSON.parse(localStorage.getItem(chave) || 'null') } catch { return null }
}
function lsSet(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { /* sem storage */ }
}
function lsDel(chave) {
  try { localStorage.removeItem(chave) } catch { /* ignora */ }
}

// Cache em memória: { metodo, direta: {cal, med}, pdf: {cal, med} }
function vazio() { return { metodo: null, direta: { cal: null, med: null }, pdf: { cal: null, med: null } } }
function doLocalStorage() {
  const c = vazio()
  try { const bruto = localStorage.getItem(CHAVE_METODO); if (METODOS.includes(bruto)) c.metodo = bruto } catch { /* ignora */ }
  for (const k of ['direta', 'pdf']) {
    const cal = lsGet(chaveCalibracao(k)); if (calValida(cal)) c[k].cal = { sx: cal.sx, sy: cal.sy, ox: cal.ox, oy: cal.oy }
    const med = lsGet(chaveMedidas(k)); if (medValida(med)) c[k].med = { ...med }
  }
  return c
}
let cache = doLocalStorage() // já serve na hora, mesmo antes do IndexedDB responder

function gravarTudo() {
  // cópia de segurança no localStorage
  try { if (cache.metodo) localStorage.setItem(CHAVE_METODO, cache.metodo) } catch { /* ignora */ }
  for (const k of ['direta', 'pdf']) {
    if (cache[k].cal) lsSet(chaveCalibracao(k), cache[k].cal); else lsDel(chaveCalibracao(k))
    if (cache[k].med) lsSet(chaveMedidas(k), cache[k].med); else lsDel(chaveMedidas(k))
  }
  // dado principal no IndexedDB
  return configSet(CHAVE_DB, JSON.parse(JSON.stringify(cache)))
}

let carregamento = null
/** Lê o que está salvo no IndexedDB (uma vez). Chame e espere antes de ler os valores na tela. */
export function carregarPrefsEtiquetas() {
  if (!carregamento) {
    carregamento = (async () => {
      const salvo = await configGet(CHAVE_DB, null)
      if (salvo && typeof salvo === 'object') {
        const c = vazio()
        if (METODOS.includes(salvo.metodo)) c.metodo = salvo.metodo
        for (const k of ['direta', 'pdf']) {
          if (calValida(salvo[k]?.cal)) c[k].cal = { ...salvo[k].cal }
          if (medValida(salvo[k]?.med)) c[k].med = { ...salvo[k].med }
        }
        cache = c
        // o IndexedDB manda; reflete no localStorage para manter a cópia em dia
        try { if (cache.metodo) localStorage.setItem(CHAVE_METODO, cache.metodo) } catch { /* ignora */ }
        for (const k of ['direta', 'pdf']) {
          if (cache[k].cal) lsSet(chaveCalibracao(k), cache[k].cal)
          if (cache[k].med) lsSet(chaveMedidas(k), cache[k].med)
        }
      } else if (cache.metodo || cache.direta.cal || cache.pdf.cal) {
        await gravarTudo() // migração: tinha só no localStorage, passa para o IndexedDB
      }
    })().catch(() => { /* fica com o que veio do localStorage */ })
  }
  return carregamento
}
carregarPrefsEtiquetas()

export function lerMetodo() {
  return METODOS.includes(cache.metodo) ? cache.metodo : 'direta'
}

export function salvarMetodo(m) {
  if (!METODOS.includes(m)) return
  cache.metodo = m
  return gravarTudo()
}

export function lerCalibracao(metodo = 'direta') {
  const c = cache[metodo === 'pdf' ? 'pdf' : 'direta'].cal
  return c ? { ...c } : { ...CALIBRACAO_PADRAO }
}

/** As quatro medidas (A, B, C, D) digitadas na última calibração — para reaparecerem nos campos. */
export function lerMedidas(metodo = 'direta') {
  const m = cache[metodo === 'pdf' ? 'pdf' : 'direta'].med
  return m ? { ...m } : null
}

/** Guarda a calibração (e as medidas que a geraram). Devolve uma promessa: resolve quando gravou. */
export function salvarCalibracao(c, metodo = 'direta', medidas = null) {
  const k = metodo === 'pdf' ? 'pdf' : 'direta'
  cache[k].cal = { sx: c.sx, sy: c.sy, ox: c.ox, oy: c.oy }
  cache[k].med = medValida(medidas) ? { larguraMm: medidas.larguraMm, alturaMm: medidas.alturaMm, esquerdaMm: medidas.esquerdaMm, topoMm: medidas.topoMm } : null
  return gravarTudo()
}

export function limparCalibracao(metodo = 'direta') {
  const k = metodo === 'pdf' ? 'pdf' : 'direta'
  cache[k] = { cal: null, med: null }
  return gravarTudo()
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
 * `estilo` = estilo visual da etiqueta (etiquetasEstilo.js); omitido = estilo padrão.
 */
export async function imprimirEtiquetas(etiquetas, contato, startPos, _nomeArquivoBase, mapaPosicoes = null, estilo = null) {
  const invalida = validar(etiquetas, mapaPosicoes)
  if (invalida) return invalida
  try {
    await carregarPrefsEtiquetas()
    const plano = planejarFolhas(etiquetas, contato, startPos, mapaPosicoes)
    await abrirImpressao(montarSvgsEtiquetas(plano, lerCalibracao('direta'), estilo || ESTILO_PADRAO))
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
export async function gerarPdfEtiquetas(etiquetas, contato, startPos, nomeArquivoBase = 'etiquetas', mapaPosicoes = null, estilo = null) {
  const invalida = validar(etiquetas, mapaPosicoes)
  if (invalida) return invalida
  try {
    await carregarPrefsEtiquetas()
    const plano = planejarFolhas(etiquetas, contato, startPos, mapaPosicoes)
    const bytes = montarPdfEtiquetas(plano, lerCalibracao('pdf'), estilo || ESTILO_PADRAO)
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
