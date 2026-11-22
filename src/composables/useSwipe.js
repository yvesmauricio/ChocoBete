import { ref } from 'vue'

// Singleton: só uma linha com a folha de ações aberta por vez em todo o app.
// (O nome "swipe" ficou por histórico: antes as ações eram reveladas ao
// arrastar a linha; hoje abrem pelo botão ⋯.)
const openSwipeId = ref(null)

export function useSwipe() {
  function closeAll() { openSwipeId.value = null }
  return { openSwipeId, closeAll }
}
