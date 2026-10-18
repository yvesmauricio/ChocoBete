import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import '@fortawesome/fontawesome-free/css/all.css'
import { iniciarLayoutMode } from './composables/useLayoutMode.js'

// 👇 PWA: confere atualizações e avisa o usuário (ver AtualizacaoBanner.vue)
import { iniciarAtualizacaoApp } from './services/atualizacaoApp.js'
iniciarAtualizacaoApp()

// Define cedo (antes de montar) se o layout é de desktop ou de celular
iniciarLayoutMode()

createApp(App)
  .use(createPinia())
  .mount('#app')