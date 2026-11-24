import PizZip from 'pizzip'
import { saveAs } from 'file-saver'
import { GRADE, layoutEtiqueta } from './etiquetasPdfCore.js'
import { ESTILO_PADRAO, normalizarEstilo, fonteDe, hexParaDocx } from './etiquetasEstilo.js'

// ── Folha Pimaco A5Q-1226: 12,0 x 26,0mm — 7 colunas x 11 linhas = 77 etiquetas ──
export const ETIQUETAS_POR_FOLHA = 77

function escapeXml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── Estilo → XML do Word ────────────────────────────────────────────────────
// Todas as 77 células do template etiqueta.docx são idênticas: um parágrafo com {sabor}
// e outro com {contato}. Em vez de remendar o XML, cada parágrafo é refeito aqui já com
// fonte, tamanho, cor, negrito, alinhamento e deslocamento do estilo escolhido.
const RE_PAR_SABOR = /<w:p>(?:(?!<\/w:p>)[\s\S])*?\{sabor\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g
const RE_PAR_CONTATO = /<w:p>(?:(?!<\/w:p>)[\s\S])*?\{contato\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g
const TWIPS_POR_MM = 1440 / 25.4
const RECUO_BASE = 37 // twips de cada lado (mesmo valor do template)

function propsRun(estilo, { tam, cor, negrito }) {
  const f = fonteDe(estilo.fonte).docx
  const t = Math.round(tam * 2) // meio-pontos
  return `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>${negrito ? '<w:b/><w:bCs/>' : ''}<w:color w:val="${hexParaDocx(cor)}"/><w:sz w:val="${t}"/><w:szCs w:val="${t}"/>`
}

/** Parágrafo com o recuo (deslocamento horizontal) e o espaçamento (vertical) do estilo. */
function paragrafoWord(estilo, texto, run, { antes = 0, depois = 0 } = {}) {
  const dx = Math.round(estilo.dx * TWIPS_POR_MM)
  const [esq, dir] = estilo.alinhamento === 'center' ? [RECUO_BASE + dx, RECUO_BASE - dx]
    : estilo.alinhamento === 'left' ? [RECUO_BASE + dx, RECUO_BASE]
      : [RECUO_BASE, RECUO_BASE - dx]
  const espaco = antes || depois
    ? `<w:spacing${antes ? ` w:before="${antes}"` : ''}${depois ? ` w:after="${depois}"` : ''}/>`
    : ''
  const props = propsRun(estilo, run)
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/>${espaco}<w:ind w:left="${esq}" w:right="${dir}"/><w:jc w:val="${estilo.alinhamento}"/><w:rPr>${props}</w:rPr></w:pPr>` +
    `<w:r><w:rPr>${props}</w:rPr><w:t>${escapeXml(texto)}</w:t></w:r></w:p>`
}

/**
 * Monta uma folha: `textos[i]` é o sabor da posição i (0–76) ou null se estiver vazia.
 * Cada etiqueta recebe o tamanho já ajustado por layoutEtiqueta (encolhe se não couber).
 */
function montarPagina(conteudoBase, textos, contato, estilo) {
  const info = textos.map((t, i) => {
    if (t == null || !String(t).trim()) return null
    const sabor = estilo.maiusculas ? String(t).toLocaleUpperCase('pt-BR') : String(t)
    const larguraMax = GRADE.larguras[i % GRADE.colunas] - 2 * GRADE.paddingLateral
    return { sabor, ...layoutEtiqueta(sabor, contato, larguraMax, estilo) }
  })
  const deslocY = Math.round(2 * Math.abs(estilo.dy) * TWIPS_POR_MM) // o bloco fica centrado: deslocar 1 = folga de 2
  const descer = estilo.dy > 0 ? deslocY : 0
  const subir = estilo.dy < 0 ? deslocY : 0
  const contatoVisivel = estilo.mostrarContato

  let iS = 0
  let pagina = conteudoBase.replace(RE_PAR_SABOR, () => {
    const c = info[iS++]
    return paragrafoWord(
      estilo, c ? c.sabor : '',
      { tam: c ? c.tamS : estilo.tamSabor, cor: estilo.corSabor, negrito: estilo.negrito },
      { antes: descer, depois: contatoVisivel ? 0 : subir }
    )
  })
  let iC = 0
  pagina = pagina.replace(RE_PAR_CONTATO, () => {
    const c = info[iC++]
    if (!contatoVisivel) return ''
    return paragrafoWord(
      estilo, c ? contato : '',
      { tam: c ? c.tamC : estilo.tamContato, cor: estilo.corContato, negrito: false },
      { depois: subir }
    )
  })
  return pagina
}

export function montarXmlEtiquetas(templateXml, etiquetas, contato, startPos = 0, mapaPosicoes = null, estiloBruto = ESTILO_PADRAO) {
  const estilo = normalizarEstilo(estiloBruto)
  const bodyMatch = templateXml.match(/^([\s\S]*?<w:body>)([\s\S]*?)(<w:sectPr[\s\S]*?<\/w:sectPr>)([\s\S]*)$/)
  if (!bodyMatch) throw new Error('Estrutura do template de etiqueta nao reconhecida')

  const [, prefixoBody, conteudoBase, sectPr, sufixoBody] = bodyMatch
  const placeholdersPorFolha = (conteudoBase.match(/\{sabor\}/g) || []).length
  if (!placeholdersPorFolha) throw new Error('Template sem marcador {sabor}')
  if (!conteudoBase.includes('{contato}')) throw new Error('Template sem marcador {contato}')
  if ((conteudoBase.match(RE_PAR_SABOR) || []).length !== placeholdersPorFolha ||
      (conteudoBase.match(RE_PAR_CONTATO) || []).length !== placeholdersPorFolha) {
    throw new Error('Template de etiqueta com marcadores fora do formato esperado')
  }

  const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
  const paginas = []

  // ── Modo manual: mapaPosicoes é um Map(posicaoGlobal0based -> texto) ──
  // Só gera as folhas necessárias para cobrir a maior posição marcada.
  if (mapaPosicoes && mapaPosicoes.size > 0) {
    const maiorPos = Math.max(...mapaPosicoes.keys())
    const totalFolhas = Math.max(1, Math.ceil((maiorPos + 1) / placeholdersPorFolha))
    for (let folha = 0; folha < totalFolhas; folha++) {
      const textos = Array.from({ length: placeholdersPorFolha }, (_, i) => {
        const posGlobal = folha * placeholdersPorFolha + i
        return mapaPosicoes.has(posGlobal) ? mapaPosicoes.get(posGlobal) : null
      })
      paginas.push(montarPagina(conteudoBase, textos, contato, estilo))
    }
    return `${prefixoBody}${paginas.join(PAGE_BREAK)}${sectPr}${sufixoBody}`
  }

  // ── Modo sequencial (padrão, comportamento original) ──
  const totalEtiquetas = etiquetas.length
  const totalFolhas = Math.max(1, Math.ceil((startPos + totalEtiquetas) / placeholdersPorFolha))
  for (let folha = 0; folha < totalFolhas; folha++) {
    const inicioGlobal = (folha * placeholdersPorFolha) - startPos
    const textos = Array.from({ length: placeholdersPorFolha }, (_, i) => {
      const idx = inicioGlobal + i
      return idx >= 0 && idx < totalEtiquetas ? etiquetas[idx] : null
    })
    paginas.push(montarPagina(conteudoBase, textos, contato, estilo))
  }
  return `${prefixoBody}${paginas.join(PAGE_BREAK)}${sectPr}${sufixoBody}`
}

/**
 * Gera o arquivo .docx de etiquetas a partir do template em /public/etiqueta.docx
 * @param {string[]} etiquetas - array de textos (um por etiqueta, repetidos conforme a quantidade) — modo sequencial
 * @param {string} contato - texto de contato a repetir em cada etiqueta
 * @param {number} startPos - posição inicial (0-based) na folha, para reaproveitar etiquetas já usadas — modo sequencial
 * @param {string} nomeArquivoBase - nome do arquivo final, sem extensão
 * @param {Map<number,string>} [mapaPosicoes] - modo manual: posição global 0-based -> texto do sabor
 * @param {object} [estilo] - estilo da etiqueta (ver etiquetasEstilo.js); omitido = estilo padrão do template
 * @returns {Promise<{ ok: boolean, novaPosicao?: number, totalFolhas?: number, erro?: string }>}
 */
export async function gerarArquivoEtiquetas(etiquetas, contato, startPos, nomeArquivoBase = 'etiquetas', mapaPosicoes = null, estilo = null) {
  if (!mapaPosicoes && !etiquetas.length) {
    return { ok: false, erro: 'Não há etiquetas válidas para gerar.' }
  }
  if (mapaPosicoes && mapaPosicoes.size === 0) {
    return { ok: false, erro: 'Marque pelo menos uma posição na folha para gerar.' }
  }
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}etiqueta.docx`)
    if (!response.ok) throw new Error('Template não encontrado na pasta public. Suba o arquivo etiqueta.docx.')

    const content = await response.arrayBuffer()
    const zip = new PizZip(content)
    const templateXml = zip.file('word/document.xml')?.asText()
    if (!templateXml) throw new Error('Conteúdo principal do template não encontrado.')

    const xmlFinal = montarXmlEtiquetas(templateXml, etiquetas, contato, startPos, mapaPosicoes, estilo || ESTILO_PADRAO)
    zip.file('word/document.xml', xmlFinal)

    const out = zip.generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    saveAs(out, `${nomeArquivoBase}.docx`)

    if (mapaPosicoes && mapaPosicoes.size > 0) {
      // Modo manual: próxima posição sugerida é a posição seguinte à maior marcada
      const maiorPos = Math.max(...mapaPosicoes.keys())
      const novaPosicao = (maiorPos % ETIQUETAS_POR_FOLHA) + 2 > ETIQUETAS_POR_FOLHA
        ? 1
        : (maiorPos % ETIQUETAS_POR_FOLHA) + 2
      const totalFolhas = Math.max(1, Math.ceil((maiorPos + 1) / ETIQUETAS_POR_FOLHA))
      return { ok: true, novaPosicao, totalFolhas }
    }

    const novaPosicao = ((startPos + etiquetas.length) % ETIQUETAS_POR_FOLHA) + 1
    const totalFolhas = Math.max(1, Math.ceil((startPos + etiquetas.length) / ETIQUETAS_POR_FOLHA))
    return { ok: true, novaPosicao, totalFolhas }
  } catch (err) {
    console.error(err)
    return { ok: false, erro: err.message || 'Erro ao gerar etiqueta.' }
  }
}