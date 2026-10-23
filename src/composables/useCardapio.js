// composables/useCardapio.js
// Módulo "Cardápio Digital" — monta um cardápio visual (preto & dourado) a
// partir das receitas já cadastradas, sem duplicar dados: cada receita ganha
// só um "adereço" opcional (descrição de venda, emoji/foto, destaque, ordem)
// guardado à parte, igual ao padrão já usado no Kit Festa.
//
// Três saídas, a partir do mesmo HTML gerado:
//   1) PDF          → abre o HTML numa janela e usa o print nativo do navegador
//      (mesmo truque do useGerarDocumento.js — qualidade de impressão real,
//      com fontes vetoriais, sem libs extras).
//   2) Tela cheia    → o mesmo HTML, mostrado num overlay dentro do próprio app.
//   3) Imagem WhatsApp → o cardápio (ou 1 item) é desenhado num container
//      escondido e "fotografado" com html2canvas (carregado sob demanda, do
//      CDN — mesmo padrão do pdfService.js para o pdf.js).

import { configGet, configSet } from '../db.js'
import { chavePixDoWhatsapp, limparTextoPix } from '../services/pixService.js'
import { normalizarInstagram, urlInstagram } from '../services/contatoService.js'
// Gerador de QR Code (lib de terceiros, MIT — ver src/vendor/QRCODE_LICENSE.txt),
// importado como texto puro (?raw) pra ser injetado dentro do <script> do
// cardápio interativo: esse HTML precisa continuar autossuficiente (funciona
// aberto direto do celular, sem internet), então a lib vai embutida no
// arquivo em vez de carregada de um CDN.
import QRCODE_LIB_JS from '../vendor/qrcode-generator.min.js?raw'

// R$() do utils.js não prefixa o símbolo (é usado com rótulos como "Venda:" já
// no contexto). Aqui o preço aparece sozinho pro cliente, então formatamos
// com o "R$" explícito.
const R$ = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Gerador de QR Code, reaproveitado fora do cardápio interativo ──
// A lib vem como texto puro (?raw) — o mesmo arquivo é injetado dentro do
// <script> do cardápio interativo (autossuficiente, sem internet) e também
// executado aqui, uma vez, pra ficar disponível como função normal do
// JavaScript (ex: pro QR do PDF compacto). `new Function` roda o texto da
// lib isolado, sem poluir o escopo global, e devolve só a função `qrcode`
// que ela define.
let qrcodeFnCache = null
function getQrcodeFn() {
  if (!qrcodeFnCache) {
    qrcodeFnCache = new Function(`${QRCODE_LIB_JS}\nreturn qrcode;`)()
  }
  return qrcodeFnCache
}

/** Gera o SVG de um QR Code a partir de um texto (ex: link do cardápio). */
function gerarQrSvg(texto, { cellSize = 4, margin = 4 } = {}) {
  const qrcode = getQrcodeFn()
  for (let tipo = 2; tipo <= 24; tipo++) {
    try {
      const qr = qrcode(tipo, 'M')
      qr.addData(texto)
      qr.make()
      return qr.createSvgTag({ cellSize, margin, scalable: true })
    } catch { /* tenta o próximo tipo (capacidade maior) */ }
  }
  return null
}

export const CHAVE_CONFIG_CARDAPIO = 'cardapio_config'

/** Os cardápios disponíveis — cada um é totalmente independente (itens, capa,
 *  regras de mínimo/sinal/antecedência, link publicado). "festa" é o cardápio
 *  original (chave antiga, preservada pra não perder dados de quem já usava). */
export const CARDAPIOS = [
  { id: 'festa', label: 'Festa', icone: 'fa-champagne-glasses' },
  { id: 'diaadia', label: 'Dia a dia', icone: 'fa-shop' },
]

function chaveConfigCardapio(id) {
  return id === 'festa' ? CHAVE_CONFIG_CARDAPIO : `cardapio_config_${id}`
}

const CONFIG_DEFAULT = (id = 'festa') => ({
  nome_cardapio: '',      // vazio = usa s.company.nome
  subtitulo: id === 'diaadia' ? 'Doces para o dia a dia' : 'Chocolates Artesanais',
  mensagem_rodape: 'Peça já e encomende o seu! 🍫',
  abrir_tela_cheia_padrao: false, // true = abre direto na tela cheia (modo "mostrar pro cliente")
  pagamento_ativo: true, // true = checkout com recebimento, Pix e pagamento no cardápio publicado
  antecedencia_dias: 2, // aviso de antecedência mínima pra encomendas — 0 = não mostrar
  sinal_ativo: true,    // exige sinal pra confirmar encomenda
  sinal_percentual: 50, // % do total cobrado como sinal via Pix (0 = sem sinal, cobra o total)
  sinal_texto: 'Encomendas confirmadas mediante pagamento de um sinal. Após a confirmação, o sinal não é reembolsável, pois é usado para a compra dos insumos da sua encomenda.',
  // Só usada no cardápio "Dia a dia": valor fixo cobrado quando o cliente
  // escolhe "Receber em casa". 0 = ainda não configurada (o cardápio avisa
  // "a combinar" em vez de inventar um número).
  taxa_entrega: 0,
  mostrar_foto_itens: true, // false = esconde a foto/emoji de cada sabor no cardápio digital (só o banner da categoria aparece)
  categorias_img: {}, // { [categoria]: dataURL } — imagem do banner da categoria no cardápio digital (vazio = usa a foto do 1º item)
  categorias_min: {}, // { [categoria]: { valor, unidades } } — ex: { Festa: { valor: 80, unidades: 20 } } — 0/ausente = sem exigência nesse critério
  itens: {}, // { [receitaUuid]: { ativo, ordem, categoria, descricao, emoji, foto, destaque, preco_exibido } }
})

export const ITEM_DEFAULT = () => ({
  ativo: true,
  ordem: 0,
  categoria: '',        // vazio = usa a categoria da própria receita
  descricao: '',
  emoji: '🍫',
  foto: null,            // dataURL (base64) já redimensionada
  destaque: false,
  // true = o item continua visível e pedível no cardápio, só que sinaliza
  // pro cliente que não é entrega na hora — precisa do prazo configurado
  // em "Antecedência e sinal" (mesma política do cardápio inteiro, não
  // configurável item a item pra não virar uma segunda tela de config).
  // Pensado pro caso comum: um item que normalmente vende pronto (ex: uma
  // trufa do dia a dia) acabou no estoque, mas ainda dá pra encomendar
  // pra outro dia — sem precisar mudar ele de cardápio.
  sob_encomenda: false,
  preco_exibido: null,   // null = usa receita.preco_sugerido
})

/** Aceita tanto o formato antigo ({ Festa: 80 }) quanto o novo ({ Festa: { valor: 80, unidades: 20 } }) */
function normalizarCategoriasMin(mapa) {
  const saida = {}
  for (const [categoria, v] of Object.entries(mapa || {})) {
    if (typeof v === 'number') saida[categoria] = { valor: v, unidades: 0 }
    else saida[categoria] = { valor: Number(v?.valor || 0), unidades: Number(v?.unidades || 0) }
  }
  return saida
}

export async function carregarConfigCardapio(id = 'festa') {
  const salvo = await configGet(chaveConfigCardapio(id), null)
  const base = CONFIG_DEFAULT(id)
  if (!salvo) return base
  return {
    ...base,
    ...salvo,
    itens: { ...(salvo.itens || {}) },
    categorias_min: normalizarCategoriasMin(salvo.categorias_min),
    categorias_img: { ...(salvo.categorias_img || {}) },
  }
}

export async function salvarConfigCardapio(id, config) {
  await configSet(chaveConfigCardapio(id), config)
  return config
}

// ── Aba padrão ao abrir o Cardápio ──────────────────────────────────────
// Preferência única (não é por cardápio): qual dos cardápios (Festa ou Dia
// a dia) já vem selecionado quando a pessoa entra na tela do Cardápio.
const CHAVE_ABA_PADRAO_CARDAPIO = 'cardapio_aba_padrao'

export async function carregarAbaPadraoCardapio() {
  const salvo = await configGet(CHAVE_ABA_PADRAO_CARDAPIO, 'festa')
  return CARDAPIOS.some(c => c.id === salvo) ? salvo : 'festa'
}

export async function salvarAbaPadraoCardapio(id) {
  await configSet(CHAVE_ABA_PADRAO_CARDAPIO, id)
}

export function getItemConfig(config, uuid) {
  return { ...ITEM_DEFAULT(), ...(config.itens?.[uuid] || {}) }
}

/**
 * Lista as receitas elegíveis (exclui bases/intermediárias) já mescladas com os
 * adereços do cardápio. Por padrão só traz os itens ativos (uso na geração do
 * PDF/imagem/tela); passe apenasAtivos: false pra listar tudo (uso no editor,
 * onde itens desativados também precisam aparecer pra poderem ser reativados).
 */
export function montarItensCardapio(receitas, config, { apenasAtivos = true } = {}) {
  return (receitas || [])
    .filter(r => !r.eh_intermediaria)
    .map(r => {
      const cfg = getItemConfig(config, r.uuid)
      const tamanho = String(r.tamanho || '').trim().toLowerCase()
      const categoriaBase = String(r.categoria || '').trim()
      const categoriaExibicao = cfg.categoria || (
        tamanho === 'festa' && /trufa/i.test(categoriaBase)
          ? 'Festa'
          : categoriaBase || 'Geral'
      )
      const nomeBase = String(r.nome || '').trim()
      const nomeExibicao = tamanho === 'festa' && /trufa/i.test(categoriaBase)
        ? nomeBase.replace(/\s*-\s*Festa\s*\d*g$/i, '').trim() || nomeBase
        : nomeBase
      const pesoUnitario = Number(r.peso_unitario || 0)
      const pesoEtiqueta = tamanho === 'festa' && /trufa/i.test(categoriaBase) && pesoUnitario > 0
        ? `Festa • ${pesoUnitario}g`
        : ''
      return {
        uuid: r.uuid,
        nome: nomeExibicao,
        categoria: categoriaExibicao,
        preco: cfg.preco_exibido != null ? Number(cfg.preco_exibido) : Number(r.preco_sugerido || 0),
        descricao: cfg.descricao || pesoEtiqueta,
        emoji: cfg.emoji || '🍫',
        foto: cfg.foto || null,
        destaque: !!cfg.destaque,
        sobEncomenda: !!cfg.sob_encomenda,
        ativo: cfg.ativo !== false,
        ordem: Number(cfg.ordem || 0),
      }
    })
    .filter(i => (apenasAtivos ? i.ativo : true))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function agruparPorCategoria(itens) {
  const mapa = new Map()
  for (const item of itens) {
    if (!mapa.has(item.categoria)) mapa.set(item.categoria, [])
    mapa.get(item.categoria).push(item)
  }
  return Array.from(mapa.entries()).map(([categoria, itens]) => ({ categoria, itens }))
}

// ── Utilitário: redimensiona foto enviada pelo usuário para não pesar no banco ──
export function redimensionarImagem(arquivo, { maxLado = 640, qualidade = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      img.onload = () => {
        let { width, height } = img
        const escala = Math.min(1, maxLado / Math.max(width, height))
        width = Math.round(width * escala)
        height = Math.round(height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', qualidade))
      }
      img.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}

// ── CSS — tema "Boutique" preto & dourado, compartilhado entre PDF e tela cheia ──
// Unificado com a identidade visual do resto do app (main.css): mesma dupla
// de fontes usada em todas as outras telas — Plus Jakarta Sans pro corpo,
// Caveat (manuscrita) pros títulos/destaques — em vez das serifadas
// Playfair Display / Cormorant Garamond que o cardápio (tela, PDF e imagem
// de WhatsApp) usava antes.
const GOOGLE_FONTS_URL_CARDAPIO = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'

// ── Tema "Resumo pra vender" — folha única A5, fundo branco, pensada pra
// caber tudo (10-20 itens) numa olhada só: 2 colunas fluindo com CSS
// multi-coluna (se ajusta sozinho ao número de itens, sem precisar calcular
// quantas linhas cabem), sem foto grande de capa, sem política de encomenda
// (isso é conversa de fechar pedido, não de vitrine) — só nome, preço,
// descrição curta e, no rodapé, um QR code pro cardápio online pra quem
// preferir pedir pelo celular. ──
const CSS_CARDAPIO_COMPACTO = `
  @import url('${GOOGLE_FONTS_URL_CARDAPIO}');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; color: #3d1f07; font-family: 'Plus Jakarta Sans', sans-serif; }
  .cardapio-compacto {
    width: 148mm; min-height: 210mm; margin: 0 auto;
    padding: 10mm; background: #fff; display: flex; flex-direction: column;
  }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    html, body { background: #fff; }
  }

  .cc-topo { text-align: center; margin-bottom: 4mm; }
  .cc-topo .selo {
    width: 34px; height: 34px; margin: 0 auto 2mm; border-radius: 50%;
    border: 1.5px solid #c49a6c; display: flex; align-items: center; justify-content: center;
    font-size: 17px; background: #f0e8d8;
  }
  .cc-topo .marca { font-family: 'Caveat', cursive; font-weight: 700; font-size: 22pt; color: #2a1504; }
  .cc-topo .subtitulo { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; font-size: 9pt; color: #7a4520; margin-top: .5mm; }
  .cc-divisor { height: 1px; background: linear-gradient(90deg, transparent, #c49a6c, transparent); margin-bottom: 4mm; }

  .cc-itens { flex: 1; column-count: 2; column-gap: 6mm; }
  .cc-categoria-titulo {
    font-family: 'Caveat', cursive; font-weight: 700; font-size: 14pt; color: #2a1504;
    break-after: avoid-column; break-inside: avoid;
    margin: 3mm 0 1.5mm;
  }
  .cc-categoria-titulo:first-child { margin-top: 0; }
  .cc-item { break-inside: avoid; margin-bottom: 2.8mm; }
  .cc-item-linha1 { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; }
  .cc-item-nome { font-weight: 700; font-size: 9.5pt; color: #3d1f07; line-height: 1.25; }
  .cc-item-preco { font-weight: 800; font-size: 9pt; color: #7a4520; white-space: nowrap; }
  .cc-item-desc {
    font-size: 7.5pt; color: #8c7260; line-height: 1.3; margin-top: .4mm;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden;
  }
  .cc-item-selo {
    display: inline-block; font-size: 6pt; font-weight: 700; letter-spacing: .3px;
    text-transform: uppercase; color: #fff; background: #c8890a;
    padding: 1px 4px; border-radius: 999px; margin-left: 4px; vertical-align: middle;
  }

  .cc-rodape {
    margin-top: 4mm; border-radius: 8px; background: #f0e8d8;
    padding: 3.5mm 4mm; display: flex; align-items: center; gap: 4mm;
  }
  .cc-rodape-qr { width: 20mm; height: 20mm; flex-shrink: 0; background: #fff; border-radius: 4px; padding: 1.5mm; }
  .cc-rodape-qr svg { width: 100%; height: 100%; display: block; }
  .cc-rodape-texto { flex: 1; min-width: 0; }
  .cc-rodape-titulo { font-family: 'Caveat', cursive; font-weight: 700; font-size: 13pt; color: #2a1504; line-height: 1.15; }
  .cc-rodape-link { font-size: 7.5pt; color: #7a4520; word-break: break-all; margin-top: .5mm; }
  .cc-rodape-simples { margin-top: 4mm; text-align: center; }
  .cc-rodape-simples .msg { font-family: 'Caveat', cursive; font-weight: 700; font-size: 13pt; color: #7a4520; }
  .cc-rodape-simples .contato { font-size: 8pt; color: #8c7260; margin-top: 1mm; }
`

function renderItemCompacto(item) {
  return `
    <div class="cc-item">
      <div class="cc-item-linha1">
        <span class="cc-item-nome">${item.nome}${item.destaque ? '<span class="cc-item-selo">★ Mais pedido</span>' : ''}</span>
        <span class="cc-item-preco">${R$(item.preco)}</span>
      </div>
      ${item.descricao ? `<div class="cc-item-desc">${item.descricao}</div>` : ''}
    </div>`
}

function renderCategoriaCompacta(grupo) {
  return `
    <div class="cc-categoria-titulo">${grupo.categoria}</div>
    ${grupo.itens.map(renderItemCompacto).join('')}`
}

/** Monta o documento HTML do modelo "Resumo pra vender" (folha única, A5). */
function cardapioCompactoDocHtml({ config, grupos, empresa, linkOnline }) {
  const nome = config.nome_cardapio || empresa?.nome || 'Cardápio'
  const instaImpresso = normalizarInstagram(empresa?.instagram)
  const contato = [empresa?.contato_etiqueta || '', instaImpresso ? '@' + instaImpresso : ''].filter(Boolean).join(' · ')
  const svgQr = linkOnline ? gerarQrSvg(linkOnline, { cellSize: 4, margin: 2 }) : null

  const rodape = svgQr
    ? `
    <div class="cc-rodape">
      <div class="cc-rodape-qr">${svgQr}</div>
      <div class="cc-rodape-texto">
        <div class="cc-rodape-titulo">📱 Peça também pelo cardápio online</div>
        <div class="cc-rodape-link">${linkOnline}</div>
      </div>
    </div>`
    : `
    <div class="cc-rodape-simples">
      <div class="msg">${config.mensagem_rodape || ''}</div>
      ${contato ? `<div class="contato">${contato}</div>` : ''}
    </div>`

  return `
  <div class="cardapio-compacto">
    <div class="cc-topo">
      <div class="selo">${seloMarca(empresa)}</div>
      <div class="marca">${nome}</div>
      <div class="subtitulo">${config.subtitulo || ''}</div>
    </div>
    <div class="cc-divisor"></div>
    <div class="cc-itens">
      ${grupos.map(renderCategoriaCompacta).join('')}
    </div>
    ${rodape}
  </div>`
}

/**
 * Gera o PDF do modelo "Resumo pra vender": folha única A5, fundo branco,
 * 2 colunas, com QR code pro cardápio online no rodapé (quando publicado).
 * Mesma técnica das imagens pro WhatsApp (html2canvas + jsPDF), mas sempre A5 e
 * sempre 1 página só — não precisa escolher tamanho.
 */
export async function gerarPdfCardapioCompacto({ config, grupos, empresa, linkOnline }) {
  const [html2canvas, jsPDF] = await Promise.all([getHtml2Canvas(), getJsPDF()])

  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-9999px'
  wrapper.style.top = '0'
  wrapper.innerHTML = `<style>${CSS_CARDAPIO_COMPACTO}</style>${cardapioCompactoDocHtml({ config, grupos, empresa, linkOnline })}`
  document.body.appendChild(wrapper)
  await garantirFontesCarregadas()

  let canvas
  try {
    canvas = await html2canvas(wrapper.querySelector('.cardapio-compacto'), {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })
  } finally {
    document.body.removeChild(wrapper)
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  const pdf = new jsPDF('p', 'mm', 'a5')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const alturaImagemMm = (canvas.height * pageWidth) / canvas.width
  // Se o conteúdo (com muitos itens) acabar passando um pouco da folha,
  // encolhe pra caber inteiro numa página só — é sempre 1 folha, nunca 2.
  const escala = Math.min(1, pageHeight / alturaImagemMm)
  const larguraPdf = pageWidth * escala
  const alturaPdf = alturaImagemMm * escala
  const xOffset = (pageWidth - larguraPdf) / 2
  const yOffset = escala < 1 ? 0 : (pageHeight - alturaPdf) / 2

  pdf.addImage(imgData, 'JPEG', xOffset, yOffset, larguraPdf, alturaPdf)

  const nome = config.nome_cardapio || empresa?.nome || 'cardapio'
  const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  pdf.save(`${slug || 'cardapio'}-resumo.pdf`)
}

function iconeOuFoto(item) {
  return item.foto
    ? `<img src="${item.foto}" alt="">`
    : (item.emoji || '🍫')
}

/** Selo/logotipo de marca no topo do cardápio: usa o logotipo personalizado
 * (enviado em Ajustes) quando existe, ou cai pro emoji padrão. */
function seloMarca(empresa) {
  return empresa?.logo
    ? `<img src="${empresa.logo}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">`
    : '🍫'
}

/** Monta o texto do selo "Pedido mínimo" a partir de { valor, unidades } */
function labelMinimoCategoria(cfgMinimo) {
  if (!cfgMinimo) return ''
  const partes = []
  if (cfgMinimo.valor > 0) partes.push(R$(cfgMinimo.valor))
  if (cfgMinimo.unidades > 0) partes.push(`${cfgMinimo.unidades} un.`)
  return partes.join(' · ')
}

// ── Política de encomenda (antecedência / sinal) ───────────────────────────
// Vira uma caixa destacada no cardápio completo (PDF/tela cheia), uma linha
// curta no rodapé de cada foto do WhatsApp, e um "cartão" próprio no fim do
// álbum enviado — assim a regra chega ao cliente não importa qual formato
// ele acabe vendo ou reencaminhando.
function politicaLinhas(config) {
  const linhas = []
  const dias = Number(config?.antecedencia_dias || 0)
  if (dias > 0) {
    linhas.push(`📅 Encomendas com <b>${dias} dia${dias === 1 ? '' : 's'} de antecedência</b>.`)
  }
  if (config?.sinal_ativo && config?.sinal_texto) {
    linhas.push(`🔒 ${config.sinal_texto}`)
  }
  return linhas
}

async function getJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF
  if (!navigator.onLine) throw new Error('Sem conexão para gerar o PDF.')
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload = () => resolve(window.jspdf.jsPDF)
    script.onerror = () => reject(new Error('Não foi possível carregar o gerador de PDF.'))
    document.head.appendChild(script)
  })
}

// ── html2canvas sob demanda (mesmo padrão do pdfService.js) ──
async function getHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas
  if (!navigator.onLine) throw new Error('Sem conexão para gerar a imagem.')
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    script.onload = () => resolve(window.html2canvas)
    script.onerror = () => reject(new Error('Não foi possível carregar o gerador de imagem.'))
    document.head.appendChild(script)
  })
}

// Unificado com a identidade visual do resto do app (main.css): mesma dupla
// de fontes usada em todas as outras telas — Plus Jakarta Sans pro corpo,
// Caveat (manuscrita) pros títulos/destaques — em vez das serifadas
// Playfair Display / Cormorant Garamond que só o cardápio usava antes.
const GOOGLE_FONTS_URL = GOOGLE_FONTS_URL_CARDAPIO

// O CSS_CARDAPIO carrega essas fontes via @import — funciona bem na tela
// cheia/PDF (que tem tempo de sobra pra carregar antes da pessoa olhar), mas
// na captura de imagem (html2canvas) a fonte às vezes ainda não tinha
// terminado de carregar na hora da "foto", saindo com uma fonte substituta
// mal ajustada — o que deixava o texto espremido/ilegível. Injetando essas
// fontes como um <link> de verdade (não só @import dentro de um <style>
// criado na hora) e esperando o carregamento de cada uma explicitamente,
// garantimos que a captura sempre espera a fonte certa estar pronta. Como
// isso já é chamado assim que a aba Cardápio abre, na hora de compartilhar
// a fonte normalmente já está em cache — a espera fica quase instantânea.
let fontesPromise = null
export function garantirFontesCarregadas() {
  if (fontesPromise) return fontesPromise
  fontesPromise = new Promise((resolve) => {
    let link = document.querySelector(`link[href="${GOOGLE_FONTS_URL}"]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = GOOGLE_FONTS_URL
      link.onload = () => resolve()
      link.onerror = () => resolve() // não trava a geração se a fonte falhar — usa fallback
      document.head.appendChild(link)
    } else {
      resolve()
    }
  }).then(async () => {
    try {
      await Promise.all([
        document.fonts.load('700 30pt "Caveat"'),
        document.fonts.load('600 15pt "Caveat"'),
        document.fonts.load('700 12pt "Plus Jakarta Sans"'),
        document.fonts.load('800 12pt "Plus Jakarta Sans"'),
      ])
      await document.fonts.ready
    } catch { /* segue mesmo assim — melhor uma imagem com fonte de fallback do que travar */ }
  })
  return fontesPromise
}

// ── Cardápio interativo (cliente monta o próprio pedido) ──────────────────
// Gera um único arquivo .html autossuficiente (sem servidor, sem login, sem
// dependência de rede pra funcionar) com um "carrinho": o cliente ajusta as
// quantidades e, ao tocar em enviar, o próprio navegador dele monta a
// mensagem e abre o WhatsApp dele já endereçado pro número da loja — o
// pedido chega como uma mensagem normal, exatamente como se o cliente
// tivesse digitado na mão.

function apenasDigitos(v) {
  return String(v || '').replace(/\D/g, '')
}

/** Tenta extrair um telefone (a maior sequência de dígitos) de um texto livre —
 *  usado pra reaproveitar o contato que já existe (ex: nas etiquetas) sem
 *  pedir a mesma informação de novo. */
export function extrairTelefoneDeTexto(texto) {
  const digitos = String(texto || '').replace(/\D/g, '')
  return digitos.length >= 10 && digitos.length <= 13 ? digitos : ''
}

/** Normaliza o número pro formato exigido pelo link do WhatsApp (com DDI 55) */
export function numeroWhatsAppFormatado(bruto) {
  const digitos = apenasDigitos(bruto)
  if (!digitos) return ''
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : '55' + digitos
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CSS_PEDIDO = `
  :root {
    /* Unificado com as variáveis do design system do app (main.css) — mesmos
       tons de marrom/dourado usados em todas as outras telas. --terracota é
       o preenchimento sólido dos botões (mesmo marrom escuro do CTA
       principal do app, ex. "Enviar cardápio"); --terracota-escuro é o
       acento pra texto (preço, legendas) — mais marrom que dourado, pra não
       pesar a tela inteira pro amarelo. */
    --terracota: #3d1f07;
    --terracota-escuro: #7a4520;
    --terracota-claro: #c49a6c;
    --terracota-desc: #8c7260;
    --creme: #f7f3ee;
    --creme-fundo: #f0e8d8;
    --marrom: #3d1f07;
    --marrom-suave: #2a1504;
    --marrom-medio: #7a4520;
    --borda: #e8e0d4;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body { background: #faf6f0; color: var(--marrom); font-family: 'Plus Jakarta Sans', sans-serif; -webkit-font-smoothing: antialiased; }
  body { padding-bottom: 140px; }
  /* ── Capa: faixa de chocolate com a marca centralizada, filete dourado embaixo ── */
  .ip-capa { 
    display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 14px; text-align: left;
    padding: max(20px, env(safe-area-inset-top)) 20px 22px;
    background: radial-gradient(120% 170% at 0% 0%, #5a3016 0%, #3d1f07 55%, #2a1504 100%);
    border-bottom: none; border-radius: 0 0 28px 28px; box-shadow: 0 10px 28px rgba(42,21,4,.20);
   }
  .ip-capa .selo { width: 60px; height: 60px; flex-shrink: 0; border-radius: 50%; border: 2px solid rgba(240,194,94,.85); display: flex; align-items: center; justify-content: center; font-size: 28px; background: rgba(255,255,255,.08); overflow: hidden; }
  .ip-capa-texto { min-width: 0; flex: 1; text-align: left; }
  .ip-capa .marca { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 21px; line-height: 1.15; color: #fff; text-transform: uppercase; letter-spacing: .05em; overflow-wrap: anywhere; }
  .ip-capa-insta { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 5px 12px; border-radius: 999px; background: rgba(255,255,255,.14); color: #fff; font-size: 12.5px; font-weight: 700; text-decoration: none; letter-spacing: normal; }
  .ip-capa .subtitulo { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 11px; color: #f0c25e; text-transform: uppercase; letter-spacing: .16em; margin-top: 5px; line-height: 1.4; }

  /* ── Seção da categoria: banner com a imagem + título por cima, e os itens
     logo abaixo no mesmo cartão (estrutura de cardápio digital). O banner é o
     botão que abre/fecha a lista. ── */
  .categoria-bloco { 
    margin: 0 14px 14px; background: #fff; border-radius: 22px; overflow: hidden;
    border: 1px solid var(--borda); box-shadow: 0 6px 20px rgba(61,31,7,.07);
   }
  .ip-cat-nav + .categoria-bloco, .ip-capa + .categoria-bloco { margin-top: 16px; }
  .categoria-titulo { 
    position: relative; display: flex; align-items: flex-end; width: 100%; min-height: 84px; padding: 0; border: none; cursor: pointer;
    text-align: left; background: #3d1f07; overflow: hidden; color: #fff;
   }
  .categoria-capa-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .categoria-capa-fundo { 
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding-right: 64px;
    background: linear-gradient(135deg, #5a3016 0%, #3d1f07 60%, #2a1504 100%);
    font-size: 44px; opacity: .95;
   }
  .categoria-capa-fundo span { opacity: .28; filter: grayscale(.2); }
  .categoria-capa-veu { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,10,3,.88) 0%, rgba(20,10,3,.60) 55%, rgba(20,10,3,.28) 100%); }
  .categoria-capa-info { 
    position: relative; z-index: 1; padding: 14px 60px 14px 16px;
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
   }
  .categoria-titulo-texto { 
    font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 19px; line-height: 1.1;
    text-transform: uppercase; letter-spacing: .05em; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.45);
   }
  .categoria-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .categoria-contagem { 
    font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 12px; color: #fff;
    background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.32); border-radius: 999px; padding: 2px 10px; flex-shrink: 0;
   }
  .categoria-selecionados { 
    display: none; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 12px; color: #3d1f07;
    background: #f0c25e; border-radius: 999px; padding: 2px 10px; flex-shrink: 0;
   }
  .categoria-chevron { 
    position: absolute; right: 14px; top: 50%; margin-top: -16px; width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 14px; color: #fff;
    background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.4); transition: transform .2s ease; flex-shrink: 0;
   }
  .categoria-bloco.aberta .categoria-chevron { transform: rotate(180deg); }
  .categoria-itens { display: none; padding: 2px 0 6px; }
  .categoria-bloco.aberta .categoria-itens { display: block; }

  .ip-cat-nav { 
    position: sticky; top: 0; z-index: 15; display: flex; gap: 8px; overflow-x: auto;
    padding: 12px 16px; background: rgba(250,246,240,.94); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(232,224,212,.9); -webkit-overflow-scrolling: touch; scrollbar-width: none;
   }
  .ip-cat-nav::-webkit-scrollbar { display: none; }
  .ip-cat-chip { 
    flex-shrink: 0; display: inline-flex; align-items: center; min-height: 40px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14px;
    color: var(--marrom); background: #fff; border: 1.5px solid var(--borda); border-radius: 999px;
    padding: 0 16px; white-space: nowrap; transition: background .15s ease, color .15s ease;
   }
  .ip-cat-chip.ativo { background: var(--terracota); color: #fff; border-color: var(--terracota); }
  .categoria-selo-minimo {
    display: inline-block; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: none;
    letter-spacing: normal; font-weight: 700; font-size: 10pt; color: #fff;
    background: var(--terracota); border-radius: 999px; padding: 2px 10px;
    width: fit-content; flex-shrink: 0;
  }
  /* Selos ao lado do nome do item — "Mais pedido" (destaque escolhido pela
     loja) e "Sob encomenda" (item sem entrega na hora, precisa de prazo).
     Cores diferentes de propósito: destaque é neutro/informativo, sob
     encomenda usa o dourado de alerta pra chamar atenção antes da pessoa
     adicionar ao pedido achando que é retirada imediata. */
  .item-selo-destaque, .item-selo-encomenda {
    display: inline-flex; align-items: center; gap: 3px; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: none;
    letter-spacing: normal; font-weight: 700; font-size: 8.5pt; border-radius: 999px;
    padding: 1px 9px; vertical-align: middle; margin-left: 4px;
  }
  .item-selo-destaque {
    background: linear-gradient(135deg, #f0c25e, #c8890a); color: #fff; border: none;
    box-shadow: 0 1px 3px rgba(168,104,0,.35);
  }
  .item-selo-encomenda { background: #fdf0d5; color: #8a5a00; border: 1px solid #e8c179; }
  .categoria-titulo .categoria-selo-minimo { background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35); color: #fff; font-size: 12px; padding: 2px 10px; }
  .categoria-titulo .categoria-preco-unico { background: #f0c25e; border: none; color: #3d1f07; font-size: 12px; font-weight: 800; padding: 2px 10px; }

  /* ── Item: card branco sobre o fundo creme. Avatar fica no topo, alinhado
     com a primeira linha do corpo. Dentro do corpo: nome sozinho (livre pra
     quebrar linha em nomes longos, sem disputar espaço com mais nada),
     descrição opcional embaixo, e por último preço + contador juntos na
     mesma linha — ficam próximos um do outro, sem vão vazio, mas sem
     espremer o nome. ── */
  .ip-item { background: transparent; border-radius: 0; padding: 14px 16px; margin: 0; border-bottom: 1px solid #f1eadf; }
  .ip-item:last-child { border-bottom: none; }
  .ip-item-topo { display: flex; align-items: flex-start; gap: 12px; }
  .ip-item-avatar { width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; background: var(--creme-fundo); display: flex; align-items: center; justify-content: center; font-size: 22px; }
  .ip-item-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
  .ip-item-avatar--foto { cursor: pointer; position: relative; }
  .ip-item-avatar--foto::after {
    content: '⤢'; position: absolute; right: -4px; bottom: -4px; width: 20px; height: 20px;
    border-radius: 50%; background: var(--terracota); color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,.3); line-height: 1;
  }
  .ip-item-avatar--foto:active { opacity: .85; }
  .ip-item-corpo { flex: 1; min-width: 0; }
  .ip-item-linha1 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; }
  .ip-item-nome { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 13pt; color: var(--marrom); }
  .ip-item-desc {
    font-size: 10pt; color: var(--terracota-desc); font-style: normal; margin-top: 3px; line-height: 1.4;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  }
  .ip-item-desc.expandido { -webkit-line-clamp: unset; overflow: visible; }
  .ip-item-ler-mais { display: none; font-size: 10pt; font-weight: 600; color: var(--terracota); margin-top: 2px; cursor: pointer; }
  .ip-item-preco-linha { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
  .ip-item-preco { font-weight: 800; font-size: 12pt; color: var(--terracota-escuro); white-space: nowrap; }

  .ip-qtd { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .ip-qtd-btn { 
    width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--terracota-claro);
    background: transparent; color: var(--terracota); font-size: 19px; font-weight: 700; line-height: 1;
    flex-shrink: 0; touch-action: manipulation;
   }
  .ip-qtd-btn:active { background: var(--creme-fundo); }
  .ip-qtd-btn:last-child { background: var(--terracota); border-color: var(--terracota); color: #fff; }
  .ip-qtd-btn:last-child:active { background: #2a1504; }
  /* Campo de quantidade: input de verdade (não span) — toca e já pode
     digitar o número direto, sem precisar ficar batendo no + várias vezes.
     -moz-appearance/-webkit-appearance somem com as setinhas nativas de
     number, e o font-size 16px evita o zoom automático do Safari ao focar. */
  .ip-qtd-valor { 
    width: 36px; height: 36px; min-width: 36px; text-align: center; font-weight: 800; font-size: 16px;
    color: var(--marrom); border: 1.5px solid transparent; border-radius: 10px; background: transparent;
    font-family: 'Plus Jakarta Sans', sans-serif; padding: 0; -moz-appearance: textfield; appearance: textfield;
   }
  .ip-qtd-valor::-webkit-outer-spin-button, .ip-qtd-valor::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .ip-qtd-valor:focus { outline: none; border-color: var(--terracota); background: var(--creme-fundo); }
  /* Quantidade 0: só um botão "+ Adicionar". O contador − N + aparece depois
     da primeira adição (classe .tem-qtd, ver sincronizarQtdUI). */
  .ip-qtd-add-txt { display: none; font-size: 14px; font-weight: 700; margin-left: 4px; }
  .ip-qtd:not(.tem-qtd) .ip-qtd-btn:first-child,
  .ip-qtd:not(.tem-qtd) .ip-qtd-valor { display: none; }
  .ip-qtd:not(.tem-qtd) .ip-qtd-btn:last-child { width: auto; height: 40px; padding: 0 16px; border-radius: 999px; font-size: 16px; }
  .ip-qtd:not(.tem-qtd) .ip-qtd-add-txt { display: inline; }

  /* Categoria com preço único: preço no título + linhas compactas por sabor. */
  .categoria-preco-unico {
    font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 10pt; color: var(--terracota-escuro);
    background: var(--creme-fundo); border: 1px solid var(--terracota-claro); border-radius: 999px;
    padding: 2px 10px; flex-shrink: 0;
  }
  .ip-item--compacto { padding: 13px 16px; margin: 0; }
  .ip-item--compacto .ip-item-topo { align-items: center; gap: 10px; }
  .ip-item--compacto .ip-item-avatar { width: 40px; height: 40px; font-size: 18px; }
  .ip-item--compacto .ip-item-corpo { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ip-item--compacto .ip-item-info { flex: 1; min-width: 0; }
  .ip-item--compacto .ip-item-nome { font-size: 11.5pt; font-weight: 700; line-height: 1.3; }
  .ip-item--compacto.tem-desc .ip-item-info { cursor: pointer; }
  .ip-item--compacto.tem-desc .ip-item-nome::before { content: '▸ '; font-size: 10px; color: var(--terracota-claro); }
  .ip-item--compacto.tem-desc.desc-aberta .ip-item-nome::before { content: '▾ '; }
  .ip-item--compacto .ip-item-nome { font-size: 11.5pt; font-weight: 700; }
  .ip-item--compacto .ip-item-meta { margin-top: 3px; font-size: 10pt; color: var(--terracota-desc); line-height: 1.35; }
  .ip-item--compacto .ip-item-preco { font-weight: 800; color: var(--terracota-escuro); font-size: 11pt; }
  .ip-item--compacto .ip-item-encomenda { font-weight: 500; }
  .ip-item--compacto .item-selo-destaque {
    background: none; box-shadow: none; border: none; padding: 0; margin-left: 5px;
    color: #c8890a; font-size: 12pt; line-height: 1;
  }
  .ip-item--compacto .ip-item-desc { display: none; }
  .ip-item--compacto.desc-aberta .ip-item-desc { display: block; -webkit-line-clamp: unset; overflow: visible; }

  .ip-politica { margin: 8px 14px 0; border: 1px solid var(--borda); border-radius: 20px; padding: 16px; background: #fff; box-shadow: 0 6px 20px rgba(61,31,7,.06); }
  .ip-politica--alerta { border-color: #c0463a; background: #fbe7e3; }
  .ip-politica-titulo { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 14px; color: var(--terracota-escuro); text-transform: none; letter-spacing: 0; margin-bottom: 8px; }
  .ip-politica--alerta .ip-politica-titulo { color: #a5372c; }
  .ip-politica-linha { font-size: 10.5pt; color: var(--marrom-medio); line-height: 1.55; margin-top: 6px; }
  .ip-politica-linha:first-of-type { margin-top: 0; }
  .ip-politica-linha b { color: var(--marrom); }

  .ip-barra { 
    position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 20;
    background: #fff; border: 1px solid var(--borda); border-radius: 24px; box-shadow: 0 12px 32px rgba(42,21,4,.20);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
   }
  .ip-barra-linha { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ip-aviso-minimo { font-size: 12.5px; line-height: 1.4; color: #a5372c; background: #fbe7e3; border: 1px solid #eab7ac; border-radius: 12px; padding: 8px 12px; }
  .ip-aviso-minimo b { color: #8f2c22; }
  .ip-barra-info { font-size: 13.5px; font-weight: 600; color: var(--marrom-medio); line-height: 1.25; }
  .ip-barra-info strong { display: block; font-size: 20px; color: var(--terracota-escuro); font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; }
  .ip-btn-enviar { flex-shrink: 0; background: var(--terracota); color: #fff; font-weight: 800; font-size: 16px; border: none; border-radius: 16px; padding: 14px 22px; }
  .ip-btn-enviar:disabled { opacity: .4; }

  .ip-modal-overlay {
    position: fixed; inset: 0; background: rgba(62,43,35,.45); z-index: 200;
    display: flex; align-items: flex-end; justify-content: center;
  }
  .ip-modal-card { 
    width: 100%; max-width: 480px; max-height: 86vh; overflow-y: auto;
    background: #fffdf9; border: 1px solid var(--borda); border-bottom: none;
    border-radius: 26px 26px 0 0; padding: 14px 18px calc(18px + env(safe-area-inset-bottom));
   }
  .ip-modal-card::before { content: ''; display: block; width: 44px; height: 4px; border-radius: 2px; background: #e4dacb; margin: 0 auto 16px; }
  .ip-modal-titulo { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 21px; line-height: 1.2; color: var(--marrom-suave); text-align: center; margin-bottom: 16px; }

  /* ── Lightbox da foto do item: toque no avatar (marcado com o selo ⤢)
       abre a foto ampliada, centralizada, com nome e preço embaixo — pra
       dar pra ver detalhe de verdade, sem depender do avatar minúsculo. ── */
  .ip-foto-overlay {
    position: fixed; inset: 0; background: rgba(20,12,8,.82); z-index: 300;
    display: flex; align-items: center; justify-content: center; padding: 22px;
  }
  .ip-foto-card {
    position: relative; width: 100%; max-width: 420px;
    background: var(--creme); border-radius: 16px; overflow: hidden;
  }
  .ip-foto-card img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; }
  .ip-foto-fechar {
    position: absolute; top: 10px; right: 10px; z-index: 1; width: 32px; height: 32px;
    border-radius: 50%; border: none; background: rgba(0,0,0,.45); color: #fff; font-size: 15px;
    display: flex; align-items: center; justify-content: center;
  }
  .ip-foto-legenda { padding: 14px 18px calc(14px + env(safe-area-inset-bottom)); text-align: center; }
  .ip-foto-nome { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14pt; color: var(--marrom); }
  .ip-foto-preco { font-weight: 800; font-size: 12pt; color: var(--terracota-escuro); margin-top: 4px; }
  .ip-modal-itens { border-top: 1px solid var(--borda); }
  .ip-modal-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14.5px; color: var(--marrom); padding: 9px 0; border-bottom: 1px dashed var(--borda); }
  .ip-modal-total { display: flex; align-items: baseline; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--borda); }
  .ip-modal-total span { font-size: 15px; font-weight: 700; color: var(--marrom-medio); text-transform: none; letter-spacing: 0; }
  .ip-modal-total strong { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 19pt; color: var(--terracota-escuro); }
  .ip-modal-politica { margin-top: 14px; font-size: 11.5pt; color: var(--marrom-medio); line-height: 1.55; white-space: pre-line; background: var(--creme-fundo); border: 1px solid var(--terracota-claro); border-radius: 14px; padding: 10px 12px; }
  .ip-modal-acoes { display: flex; gap: 10px; margin-top: 18px; }
  .ip-modal-btn { flex: 1; border-radius: 16px; padding: 15px 14px; font-weight: 800; font-size: 15px; }
  .ip-modal-btn--voltar { background: transparent; border: 1px solid var(--terracota-claro); color: var(--terracota); }
  .ip-modal-btn--confirmar { background: var(--terracota); border: none; color: #fff; }
  /* Botão que realmente abre o WhatsApp: verde, pra ficar óbvio o que acontece ao tocar. */
  .ip-modal-btn--whatsapp { background: #178a45; flex: 1.5; white-space: nowrap; }
  .ip-modal-btn--whatsapp:active { background: #0f6e36; }

  .ip-modal-pix { margin-top: 16px; background: #fff; border: 1.5px solid var(--borda); border-radius: 18px; padding: 16px; }
  .ip-modal-pix-titulo { font-size: 12.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--terracota-escuro); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .ip-modal-pix-linha { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .ip-modal-pix-linha span { font-size: 13.5px; color: var(--marrom); }
  .ip-modal-pix-linha strong { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 16pt; color: var(--terracota-escuro); }
  .ip-modal-pix-restante { font-size: 13px; color: var(--marrom-medio); margin-top: 4px; }
  .ip-modal-pix-restante b { color: var(--marrom); }
  .ip-modal-pix-codigo {
    width: 100%; margin-top: 10px; resize: none; height: 62px; font-size: 11px; line-height: 1.4;
    font-family: monospace; color: var(--marrom-medio); background: #fff; border: 1px dashed var(--terracota-claro);
    border-radius: 8px; padding: 8px; word-break: break-all;
  }
  .ip-modal-btn--pix { width: 100%; margin-top: 8px; background: #fff; border: 1.5px solid var(--terracota); color: var(--terracota); }
  .ip-modal-btn--pix.copiado { background: var(--terracota); color: #fff; border-color: var(--terracota); }
  .ip-modal-pix-conta { font-size: 13px; color: var(--marrom); margin-top: 6px; }
  .ip-modal-pix-conta b { color: var(--terracota-escuro); }
  .ip-modal-pix-dica { font-size: 11px; color: var(--terracota-desc); margin-top: 8px; text-align: center; }
  .ip-modal-pix-qr {
    display: flex; justify-content: center; align-items: center; margin-top: 10px;
    background: #fff; border: 1px solid var(--terracota-claro); border-radius: 8px; padding: 12px;
  }
  .ip-modal-pix-qr svg { width: 180px; height: 180px; }
  .ip-modal-pix-qr-legenda { font-size: 11px; color: var(--terracota-desc); text-align: center; margin-top: 4px; }

  .ip-modal-cliente { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
  .ip-modal-cliente-hint { font-size: 12px; color: var(--marrom-medio); background: var(--creme-fundo); border-radius: 8px; padding: 8px 10px; }
  .ip-modal-cliente-hint--obrigatorio { color: var(--terracota-escuro); background: var(--creme-fundo); border: 1px solid var(--terracota-claro); font-weight: 600; }
  .ip-modal-cliente-campo { display: flex; flex-direction: column; gap: 4px; }
  .ip-modal-entrega { margin: 14px 0 4px; background: var(--creme-fundo); border: 1.5px dashed var(--terracota-claro); border-radius: 14px; padding: 12px 14px; }
  .ip-modal-entrega-check { display: flex; align-items: center; gap: 10px; font-size: 14.5px; font-weight: 700; color: var(--marrom); cursor: pointer; user-select: none; }
  .ip-modal-entrega-check input[type="checkbox"] { width: 21px; height: 21px; accent-color: var(--terracota); cursor: pointer; flex-shrink: 0; }
  .ip-modal-cliente-campo span { font-size: 12.5px; font-weight: 700; color: var(--marrom-medio); text-transform: none; letter-spacing: 0; }
  .ip-modal-cliente-campo input {
    background: #fff; border: 1.5px solid var(--borda); border-radius: 12px;
    padding: 13px 14px; font-size: 16px; color: var(--marrom); font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .ip-modal-cliente-campo input::placeholder { color: #B0977E; }

  .ip-modal-sucesso { display: none; flex-direction: column; align-items: center; text-align: center; padding: 36px 12px; }
  .ip-modal-sucesso-check { font-size: 42px; margin-bottom: 10px; }
  .ip-modal-sucesso-texto { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; color: var(--marrom-suave); font-weight: 800; }
  .ip-modal-sucesso-sub { font-size: 14px; color: var(--marrom-medio); margin-top: 6px; line-height: 1.4; }
  .ip-modal-instrucao { display: none; flex-direction: column; align-items: center; text-align: center; padding: 20px 6px 4px; }
  .ip-modal-instrucao-seta { font-size: 58px; line-height: 1; animation: cbApontarSeta 1.1s ease-in-out infinite; }
  @keyframes cbApontarSeta { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(10px); } }
  .ip-modal-instrucao-titulo { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; color: var(--marrom-suave); font-weight: 800; margin-top: 4px; line-height: 1.2; }
  .ip-modal-instrucao-texto { font-size: 14.5px; color: var(--marrom); margin-top: 8px; line-height: 1.55; }
  .ip-modal-instrucao-destaque { display: inline-block; background: #25D366; color: #fff; font-weight: 800; padding: 10px 18px; border-radius: 999px; margin-top: 14px; font-size: 14.5px; }
  .ip-modal-instrucao-acoes { display: flex; gap: 10px; margin-top: 22px; width: 100%; }
  .ip-checagem-banner { display: none; position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 9999; background: #fff; border: 1.5px solid var(--terracota); border-radius: 16px; padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
  .ip-checagem-texto { font-size: 14.5px; color: var(--marrom); font-weight: 700; margin-bottom: 12px; text-align: center; }
  .ip-checagem-acoes { display: flex; gap: 10px; }
  .ip-checagem-btn { flex: 1; border-radius: 999px; padding: 12px; font-weight: 700; font-size: 14px; border: none; }
  .ip-checagem-btn--sim { background: var(--terracota); color: #fff; }
  .ip-checagem-btn--nao { background: #fff; border: 1.5px solid var(--terracota); color: var(--terracota); }

  /* ── Fluxo "Como você vai receber?" (retirada/entrega) — só existe no
       cardápio Dia a dia, cliente final. Cada etapa é um bloco dentro do
       mesmo modal; só uma fica visível por vez. ── */
  .ip-opcoes { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .ip-opcao { 
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;
    width: 100%; background: #fff; border: 1.5px solid var(--borda); border-radius: 18px; padding: 16px 18px;
   }
  .ip-opcao:active { background: var(--creme-fundo); border-color: var(--terracota); }
  .ip-opcao-titulo { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 16px; color: var(--marrom); }
  .ip-opcao-desc { font-size: 13px; color: var(--terracota-desc); }

  .ip-endereco-form { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .ip-endereco-erro { font-size: 12.5px; color: #a5372c; background: #fbe7e3; border: 1px solid #eab7ac; border-radius: 8px; padding: 8px 10px; margin-top: 10px; }
  .ip-modal-cliente-campo input.ip-input-erro { border-color: #c0463a; background: #fbe7e3; }

  .ip-modal-total--sub { margin-top: 6px; padding-top: 0; border-top: none; }
  .ip-modal-total--sub span { font-size: 13px; }
  .ip-modal-total--sub strong { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 14pt; color: var(--marrom); }

  .ip-revisao-resumo { margin-top: 16px; display: flex; flex-direction: column; border-top: 1px solid var(--borda); }
  .ip-revisao-linha {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
    background: none; border: none; border-bottom: 1px dashed var(--borda); padding: 11px 0; text-align: left;
  }
  .ip-revisao-linha--estatico { cursor: default; }
  .ip-revisao-linha-label { font-size: 11px; color: var(--terracota-desc); text-transform: uppercase; letter-spacing: .4px; flex-shrink: 0; }
  .ip-revisao-linha-valor { font-size: 13.5px; color: var(--marrom); font-weight: 600; flex: 1; text-align: right; margin: 0 8px; }
  .ip-revisao-linha-trocar { font-size: 11px; color: var(--terracota); font-weight: 700; flex-shrink: 0; }

  .ip-modal-pagamento-posterior {
    margin-top: 16px; background: var(--creme-fundo); border: 1.5px solid var(--terracota-claro);
    border-radius: 12px; padding: 14px; text-align: center;
  }
  .ip-modal-pagamento-posterior .ip-modal-pix-titulo { justify-content: center; margin-bottom: 4px; }
  .ip-modal-pagamento-posterior-sub { font-size: 12.5px; color: var(--terracota-desc); }
`

/**
 * Gera o HTML autossuficiente do cardápio interativo: o cliente ajusta as
 * quantidades e o botão "Enviar pedido" abre o WhatsApp dele com a mensagem
 * já pronta, endereçada pro número da loja (empresa.whatsapp_pedidos).
 * Nada disso depende de internet, servidor ou conta — só do WhatsApp já
 * instalado no celular de quem for pedir.
 */
export function gerarHtmlPedidoInterativo({ config, grupos, empresa, modoBalcao = false, cardapioId = '' }) {
  const nome = config.nome_cardapio || empresa?.nome || 'Cardápio'
  const numero = numeroWhatsAppFormatado(empresa?.whatsapp_pedidos)
  const itensGlobais = grupos.flatMap(g => g.itens)

  // Pix: a chave é sempre o mesmo número do WhatsApp de pedidos (tipo
  // telefone) — sem cadastro extra nenhum. Se o número não estiver
  // configurado, o bloco de Pix simplesmente não aparece pro cliente (mesma
  // condição do aviso de WhatsApp não configurado, logo abaixo).
  const chavePix = chavePixDoWhatsapp(empresa?.whatsapp_pedidos)
  const nomeRecebedorPix = limparTextoPix(nome, 25, 'LOJA')
  // Nome do titular da conta Pix (Ajustes > Identidade > Razão Social). Aparece pro
  // cliente no bloco de Pix pra ele reconhecer o nome na hora de pagar.
  const razaoSocialPix = String(empresa?.razao_social || '').trim()
  const htmlContaPix = razaoSocialPix
    ? `<div class="ip-modal-pix-conta">Conta em nome de: <b>${escHtml(razaoSocialPix)}</b></div>`
    : ''
  const cidadeRecebedorPix = limparTextoPix(empresa?.municipio, 15, 'BRASIL')
  const sinalAtivo = !!config.sinal_ativo
  const sinalFracao = Math.min(1, Math.max(0, Number(config.sinal_percentual || 0) / 100))
  const pagamentoAtivo = modoBalcao || config.pagamento_ativo !== false

  // ── Fluxo novo de recebimento — cliente final (não modo balcão), nos dois
  // cardápios:
  //   • Dia a dia: cliente escolhe Retirar ou Receber em casa; taxa de
  //     entrega é o valor fixo configurado (0 = "a combinar").
  //   • Festa: toda encomenda é entrega (não existe retirada de festa), e a
  //     taxa depende do caso a caso — por isso NUNCA tem valor fixo aqui,
  //     sempre "a combinar" no WhatsApp.
  // Modo balcão continua 100% com o fluxo antigo, sem nenhuma dessas telas. ──
  const novoFluxoAtivo = (cardapioId === 'diaadia' || cardapioId === 'festa') && !modoBalcao && pagamentoAtivo
  const comEscolhaRecebimento = novoFluxoAtivo && cardapioId === 'diaadia'
  const taxaEntrega = cardapioId === 'diaadia' ? Number(config.taxa_entrega || 0) : 0
  const textoBotaoRevisar = novoFluxoAtivo ? 'Revisar pedido' : 'Confirmar pedido'

  const dadosJs = itensGlobais.map(i => ({ nome: i.nome, preco: Number(i.preco || 0), categoria: i.categoria }))
  const dadosJsonSeguro = JSON.stringify(dadosJs).replace(/</g, '\\u003c')

  // Pedido mínimo por categoria (ex: "Festa" precisa de um mínimo em R$ pra
  // compensar o tempo/insumos — já os itens do dia a dia não têm mínimo).
  const minimosPorCategoria = {}
  for (const g of grupos) {
    const cfgMinimo = config?.categorias_min?.[g.categoria]
    const valor = Number(cfgMinimo?.valor || 0)
    const unidades = Number(cfgMinimo?.unidades || 0)
    if (valor > 0 || unidades > 0) minimosPorCategoria[g.categoria] = { valor, unidades }
  }
  const minimosJsonSeguro = JSON.stringify(minimosPorCategoria).replace(/</g, '\\u003c')

  const linhasPolitica = politicaLinhas(config)
  const politicaHtml = linhasPolitica.length ? `
    <div class="ip-politica">
      <div class="ip-politica-titulo">📋 Como funciona a encomenda</div>
      ${linhasPolitica.map(l => `<div class="ip-politica-linha">${l}</div>`).join('')}
    </div>` : ''
  // Mesmo texto, sem as tags <b> — vai dentro da mensagem de texto puro do WhatsApp
  const politicaTextoPlano = linhasPolitica.map(l => l.replace(/<\/?b>/g, '')).join('\n')

  const avisoSemNumero = !numero ? `
    <div class="ip-politica ip-politica--alerta">
      <div class="ip-politica-titulo">⚠️ Número não configurado</div>
      <div class="ip-politica-linha">Este arquivo ainda não tem o WhatsApp da loja configurado — peça pra loja gerar de novo antes de enviar o pedido.</div>
    </div>` : ''

  const chipsNavHtml = grupos.length > 1 ? `
  <div class="ip-cat-nav" id="ip-cat-nav">
    ${grupos.map((g, i) => `<button type="button" class="ip-cat-chip" id="ip-chip-${i}" onclick="irParaCategoria(${i})">${escHtml(g.categoria)}</button>`).join('')}
  </div>` : ''

  const gruposHtml = grupos.map((g, catIdx) => {
    const minimo = minimosPorCategoria[g.categoria]
    const selo = minimo ? `<span class="categoria-selo-minimo">💰 Pedido mínimo: ${labelMinimoCategoria(minimo)}</span>` : ''
    // Preço único na categoria (3+ itens, todos com o mesmo valor): o preço vai
    // no título e cada sabor vira uma linha compacta (só nome + botão).
    // Preço-base da categoria = o preço mais comum, quando é maioria (3+ itens). Vai no título
    // ("R$ 7,00 cada") e só os itens com preço diferente mostram o próprio preço.
    const contagemPrecos = new Map()
    g.itens.forEach(it => contagemPrecos.set(Number(it.preco), (contagemPrecos.get(Number(it.preco)) || 0) + 1))
    let precoBase = null, maiorQtd = 0
    contagemPrecos.forEach((qtd, preco) => { if (qtd > maiorQtd) { precoBase = preco; maiorQtd = qtd } })
    if (g.itens.length < 3 || maiorQtd * 2 <= g.itens.length) precoBase = null
    const precoUnico = precoBase !== null ? `<span class="categoria-preco-unico">${R$(precoBase)} cada</span>` : ''
    // Imagem do banner: a escolhida pra categoria; senão a foto do primeiro item que tiver foto.
    const capaImg = config?.categorias_img?.[g.categoria] || g.itens.find(it => it.foto)?.foto || ''
    return `
    <div class="categoria-bloco${catIdx === 0 ? ' aberta' : ''}" id="ip-cat-${catIdx}">
      <button type="button" class="categoria-titulo" onclick="toggleCategoria(${catIdx})">
        ${capaImg
          ? `<img class="categoria-capa-img" src="${capaImg}" alt="">`
          : `<span class="categoria-capa-fundo"><span>${escHtml(g.itens[0]?.emoji || '🍫')}</span></span>`}
        <span class="categoria-capa-veu"></span>
        <span class="categoria-capa-info">
          <span class="categoria-titulo-texto">${escHtml(g.categoria)}</span>
          <span class="categoria-meta">
            <span class="categoria-contagem">${g.itens.length} ${g.itens.length === 1 ? 'item' : 'itens'}</span>
            <span class="categoria-selecionados" id="ip-cat-selecionados-${catIdx}"></span>
            ${precoUnico}
            ${selo}
          </span>
        </span>
        <span class="categoria-chevron">▾</span>
      </button>
      <div class="categoria-itens" id="ip-cat-itens-${catIdx}">
      ${g.itens.map(item => {
        const idx = itensGlobais.indexOf(item)
        const qtdHtml = `
                <div class="ip-qtd">
                  <button type="button" class="ip-qtd-btn" onclick="alterarQtd(${idx}, -1)">−</button>
                  <input type="tel" inputmode="numeric" pattern="[0-9]*" class="ip-qtd-valor" id="qtd-${idx}" value="0"
                    onfocus="this.select()" oninput="digitarQtd(this, ${idx})" onblur="finalizarQtd(this, ${idx})"
                    onkeydown="if(event.key==='Enter'){this.blur();}">
                  <button type="button" class="ip-qtd-btn" onclick="alterarQtd(${idx}, 1)">+<span class="ip-qtd-add-txt">Adicionar</span></button>
                </div>
        `
        // Todos os itens seguem o mesmo layout enxuto: sem imagem por unidade (a categoria
        // já tem a capa), descrição recolhida (toca no nome pra abrir) e no máximo UMA linha
        // de detalhes sob o nome: preço (só quando foge do preço-base) · aviso de encomenda.
        const mostrarPreco = precoBase === null || Number(item.preco) !== precoBase
        const detalhes = [
          mostrarPreco ? `<span class="ip-item-preco">${R$(item.preco)}</span>` : '',
          item.sobEncomenda ? '<span class="ip-item-encomenda">🕒 sob encomenda</span>' : ''
        ].filter(Boolean)
        return `
        <div class="ip-item ip-item--compacto${item.descricao ? ' tem-desc' : ''}">
          <div class="ip-item-topo">
            <div class="ip-item-corpo">
              <div class="ip-item-info"${item.descricao ? ' onclick="this.closest(\'.ip-item\').classList.toggle(\'desc-aberta\')"' : ''}>
                <div class="ip-item-linha1">
                <span class="ip-item-nome">${escHtml(item.nome)}${item.destaque ? '<span class="item-selo-destaque" title="Mais pedido" aria-label="Mais pedido">★</span>' : ''}</span>
                </div>
                ${detalhes.length ? `<div class="ip-item-meta">${detalhes.join('<span class="ip-item-meta-sep"> · </span>')}</div>` : ''}
                ${item.descricao ? `<div class="ip-item-desc">${escHtml(item.descricao)}</div>` : ''}
              </div>
              ${qtdHtml}
            </div>
          </div>
        </div>`
      }).join('')}
      </div>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(nome)} — Monte seu pedido</title>
<!-- Fonte carregada sem travar a 1ª renderização: o CSS_PEDIDO usava
     @import (que segura a tela em branco até a fonte terminar de baixar —
     ruim com rede lenta/instável, ex. wifi da loja). O truque
     media="print" faz o navegador não esperar por este <link> pra pintar
     a tela; assim que carrega, o onload troca pra media="all" e a fonte
     "encaixa" por cima do texto que já apareceu com a fonte de reserva
     (Plus Jakarta Sans/Caveat têm fallback genérico no CSS abaixo). Se a
     rede falhar, o cardápio simplesmente fica com a fonte de reserva —
     nunca mais em branco esperando. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${GOOGLE_FONTS_URL}" media="print" onload="this.media='all'">
<style>${CSS_PEDIDO}</style>
</head>
<body>
  ${!modoBalcao ? `
  <div class="ip-capa">
    <div class="selo">${seloMarca(empresa)}</div>
    <div class="ip-capa-texto">
      <div class="marca">${escHtml(nome)}</div>
      <div class="subtitulo">${escHtml(config.subtitulo || '')}</div>
      ${normalizarInstagram(empresa?.instagram) ? `<a class="ip-capa-insta" href="${urlInstagram(empresa.instagram)}" target="_blank" rel="noopener">📷 @${normalizarInstagram(empresa.instagram)}</a>` : ''}
    </div>
  </div>` : ''}

  ${chipsNavHtml}
  ${avisoSemNumero}
  ${gruposHtml}
  ${politicaHtml}

  <div class="ip-barra">
    <div id="ip-aviso-minimo" class="ip-aviso-minimo" style="display:none;"></div>
    <div class="ip-barra-linha">
      <div class="ip-barra-info">
        <span id="ip-contador">0</span> <span id="ip-contador-rotulo">itens</span>
        <strong id="ip-total">R$ 0,00</strong>
      </div>
      <button type="button" class="ip-btn-enviar" id="ip-btn-enviar" disabled onclick="abrirConfirmacao()">${textoBotaoRevisar}</button>
    </div>
  </div>

  <div id="ip-modal-overlay" class="ip-modal-overlay" style="display:none;" onclick="if (event.target === this) fecharConfirmacao()">
    <div class="ip-modal-card">
      ${novoFluxoAtivo ? `
      <div id="ip-modal-conteudo">
        ${comEscolhaRecebimento ? `
        <div id="ip-etapa-recebimento" class="ip-etapa">
          <div class="ip-modal-titulo">Como você vai receber?</div>
          <div class="ip-opcoes">
            <button type="button" class="ip-opcao" onclick="escolherRecebimento('retirada')">
              <span class="ip-opcao-titulo">📦 Retirar</span>
              <span class="ip-opcao-desc">Você busca o pedido com a gente</span>
            </button>
            <button type="button" class="ip-opcao" onclick="escolherRecebimento('entrega')">
              <span class="ip-opcao-titulo">🛵 Receber em casa</span>
              <span class="ip-opcao-desc">A gente leva até você</span>
            </button>
          </div>
          <div class="ip-modal-acoes">
            <button type="button" class="ip-modal-btn ip-modal-btn--voltar" onclick="fecharConfirmacao()">Voltar</button>
          </div>
        </div>

        <div id="ip-etapa-pagamento" class="ip-etapa" style="display:none;">
          <div class="ip-modal-titulo">Como deseja pagar?</div>
          <div class="ip-opcoes">
            <button type="button" class="ip-opcao" onclick="escolherPagamento('pix')">
              <span class="ip-opcao-titulo">💳 Pix agora</span>
              <span class="ip-opcao-desc">Pague na hora e mande o comprovante</span>
            </button>
            <button type="button" class="ip-opcao" onclick="escolherPagamento('depois')">
              <span class="ip-opcao-titulo">🕒 Pagar depois</span>
              <span class="ip-opcao-desc">Combine o pagamento na retirada</span>
            </button>
          </div>
          <div class="ip-modal-acoes">
            <button type="button" class="ip-modal-btn ip-modal-btn--voltar" onclick="irParaEtapa('recebimento')">◀ Voltar</button>
          </div>
        </div>` : ''}

        <div id="ip-etapa-endereco" class="ip-etapa" style="display:none;">
          <div class="ip-modal-titulo">Endereço de entrega</div>
          <div class="ip-endereco-form">
            <label class="ip-modal-cliente-campo"><span>Nome</span><input id="ip-end-nome" type="text" placeholder="Seu nome completo" autocomplete="name"></label>
            <label class="ip-modal-cliente-campo"><span>Endereço</span><input id="ip-end-rua" type="text" placeholder="Rua, avenida..." autocomplete="address-line1"></label>

            <label class="ip-modal-cliente-campo"><span>Número</span><input id="ip-end-numero" type="text" placeholder="Nº" autocomplete="off"></label>
            <label class="ip-modal-cliente-campo"><span>Complemento (se necessário)</span><input id="ip-end-complemento" type="text" placeholder="Apto, bloco... (opcional)" autocomplete="address-line2"></label>
            <label class="ip-modal-cliente-campo"><span>Bairro</span><input id="ip-end-bairro" type="text" placeholder="Bairro" autocomplete="off"></label>
            <label class="ip-modal-cliente-campo"><span>Ponto de referência (se necessário)</span><input id="ip-end-referencia" type="text" placeholder="Perto de... (opcional)" autocomplete="off"></label>
          </div>
          <div id="ip-endereco-erro" class="ip-endereco-erro" style="display:none;"></div>
          <div class="ip-modal-acoes">
            <button type="button" class="ip-modal-btn ip-modal-btn--voltar" onclick="voltarDoEndereco()">◀ Voltar</button>
            <button type="button" class="ip-modal-btn ip-modal-btn--confirmar" onclick="confirmarEndereco()">Continuar</button>
          </div>
        </div>

        <div id="ip-etapa-revisao" class="ip-etapa" style="display:none;">
          <div class="ip-modal-titulo">Seu pedido</div>
          <div id="ip-modal-itens" class="ip-modal-itens"></div>
          <div id="ip-revisao-produtos-linha" class="ip-modal-total ip-modal-total--sub" style="display:none;">
            <span>Produtos</span>
            <strong id="ip-revisao-produtos-valor">R$ 0,00</strong>
          </div>
          <div id="ip-revisao-entrega-linha" class="ip-modal-total ip-modal-total--sub" style="display:none;">
            <span>Entrega</span>
            <strong id="ip-revisao-entrega-valor">R$ 0,00</strong>
          </div>
          <div class="ip-modal-total">
            <span>Total</span>
            <strong id="ip-modal-total-valor">R$ 0,00</strong>
          </div>

          <div class="ip-revisao-resumo">
            <button type="button" class="ip-revisao-linha" id="ip-revisao-recebimento-btn" onclick="irParaEtapa('recebimento')">
              <span class="ip-revisao-linha-label">Recebimento</span>
              <span class="ip-revisao-linha-valor" id="ip-revisao-recebimento">—</span>
              <span class="ip-revisao-linha-trocar" id="ip-revisao-recebimento-trocar">trocar</span>
            </button>
            <button type="button" class="ip-revisao-linha" id="ip-revisao-endereco-linha" onclick="editarEndereco()" style="display:none;">
              <span class="ip-revisao-linha-label">Endereço</span>
              <span class="ip-revisao-linha-valor" id="ip-revisao-endereco">—</span>
              <span class="ip-revisao-linha-trocar">trocar</span>
            </button>
            <button type="button" class="ip-revisao-linha" id="ip-revisao-pagamento-btn" onclick="irParaEtapa('pagamento')">
              <span class="ip-revisao-linha-label">Pagamento</span>
              <span class="ip-revisao-linha-valor" id="ip-revisao-pagamento">—</span>
              <span class="ip-revisao-linha-trocar" id="ip-revisao-pagamento-trocar">trocar</span>
            </button>
          </div>

          <div id="ip-modal-pix" class="ip-modal-pix" style="display:none;">
            <div class="ip-modal-pix-titulo">💳 Pagar com Pix</div>
            <div class="ip-modal-pix-linha">
              <span id="ip-modal-pix-label">Valor a pagar agora</span>
              <strong id="ip-modal-pix-valor">R$ 0,00</strong>
            </div>
            <div id="ip-modal-pix-restante" class="ip-modal-pix-restante" style="display:none;"></div>
            ${htmlContaPix}
            <textarea id="ip-modal-pix-codigo" class="ip-modal-pix-codigo" readonly style="display:none;"></textarea>
            <button type="button" id="ip-modal-btn-pix" class="ip-modal-btn ip-modal-btn--pix" onclick="copiarCodigoPix()">📋 Copiar código Pix</button>
            <div class="ip-modal-pix-dica">Cole em "Pix Copia e Cola" no app do seu banco. A chave é o WhatsApp da loja.</div>
          </div>
          <div id="ip-modal-pagamento-posterior" class="ip-modal-pagamento-posterior" style="display:none;">
            <div class="ip-modal-pix-titulo">🕒 Pagamento posterior</div>
            <div class="ip-modal-pagamento-posterior-sub">Sem Pix agora — combine o pagamento direto com a gente na retirada.</div>
          </div>
          <div id="ip-modal-politica" class="ip-modal-politica" style="display:none;"></div>

          <div class="ip-modal-acoes">
            <button type="button" class="ip-modal-btn ip-modal-btn--voltar" onclick="fecharConfirmacao()">Voltar e editar</button>
            <button type="button" class="ip-modal-btn ip-modal-btn--confirmar ip-modal-btn--whatsapp" onclick="mostrarInstrucaoEnvio()">Enviar pelo WhatsApp</button>
          </div>
        </div>
      </div>
      <div id="ip-modal-instrucao" class="ip-modal-instrucao">
        <div class="ip-modal-instrucao-seta">👉</div>
        <div class="ip-modal-instrucao-titulo">Quase lá!</div>
        <div class="ip-modal-instrucao-texto">
          O WhatsApp vai abrir com sua mensagem já pronta.<br>
          Pra ela chegar até nós, você precisa tocar no botão <b>verde de ENVIAR</b> lá dentro do WhatsApp.
        </div>
        <div class="ip-modal-instrucao-destaque">Procure a seta verde ➤ e toque nela</div>
        <div class="ip-modal-instrucao-acoes">
          <button type="button" class="ip-modal-btn ip-modal-btn--voltar" onclick="voltarInstrucaoEnvio()">Voltar</button>
          <button type="button" class="ip-modal-btn ip-modal-btn--confirmar ip-modal-btn--whatsapp" onclick="confirmarEnvio()">Abrir WhatsApp agora</button>
        </div>
      </div>
      <div id="ip-modal-sucesso" class="ip-modal-sucesso" style="display:none;">
        <div class="ip-modal-sucesso-check">✅</div>
        <div class="ip-modal-sucesso-texto">Pedido enviado!</div>
        <div class="ip-modal-sucesso-sub">Seu pedido foi encaminhado pelo WhatsApp.<br>Aguarde nossa confirmação.</div>
      </div>` : `
      <div id="ip-modal-conteudo">
        <div class="ip-modal-titulo">Confirme seu pedido</div>
        <div id="ip-modal-itens" class="ip-modal-itens"></div>
        <div class="ip-modal-total">
          <span>Total</span>
          <strong id="ip-modal-total-valor">R$ 0,00</strong>
        </div>
        ${modoBalcao ? `
        <div class="ip-modal-entrega">
          <label class="ip-modal-entrega-check">
            <input type="checkbox" id="ip-balcao-entrega-chk" onchange="recalcularTotalEPixBalcao()">
            <span>🛵 Esse pedido tem entrega${taxaEntrega > 0 ? ' (+' + taxaEntrega.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ')' : ''}?</span>
          </label>
        </div>` : ''}
        ${pagamentoAtivo ? `<div id="ip-modal-pix" class="ip-modal-pix" style="display:none;">
          <div class="ip-modal-pix-titulo">💳 Pagar com Pix</div>
          <div class="ip-modal-pix-linha">
            <span id="ip-modal-pix-label">Valor a pagar agora</span>
            <strong id="ip-modal-pix-valor">R$ 0,00</strong>
          </div>
          <div id="ip-modal-pix-restante" class="ip-modal-pix-restante" style="display:none;"></div>
          ${htmlContaPix}
          ${modoBalcao ? `
          <div id="ip-modal-pix-qr" class="ip-modal-pix-qr" style="display:none;"></div>
          <div class="ip-modal-pix-qr-legenda">Peça pro cliente apontar a câmera do banco pro QR acima</div>` : ''}
          <textarea id="ip-modal-pix-codigo" class="ip-modal-pix-codigo" readonly style="display:none;"></textarea>
          <button type="button" id="ip-modal-btn-pix" class="ip-modal-btn ip-modal-btn--pix" onclick="copiarCodigoPix()">📋 Copiar código Pix</button>
          <div class="ip-modal-pix-dica">${modoBalcao ? 'Ou cole em "Pix Copia e Cola" no WhatsApp do cliente, se preferir.' : 'Cole em "Pix Copia e Cola" no app do seu banco. A chave é o WhatsApp da loja.'}</div>
        </div>` : ''}
        <div id="ip-modal-politica" class="ip-modal-politica" style="display:none;"></div>
        ${modoBalcao ? `
        <div class="ip-modal-cliente">
          <div id="ip-cliente-hint" class="ip-modal-cliente-hint">Nome e WhatsApp são opcionais — preencha só se for útil pra esse cliente.</div>
          <label class="ip-modal-cliente-campo">
            <span>Nome do cliente</span>
            <input id="ip-cliente-nome" type="text" placeholder="Nome completo (opcional)" autocomplete="off">
          </label>
          <label class="ip-modal-cliente-campo">
            <span>WhatsApp do cliente</span>
            <input id="ip-cliente-telefone" type="tel" placeholder="(21) 99999-9999 (opcional)" autocomplete="off">
          </label>
        </div>` : ''}
        <div class="ip-modal-acoes">
          <button type="button" class="ip-modal-btn ip-modal-btn--voltar" onclick="fecharConfirmacao()">Voltar e editar</button>
          ${modoBalcao
            ? '<button type="button" class="ip-modal-btn ip-modal-btn--confirmar" onclick="finalizarPedidoBalcao()">Finalizar pedido</button>'
            : '<button type="button" class="ip-modal-btn ip-modal-btn--confirmar ip-modal-btn--whatsapp" onclick="mostrarInstrucaoEnvio()">Enviar pelo WhatsApp</button>'}
        </div>
      </div>
      ${!modoBalcao ? `
      <div id="ip-modal-instrucao" class="ip-modal-instrucao">
        <div class="ip-modal-instrucao-seta">👉</div>
        <div class="ip-modal-instrucao-titulo">Quase lá!</div>
        <div class="ip-modal-instrucao-texto">
          O WhatsApp vai abrir com sua mensagem já pronta.<br>
          Pra ela chegar até nós, você precisa tocar no botão <b>verde de ENVIAR</b> lá dentro do WhatsApp.
        </div>
        <div class="ip-modal-instrucao-destaque">Procure a seta verde ➤ e toque nela</div>
        <div class="ip-modal-instrucao-acoes">
          <button type="button" class="ip-modal-btn ip-modal-btn--voltar" onclick="voltarInstrucaoEnvio()">Voltar</button>
          <button type="button" class="ip-modal-btn ip-modal-btn--confirmar ip-modal-btn--whatsapp" onclick="confirmarEnvio()">Abrir WhatsApp agora</button>
        </div>
      </div>` : ''}
      <div id="ip-modal-sucesso" class="ip-modal-sucesso" style="display:none;">
        <div class="ip-modal-sucesso-check">✅</div>
        <div class="ip-modal-sucesso-texto">Pedido salvo!</div>
        <div class="ip-modal-sucesso-sub">Pode continuar com o próximo cliente.</div>
      </div>`}
    </div>
  </div>

  ${!modoBalcao ? `
  <div id="ip-checagem-banner" class="ip-checagem-banner">
    <div class="ip-checagem-texto">Você conseguiu enviar seu pedido no WhatsApp? 📲</div>
    <div class="ip-checagem-acoes">
      <button type="button" class="ip-checagem-btn ip-checagem-btn--nao" onclick="reabrirWhatsApp()">Não, abrir de novo</button>
      <button type="button" class="ip-checagem-btn ip-checagem-btn--sim" onclick="confirmarEnvioConcluido()">Sim, enviei ✅</button>
    </div>
  </div>` : ''}

  <div id="ip-foto-overlay" class="ip-foto-overlay" style="display:none;" onclick="if (event.target === this) fecharFotoItem()">
    <div class="ip-foto-card">
      <button type="button" class="ip-foto-fechar" onclick="fecharFotoItem()">✕</button>
      <img id="ip-foto-img" src="" alt="">
      <div class="ip-foto-legenda">
        <div id="ip-foto-nome" class="ip-foto-nome"></div>
        <div id="ip-foto-preco" class="ip-foto-preco"></div>
      </div>
    </div>
  </div>

  <script>
    var ITENS = ${dadosJsonSeguro};
    var CATEGORIAS = ${JSON.stringify(grupos.map(g => g.categoria)).replace(/</g, '\\u003c')};
    var qtds = ITENS.map(function () { return 0 });
    var MINIMOS = ${minimosJsonSeguro};
    var POLITICA_TEXTO = ${JSON.stringify(politicaTextoPlano)};
    var NUMERO = ${JSON.stringify(numero)};
    var MODO_BALCAO = ${JSON.stringify(!!modoBalcao)};
    var CARDAPIO_ID = ${JSON.stringify(cardapioId)};
    var CHAVE_PIX = ${JSON.stringify(chavePix)};
    var NOME_PIX = ${JSON.stringify(nomeRecebedorPix)};
    var CIDADE_PIX = ${JSON.stringify(cidadeRecebedorPix)};
    var SINAL_ATIVO = ${JSON.stringify(sinalAtivo)};
    var SINAL_FRACAO = ${JSON.stringify(sinalFracao)};
    var PAGAMENTO_ATIVO = ${JSON.stringify(pagamentoAtivo)};
    var CATEGORIA_FESTA = 'FESTA';
    var COM_ESCOLHA_RECEBIMENTO = ${JSON.stringify(comEscolhaRecebimento)};
    var TAXA_ENTREGA = ${JSON.stringify(taxaEntrega)};

    // ── "ler mais" só aparece quando a descrição realmente estoura 2 linhas —
    // uma descrição curta (1 linha) não ganha esse link à toa. ──
    Array.prototype.forEach.call(document.querySelectorAll('.ip-item-desc'), function (desc) {
      if (desc.scrollHeight <= desc.clientHeight + 1) return;
      var link = desc.nextElementSibling;
      if (!link || !link.classList.contains('ip-item-ler-mais')) return;
      link.style.display = 'inline-block';
      link.addEventListener('click', function () {
        var aberto = desc.classList.toggle('expandido');
        link.textContent = aberto ? 'ler menos' : 'ler mais';
      });
    });

    // ── Lightbox da foto do item: toque no avatar abre a foto ampliada. ──
    function abrirFotoItem(el) {
      var img = el.querySelector('img');
      if (!img) return;
      document.getElementById('ip-foto-img').src = img.src;
      document.getElementById('ip-foto-nome').textContent = el.getAttribute('data-nome') || '';
      document.getElementById('ip-foto-preco').textContent = el.getAttribute('data-preco') || '';
      document.getElementById('ip-foto-overlay').style.display = 'flex';
    }
    function fecharFotoItem() {
      document.getElementById('ip-foto-overlay').style.display = 'none';
    }

    // ── Pix "copia e cola" (BR Code / EMV, padrão Banco Central) ──────────
    // Duplicado aqui (em vez de importado) porque este arquivo é um HTML
    // autossuficiente — precisa funcionar aberto direto do celular, sem
    // servidor, sem internet e sem módulos JS.
    function pixCampo(id, valor) {
      var tamanho = String(valor.length).padStart(2, '0');
      return id + tamanho + valor;
    }
    function pixCrc16(texto) {
      var crc = 0xffff;
      for (var i = 0; i < texto.length; i++) {
        crc ^= texto.charCodeAt(i) << 8;
        for (var j = 0; j < 8; j++) {
          crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
        }
      }
      return crc.toString(16).toUpperCase().padStart(4, '0');
    }
    function montarPayloadPix(valor, identificador) {
      if (!CHAVE_PIX) return '';
      var conta = pixCampo('00', 'BR.GOV.BCB.PIX') + pixCampo('01', CHAVE_PIX);
      var payload = pixCampo('00', '01') + pixCampo('01', '11') + pixCampo('26', conta) + pixCampo('52', '0000') + pixCampo('53', '986');
      var valorNum = Number(valor || 0);
      if (valorNum > 0) payload += pixCampo('54', valorNum.toFixed(2));
      var idLimpo = String(identificador || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
      payload += pixCampo('58', 'BR') + pixCampo('59', NOME_PIX) + pixCampo('60', CIDADE_PIX) + pixCampo('62', pixCampo('05', idLimpo));
      var semCrc = payload + '6304';
      return semCrc + pixCrc16(semCrc);
    }
    function copiarCodigoPix() {
      var campo = document.getElementById('ip-modal-pix-codigo');
      var btn = document.getElementById('ip-modal-btn-pix');
      var marcarCopiado = function () {
        btn.textContent = '✅ Código copiado!';
        btn.classList.add('copiado');
        setTimeout(function () { btn.textContent = '📋 Copiar código Pix'; btn.classList.remove('copiado'); }, 2500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(campo.value).then(marcarCopiado).catch(function () {
          campo.select();
          document.execCommand('copy');
          marcarCopiado();
        });
      } else {
        campo.select();
        document.execCommand('copy');
        marcarCopiado();
      }
    }

    // ── QR Code do Pix (só no modo balcão — o cliente aponta a câmera do
    // banco pra tela e paga na hora, sem precisar copiar nada). Lib de
    // terceiros embutida (ver comentário no topo do arquivo-fonte) pra
    // funcionar 100% offline, sem CDN.
    ${modoBalcao ? QRCODE_LIB_JS : ''}
    function renderizarQrPix(payload) {
      var box = document.getElementById('ip-modal-pix-qr');
      if (!box) return;
      if (!payload || typeof qrcode !== 'function') { box.style.display = 'none'; box.innerHTML = ''; return; }
      var svg = null;
      for (var tipo = 4; tipo <= 24 && !svg; tipo++) {
        try {
          var qr = qrcode(tipo, 'M');
          qr.addData(payload);
          qr.make();
          svg = qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
        } catch (e) { svg = null; }
      }
      if (svg) { box.innerHTML = svg; box.style.display = 'flex'; }
      else { box.innerHTML = ''; box.style.display = 'none'; }
    }

    function fmtBRL(v) {
      return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function subtotaisPorCategoria() {
      var dados = {};
      for (var i = 0; i < ITENS.length; i++) {
        if (qtds[i] > 0) {
          var cat = ITENS[i].categoria;
          if (!dados[cat]) dados[cat] = { valor: 0, unidades: 0 };
          dados[cat].valor += ITENS[i].preco * qtds[i];
          dados[cat].unidades += qtds[i];
        }
      }
      return dados;
    }
    function pendenciasMinimo() {
      var atuais = subtotaisPorCategoria();
      var pendencias = [];
      for (var cat in MINIMOS) {
        var min = MINIMOS[cat];
        var atual = atuais[cat] || { valor: 0, unidades: 0 };
        if (atual.unidades === 0) continue; // categoria sem nenhum item selecionado ainda — nada a cobrar
        var faltaValor = min.valor > 0 && atual.valor < min.valor ? (min.valor - atual.valor) : 0;
        var faltaUnidades = min.unidades > 0 && atual.unidades < min.unidades ? (min.unidades - atual.unidades) : 0;
        if (faltaValor > 0 || faltaUnidades > 0) {
          pendencias.push({ categoria: cat, faltaValor: faltaValor, faltaUnidades: faltaUnidades });
        }
      }
      return pendencias;
    }
    function atualizarBadgesCategorias() {
      var porCategoria = {};
      for (var i = 0; i < ITENS.length; i++) {
        if (qtds[i] > 0) {
          var cat = ITENS[i].categoria;
          porCategoria[cat] = (porCategoria[cat] || 0) + qtds[i];
        }
      }
      for (var c = 0; c < CATEGORIAS.length; c++) {
        var el = document.getElementById('ip-cat-selecionados-' + c);
        if (!el) continue;
        var qtd = porCategoria[CATEGORIAS[c]] || 0;
        if (qtd > 0) {
          el.textContent = qtd + (qtd === 1 ? ' selecionado' : ' selecionados');
          el.style.display = 'inline-block';
        } else {
          el.style.display = 'none';
        }
      }
    }
    // Acordeão: abre só a categoria escolhida e recolhe as outras.
    function abrirSomenteCategoria(idx) {
      var blocos = document.querySelectorAll('.categoria-bloco');
      for (var i = 0; i < blocos.length; i++) blocos[i].classList.toggle('aberta', i === idx);
      var chips = document.querySelectorAll('.ip-cat-chip');
      chips.forEach(function (chip, i) { chip.classList.toggle('ativo', i === idx); });
    }
    function rolarAteCategoria(idx) {
      var bloco = document.getElementById('ip-cat-' + idx);
      if (!bloco) return;
      var navEl = document.getElementById('ip-cat-nav');
      var offset = navEl ? navEl.offsetHeight + 8 : 8;
      var y = bloco.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    function toggleCategoria(idx) {
      var bloco = document.getElementById('ip-cat-' + idx);
      if (!bloco) return;
      if (bloco.classList.contains('aberta')) { bloco.classList.remove('aberta'); return; }
      abrirSomenteCategoria(idx);
      rolarAteCategoria(idx);   // as outras encolheram: leva a escolhida pro topo
    }
    function irParaCategoria(idx) {
      abrirSomenteCategoria(idx);
      rolarAteCategoria(idx);
    }
    function alterarQtd(idx, delta) {
      qtds[idx] = Math.max(0, qtds[idx] + delta);
      document.getElementById('qtd-' + idx).value = qtds[idx];
      atualizarResumo();
    }
    // ── Digitar a quantidade direto no campo (em vez de só usar +/-) ──
    // A cada tecla já soma no total (não precisa confirmar/sair do campo).
    // Só aceita dígitos — qualquer outra tecla é limpa na hora.
    function digitarQtd(el, idx) {
      var digitos = el.value.replace(/[^0-9]/g, '');
      if (digitos.length > 1) digitos = digitos.replace(/^0+/, '') || '0';
      el.value = digitos;
      qtds[idx] = digitos === '' ? 0 : parseInt(digitos, 10);
      atualizarResumo();
    }
    // Ao sair do campo (ou apertar Enter), se ficou vazio volta pra "0".
    function finalizarQtd(el, idx) {
      if (el.value === '') { el.value = '0'; qtds[idx] = 0; }
      atualizarResumo();
    }
    // Item com quantidade 0 mostra só "+ Adicionar"; com 1+ (ou com o campo em
    // edição, pra não sumir enquanto a pessoa digita) mostra o contador − N +.
    function sincronizarQtdUI() {
      for (var i = 0; i < ITENS.length; i++) {
        var inp = document.getElementById('qtd-' + i);
        if (!inp || !inp.parentNode) continue;
        inp.parentNode.classList.toggle('tem-qtd', qtds[i] > 0 || document.activeElement === inp);
      }
    }
    function atualizarResumo() {
      var total = 0, totalItens = 0;
      for (var i = 0; i < ITENS.length; i++) { total += ITENS[i].preco * qtds[i]; totalItens += qtds[i]; }
      document.getElementById('ip-total').textContent = fmtBRL(total);
      document.getElementById('ip-contador').textContent = totalItens;
      document.getElementById('ip-contador-rotulo').textContent = totalItens === 1 ? 'item' : 'itens';
      atualizarBadgesCategorias();
      sincronizarQtdUI();

      var pendencias = pendenciasMinimo();
      var avisoEl = document.getElementById('ip-aviso-minimo');
      if (pendencias.length) {
        avisoEl.innerHTML = pendencias.map(function (p) {
          var partes = [];
          if (p.faltaValor > 0) partes.push(fmtBRL(p.faltaValor));
          if (p.faltaUnidades > 0) partes.push(p.faltaUnidades + ' un.');
          return '⚠️ Faltam ' + partes.join(' e ') + ' em <b>' + p.categoria + '</b> pra atingir o pedido mínimo dessa categoria.';
        }).join('<br>');
        avisoEl.style.display = 'block';
      } else {
        avisoEl.style.display = 'none';
      }
      document.getElementById('ip-btn-enviar').disabled = totalItens === 0 || pendencias.length > 0;
    }
    var ultimoResumo = null;
    ${novoFluxoAtivo ? `
    // ═══════════════════════════════════════════════════════════════════
    // Fluxo NOVO — só no cardápio Dia a dia, cliente final: produtos →
    // como receber → (endereço, se entrega) → forma de pagamento →
    // revisão → WhatsApp. Cada etapa é um bloco dentro do mesmo modal.
    // ═══════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════
    // Fluxo NOVO — cliente final, Dia a dia e Festa: produtos → (como
    // receber, só no Dia a dia) → endereço (sempre que houver entrega) →
    // forma de pagamento (só no Dia a dia) → revisão → WhatsApp.
    // No Festa não existe escolha de recebimento — é sempre entrega — e a
    // taxa nunca tem valor fixo (TAXA_ENTREGA vem 0 do gerador), sempre
    // "a combinar" no WhatsApp, porque depende do caso.
    // ═══════════════════════════════════════════════════════════════════
    var pedidoRecebimento = null; // 'retirada' | 'entrega'
    var pedidoPagamento = null;   // 'pix' | 'depois'
    var pedidoEndereco = null;
    var etapaAtual = COM_ESCOLHA_RECEBIMENTO ? 'recebimento' : 'endereco';
    var enderecoOrigem = null; // 'recebimento' | 'revisao' | null (veio direto do carrinho)

    function mostrarEtapa(nomeEtapa) {
      ['recebimento', 'pagamento', 'endereco', 'revisao'].forEach(function (e) {
        var el = document.getElementById('ip-etapa-' + e);
        if (el) el.style.display = (e === nomeEtapa) ? 'block' : 'none';
      });
      etapaAtual = nomeEtapa;
    }
    function irParaEtapa(nomeEtapa) { mostrarEtapa(nomeEtapa); }

    function abrirConfirmacao() {
      var linhas = [], total = 0, itensSelecionados = [];
      for (var i = 0; i < ITENS.length; i++) {
        if (qtds[i] > 0) {
          var subtotal = ITENS[i].preco * qtds[i];
          linhas.push('• ' + qtds[i] + 'x ' + ITENS[i].nome + ' — ' + fmtBRL(subtotal));
          total += subtotal;
          itensSelecionados.push({ nome: ITENS[i].nome, categoria: ITENS[i].categoria, qtd: qtds[i], subtotal: subtotal });
        }
      }
      if (!itensSelecionados.length) return;
      if (pendenciasMinimo().length) return;
      if (!NUMERO) { alert('Este cardápio ainda não tem o WhatsApp da loja configurado. Peça pra loja atualizar o arquivo.'); return; }

      ultimoResumo = { linhas: linhas, total: total, itens: itensSelecionados };
      pedidoPagamento = null;
      pedidoEndereco = null;
      enderecoOrigem = null;

      if (COM_ESCOLHA_RECEBIMENTO) {
        pedidoRecebimento = null;
        mostrarEtapa('recebimento');
      } else {
        // Festa: não existe retirada, já entra direto no endereço.
        pedidoRecebimento = 'entrega';
        mostrarEtapa('endereco');
      }
      document.getElementById('ip-modal-conteudo').style.display = 'block';
      document.getElementById('ip-modal-sucesso').style.display = 'none';
      var elInstrucaoAbrir = document.getElementById('ip-modal-instrucao');
      if (elInstrucaoAbrir) elInstrucaoAbrir.style.display = 'none';
      document.getElementById('ip-modal-overlay').style.display = 'flex';
    }
    function fecharConfirmacao() {
      document.getElementById('ip-modal-overlay').style.display = 'none';
    }
    function voltarInstrucaoEnvio() {
      document.getElementById('ip-modal-instrucao').style.display = 'none';
      document.getElementById('ip-modal-conteudo').style.display = 'block';
    }
    function voltarDoEndereco() {
      if (enderecoOrigem === 'revisao') {
        montarRevisao();
        mostrarEtapa('revisao');
      } else if (COM_ESCOLHA_RECEBIMENTO) {
        mostrarEtapa('recebimento');
      } else {
        fecharConfirmacao();
      }
    }
    function editarEndereco() {
      enderecoOrigem = 'revisao';
      mostrarEtapa('endereco');
    }

    function escolherRecebimento(valor) {
      pedidoRecebimento = valor;
      if (valor === 'retirada') {
        mostrarEtapa('pagamento');
      } else {
        enderecoOrigem = 'recebimento';
        mostrarEtapa('endereco');
      }
    }
    function escolherPagamento(valor) {
      pedidoPagamento = valor;
      montarRevisao();
      mostrarEtapa('revisao');
    }
    function confirmarEndereco() {
      var campos = {
        nome: document.getElementById('ip-end-nome').value.trim(),
        rua: document.getElementById('ip-end-rua').value.trim(),
        numero: document.getElementById('ip-end-numero').value.trim(),
        complemento: document.getElementById('ip-end-complemento').value.trim(),
        bairro: document.getElementById('ip-end-bairro').value.trim(),
        referencia: document.getElementById('ip-end-referencia').value.trim()
      };
      var obrigatorios = [
        ['ip-end-nome', campos.nome], ['ip-end-rua', campos.rua],
        ['ip-end-numero', campos.numero], ['ip-end-bairro', campos.bairro]
      ];
      var faltando = false;
      obrigatorios.forEach(function (par) {
        var el = document.getElementById(par[0]);
        var vazio = !par[1];
        el.classList.toggle('ip-input-erro', vazio);
        if (vazio) faltando = true;
      });
      var erroEl = document.getElementById('ip-endereco-erro');
      if (faltando) {
        erroEl.textContent = 'Preencha nome, endereço, número e bairro pra continuar.';
        erroEl.style.display = 'block';
        return;
      }
      erroEl.style.display = 'none';
      pedidoEndereco = campos;
      pedidoPagamento = 'pix'; // entrega sempre paga por Pix — não existe "entrega + pagar depois"
      montarRevisao();
      mostrarEtapa('revisao');
    }
    function enderecoResumoTexto() {
      if (!pedidoEndereco) return '';
      var p = pedidoEndereco;
      var partes = [p.rua + ', ' + p.numero];
      if (p.complemento) partes.push(p.complemento);
      partes.push(p.bairro);
      if (p.referencia) partes.push('Ref.: ' + p.referencia);
      return partes.join(' — ');
    }

    function montarRevisao() {
      var produtos = ultimoResumo.total;
      var temEntrega = pedidoRecebimento === 'entrega';
      var taxa = temEntrega ? TAXA_ENTREGA : 0;
      var totalGeral = produtos + taxa;

      var itensEl = document.getElementById('ip-modal-itens');
      itensEl.innerHTML = '';
      ultimoResumo.itens.forEach(function (it) {
        var linha = document.createElement('div');
        linha.className = 'ip-modal-item';
        var nomeSpan = document.createElement('span');
        nomeSpan.textContent = it.qtd + 'x ' + it.nome;
        var precoSpan = document.createElement('span');
        precoSpan.textContent = fmtBRL(it.subtotal);
        linha.appendChild(nomeSpan);
        linha.appendChild(precoSpan);
        itensEl.appendChild(linha);
      });

      var produtosLinha = document.getElementById('ip-revisao-produtos-linha');
      var entregaLinha = document.getElementById('ip-revisao-entrega-linha');
      if (temEntrega) {
        document.getElementById('ip-revisao-produtos-valor').textContent = fmtBRL(produtos);
        document.getElementById('ip-revisao-entrega-valor').textContent = taxa > 0 ? fmtBRL(taxa) : 'A combinar';
        produtosLinha.style.display = 'flex';
        entregaLinha.style.display = 'flex';
      } else {
        produtosLinha.style.display = 'none';
        entregaLinha.style.display = 'none';
      }
      document.getElementById('ip-modal-total-valor').textContent = fmtBRL(totalGeral);

      document.getElementById('ip-revisao-recebimento').textContent = temEntrega ? 'Entrega' : 'Retirada';
      var recebimentoTrocar = document.getElementById('ip-revisao-recebimento-trocar');
      var recebimentoBtn = document.getElementById('ip-revisao-recebimento-btn');
      if (COM_ESCOLHA_RECEBIMENTO) {
        if (recebimentoTrocar) recebimentoTrocar.style.display = 'inline';
        if (recebimentoBtn) recebimentoBtn.style.pointerEvents = 'auto';
      } else {
        if (recebimentoTrocar) recebimentoTrocar.style.display = 'none';
        if (recebimentoBtn) recebimentoBtn.style.pointerEvents = 'none';
      }

      var enderecoLinha = document.getElementById('ip-revisao-endereco-linha');
      if (temEntrega) {
        document.getElementById('ip-revisao-endereco').textContent = enderecoResumoTexto();
        enderecoLinha.style.display = 'flex';
      } else {
        enderecoLinha.style.display = 'none';
      }

      var pagamentoTrocar = document.getElementById('ip-revisao-pagamento-trocar');
      var pagamentoBtn = document.getElementById('ip-revisao-pagamento-btn');
      if (temEntrega) {
        document.getElementById('ip-revisao-pagamento').textContent = 'Pix';
        if (pagamentoTrocar) pagamentoTrocar.style.display = 'none';
        if (pagamentoBtn) pagamentoBtn.style.pointerEvents = 'none';
      } else {
        document.getElementById('ip-revisao-pagamento').textContent = pedidoPagamento === 'pix' ? 'Pix agora' : 'Pagar depois';
        if (pagamentoTrocar) pagamentoTrocar.style.display = 'inline';
        if (pagamentoBtn) pagamentoBtn.style.pointerEvents = 'auto';
      }

      var pixEl = document.getElementById('ip-modal-pix');
      var posteriorEl = document.getElementById('ip-modal-pagamento-posterior');
      ultimoResumo.valorPix = 0;
      ultimoResumo.valorRestante = 0;
      ultimoResumo.cobrarSinal = false;

      if (pedidoPagamento === 'pix' && CHAVE_PIX && totalGeral > 0) {
        var cobrarSinal = SINAL_ATIVO && SINAL_FRACAO > 0;
        var valorPix = cobrarSinal ? totalGeral * SINAL_FRACAO : totalGeral;
        var valorRestante = cobrarSinal ? totalGeral - valorPix : 0;
        var percentualExibido = Math.round(SINAL_FRACAO * 100);

        document.getElementById('ip-modal-pix-label').textContent = cobrarSinal
          ? 'Sinal a pagar agora (' + percentualExibido + '%)'
          : 'Valor a pagar agora';
        document.getElementById('ip-modal-pix-valor').textContent = fmtBRL(valorPix);

        var restanteEl = document.getElementById('ip-modal-pix-restante');
        if (cobrarSinal) {
          restanteEl.innerHTML = 'Falta pagar n' + (temEntrega ? 'a entrega' : 'a retirada') + ': <b>' + fmtBRL(valorRestante) + '</b>';
          restanteEl.style.display = 'block';
        } else {
          restanteEl.style.display = 'none';
        }

        ultimoResumo.valorPix = valorPix;
        ultimoResumo.valorRestante = valorRestante;
        ultimoResumo.cobrarSinal = cobrarSinal;

        var payloadPix = montarPayloadPix(valorPix, 'PEDIDO');
        document.getElementById('ip-modal-pix-codigo').value = payloadPix;
        ultimoResumo.codigoPix = payloadPix;
        pixEl.style.display = 'block';
        posteriorEl.style.display = 'none';
      } else if (pedidoPagamento === 'depois') {
        pixEl.style.display = 'none';
        posteriorEl.style.display = 'block';
      } else {
        pixEl.style.display = 'none';
        posteriorEl.style.display = 'none';
      }

      var politicaEl = document.getElementById('ip-modal-politica');
      if (POLITICA_TEXTO) {
        politicaEl.textContent = POLITICA_TEXTO;
        politicaEl.style.display = 'block';
      } else {
        politicaEl.style.display = 'none';
      }

      ultimoResumo.recebimento = pedidoRecebimento;
      ultimoResumo.pagamento = pedidoPagamento;
      ultimoResumo.endereco = pedidoEndereco;
      ultimoResumo.taxaEntrega = taxa;
      ultimoResumo.totalGeral = totalGeral;
    }

    function confirmarEnvio() {
      if (!ultimoResumo) return;
      var temEntrega = ultimoResumo.recebimento === 'entrega';
      var msg = 'Olá! Gostaria de fazer o seguinte pedido:\\n\\n' + ultimoResumo.linhas.join('\\n');
      if (temEntrega) {
        msg += '\\n\\nProdutos: ' + fmtBRL(ultimoResumo.total);
        msg += '\\nEntrega: ' + (ultimoResumo.taxaEntrega > 0 ? fmtBRL(ultimoResumo.taxaEntrega) : 'a combinar');
      }
      msg += '\\nTotal: ' + fmtBRL(ultimoResumo.totalGeral);
      msg += '\\n\\nRecebimento: ' + (temEntrega ? 'Entrega' : 'Retirada');
      if (temEntrega && ultimoResumo.endereco) {
        var e = ultimoResumo.endereco;
        msg += '\\nNome: ' + e.nome;
        msg += '\\nEndereço: ' + e.rua + ', ' + e.numero + (e.complemento ? ' - ' + e.complemento : '');
        msg += '\\nBairro: ' + e.bairro;
        if (e.referencia) msg += '\\nReferência: ' + e.referencia;
      }
      msg += '\\nPagamento: ' + (ultimoResumo.pagamento === 'pix' ? 'Pix' : 'Pagamento posterior');
      if (ultimoResumo.valorPix) {
        msg += ultimoResumo.cobrarSinal
          ? '\\n\\n💳 Sinal via Pix: ' + fmtBRL(ultimoResumo.valorPix) + ' (já vou pagar e mando o comprovante aqui)\\nRestante n' + (temEntrega ? 'a entrega' : 'a retirada') + ': ' + fmtBRL(ultimoResumo.valorRestante)
          : '\\n\\n💳 Vou pagar via Pix: ' + fmtBRL(ultimoResumo.valorPix) + ' (mando o comprovante aqui)';
        if (ultimoResumo.codigoPix) {
          msg += '\\n\\n📋 Código Pix Copia e Cola (caso eu não tenha copiado ainda):\\n' + ultimoResumo.codigoPix;
        }
      }
      if (POLITICA_TEXTO) msg += '\\n\\n' + POLITICA_TEXTO;

      var linkWhats = 'https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(msg);
      document.getElementById('ip-modal-instrucao').style.display = 'none';
      document.getElementById('ip-modal-conteudo').style.display = 'none';
      document.getElementById('ip-modal-sucesso').style.display = 'flex';
      // Marca que um pedido ficou "pendente de confirmação" — se a pessoa
      // voltar pro navegador (por não ter conseguido enviar, ou por engano),
      // a gente pergunta e oferece reabrir o WhatsApp. Ver checarRetornoPedido().
      try { sessionStorage.setItem('cb_pedido_pendente', '1'); } catch (e) {}
      setTimeout(function () { window.location.href = linkWhats; }, 900);
    }
    ` : `
    // ═══════════════════════════════════════════════════════════════════
    // Fluxo ORIGINAL — cardápio Festa e/ou modo balcão, sem alterações.
    // ═══════════════════════════════════════════════════════════════════
    function abrirConfirmacao() {
      var linhas = [], itensTotal = 0, itensSelecionados = [];
      for (var i = 0; i < ITENS.length; i++) {
        if (qtds[i] > 0) {
          var subtotal = ITENS[i].preco * qtds[i];
          linhas.push('• ' + qtds[i] + 'x ' + ITENS[i].nome + ' — ' + fmtBRL(subtotal));
          itensTotal += subtotal;
          itensSelecionados.push({ nome: ITENS[i].nome, categoria: ITENS[i].categoria, qtd: qtds[i], subtotal: subtotal });
        }
      }
      if (!itensSelecionados.length) return;
      if (pendenciasMinimo().length) return;
      if (!MODO_BALCAO && !NUMERO) { alert('Este cardápio ainda não tem o WhatsApp da loja configurado. Peça pra loja atualizar o arquivo.'); return; }

      // Só exige nome/WhatsApp do cliente quando o pedido tem item de
      // categoria "Festa" (encomenda que precisa de combinação/entrega) —
      // venda avulsa de balcão pode ficar sem identificação.
      var temFesta = itensSelecionados.some(function (it) {
        return String(it.categoria || '').trim().toUpperCase() === CATEGORIA_FESTA;
      });

      ultimoResumo = { linhas: linhas, total: itensTotal, itensTotal: itensTotal, entregaValor: 0, itens: itensSelecionados, exigeCliente: temFesta };

      if (MODO_BALCAO) {
        var hintEl = document.getElementById('ip-cliente-hint');
        var nomeInput = document.getElementById('ip-cliente-nome');
        var telInput = document.getElementById('ip-cliente-telefone');
        if (hintEl) {
          hintEl.textContent = temFesta
            ? 'Esse pedido tem item de Festa — nome e WhatsApp do cliente são obrigatórios pra combinar a entrega.'
            : 'Nome e WhatsApp são opcionais — preencha só se for útil pra esse cliente.';
          hintEl.classList.toggle('ip-modal-cliente-hint--obrigatorio', temFesta);
        }
        if (nomeInput) nomeInput.placeholder = temFesta ? 'Nome completo' : 'Nome completo (opcional)';
        if (telInput) telInput.placeholder = temFesta ? '(21) 99999-9999' : '(21) 99999-9999 (opcional)';
        // Checkbox de entrega começa sempre desmarcado a cada novo pedido.
        var entregaChkAbrir = document.getElementById('ip-balcao-entrega-chk');
        if (entregaChkAbrir) entregaChkAbrir.checked = false;
      }

      // Monta a lista de itens do modal via DOM (não innerHTML) pra não correr
      // risco nenhum de interpretar caracteres do nome do item como HTML.
      var itensEl = document.getElementById('ip-modal-itens');
      itensEl.innerHTML = '';
      itensSelecionados.forEach(function (it) {
        var linha = document.createElement('div');
        linha.className = 'ip-modal-item';
        var nomeSpan = document.createElement('span');
        nomeSpan.textContent = it.qtd + 'x ' + it.nome;
        var precoSpan = document.createElement('span');
        precoSpan.textContent = fmtBRL(it.subtotal);
        linha.appendChild(nomeSpan);
        linha.appendChild(precoSpan);
        itensEl.appendChild(linha);
      });

      recalcularTotalEPixBalcao();

      var politicaEl = document.getElementById('ip-modal-politica');
      if (POLITICA_TEXTO) {
        politicaEl.textContent = POLITICA_TEXTO;
        politicaEl.style.display = 'block';
      } else {
        politicaEl.style.display = 'none';
      }

      var elInstrucaoAbrir = document.getElementById('ip-modal-instrucao');
      if (elInstrucaoAbrir) elInstrucaoAbrir.style.display = 'none';
      document.getElementById('ip-modal-conteudo').style.display = 'block';
      document.getElementById('ip-modal-overlay').style.display = 'flex';
    }
    // ── Taxa de entrega no balcão: valor fixo, definido em Configurações
    // (TAXA_ENTREGA). Aqui é só um checkbox — marcou, soma o valor já
    // configurado; desmarcou, tira. Nada pra digitar na hora do pedido.
    function recalcularTotalEPixBalcao() {
      if (!ultimoResumo) return;
      var entregaValor = 0;
      if (MODO_BALCAO) {
        var entregaChk = document.getElementById('ip-balcao-entrega-chk');
        if (entregaChk && entregaChk.checked) {
          entregaValor = TAXA_ENTREGA > 0 ? TAXA_ENTREGA : 0;
        }
      }
      ultimoResumo.entregaValor = entregaValor;
      var total = (ultimoResumo.itensTotal || 0) + entregaValor;
      ultimoResumo.total = total;
      document.getElementById('ip-modal-total-valor').textContent = fmtBRL(total);

      if (!PAGAMENTO_ATIVO) {
        ultimoResumo.valorPix = 0;
        ultimoResumo.valorRestante = 0;
        ultimoResumo.cobrarSinal = false;
        return;
      }

      var pixEl = document.getElementById('ip-modal-pix');
      if (CHAVE_PIX && total > 0) {
        var cobrarSinal = SINAL_ATIVO && SINAL_FRACAO > 0;
        var valorPix = cobrarSinal ? total * SINAL_FRACAO : total;
        var valorRestante = cobrarSinal ? total - valorPix : 0;
        var percentualExibido = Math.round(SINAL_FRACAO * 100);

        document.getElementById('ip-modal-pix-label').textContent = cobrarSinal
          ? 'Sinal a pagar agora (' + percentualExibido + '%)'
          : 'Valor a pagar agora';
        document.getElementById('ip-modal-pix-valor').textContent = fmtBRL(valorPix);

        var restanteEl = document.getElementById('ip-modal-pix-restante');
        if (cobrarSinal) {
          restanteEl.innerHTML = 'Falta pagar na entrega: <b>' + fmtBRL(valorRestante) + '</b>';
          restanteEl.style.display = 'block';
        } else {
          restanteEl.style.display = 'none';
        }

        ultimoResumo.valorPix = valorPix;
        ultimoResumo.valorRestante = valorRestante;
        ultimoResumo.cobrarSinal = cobrarSinal;

        var payloadPix = montarPayloadPix(valorPix, 'PEDIDO');
        document.getElementById('ip-modal-pix-codigo').value = payloadPix;
        if (MODO_BALCAO) renderizarQrPix(payloadPix);
        pixEl.style.display = 'block';
      } else {
        pixEl.style.display = 'none';
        ultimoResumo.valorPix = 0;
        ultimoResumo.valorRestante = 0;
        ultimoResumo.cobrarSinal = false;
        if (MODO_BALCAO) renderizarQrPix('');
      }
    }
    function fecharConfirmacao() {
      document.getElementById('ip-modal-overlay').style.display = 'none';
      var elInstrucao = document.getElementById('ip-modal-instrucao');
      if (elInstrucao) elInstrucao.style.display = 'none';
      var elConteudo = document.getElementById('ip-modal-conteudo');
      if (elConteudo) elConteudo.style.display = 'block';
    }
    function confirmarEnvio() {
      if (!ultimoResumo) return;
      var msg = 'Olá! Gostaria de fazer o seguinte pedido:\\n\\n' + ultimoResumo.linhas.join('\\n') + '\\n\\nTotal: ' + fmtBRL(ultimoResumo.total);
      if (ultimoResumo.valorPix) {
        msg += ultimoResumo.cobrarSinal
          ? '\\n\\n💳 Sinal via Pix: ' + fmtBRL(ultimoResumo.valorPix) + ' (já vou pagar e mando o comprovante aqui)\\nRestante na entrega: ' + fmtBRL(ultimoResumo.valorRestante)
          : '\\n\\n💳 Vou pagar via Pix: ' + fmtBRL(ultimoResumo.valorPix) + ' (mando o comprovante aqui)';
      }
      if (POLITICA_TEXTO) msg += '\\n\\n' + POLITICA_TEXTO;
      // Marca que um pedido ficou "pendente de confirmação" — se a pessoa
      // voltar pro navegador (por não ter conseguido enviar, ou por engano),
      // a gente pergunta e oferece reabrir o WhatsApp. Ver checarRetornoPedido().
      try { sessionStorage.setItem('cb_pedido_pendente', '1'); } catch (e) {}
      window.location.href = 'https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(msg);
    }
    `}

    // ── Modo balcão: em vez de abrir o WhatsApp (não faz sentido quando é
    // você segurando o celular na frente do cliente), salva o pedido — com
    // nome e telefone do cliente pra contato depois — e manda pro app
    // principal guardar (window.parent, já que esta tela roda num iframe
    // dentro do app). Depois reseta o carrinho pro próximo cliente.
    function finalizarPedidoBalcao() {
      if (!ultimoResumo || !ultimoResumo.itens.length) return;
      var nomeEl = document.getElementById('ip-cliente-nome');
      var telEl = document.getElementById('ip-cliente-telefone');
      var nome = (nomeEl.value || '').trim();
      var telefone = (telEl.value || '').trim();
      if (ultimoResumo.exigeCliente && (!nome || !telefone)) {
        alert('Esse pedido tem item de Festa — preencha o nome e o WhatsApp do cliente pra combinar a entrega.');
        return;
      }
      var pedido = {
        cardapioId: CARDAPIO_ID,
        clienteNome: nome,
        clienteTelefone: telefone,
        itens: ultimoResumo.itens,
        itensTotal: ultimoResumo.itensTotal || ultimoResumo.total,
        entregaValor: ultimoResumo.entregaValor || 0,
        total: ultimoResumo.total,
        cobrarSinal: !!ultimoResumo.cobrarSinal,
        valorPix: ultimoResumo.valorPix || 0,
        valorRestante: ultimoResumo.valorRestante || 0,
        temFesta: !!ultimoResumo.exigeCliente,
      };
      if (window.parent) {
        window.parent.postMessage({ tipo: 'cardapio:pedido-balcao', pedido: pedido }, '*');
      }
      document.getElementById('ip-modal-conteudo').style.display = 'none';
      document.getElementById('ip-modal-sucesso').style.display = 'flex';
      setTimeout(function () {
        qtds = ITENS.map(function () { return 0 });
        for (var i = 0; i < ITENS.length; i++) {
          var elQ = document.getElementById('qtd-' + i);
          if (elQ) elQ.value = '0';
        }
        atualizarResumo();
        nomeEl.value = '';
        telEl.value = '';
        var entregaChkReset = document.getElementById('ip-balcao-entrega-chk');
        if (entregaChkReset) entregaChkReset.checked = false;
        document.getElementById('ip-modal-overlay').style.display = 'none';
        document.getElementById('ip-modal-conteudo').style.display = 'block';
        document.getElementById('ip-modal-sucesso').style.display = 'none';
      }, 1700);
    }

    // ── Tela de instrução: aparece ANTES de abrir o WhatsApp, deixando bem
    // claro (com seta animada e destaque verde) que ainda falta tocar no
    // botão de enviar dentro do próprio WhatsApp. Isso não garante o envio
    // — nenhum site consegue apertar esse botão pelo cliente, é uma trava
    // anti-spam do próprio WhatsApp — mas reduz muito quem esquece.
    function mostrarInstrucaoEnvio() {
      var elConteudo = document.getElementById('ip-modal-conteudo');
      var elInstrucao = document.getElementById('ip-modal-instrucao');
      if (elConteudo) elConteudo.style.display = 'none';
      if (elInstrucao) elInstrucao.style.display = 'flex';
    }
    // ── Checagem de retorno: se o app do WhatsApp abriu por cima do
    // navegador (o mais comum no celular), a aba fica pausada em segundo
    // plano e volta a ficar visível quando a pessoa aperta "voltar". Nesse
    // momento perguntamos se deu tudo certo. Não roda no modo balcão (lá
    // quem finaliza o pedido é o botão "Finalizar pedido", sem WhatsApp).
    function checarRetornoPedido() {
      if (MODO_BALCAO) return;
      var pendente;
      try { pendente = sessionStorage.getItem('cb_pedido_pendente'); } catch (e) { pendente = null; }
      var banner = document.getElementById('ip-checagem-banner');
      if (pendente === '1' && banner) banner.style.display = 'block';
    }
    function confirmarEnvioConcluido() {
      try { sessionStorage.removeItem('cb_pedido_pendente'); } catch (e) {}
      var banner = document.getElementById('ip-checagem-banner');
      if (banner) banner.style.display = 'none';
      fecharConfirmacao();
    }
    function reabrirWhatsApp() {
      var banner = document.getElementById('ip-checagem-banner');
      if (banner) banner.style.display = 'none';
      if (ultimoResumo) confirmarEnvio();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') checarRetornoPedido();
    });
    window.addEventListener('pageshow', function () { checarRetornoPedido(); });
  </script>
</body>
</html>`
}

/** Compartilha (ou baixa, como fallback) um único arquivo qualquer — usado pro cardápio interativo (.html) */
export async function compartilharArquivo(blob, { nomeArquivo, tipo = 'text/html', titulo = '', texto = '' } = {}) {
  const arquivo = new File([blob], nomeArquivo, { type: tipo })
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: titulo, text: texto })
      return 'compartilhado'
    } catch {
      return 'cancelado'
    }
  }
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'baixado'
}