import { ref, computed } from 'vue'
import { temOverlayAberto } from './overlayHistory.js'

// ── Modo de layout: celular × desktop ───────────────────────────────────
// Preferência do usuário (guardada só neste aparelho/navegador):
//   'auto'    → decide sozinho pela largura da janela (≥ 1024px = desktop)
//   'celular' → sempre a coluna estreita com barra inferior
//   'desktop' → sempre menu lateral + área de conteúdo larga
// O resultado vira a classe `is-desktop` no <html>, que o CSS usa pra
// trocar o layout (ver bloco "DESKTOP" no fim de assets/main.css).

const STORAGE_KEY = 'choco_modo_layout'
const QUERY_DESKTOP = '(min-width: 1024px)'

export const MODOS_LAYOUT = [
  { id: 'auto',    label: 'Automático', icon: 'fas fa-wand-magic-sparkles', desc: 'Usa o layout de computador em telas largas e o de celular nas estreitas.' },
  { id: 'celular', label: 'Celular',    icon: 'fas fa-mobile-screen',       desc: 'Sempre a tela estreita, com barra de navegação embaixo.' },
  { id: 'desktop', label: 'Desktop',    icon: 'fas fa-desktop',             desc: 'Sempre o layout de computador, com menu lateral e área larga.' },
]

function lerPreferencia() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (MODOS_LAYOUT.some(m => m.id === v)) return v
  } catch { /* localStorage indisponível */ }
  return 'auto'
}

const preferencia = ref(lerPreferencia())
const telaLarga = ref(false)
let mql = null
let iniciado = false

const isDesktop = computed(() =>
  preferencia.value === 'desktop' || (preferencia.value === 'auto' && telaLarga.value)
)

function aplicarClasse() {
  document.documentElement.classList.toggle('is-desktop', isDesktop.value)
}

// Atalhos de teclado globais do modo desktop.
// Esc fecha o modal/overlay do topo da pilha — reaproveita o mesmo caminho do
// botão "Voltar" (history.back → overlayHistory), então qualquer modal que já
// fecha com o Voltar do Android também fecha com Esc, sem tocar em cada um.
function onKeydown(e) {
  if (!isDesktop.value) return
  if (e.key === 'Escape' && !e.defaultPrevented) {
    const alvo = e.target
    // não rouba o Esc de campos de edição (ex.: cancelar uma digitação)
    if (alvo?.closest?.('input, textarea, select, [contenteditable="true"]')) {
      alvo.blur?.()
      return
    }
    // Só age se houver mesmo um modal registrado na pilha — assim nunca
    // "volta" a página por engano quando não há nada aberto.
    if (temOverlayAberto()) {
      e.preventDefault()
      window.history.back()
    }
  }
}

// ── Altura do cabeçalho fixo da aba ativa (--tab-hdr-h) ──────────────────
// Blocos que precisam "grudar" logo abaixo do cabeçalho (resumo/filtros do
// Financeiro, passos das Etiquetas, painel do lote na Cozinha) usam essa
// variável como `top`, em vez de 0 — assim empilham em vez de se cobrirem.
let _hdrH = -1
function medirCabecalho() {
  const el = [...document.querySelectorAll('.main .tab-hdr')].find(e => e.offsetParent !== null)
  const h = el ? Math.round(el.getBoundingClientRect().height) : 0
  if (h !== _hdrH) {
    _hdrH = h
    document.documentElement.style.setProperty('--tab-hdr-h', h + 'px')
  }
}
let _raf = 0
function agendarMedicao() {
  if (_raf) return
  _raf = requestAnimationFrame(() => { _raf = 0; medirCabecalho() })
}
function observarCabecalho() {
  window.addEventListener('resize', agendarMedicao)
  const main = document.querySelector('.main')
  const ligar = (alvo) => {
    new MutationObserver(agendarMedicao).observe(alvo, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'],
    })
  }
  if (main) ligar(main)
  else {
    // .main só existe depois que o app monta e o perfil é escolhido
    const espera = new MutationObserver(() => {
      const m = document.querySelector('.main')
      if (m) { espera.disconnect(); ligar(m); agendarMedicao() }
    })
    espera.observe(document.body, { childList: true, subtree: true })
  }
  agendarMedicao()
}

// Chamar uma vez no main.js, antes de montar o app (evita "piscar" o layout).
export function iniciarLayoutMode() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  mql = window.matchMedia(QUERY_DESKTOP)
  telaLarga.value = mql.matches
  mql.addEventListener?.('change', (e) => {
    telaLarga.value = e.matches
    aplicarClasse()
  })
  window.addEventListener('keydown', onKeydown)
  aplicarClasse()
  observarCabecalho()
}

export function useLayoutMode() {
  function definirModo(id) {
    if (!MODOS_LAYOUT.some(m => m.id === id)) return
    preferencia.value = id
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* sem storage: vale só nesta sessão */ }
    aplicarClasse()
  }
  return { preferencia, isDesktop, definirModo }
}
