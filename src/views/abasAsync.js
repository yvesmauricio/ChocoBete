// Telas carregadas sob demanda: cada uma vira um chunk próprio e só é baixada/
// executada na primeira vez que a pessoa abre a aba (ou o perfil que a usa).
// A tela de seleção de perfil (SelecaoPerfil) continua estática: é a 1ª a aparecer.
import { defineAsyncComponent } from 'vue'
import AbaCarregando from '../components/AbaCarregando.vue'
import AbaErro from '../components/AbaErro.vue'

const aba = (loader) => defineAsyncComponent({
  loader,
  loadingComponent: AbaCarregando,
  errorComponent: AbaErro,
  delay: 150 // chunk em cache abre sem piscar o "Abrindo…"
})

export const TabReceitas     = aba(() => import('./TabReceitas.vue'))
export const TabProducao     = aba(() => import('./TabProducao.vue'))
export const TabPainel       = aba(() => import('./TabPainel.vue'))
export const TabInsumos      = aba(() => import('./TabInsumos.vue'))
export const TabInteligencia = aba(() => import('./TabInteligencia.vue'))
export const TabFinanceiro   = aba(() => import('./TabFinanceiro.vue'))
export const TabCozinha      = aba(() => import('./TabCozinha.vue'))
export const TabAjustes      = aba(() => import('./TabAjustes.vue'))
export const TabBriefing     = aba(() => import('./TabBriefing.vue'))
export const TabEtiquetas    = aba(() => import('./TabEtiquetas.vue'))
export const TabCardapio     = aba(() => import('./TabCardapio.vue'))
export const TabCaderneta    = aba(() => import('./TabCaderneta.vue'))
