import { montarEtiquetasProducao } from '../modules/etiquetasProducao.js'
import { gerarArquivoEtiquetas } from './useEtiquetas.js'
import { imprimirEtiquetas, gerarPdfEtiquetas, lerMetodo, carregarPrefsEtiquetas } from './useEtiquetasPdf.js'

/**
 * Imprime as etiquetas de controle da produção (trufa = 1 por forma, só o sabor;
 * demais = sabor + quantidade). Usa a mesma folha Pimaco, a mesma "próxima posição livre"
 * e a mesma forma de imprimir (direto / PDF / Word) escolhida em Ajustes › Sistema.
 *
 * @param {object} s        store do app (precisa de s.receitas, s.company, s.saveCompany, s.notify, s.loading)
 * @param {object} confirm  useConfirm()
 * @param {Array}  itens    linhas de produção a etiquetar
 */
export async function imprimirEtiquetasProducao(s, confirm, itens) {
  const { etiquetas, linhas } = montarEtiquetasProducao(itens, s.receitas)
  if (!etiquetas.length) {
    s.notify('Não há etiquetas de produção para gerar (itens sem quantidade ou só receitas intermediárias).', 'error')
    return { ok: false }
  }

  const resumo = linhas.map(l => `${l.sabor}: ${l.rotuloQtd}${l.tipo === 'forma' ? ' → ' + l.etiquetas + ' etiqueta' + (l.etiquetas > 1 ? 's' : '') : ''}`).join(' · ')
  const total = etiquetas.length
  const okResumo = await confirm.ask(
    `${total} etiqueta${total > 1 ? 's' : ''} de produção. ${resumo}`,
    { title: 'Etiquetas da produção', icon: 'fas fa-tags', type: 'primary', confirmLabel: 'Imprimir' }
  )
  if (!okResumo) return { ok: false, cancelado: true }

  // Posição na folha (mesma "próxima etiqueta livre" da tela de Etiquetas)
  let startPos = Math.max(0, (Number(s.company?.posicao_etiqueta || 1) || 1) - 1)
  if (startPos > 0) {
    const continuar = await confirm.ask(
      `A próxima etiqueta livre é a ${startPos + 1}. Toque em "Continuar" para reaproveitar a folha atual ou em "Nova folha" para recomeçar da primeira etiqueta.`,
      { title: 'Como deseja imprimir?', icon: 'fas fa-tags', type: 'primary', confirmLabel: 'Continuar', cancelLabel: 'Nova folha' }
    )
    if (!continuar) startPos = 0
  }

  await carregarPrefsEtiquetas()
  const forma = lerMetodo()
  const gerar = forma === 'direta' ? imprimirEtiquetas : forma === 'pdf' ? gerarPdfEtiquetas : gerarArquivoEtiquetas
  const comLoader = forma === 'docx' // impressão direta/Compartilhar abrem telas do Android: sem loader global
  if (comLoader) s.loading = true
  let r
  try {
    r = await gerar(etiquetas, '', startPos, 'etiquetas-producao')
  } finally {
    if (comLoader) s.loading = false
  }

  if (r.ok) {
    s.saveCompany({ posicao_etiqueta: r.novaPosicao })
    const verbo = forma === 'direta' ? 'Impressão aberta' : 'Etiqueta gerada'
    s.notify(`${verbo}! ${r.totalFolhas} folha${r.totalFolhas > 1 ? 's' : ''}. Próxima posição: ${r.novaPosicao}.`)
  } else {
    s.notify(r.erro || 'Não foi possível gerar as etiquetas.', 'error')
  }
  return r
}
