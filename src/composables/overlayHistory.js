const overlayStack = []

let listening = false
let suppressNextPop = false
let sentinelaAtiva = false

// Callback registrado pelo App.vue para navegação de aba quando o "voltar"
// não corresponde ao fechamento de nenhum modal.
let fallbackNavegacao = null // () => boolean

export function temOverlayAberto() {
  return overlayStack.length > 0
}

/**
 * Registra o fallback chamado quando o usuário aperta "Voltar" e não há
 * nenhum modal/overlay para fechar. Deve retornar `true` se a navegação
 * tratou o evento (trocou de aba), ou `false` se não havia mais nada
 * a fazer (deixa o navegador seguir o curso normal, podendo sair do app).
 */
export function registrarFallbackNavegacao(fn) {
  fallbackNavegacao = fn
}

function empurrarSentinela() {
  if (sentinelaAtiva) return
  window.history.pushState({ appSentinela: true }, '')
  sentinelaAtiva = true
}

function ensureListener() {
  if (listening || typeof window === 'undefined') return
  window.addEventListener('popstate', handlePopState)
  listening = true
}

function handlePopState() {
  sentinelaAtiva = false

  if (suppressNextPop) {
    suppressNextPop = false
    empurrarSentinela()
    return
  }

  const entry = overlayStack.pop()
  if (entry) {
    // Havia modal aberto: fecha-o e rearma a sentinela
    entry.onBack()
    empurrarSentinela()
    return
  }

  // Nenhum modal aberto: tenta fallback de navegação (voltar para aba inicial)
  // Se o fallback tratou, rearma. Se não, deixa o navegador sair do app.
  const navegou = fallbackNavegacao?.()
  if (navegou) {
    empurrarSentinela()
  }
}

export function pushOverlayHistory(onBack) {
  ensureListener()
  const token = Symbol('overlay-history')
  overlayStack.push({ token, onBack })
  window.history.pushState({ overlay: true }, '')
  sentinelaAtiva = false // entrada do overlay ocupa o lugar da sentinela
  return token
}

export function closeOverlayHistory(token, fallback) {
  if (!token) {
    fallback?.()
    return
  }

  const top = overlayStack.at(-1)
  if (top?.token === token) {
    window.history.back()
    return
  }

  const idx = overlayStack.findIndex(entry => entry.token === token)
  if (idx >= 0) overlayStack.splice(idx, 1)
  fallback?.()
}

/**
 * Inicializa a proteção contra o botão "Voltar" fechar o app de primeira.
 * Chamar uma única vez no onMounted do App.vue.
 */
export function iniciarProtecaoBackButton() {
  ensureListener()
  empurrarSentinela()
}