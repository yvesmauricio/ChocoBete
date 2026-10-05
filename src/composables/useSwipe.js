import { ref } from 'vue'

// Singleton: só um SwipeRow aberto por vez em toda a aplicação
const openSwipeId = ref(null)

// Dica de "arraste para revelar ações": mostrada como uma pequena animação de
// "espiada" (peek) na primeira linha de lista que o usuário encontrar, uma
// única vez por dispositivo — para ensinar o gesto sem precisar de texto/
// tutorial. Guardado no localStorage pra nunca mais repetir depois de visto.
const HINT_KEY = 'choco_swipe_hint_visto'
let hintClaimed = false
try { hintClaimed = !!localStorage.getItem(HINT_KEY) } catch { /* localStorage indisponível */ }

export function useSwipe() {
  function closeAll() { openSwipeId.value = null }

  // Entre várias linhas montadas ao mesmo tempo, só a primeira a chamar isso
  // recebe `true` — essa fica responsável por mostrar o peek; as demais nunca
  // mais tentam (mesma sessão ou sessões futuras).
  function claimSwipeHint() {
    if (hintClaimed) return false
    hintClaimed = true
    try { localStorage.setItem(HINT_KEY, '1') } catch { /* localStorage indisponível */ }
    return true
  }

  return { openSwipeId, closeAll, claimSwipeHint }
}
