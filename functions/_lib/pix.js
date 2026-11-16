// Pix "copia e cola" (BR Code / EMV, padrão do Banco Central) com chave fixa e valor definido.
// É a MESMA montagem que a página usa (montarPayloadPix), só que aqui o valor vem do servidor:
// o cliente não consegue trocar o valor que está dentro do código.
const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor

function crc16(texto) {
  let crc = 0xffff
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** pix = { chave, nome, cidade } (já higienizados pelo app, igual à página). Sem chave → ''. */
export function montarPayloadPix({ pix, valorCentavos, txid }) {
  if (!pix?.chave) return ''
  const conta = campo('00', 'BR.GOV.BCB.PIX') + campo('01', String(pix.chave))
  let p = campo('00', '01') + campo('01', '11') + campo('26', conta) + campo('52', '0000') + campo('53', '986')
  if (valorCentavos > 0) p += campo('54', (valorCentavos / 100).toFixed(2))
  const id = String(txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  p += campo('58', 'BR') + campo('59', String(pix.nome || 'LOJA')) + campo('60', String(pix.cidade || 'BRASIL')) + campo('62', campo('05', id))
  const semCrc = p + '6304'
  return semCrc + crc16(semCrc)
}
