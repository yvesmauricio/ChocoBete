<template>
  <header class="hdr">
    <div class="hdr-logo">
      <div class="hdr-logo-icon">
        <img v-if="s.company.logo" :src="s.company.logo" alt="">
        <i v-else class="fas fa-cookie-bite"></i>
      </div>
      <div class="hdr-text">
        <div class="hdr-name">{{ s.company.nome || 'Minha confeitaria' }}</div>
        <div class="hdr-slogan">{{ s.company.slogan }}</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="hdr-actions">
        <!-- Sync com o Google Drive — mesmo tamanho do botão "trocar
             perfil" (não mais uma bolinha discreta), porque nesse perfil
             o envio não é automático a cada alteração: o app fica com
             dados pendentes até alguém tocar aqui, então precisa ser bem
             visível quando isso acontece. -->
        <!-- Sempre visível quando o Drive está conectado:
             verde = salvo · vermelho = precisa salvar/falhou · laranja = salvando -->
        <button
          v-if="s.googleDriveConfigured"
          class="hdr-btn hdr-btn-sync"
          :class="`hdr-btn-sync--${syncEstado}`"
          :disabled="!syncClicavel"
          :title="syncTitulo"
          :aria-label="syncTitulo"
          @click="onClickSync"
        >
          <i class="fas" :class="syncIcone"></i>
        </button>

        <!-- Trocar perfil -->
        <button
          class="hdr-btn hdr-btn-perfil"
          title="Trocar perfil"
          @click="trocarPerfil"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { inject } from 'vue'
import { useStore } from '../store.js'
import { useSyncIndicador } from '../composables/useSyncIndicador.js'

const s = useStore()
const trocarPerfil = inject('trocarPerfil', () => {})

// Esse perfil (Admin) não sincroniza sozinho a cada alteração — por isso o
// botão é clicável nos estados "precisa salvar" (pendente) e "erro".
const { estado: syncEstado, clicavel: syncClicavel, titulo: syncTitulo, icone: syncIcone } = useSyncIndicador(s)

async function onClickSync() {
  if (!syncClicavel.value) return
  // O envio agora confere se outro aparelho salvou no Drive desde a última
  // sincronização: se sim, abre a decisão (não sobrescreve nada sem escolha),
  // então não precisa mais do aviso genérico antes de enviar.
  await s.syncImediato({ manual: true })
}
</script>
