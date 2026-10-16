import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import '@fortawesome/fontawesome-free/css/all.css'
import { iniciarLayoutMode } from './composables/useLayoutMode.js'

// 👇 REGISTRO DO PWA
import { registerSW } from 'virtual:pwa-register'

// Atualiza silenciosamente — aplica na próxima vez que o usuário abrir o app
// Sem reload forçado, sem double refresh
const updateSW = registerSW({
  onNeedRefresh() {
    // Novo SW disponível: instala em background, aplica no próximo acesso
    updateSW(false)
  },
  onOfflineReady() {
    console.log('App pronto para uso offline')
  }
})

// Define cedo (antes de montar) se o layout é de desktop ou de celular
iniciarLayoutMode()

// Campos de data/hora: no desktop o navegador só abre o calendário ao clicar
// na setinha do campo. Aqui abrimos ao clicar em qualquer ponto do campo
// (inclusive nos campos invisíveis que cobrem o card "Data da compra").
document.addEventListener('click', (e) => {
  const el = e.target
  if (!(el instanceof HTMLInputElement)) return
  if (!['date', 'datetime-local', 'time', 'month'].includes(el.type)) return
  if (el.disabled || el.readOnly || typeof el.showPicker !== 'function') return
  try { el.showPicker() } catch { /* já aberto ou sem gesto do usuário */ }
}, true)

createApp(App)
  .use(createPinia())
  .mount('#app')