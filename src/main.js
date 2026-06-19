import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import '@fortawesome/fontawesome-free/css/all.css'

// 👇 REGISTRO DO PWA
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nova versão disponível. Atualizar agora?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App pronto para uso offline 📦')
  }
})

createApp(App)
  .use(createPinia())
  .mount('#app')