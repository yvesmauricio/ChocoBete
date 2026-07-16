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

// R$() do utils.js não prefixa o símbolo (é usado com rótulos como "Venda:" já
// no contexto). Aqui o preço aparece sozinho pro cliente, então formatamos
// com o "R$" explícito.
const R$ = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const CHAVE_CONFIG_CARDAPIO = 'cardapio_config'

const CONFIG_DEFAULT = () => ({
  nome_cardapio: '',      // vazio = usa s.company.nome
  subtitulo: 'Chocolates Artesanais',
  mensagem_rodape: 'Peça já e encomende o seu! 🍫',
  abrir_tela_cheia_padrao: false, // true = abre direto na tela cheia (modo "mostrar pro cliente")
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
  preco_exibido: null,   // null = usa receita.preco_sugerido
})

export async function carregarConfigCardapio() {
  const salvo = await configGet(CHAVE_CONFIG_CARDAPIO, null)
  const base = CONFIG_DEFAULT()
  if (!salvo) return base
  return {
    ...base,
    ...salvo,
    itens: { ...(salvo.itens || {}) },
  }
}

export async function salvarConfigCardapio(config) {
  await configSet(CHAVE_CONFIG_CARDAPIO, config)
  return config
}

export function getItemConfig(config, uuid) {
  return { ...ITEM_DEFAULT(), ...(config.itens?.[uuid] || {}) }
}

export function setItemConfig(config, uuid, patch) {
  const atual = getItemConfig(config, uuid)
  config.itens = { ...config.itens, [uuid]: { ...atual, ...patch } }
  return config
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
      return {
        uuid: r.uuid,
        nome: r.nome,
        categoria: cfg.categoria || r.categoria || 'Geral',
        preco: cfg.preco_exibido != null ? Number(cfg.preco_exibido) : Number(r.preco_sugerido || 0),
        descricao: cfg.descricao || '',
        emoji: cfg.emoji || '🍫',
        foto: cfg.foto || null,
        destaque: !!cfg.destaque,
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
export const CSS_CARDAPIO = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #0e0c0a;
    color: #f3e9d6;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .cardapio-doc {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 16mm 14mm 18mm;
    background:
      radial-gradient(circle at 12% 8%, rgba(201,162,39,.10), transparent 40%),
      radial-gradient(circle at 88% 92%, rgba(201,162,39,.08), transparent 40%),
      #0e0c0a;
    position: relative;
    page-break-after: always;
  }
  @media print {
    /* Sem isso, o navegador ignora cor de fundo na impressão por padrão
       (pra "economizar tinta") — é por isso que o PDF saía com fundo
       branco em vez do preto/dourado do tema. Isso força a impressão a
       respeitar as cores de fundo definidas no CSS. */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    html, body { background: #0e0c0a; }
    .cardapio-doc { margin: 0; page-break-after: always; }
    .no-print { display: none !important; }
  }
  /* A folha é pensada pra A4 (210mm) — perfeito pro PDF, mas numa tela de
     celular (ex.: ~360-411px de largura) isso é bem mais largo que a tela
     e ficava cortado/precisando de scroll horizontal. Essa regra só vale
     pra exibição em tela (não afeta o PDF, que usa @media print). */
  @media screen and (max-width: 640px) {
    html, body { overflow-x: hidden; }
    .cardapio-doc {
      width: 100%;
      min-height: 100vh;
      padding: 28px 18px 34px;
    }
    .capa .marca { font-size: 24pt; }
    .categoria-titulo { font-size: 13pt; }
  }
  .ouro { color: #d4af37; }
  .divisor {
    display: flex; align-items: center; gap: 10px;
    margin: 6mm 0;
    color: #b8944f;
  }
  .divisor::before, .divisor::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, #6b5321, transparent);
  }
  .divisor .diamante { font-size: 10px; transform: rotate(45deg); border: 1px solid #b8944f; width: 6px; height: 6px; }

  .capa { text-align: center; padding: 10mm 0 4mm; }
  .capa .selo {
    width: 64px; height: 64px; margin: 0 auto 8mm; border-radius: 50%;
    border: 1.5px solid #d4af37; display: flex; align-items: center; justify-content: center;
    font-size: 28px; background: rgba(212,175,55,.08);
  }
  .capa .marca {
    font-family: 'Playfair Display', serif; font-weight: 800;
    font-size: 30pt; letter-spacing: .5px; color: #f3e9d6;
    text-shadow: 0 0 24px rgba(212,175,55,.25);
  }
  .capa .subtitulo {
    font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 14pt;
    color: #d4af37; margin-top: 3mm; letter-spacing: .3px;
  }

  .categoria-titulo {
    font-family: 'Playfair Display', serif; font-weight: 700;
    font-size: 15pt; color: #d4af37; text-transform: uppercase;
    letter-spacing: 1.5px; text-align: center; margin: 9mm 0 5mm;
  }

  .item-row {
    display: flex; align-items: flex-start; gap: 3.5mm;
    padding: 3.2mm 0; border-bottom: 1px dashed rgba(212,175,55,.25);
  }
  .item-avatar {
    width: 11mm; height: 11mm; border-radius: 50%; flex-shrink: 0;
    background: rgba(212,175,55,.10); border: 1px solid rgba(212,175,55,.5);
    display: flex; align-items: center; justify-content: center; font-size: 14pt;
    overflow: hidden;
  }
  .item-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .item-corpo { flex: 1; min-width: 0; }
  .item-linha1 { display: flex; align-items: baseline; gap: 2mm; }
  .item-nome {
    font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 13.5pt;
    color: #f3e9d6; letter-spacing: .2px;
  }
  .item-leader { flex: 1; border-bottom: 1px dotted rgba(212,175,55,.35); margin-bottom: 2px; min-width: 6mm; }
  .item-preco { font-weight: 700; font-size: 11.5pt; color: #d4af37; white-space: nowrap; }
  .item-desc { font-size: 8.5pt; color: #c9bda3; margin-top: .8mm; font-style: italic; line-height: 1.35; }
  .item-selo-destaque {
    display: inline-block; font-size: 6.5pt; font-weight: 700; letter-spacing: .5px;
    text-transform: uppercase; color: #0e0c0a; background: #d4af37;
    padding: 1px 5px; border-radius: 999px; margin-left: 5px; vertical-align: middle;
  }

  .rodape {
    text-align: center; margin-top: 10mm; padding-top: 5mm;
    border-top: 1px solid rgba(212,175,55,.3);
  }
  .rodape .msg {
    font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 12.5pt; color: #d4af37;
  }
  .rodape .contato { font-size: 8.5pt; color: #c9bda3; margin-top: 2mm; letter-spacing: .3px; }
`

function iconeOuFoto(item) {
  return item.foto
    ? `<img src="${item.foto}" alt="">`
    : (item.emoji || '🍫')
}

function renderItem(item) {
  return `
    <div class="item-row">
      <div class="item-avatar">${iconeOuFoto(item)}</div>
      <div class="item-corpo">
        <div class="item-linha1">
          <span class="item-nome">${item.nome}${item.destaque ? '<span class="item-selo-destaque">Mais pedido</span>' : ''}</span>
          <span class="item-leader"></span>
          <span class="item-preco">${R$(item.preco)}</span>
        </div>
        ${item.descricao ? `<div class="item-desc">${item.descricao}</div>` : ''}
      </div>
    </div>`
}

function renderCategoria(grupo) {
  return `
    <div class="categoria-bloco">
      <div class="categoria-titulo">${grupo.categoria}</div>
      ${grupo.itens.map(renderItem).join('')}
    </div>`
}

/** Monta o documento HTML completo do cardápio (usado tanto no PDF quanto na tela cheia) */
export function gerarHtmlCardapio({ config, grupos, empresa }) {
  const nome = config.nome_cardapio || empresa?.nome || 'Cardápio'
  const contato = empresa?.contato_etiqueta || ''
  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${nome}</title>
<style>${CSS_CARDAPIO}</style>
</head>
<body>
  <div class="cardapio-doc">
    <div class="capa">
      <div class="selo">🍫</div>
      <div class="marca">${nome}</div>
      <div class="subtitulo">${config.subtitulo || ''}</div>
    </div>
    <div class="divisor"><span class="diamante"></span></div>
    ${grupos.map(renderCategoria).join('')}
    <div class="rodape">
      <div class="msg">${config.mensagem_rodape || ''}</div>
      ${contato ? `<div class="contato">${contato}</div>` : ''}
    </div>
  </div>
</body>
</html>`
}

function abrirJanela(html) {
  const win = window.open('', '_blank', 'width=900,height=900,scrollbars=yes')
  if (!win) { alert('Permita pop-ups para gerar o cardápio.'); return null }
  win.document.write(html)
  win.document.close()
  win.focus()
  return win
}

/** Gera o PDF do cardápio (abre a janela de impressão nativa do navegador) */
export function gerarPdfCardapio({ config, grupos, empresa }) {
  const html = gerarHtmlCardapio({ config, grupos, empresa })
  const win = abrirJanela(html)
  if (!win) return
  setTimeout(() => { win.print() }, 400)
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

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'

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
        document.fonts.load('700 30pt "Playfair Display"'),
        document.fonts.load('800 15pt "Playfair Display"'),
        document.fonts.load('italic 500 14pt "Cormorant Garamond"'),
        document.fonts.load('600 14pt "Cormorant Garamond"'),
        document.fonts.load('700 12pt "Plus Jakarta Sans"'),
      ])
      await document.fonts.ready
    } catch { /* segue mesmo assim — melhor uma imagem com fonte de fallback do que travar */ }
  })
  return fontesPromise
}

async function renderizarComoImagem(elemento, { largura, escala = 2.5 } = {}) {
  const html2canvas = await getHtml2Canvas()
  const canvas = await html2canvas(elemento, {
    backgroundColor: '#0e0c0a',
    scale: escala,
    useCORS: true,
    width: largura,
    windowWidth: largura,
  })
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95))
}

/** CSS "de tela" — usado nas imagens (largura fixa de celular, sem folha A4) */
function cssImagem() {
  return CSS_CARDAPIO.replace(
    /\.cardapio-doc\s*{[^}]*}/,
    `.cardapio-doc { width: 720px; min-height: 0; margin: 0; padding: 28px 24px 34px; }`
  )
}

async function comContainerOffscreen(htmlInterno, largura, callback) {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-9999px'
  wrapper.style.top = '0'
  wrapper.innerHTML = `<style>${cssImagem()}</style>${htmlInterno}`
  document.body.appendChild(wrapper)
  // aguarda as fontes carregarem de verdade antes de "fotografar"
  await garantirFontesCarregadas()
  try {
    return await renderizarComoImagem(wrapper.firstElementChild ? wrapper : wrapper, { largura })
  } finally {
    document.body.removeChild(wrapper)
  }
}

/** Gera uma imagem (PNG) com o cardápio inteiro — ótimo pra Status/WhatsApp */
export async function gerarImagemCardapioCompleto({ config, grupos, empresa }) {
  const nome = config.nome_cardapio || empresa?.nome || 'Cardápio'
  const contato = empresa?.contato_etiqueta || ''
  const html = `
    <div class="cardapio-doc">
      <div class="capa">
        <div class="selo">🍫</div>
        <div class="marca">${nome}</div>
        <div class="subtitulo">${config.subtitulo || ''}</div>
      </div>
      <div class="divisor"><span class="diamante"></span></div>
      ${grupos.map(renderCategoria).join('')}
      <div class="rodape">
        <div class="msg">${config.mensagem_rodape || ''}</div>
        ${contato ? `<div class="contato">${contato}</div>` : ''}
      </div>
    </div>`
  return comContainerOffscreen(html, 720)
}

/** Gera uma imagem (PNG) de UM item só — pra promover um doce específico */
export async function gerarImagemItem(item, { empresa } = {}) {
  const contato = empresa?.contato_etiqueta || ''
  const html = `
    <div class="cardapio-doc" style="padding:34px 28px;">
      <div style="text-align:center;">
        <div class="item-avatar" style="width:96px;height:96px;font-size:44px;margin:0 auto 14px;">${iconeOuFoto(item)}</div>
        <div class="item-nome" style="font-size:22pt;">${item.nome}${item.destaque ? '<span class="item-selo-destaque">Mais pedido</span>' : ''}</div>
        ${item.descricao ? `<div class="item-desc" style="font-size:11pt;margin-top:8px;">${item.descricao}</div>` : ''}
        <div class="item-preco" style="font-size:20pt;display:block;margin-top:14px;">${R$(item.preco)}</div>
      </div>
      <div class="rodape">
        <div class="msg">Peça já! 🍫</div>
        ${contato ? `<div class="contato">${contato}</div>` : ''}
      </div>
    </div>`
  return comContainerOffscreen(html, 560)
}

/** Compartilha um blob de imagem via Web Share (WhatsApp etc.), com fallback pra download */
export async function compartilharImagem(blob, { nomeArquivo = 'cardapio.png', titulo = 'Cardápio', texto = '' } = {}) {
  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: titulo, text: texto })
      return 'compartilhado'
    } catch {
      // usuário cancelou — não faz nada
      return 'cancelado'
    }
  }
  // Fallback: baixa a imagem pro usuário anexar manualmente no WhatsApp
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'baixado'
}
