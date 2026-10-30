// Controle de atualização do app (PWA).
// - Confere se há versão nova ao abrir, ao voltar pro app e a cada 10 min.
// - Quando a versão nova termina de baixar, liga `novaVersao` → o
//   AtualizacaoBanner.vue mostra o aviso. NADA é recarregado sozinho:
//   quem decide o momento é o usuário (evita perder algo não salvo).
import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import { versaoInstalada, buscarVersaoPublicada } from './versaoApp.js'

export const novaVersao = ref(false)   // há versão nova pronta pra aplicar?
export const aviso = ref(true)         // o aviso está visível? (o "Depois" apenas esconde)

let updateSW = null
let registro = null   // registro do service worker (pra pedir verificação manual)
const INTERVALO_MS = 10 * 60 * 1000

export function iniciarAtualizacaoApp() {
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      registro = reg
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

const esperar = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Verificação manual (botão em Ajustes). Pergunta ao servidor qual versão está publicada e
 * pede ao service worker pra procurar atualização, esperando até ~20 s a nova terminar de baixar.
 * Estados: 'offline' | 'erro' | 'nova' (pronta pra aplicar) | 'diferente' (publicada, ainda
 * não chegou aqui) | 'atualizado'. `publicada` é o conteúdo do version.json (ou null).
 */
export async function buscarAtualizacaoAgora() {
  if (!navigator.onLine) return { estado: 'offline', publicada: null }
  const publicada = await buscarVersaoPublicada()
  if (registro) {
    try { await registro.update() } catch { /* sem rede no meio do caminho: segue com o que há */ }
    for (let i = 0; i < 40 && !novaVersao.value; i++) {
      if (!registro.installing && !registro.waiting) break
      await esperar(500)
    }
    await esperar(300) // dá tempo do aviso "nova versão pronta" chegar
  }
  if (novaVersao.value) return { estado: 'nova', publicada }
  if (!publicada) return { estado: 'erro', publicada: null }
  const diferente = publicada.commit && versaoInstalada.commit && publicada.commit !== versaoInstalada.commit
  return { estado: diferente ? 'diferente' : 'atualizado', publicada }
}

/**
 * Último recurso quando o app não atualiza: remove o service worker e o cache DO APP e recarrega.
 * NÃO apaga seus dados (ficam no banco do aparelho, que não é tocado aqui). Preserva os caches de
 * fontes/ícones pra não ficar sem eles caso a internet caia logo depois.
 * Exige internet e servidor respondendo, senão o app poderia não conseguir reabrir.
 */
export async function forcarAtualizacaoCompleta() {
  if (!navigator.onLine) throw new Error('Precisa de internet para forçar a atualização.')
  const publicada = await buscarVersaoPublicada()
  if (!publicada) throw new Error('Não consegui falar com o servidor agora. Tente de novo com internet.')
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
  await Promise.all(regs.map(r => r.unregister()))
  if (typeof caches !== 'undefined') {
    const chaves = await caches.keys()
    await Promise.all(chaves.filter(k => !/^(font-awesome|google-fonts)/.test(k)).map(k => caches.delete(k)))
  }
  location.reload()
}
