import { ref } from 'vue'
import { pushOverlayHistory, closeOverlayHistory } from './overlayHistory.js'

/**
 * Gerencia uma pilha de modais com suporte ao botão Voltar do navegador.
 *
 * Uso:
 *   const { modal, abrirModal, fecharModal } = useModalStack()
 *
 *   abrirModal('receita')   → abre o modal "receita" (empilha histórico)
 *   fecharModal()           → fecha o modal atual e volta ao anterior
 *   fecharTudo()            → esvazia a pilha de uma vez
 */
export function useModalStack(initialValue = null) {
  const modal = ref(initialValue)
  const stack = [] // [{ token, previous }]

  function abrirModal(next) {
    const previous = modal.value
    const token = pushOverlayHistory(() => {
      stack.pop()
      modal.value = previous
    })
    stack.push({ token, previous })
    modal.value = next
  }

  function fecharModal() {
    const current = stack.at(-1)
    if (!current) {
      modal.value = null
      return
    }
    closeOverlayHistory(current.token, () => {
      stack.pop()
      modal.value = current.previous
    })
  }

  function fecharTudo() {
    while (stack.length) fecharModal()
  }

  return { modal, abrirModal, fecharModal, fecharTudo }
}
