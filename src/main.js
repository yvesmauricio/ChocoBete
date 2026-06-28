import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import '@fortawesome/fontawesome-free/css/all.css'

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
    console.log('App pronto para uso offline 📦')
  }
})

createApp(App)
  .use(createPinia())
  .mount('#app')