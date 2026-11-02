// Estado visual do botão de sincronização com o Drive (usado no cabeçalho do
// Admin e no da Bete, para os dois se comportarem igual).
//
//   saved   verde     tudo salvo no Drive
//   pending vermelho  há alterações neste aparelho que ainda não foram enviadas
//   syncing laranja   enviando agora
//   error   vermelho  falhou ou há conflito com outro aparelho (toque resolve)
import { computed } from 'vue'

export function useSyncIndicador(s) {
  const estado = computed(() => {
    if (s.syncStatus === 'error' || s.syncStatus === 'conflict') return 'error'
    if (s.syncStatus === 'syncing') return 'syncing'
    if (s.hasLocalChanges) return 'pending'
    return 'saved'
  })

  const clicavel = computed(() => estado.value === 'pending' || estado.value === 'error')

  const titulo = computed(() => {
    if (s.syncStatus === 'conflict') return 'Conflito: outro aparelho também alterou os dados — toque para escolher qual versão manter'
    if (estado.value === 'error') return 'Falha ao salvar no Drive — toque para tentar de novo'
    if (estado.value === 'syncing') return 'Salvando no Drive…'
    if (estado.value === 'pending') return 'Precisa salvar: há alterações ainda não enviadas ao Drive — toque para enviar agora'
    return 'Tudo salvo no Drive'
  })

  const icone = computed(() => ({
    saved: 'fa-circle-check',
    pending: 'fa-cloud-arrow-up',
    syncing: 'fa-arrows-rotate fa-spin',
    error: 'fa-triangle-exclamation'
  }[estado.value]))

  return { estado, clicavel, titulo, icone }
}
