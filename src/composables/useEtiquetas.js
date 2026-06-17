import { jsPDF } from 'jspdf'

export const ETIQUETAS_POR_FOLHA = 77

const SPECS = {
  // Folha A5 paisagem
  sheetWidth: 210,
  sheetHeight: 148,

  // Grade
  cols: 7,
  rows: 11,

  // Etiqueta
  labelWidth: 26,
  labelHeight: 12,

  // Margens da folha
  marginLeft: 8,
  marginTop: 8.6,

  // Espaçamentos
  gapHorizontal: 2,
  gapVertical: 0
}

/**
 * Gera PDF de etiquetas A5 (77 etiquetas)
 *
 * @param {string[]} etiquetas
 * @param {string} contato
 * @param {number} startPos
 * @param {string} nomeArquivoBase
 */
export async function gerarArquivoEtiquetas(
  etiquetas,
  contato,
  startPos = 0,
  nomeArquivoBase = 'etiquetas'
) {
  if (!Array.isArray(etiquetas) || etiquetas.length === 0) {
    return {
      ok: false,
      erro: 'Não há etiquetas para gerar.'
    }
  }

  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a5',
      putOnlyUsedFonts: true,
      floatPrecision: 16
    })

    const totalEtiquetas = etiquetas.length
    const totalEspacosNecessarios = startPos + totalEtiquetas
    const totalFolhas = Math.ceil(
      totalEspacosNecessarios / ETIQUETAS_POR_FOLHA
    )

    let indiceEtiqueta = 0

    for (let folha = 0; folha < totalFolhas; folha++) {
      if (folha > 0) {
        doc.addPage('a5', 'landscape')
      }

      for (let posicaoFolha = 0; posicaoFolha < ETIQUETAS_POR_FOLHA; posicaoFolha++) {
        const posicaoGlobal =
          folha * ETIQUETAS_POR_FOLHA + posicaoFolha

        if (posicaoGlobal < startPos) {
          continue
        }

        if (indiceEtiqueta >= totalEtiquetas) {
          break
        }

        const textoEtiqueta = String(
          etiquetas[indiceEtiqueta] ?? ''
        ).trim()

        indiceEtiqueta++

        const coluna = posicaoFolha % SPECS.cols
        const linha = Math.floor(
          posicaoFolha / SPECS.cols
        )

        const x =
          SPECS.marginLeft +
          coluna *
            (SPECS.labelWidth + SPECS.gapHorizontal)

        const y =
          SPECS.marginTop +
          linha *
            (SPECS.labelHeight + SPECS.gapVertical)

        const centroX = x + SPECS.labelWidth / 2

        // SABOR
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)

        doc.text(
          textoEtiqueta.toUpperCase(),
          centroX,
          y + 4.2,
          {
            align: 'center',
            maxWidth: SPECS.labelWidth - 2
          }
        )

        // CONTATO
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)

        doc.text(
          contato,
          centroX,
          y + 8.8,
          {
            align: 'center',
            maxWidth: SPECS.labelWidth - 2
          }
        )

        // DEBUG (descomente para testar alinhamento)
        /*
        doc.setDrawColor(220)
        doc.rect(
          x,
          y,
          SPECS.labelWidth,
          SPECS.labelHeight
        )
        */
      }
    }

    doc.save(`${nomeArquivoBase}.pdf`)

    return {
      ok: true,
      totalFolhas,
      novaPosicao:
        (startPos + etiquetas.length) %
        ETIQUETAS_POR_FOLHA
    }
  } catch (erro) {
    console.error(erro)

    return {
      ok: false,
      erro:
        erro?.message ||
        'Erro ao gerar PDF.'
    }
  }
}