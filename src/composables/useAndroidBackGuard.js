import { onMounted } from 'vue'
import { registrarFallbackNavegacao, iniciarProtecaoBackButton } from './overlayHistory.js'

/**
 * Impede que o botão/gesto "Voltar" do Android/Desktop feche o app de primeira.
 *
 * Comportamento:
 *   1. Modal aberto     → fecha o modal (overlayHistory já cuida disso)
 *   2. Sem modal, fora do Painel → volta para o Painel
 *   3. No Painel, sem modal → sai do app (comportamento esperado)
 *
 * Toda a lógica está centralizada em overlayHistory.js para evitar corridas
 * de timing entre múltiplos listeners de 'popstate'.
 */
export function useAndroidBackGuard({ getTab, setTab, tabInicial = 'painel' }) {
  onMounted(() => {
    // Registra o fallback: chamado quando "Voltar" não fecha nenhum modal.
    // Retorna true se navegou (consumiu o evento), false se deixa sair.
    registrarFallbackNavegacao(() => {
      const abaAtual = getTab()
      if (abaAtual !== tabInicial) {
        setTab(tabInicial)
        return true // consumiu — estava em outra aba, voltou ao Painel
      }
      return false  // já estava no Painel, deixa o navegador sair do app
    })

    // Empurra a sentinela inicial e registra o listener centralizado
    iniciarProtecaoBackButton()
  })
}