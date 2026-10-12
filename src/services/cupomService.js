/**
 * Cupom "não fiscal" em imagem (PNG) para enviar por WhatsApp.
 *
 * Desenhado direto num <canvas> (sem html2canvas/CDN): funciona offline e o texto
 * fica nítido. Visual de bobina térmica de 80 mm: fonte monoespaçada, tracejados,
 * bordas serrilhadas. Sempre traz "Sem valor fiscal" no cabeçalho.
 *
 * O Pix copia e cola NÃO entra na imagem — vai numa mensagem separada, só com o
 * código, para a cliente copiar com facilidade.
 */
import { fmt, fmtBR, fmtHora } from '../composables/useCaderneta.js'

const FONTE = '"Courier New", "Roboto Mono", ui-monospace, Menlo, Consolas, monospace'
const LARGURA = 380      // px lógicos
const ESCALA  = 2        // 380 → 760 px reais (nítido no WhatsApp)
const MARGEM  = 16       // fundo cinza em volta do "papel"
const PAD     = 18       // respiro dentro do papel
const DENTE   = 7        // altura do serrilhado
const COR = { fundo: '#e8e4de', papel: '#ffffff', tinta: '#1b1b1b', suave: '#6b6b6b', traco: '#9a9a9a' }

const dinheiro = v => `R$ ${fmt(Number(v) || 0)}`

function ajustarFonte(ctx, tam, negrito) {
  ctx.font = `${negrito ? 'bold ' : ''}${tam}px ${FONTE}`
}

// Quebra o texto em linhas que cabem em `largura` (palavras; se uma palavra sozinha
// for maior que a linha, quebra por caractere — nome enorme não estoura o cupom).
function quebrar(ctx, texto, largura) {
  const saida = []
  String(texto ?? '').split('\n').forEach(par => {
    let atual = ''
    par.split(' ').forEach(pal => {
      const tentativa = atual ? `${atual} ${pal}` : pal
      if (ctx.measureText(tentativa).width <= largura) { atual = tentativa; return }
      if (atual) saida.push(atual)
      let resto = pal
      while (ctx.measureText(resto).width > largura && resto.length > 1) {
        let n = resto.length
        while (n > 1 && ctx.measureText(resto.slice(0, n)).width > largura) n--
        saida.push(resto.slice(0, n))
        resto = resto.slice(n)
      }
      atual = resto
    })
    saida.push(atual)
  })
  return saida
}

// Percorre as linhas medindo (desenhar = false) ou desenhando (true). Devolve a altura.
function percorrer(ctx, linhas, largura, desenhar) {
  let y = 0
  for (const l of linhas) {
    if (l.t === 'espaco') { y += l.h || 6; continue }
    if (l.t === 'hr') {
      y += 6
      if (desenhar) {
        ctx.save()
        ctx.strokeStyle = COR.traco; ctx.lineWidth = 1; ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(largura, y); ctx.stroke()
        ctx.restore()
      }
      y += 8
      continue
    }
    const tam = l.tam || 13
    const alt = Math.round(tam * 1.5)
    const recuo = l.recuo || 0
    ajustarFonte(ctx, tam, l.neg)
    ctx.fillStyle = l.suave ? COR.suave : COR.tinta
    ctx.textBaseline = 'alphabetic'

    if (l.t === 'lr') {
      const dirTxt = String(l.dir ?? '')
      const dirW = ctx.measureText(dirTxt).width
      const esq = quebrar(ctx, l.esq, Math.max(40, largura - recuo - dirW - 10))
      esq.forEach((ln, i) => {
        if (desenhar) {
          ctx.textAlign = 'left'; ctx.fillText(ln, recuo, y + alt * 0.72)
          if (i === 0) { ctx.textAlign = 'right'; ctx.fillText(dirTxt, largura, y + alt * 0.72) }
        }
        y += alt
      })
      continue
    }

    // 'centro' | 'texto'
    quebrar(ctx, l.texto, largura - recuo).forEach(ln => {
      if (desenhar) {
        if (l.t === 'centro') { ctx.textAlign = 'center'; ctx.fillText(ln, largura / 2, y + alt * 0.72) }
        else { ctx.textAlign = 'left'; ctx.fillText(ln, recuo, y + alt * 0.72) }
      }
      y += alt
    })
  }
  return y
}

function caminhoPapel(ctx, x0, y0, x1, y1) {
  const n = Math.max(2, Math.round((x1 - x0) / (DENTE * 1.6)))
  const passo = (x1 - x0) / n
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * passo, y = y0 + (i % 2 ? 0 : DENTE)
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  for (let i = n; i >= 0; i--) {
    const x = x0 + i * passo, y = y1 - (i % 2 ? 0 : DENTE)
    ctx.lineTo(x, y)
  }
  ctx.closePath()
}

async function renderizar(linhas) {
  const interna = LARGURA - 2 * MARGEM - 2 * PAD
  const medidor = document.createElement('canvas').getContext('2d')
  const alturaConteudo = percorrer(medidor, linhas, interna, false)
  const alturaPapel = DENTE * 2 + PAD * 2 + alturaConteudo
  const altura = Math.ceil(alturaPapel + MARGEM * 2)

  const canvas = document.createElement('canvas')
  canvas.width = LARGURA * ESCALA
  canvas.height = altura * ESCALA
  const ctx = canvas.getContext('2d')
  ctx.scale(ESCALA, ESCALA)

  ctx.fillStyle = COR.fundo
  ctx.fillRect(0, 0, LARGURA, altura)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1
  ctx.fillStyle = COR.papel
  caminhoPapel(ctx, MARGEM, MARGEM, LARGURA - MARGEM, altura - MARGEM)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(MARGEM + PAD, MARGEM + DENTE + PAD)
  percorrer(ctx, linhas, interna, true)
  ctx.restore()

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'))
}

// ── blocos reutilizáveis ─────────────────────────────────────
function cabecalho(empresa, titulo) {
  const l = [{ t: 'centro', texto: empresa.nome || 'Minha loja', tam: 18, neg: true }]
  if (empresa.telefone)  l.push({ t: 'centro', texto: empresa.telefone, suave: true, tam: 12 })
  if (empresa.instagram) l.push({ t: 'centro', texto: `@${empresa.instagram}`, suave: true, tam: 12 })
  l.push({ t: 'hr' })
  l.push({ t: 'centro', texto: titulo, neg: true, tam: 14 })
  l.push({ t: 'centro', texto: 'Sem valor fiscal', suave: true, tam: 12 })
  l.push({ t: 'hr' })
  return l
}

function rodape(empresa) {
  const l = [{ t: 'hr' }, { t: 'centro', texto: 'Obrigada pela preferência!' }]
  if (empresa.instagram) l.push({ t: 'centro', texto: `@${empresa.instagram}`, suave: true, tam: 12 })
  return l
}

function linhasItens(f) {
  const l = []
  if (f.itens?.length) {
    f.itens.forEach(i => {
      const q = i.qty ?? i.qtd ?? 0
      const u = Number(i.preco || 0)
      const sub = Number(i.subtotal ?? q * u)
      l.push({ t: 'texto', texto: i.nome || 'Item' })
      l.push({ t: 'lr', esq: `${q} x ${fmt(u)}`, dir: fmt(sub), recuo: 14, suave: true })
    })
  } else if (f.descricaoLivre) {
    l.push({ t: 'texto', texto: f.descricaoLivre })
  }
  return l
}

function dataHora(f, mostrarHora) {
  const hora = mostrarHora ? fmtHora(f.horaVenda) : ''
  return hora ? `${fmtBR(f.dataVenda)} ${hora}` : fmtBR(f.dataVenda)
}

const hojeBR = () => fmtBR(new Date().toLocaleDateString('sv'))

export function nomeArquivoCupom(prefixo, nome) {
  const slug = String(nome || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'cliente'
  return `${prefixo}-${slug}.png`
}

/**
 * Comprovante de UMA venda.
 * opts: { empresa:{nome,telefone,instagram}, mostrarHora, nomeCliente, lojaNome, desconto }
 */
export async function gerarCupomVenda(f, opts = {}) {
  const { empresa = {}, mostrarHora = true, nomeCliente = f.clienteNome, lojaNome = '', desconto = 0 } = opts
  const total = Number(f.total ?? f.saldo ?? 0)
  const saldo = Number(f.saldo || 0)
  const linhas = [
    ...cabecalho(empresa, 'COMPROVANTE DE VENDA'),
    { t: 'lr', esq: 'Data', dir: dataHora(f, mostrarHora) },
    { t: 'lr', esq: 'Cliente', dir: nomeCliente || '' },
  ]
  if (lojaNome) linhas.push({ t: 'lr', esq: 'Loja', dir: lojaNome })
  if (Number.isFinite(Number(f.id))) linhas.push({ t: 'lr', esq: 'Venda nº', dir: String(f.id).padStart(6, '0') })
  linhas.push({ t: 'hr' }, ...linhasItens(f), { t: 'hr' })

  if (desconto > 0) {
    linhas.push({ t: 'lr', esq: 'Subtotal', dir: dinheiro(total + desconto) })
    linhas.push({ t: 'lr', esq: f.descontoMotivo ? `Desconto (${f.descontoMotivo})` : 'Desconto', dir: `- ${dinheiro(desconto)}` })
  }
  linhas.push({ t: 'lr', esq: 'TOTAL', dir: dinheiro(total), neg: true, tam: 15 })

  const pagos = f.pagamentos || []
  if (pagos.length) {
    linhas.push({ t: 'hr' })
    pagos.forEach(p => linhas.push({ t: 'lr', esq: `Pago ${fmtBR(p.data).slice(0, 5)}`, dir: dinheiro(p.valor) }))
  }
  linhas.push({ t: 'hr' })
  if (saldo > 0.01) {
    linhas.push({ t: 'lr', esq: 'EM ABERTO', dir: dinheiro(saldo), neg: true })
    if (f.dataVenc) linhas.push({ t: 'lr', esq: 'Combinado para', dir: fmtBR(f.dataVenc) })
  } else {
    linhas.push({ t: 'centro', texto: 'QUITADO', neg: true, tam: 15 })
  }
  linhas.push(...rodape(empresa))
  return renderizar(linhas)
}

/**
 * Resumo das compras (a "cobrança", com leveza): todas as compras em aberto da cliente + total.
 * Não mostra vencimento (a data combinada fica só no cadastro, como na mensagem de texto).
 * opts: { empresa, mostrarHora, desconto: f => número, pix: { chave, nome } | null }
 */
export async function gerarCupomCobranca(cli, abertos, opts = {}) {
  const { empresa = {}, mostrarHora = true, desconto = () => 0, pix = null } = opts
  const ordenadas = [...abertos].sort((a, b) => String(a.dataVenda || '').localeCompare(String(b.dataVenda || '')))
  const total = ordenadas.reduce((s, f) => s + Number(f.saldo || 0), 0)

  const linhas = [
    ...cabecalho(empresa, 'RESUMO DAS COMPRAS'),
    { t: 'lr', esq: 'Data', dir: hojeBR() },
    { t: 'lr', esq: 'Cliente', dir: cli.clienteNome || '' },
    { t: 'hr' },
  ]

  ordenadas.forEach((f, i) => {
    if (i) linhas.push({ t: 'espaco', h: 4 })
    linhas.push({ t: 'texto', texto: dataHora(f, mostrarHora), neg: true })
    linhas.push(...linhasItens(f))
    const d = desconto(f)
    if (d > 0) linhas.push({ t: 'lr', esq: 'Desconto', dir: `- ${dinheiro(d)}` })
    const totalCompra = Number(f.total ?? f.saldo)
    const saldo = Number(f.saldo || 0)
    if (saldo < totalCompra - 0.01) linhas.push({ t: 'lr', esq: 'Já pago', dir: dinheiro(totalCompra - saldo) })
    linhas.push({ t: 'lr', esq: 'Em aberto', dir: dinheiro(saldo), neg: true })
  })

  linhas.push({ t: 'hr' })
  linhas.push({ t: 'lr', esq: 'TOTAL', dir: dinheiro(total), neg: true, tam: 16 })

  if (pix) {
    linhas.push({ t: 'hr' })
    linhas.push({ t: 'centro', texto: 'PAGAMENTO VIA PIX', neg: true })
    if (pix.chave) linhas.push({ t: 'lr', esq: 'Chave', dir: pix.chave })
    if (pix.nome)  linhas.push({ t: 'lr', esq: 'Nome', dir: pix.nome })
    linhas.push({ t: 'texto', texto: 'O código copia e cola vai na mensagem seguinte.', suave: true, tam: 12 })
  }
  linhas.push(...rodape(empresa))
  return renderizar(linhas)
}
