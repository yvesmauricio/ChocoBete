import { ref } from 'vue'

// Singleton: só um SwipeRow aberto por vez em toda a aplicação
const openSwipeId = ref(null)

export function useSwipe() {
  function closeAll() { openSwipeId.value = null }
  return { openSwipeId, closeAll }
}
