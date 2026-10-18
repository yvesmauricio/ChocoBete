// Controle de atualização do app (PWA).
// - Confere se há versão nova ao abrir, ao voltar pro app e a cada 10 min.
// - Quando a versão nova termina de baixar, liga `novaVersao` → o
//   AtualizacaoBanner.vue mostra o aviso. NADA é recarregado sozinho:
//   quem decide o momento é o usuário (evita perder algo não salvo).
import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

export const novaVersao = ref(false)   // há versão nova pronta pra aplicar?
export const aviso = ref(true)         // o aviso está visível? (o "Depois" apenas esconde)

let updateSW = null
const INTERVALO_MS = 10 * 60 * 1000

export function iniciarAtualizacaoApp() {
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const verificar = () => {
        if (navigator.onLine) reg.update().catch(() => {})
      }
      setInterval(verificar, INTERVALO_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        verificar()
        // Voltou pro app com atualização pendente → mostra o aviso de novo
        if (novaVersao.value) aviso.value = true
      })
    },
    onNeedRefresh() {
      novaVersao.value = true
      aviso.value = true
    },
    onOfflineReady() {
      console.log('App pronto para uso offline')
    }
  })
}

export function aplicarAtualizacao() {
  if (!updateSW) return location.reload()
  updateSW(true)                         // ativa o SW novo e recarrega
  // Rede de segurança: se por algum motivo não recarregar, força.
  setTimeout(() => location.reload(), 4000)
}

export function adiarAtualizacao() {
  aviso.value = false
}
