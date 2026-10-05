// services/pixService.js
// Gera o payload Pix "copia e cola" (padrão BR Code / EMV do Banco Central)
// pra cobrar o cliente direto no cardápio interativo — sem app de terceiro,
// sem taxa, sem esperar confirmação de ninguém: é só texto, o cliente cola
// no Pix do banco dele e paga.
//
// Referência: Manual de Padrões para Iniciação do Pix (BACEN) — o mesmo
// formato TLV (Tag-Length-Value) usado por todo QR Code Pix do país, então
// o código gerado aqui funciona em qualquer banco.
//
// Importante: isso é um "QR estático com valor predefinido" (Ponto de
// Iniciação "11"), não um QR dinâmico — ou seja, não existe confirmação
// automática de pagamento. A pessoa que vende ainda precisa checar o
// extrato/comprovante recebido pelo cliente, igual já faz hoje.

// Duplicado (não importado de useCardapio.js) só pra evitar import
// circular: useCardapio.js importa deste arquivo pra montar o Pix do
// cardápio, então este arquivo não pode importar de volta de lá.
function apenasDigitos(v) {
  return String(v || '').replace(/\D/g, '')
}

/** Deriva a chave Pix (tipo telefone) a partir do mesmo número usado no
 *  WhatsApp de pedidos — formato exigido pelo Pix: "+55DDNNNNNNNNN". */
export function chavePixDoWhatsapp(whatsappBruto) {
  const digitos = apenasDigitos(whatsappBruto)
  if (!digitos) return ''
  const comDDI = digitos.startsWith('55') && digitos.length >= 12 ? digitos : '55' + digitos
  return '+' + comDDI
}

/** Remove acentos, caracteres não alfanuméricos e trunca — os campos de
 *  nome/cidade do Pix aceitam só um conjunto restrito de caracteres. */
export function limparTextoPix(texto, maxLen, fallback = '') {
  const semAcento = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const limpo = semAcento.replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
  return (limpo || fallback).slice(0, maxLen)
}

// ── Pix "copia e cola" (BR Code / EMV, padrão Banco Central) ────────────
// Mesma lógica (campo TLV + CRC16) já usada no cardápio interativo — ver
// useCardapio.js → montarPayloadPix() dentro do HTML autossuficiente. Essa
// versão aqui é a "de verdade" (importável), usada nas telas do próprio
// app (ex: tela de Cobrança da Bete); a do cardápio interativo continua
// duplicada de propósito porque aquele HTML precisa rodar sozinho, sem
// módulos JS, fora do app.

/** Monta um campo Pix no formato TLV (Tag-Length-Value) exigido pelo BR Code. */
export function pixCampo(id, valor) {
  const tamanho = String(valor.length).padStart(2, '0')
  return id + tamanho + valor
}

function pixCrc16(texto) {
  let crc = 0xffff
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Monta o payload Pix "copia e cola" completo (BR Code / EMV).
 *  Sem `valor` (ou valor <= 0), o QR fica "aberto" — funciona normalmente,
 *  o cliente digita o valor no app do banco dele na hora de pagar. Com
 *  `valor`, o QR já chega com o valor preenchido (o cliente só confirma). */
export function montarPayloadPix({ chave, nome, cidade, valor, identificador } = {}) {
  const chaveLimpa = String(chave || '').trim()
  if (!chaveLimpa) return ''
  const nomeLimpo   = limparTextoPix(nome, 25, 'LOJA')
  const cidadeLimpa = limparTextoPix(cidade, 15, 'BRASIL')
  const conta = pixCampo('00', 'BR.GOV.BCB.PIX') + pixCampo('01', chaveLimpa)
  let payload = pixCampo('00', '01') + pixCampo('01', '11') + pixCampo('26', conta) + pixCampo('52', '0000') + pixCampo('53', '986')
  const valorNum = Number(valor || 0)
  if (valorNum > 0) payload += pixCampo('54', valorNum.toFixed(2))
  const idLimpo = String(identificador || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  payload += pixCampo('58', 'BR') + pixCampo('59', nomeLimpo) + pixCampo('60', cidadeLimpa) + pixCampo('62', pixCampo('05', idLimpo))
  const semCrc = payload + '6304'
  return semCrc + pixCrc16(semCrc)
}


