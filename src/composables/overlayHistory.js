const overlayStack = []

let listening = false
let suppressNextPop = false

function ensureListener() {
  if (listening || typeof window === 'undefined') return
  window.addEventListener('popstate', handlePopState)
  listening = true
}

function handlePopState() {
  if (suppressNextPop) {
    suppressNextPop = false
    return
  }

  const entry = overlayStack.pop()
  if (!entry) return
  entry.onBack()
}

export function pushOverlayHistory(onBack) {
  ensureListener()

  const token = Symbol('overlay-history')
  overlayStack.push({ token, onBack })
  window.history.pushState({ overlay: true }, '')

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
