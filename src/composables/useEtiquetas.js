import PizZip from 'pizzip'
import { saveAs } from 'file-saver'

// ── Folha Pimaco A5Q-1226: 12,0 x 26,0mm — 7 colunas x 11 linhas = 77 etiquetas ──
export const ETIQUETAS_POR_FOLHA = 77

function escapeXml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function montarXmlEtiquetas(templateXml, etiquetas, contato, startPos = 0) {
  const bodyMatch = templateXml.match(/^([\s\S]*?<w:body>)([\s\S]*?)(<w:sectPr[\s\S]*?<\/w:sectPr>)([\s\S]*)$/)
  if (!bodyMatch) throw new Error('Estrutura do template de etiqueta nao reconhecida')

  const [, prefixoBody, conteudoBase, sectPr, sufixoBody] = bodyMatch
  const placeholdersPorFolha = (conteudoBase.match(/\{sabor\}/g) || []).length
  if (!placeholdersPorFolha) throw new Error('Template sem marcador {sabor}')
  if (!conteudoBase.includes('{contato}')) throw new Error('Template sem marcador {contato}')

  const totalEtiquetas = etiquetas.length
  const totalFolhas = Math.max(1, Math.ceil((startPos + totalEtiquetas) / placeholdersPorFolha))
  const paginas = []
  const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

  for (let folha = 0; folha < totalFolhas; folha++) {
    let idxNaFolhaSabor = 0
    let idxNaFolhaContato = 0
    const inicioGlobal = (folha * placeholdersPorFolha) - startPos

    const pagina = conteudoBase
      .replace(/\{sabor\}/g, () => {
        const idxEtiqueta = inicioGlobal + idxNaFolhaSabor
        idxNaFolhaSabor += 1
        return idxEtiqueta >= 0 && idxEtiqueta < totalEtiquetas ? escapeXml(etiquetas[idxEtiqueta]) : ''
      })
      .replace(/\{contato\}/g, () => {
        const idxEtiqueta = inicioGlobal + idxNaFolhaContato
        idxNaFolhaContato += 1
        return idxEtiqueta >= 0 && idxEtiqueta < totalEtiquetas ? escapeXml(contato) : ''
      })

    paginas.push(pagina)
  }

  return `${prefixoBody}${paginas.join(PAGE_BREAK)}${sectPr}${sufixoBody}`
}

/**
 * Gera o arquivo .docx de etiquetas a partir do template em /public/etiqueta.docx
 * @param {string[]} etiquetas - array de textos (um por etiqueta, repetidos conforme a quantidade)
 * @param {string} contato - texto de contato a repetir em cada etiqueta
 * @param {number} startPos - posição inicial (0-based) na folha, para reaproveitar etiquetas já usadas
 * @param {string} nomeArquivoBase - nome do arquivo final, sem extensão
 * @returns {Promise<{ ok: boolean, novaPosicao?: number, totalFolhas?: number, erro?: string }>}
 */
export async function gerarArquivoEtiquetas(etiquetas, contato, startPos, nomeArquivoBase = 'etiquetas') {
  if (!etiquetas.length) {
    return { ok: false, erro: 'Não há etiquetas válidas para gerar.' }
  }
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}etiqueta.docx`)
    if (!response.ok) throw new Error('Template não encontrado na pasta public. Suba o arquivo etiqueta.docx.')

    const content = await response.arrayBuffer()
    const zip = new PizZip(content)
    const templateXml = zip.file('word/document.xml')?.asText()
    if (!templateXml) throw new Error('Conteúdo principal do template não encontrado.')

    const xmlFinal = montarXmlEtiquetas(templateXml, etiquetas, contato, startPos)
    zip.file('word/document.xml', xmlFinal)

    const out = zip.generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    saveAs(out, `${nomeArquivoBase}.docx`)

    const novaPosicao = ((startPos + etiquetas.length) % ETIQUETAS_POR_FOLHA) + 1
    const totalFolhas = Math.max(1, Math.ceil((startPos + etiquetas.length) / ETIQUETAS_POR_FOLHA))
    return { ok: true, novaPosicao, totalFolhas }
  } catch (err) {
    console.error(err)
    return { ok: false, erro: err.message || 'Erro ao gerar etiqueta.' }
  }
}
