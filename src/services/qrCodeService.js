// services/qrCodeService.js
// Gerador de QR Code (SVG) reaproveitado nas telas do próprio app — mesma
// lib de terceiros (MIT — ver src/vendor/QRCODE_LICENSE.txt) já usada no
// cardápio interativo, só que aqui carregada uma vez como função JS normal
// em vez de injetada como <script> num HTML autossuficiente. 100% local:
// não depende de internet nem de CDN.
import QRCODE_LIB_JS from '../vendor/qrcode-generator.min.js?raw'

// `new Function` roda o texto da lib isolado (sem poluir o escopo global)
// e devolve só a função `qrcode` que ela define.
let qrcodeFnCache = null
function getQrcodeFn() {
  if (!qrcodeFnCache) {
    qrcodeFnCache = new Function(`${QRCODE_LIB_JS}\nreturn qrcode;`)()
  }
  return qrcodeFnCache
}

/** Gera o SVG de um QR Code a partir de um texto (payload Pix, vCard, link...).
 *  Tenta o menor "tipo" (tamanho) que comporte o texto, subindo até caber. */
export function gerarQrSvg(texto, { cellSize = 5, margin = 2 } = {}) {
  if (!texto) return null
  const qrcode = getQrcodeFn()
  for (let tipo = 2; tipo <= 24; tipo++) {
    try {
      const qr = qrcode(tipo, 'M')
      qr.addData(texto)
      qr.make()
      return qr.createSvgTag({ cellSize, margin, scalable: true })
    } catch { /* tenta o próximo tamanho (capacidade maior) */ }
  }
  return null
}

function linhaVCard(texto) {
  // vCard usa ; e , como separadores de campo — escapa pra não quebrar o
  // parser do app de contatos de quem escaneia.
  return String(texto || '').replace(/([,;])/g, '\\$1')
}

/** Monta um vCard 3.0 — padrão aberto, lido offline pela câmera nativa do
 *  Android/iOS (oferece "Adicionar aos contatos" na hora, sem internet). */
export function montarVCard({ nome, telefoneWhatsapp, instagramUrl, nota } = {}) {
  const nomeLimpo = linhaVCard(nome || 'Loja')
  const linhas = ['BEGIN:VCARD', 'VERSION:3.0', `N:;${nomeLimpo};;;`, `FN:${nomeLimpo}`]
  if (telefoneWhatsapp) {
    linhas.push(`TEL;TYPE=CELL:+${telefoneWhatsapp}`)
  }
  if (instagramUrl) linhas.push(`URL:${instagramUrl}`)
  if (nota) linhas.push(`NOTE:${linhaVCard(nota)}`)
  linhas.push('END:VCARD')
  return linhas.join('\n')
}
