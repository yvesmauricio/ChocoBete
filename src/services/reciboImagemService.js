// src/services/reciboImagemService.js
// Desenha um recibo "estilo cupom" (não fiscal) em <canvas> e entrega como PNG.
// Sem dependências novas e funciona offline.
//
// Uso:
//   const r = await compartilharRecibo(dados)   // 'compartilhado' | 'cancelado' | 'baixado'

const LARGURA = 380      // px CSS
const PAD = 24
const ESCALA = 2         // 2x = nítido em tela de celular
const ALT_LINHA = 24
const FONTE = '"DejaVu Sans Mono","Roboto Mono",ui-monospace,Menlo,Consolas,"Courier New",monospace'
const TINTA = '#111111'
const SUAVE = '#666666'
const TRACO = '#bbbbbb'

const moeda = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * dados = {
 *   loja: { nome, subtitulo?, contato? },
 *   data: '03/10/2026 10:15',
 *   cliente: 'Maria Souza',
 *   numero: '000412',
 *   itens: [{ nome, qtd, unit, subtotal }],
 *   subtotal, desconto, total,
 *   pagamentos: [{ rotulo: 'Pago 05/10', valor }],
 *   emAberto,            // 0 => mostra "QUITADO"
 *   vencimento?: '17/10/2026',
 *   rodape?: 'Obrigada pela preferência!',
 *   assinatura?: '@chocobete'
 * }
 */
function montarOperacoes(d) {
  const ops = []
  const centro = (texto, { cor = TINTA, tam = 15, peso = '' } = {}) =>
    ops.push({ t: 'centro', texto, cor, tam, peso, h: ALT_LINHA })
  const linha = (esq, dir, { cor = TINTA, tam = 15, peso = '', recuo = 0 } = {}) =>
    ops.push({ t: 'linha', esq, dir, cor, tam, peso, recuo, h: ALT_LINHA })
  const sep = () => ops.push({ t: 'sep', h: 22 })
  const espaco = (h) => ops.push({ t: 'espaco', h })

  espaco(10)
  centro(d.loja.nome.toUpperCase(), { tam: 20 })
  if (d.loja.subtitulo) centro(d.loja.subtitulo, { cor: SUAVE, tam: 14 })
  if (d.loja.contato) centro(d.loja.contato, { cor: SUAVE, tam: 14 })
  sep()
  centro('COMPROVANTE DE VENDA')
  centro('Sem valor fiscal', { cor: SUAVE, tam: 14 })
  sep()
  linha('Data', d.data)
  linha('Cliente', d.cliente)
  linha('Venda nº', d.numero)
  sep()
  linha('ITEM', 'QTD x UNIT   TOTAL', { cor: SUAVE, tam: 13 })
  for (const i of d.itens || []) {
    linha(i.nome, '')
    linha(`${i.qtd} x ${moeda(i.unit)}`, moeda(i.subtotal), { cor: SUAVE, recuo: 14 })
  }
  sep()
  linha('Subtotal', `R$ ${moeda(d.subtotal)}`)
  if (d.desconto > 0.001) linha('Desconto', `- R$ ${moeda(d.desconto)}`)
  linha('TOTAL', `R$ ${moeda(d.total)}`, { tam: 20 })
  sep()
  for (const p of d.pagamentos || []) linha(p.rotulo, `R$ ${moeda(p.valor)}`)
  if (d.emAberto > 0.01) {
    linha('EM ABERTO', `R$ ${moeda(d.emAberto)}`, { peso: 'bold' })
    if (d.vencimento) linha('Vencimento', d.vencimento)
  } else {
    linha('QUITADO', `R$ ${moeda(0)}`, { peso: 'bold' })
  }
  sep()
  centro(d.rodape || 'Obrigada pela preferência!')
  if (d.assinatura) centro(d.assinatura, { cor: SUAVE, tam: 14 })
  espaco(10)
  return ops
}

function ajustar(ctx, texto, larguraMax) {
  if (ctx.measureText(texto).width <= larguraMax) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > larguraMax) t = t.slice(0, -1)
  return t + '…'
}

export async function gerarReciboBlob(dados) {
  if (document.fonts?.ready) { try { await document.fonts.ready } catch { /* segue */ } }

  const ops = montarOperacoes(dados)
  const altura = ops.reduce((s, o) => s + o.h, 0)

  const canvas = document.createElement('canvas')
  canvas.width = LARGURA * ESCALA
  canvas.height = altura * ESCALA
  const ctx = canvas.getContext('2d')
  ctx.scale(ESCALA, ESCALA)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, LARGURA, altura)
  ctx.textBaseline = 'middle'

  const util = LARGURA - PAD * 2
  let y = 0
  for (const o of ops) {
    const meio = y + o.h / 2
    if (o.t === 'sep') {
      ctx.strokeStyle = TRACO
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(PAD, meio)
      ctx.lineTo(LARGURA - PAD, meio)
      ctx.stroke()
    } else if (o.t === 'centro') {
      ctx.font = `${o.peso} ${o.tam}px ${FONTE}`.trim()
      ctx.fillStyle = o.cor
      ctx.textAlign = 'center'
      ctx.fillText(ajustar(ctx, o.texto, util), LARGURA / 2, meio)
    } else if (o.t === 'linha') {
      ctx.font = `${o.peso} ${o.tam}px ${FONTE}`.trim()
      ctx.fillStyle = o.cor
      ctx.textAlign = 'right'
      const larguraDir = o.dir ? ctx.measureText(o.dir).width + 12 : 0
      if (o.dir) ctx.fillText(o.dir, LARGURA - PAD, meio)
      ctx.textAlign = 'left'
      ctx.fillText(ajustar(ctx, o.esq, util - larguraDir - o.recuo), PAD + o.recuo, meio)
    }
    y += o.h
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png')
  )
}

/** Abre a folha de compartilhamento do celular (escolhe WhatsApp + contato).
 *  Se o aparelho/navegador não suportar enviar arquivo, baixa a imagem. */
export async function compartilharRecibo(dados, nomeArquivo = 'recibo.png') {
  const blob = await gerarReciboBlob(dados)
  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' })

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo] })
      return 'compartilhado'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado'
      // qualquer outro erro: cai no download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'baixado'
}
