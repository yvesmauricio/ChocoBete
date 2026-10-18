<template>
  <header class="hdr">
    <div class="hdr-logo">
      <div class="hdr-logo-icon">
        <img v-if="s.company.logo" :src="s.company.logo" alt="">
        <i v-else class="fas fa-cookie-bite"></i>
      </div>
      <div class="hdr-text">
        <div class="hdr-name">{{ s.company.nome }}</div>
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
        <button
          v-if="s.googleDriveConfigured && syncEstado !== 'idle'"
          class="hdr-btn hdr-btn-sync"
          :class="`hdr-btn-sync--${syncEstado}`"
          :disabled="!syncClicavel"
          :title="syncTitulo"
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
import { inject, computed } from 'vue'
import { useStore } from '../store.js'
import { useConfirm } from '../composables/useConfirm.js'

const s = useStore()
const trocarPerfil = inject('trocarPerfil', () => {})
const confirmar = useConfirm()

// Esse perfil (Admin) não sincroniza sozinho a cada alteração — diferente
// do perfil da Bete. Por isso o botão precisa continuar clicável também
// no estado "pendente" (alterações aguardando envio), não só quando dá erro.
const syncEstado = computed(() => {
  if (s.syncStatus === 'error' || s.syncStatus === 'conflict') return 'error'
  if (s.syncStatus === 'syncing' || s.hasLocalChanges) return 'syncing'
  if (s.syncStatus === 'ok') return 'ok'
  return 'idle'
})
const temAlteracoesPendentes = computed(() => s.hasLocalChanges && s.syncStatus !== 'syncing')
const syncClicavel = computed(() => s.syncStatus === 'error' || s.syncStatus === 'conflict' || temAlteracoesPendentes.value)
const syncTitulo = computed(() => {
  if (s.syncStatus === 'conflict') return 'Outro aparelho também alterou os dados — toque para escolher qual versão manter'
  if (s.syncStatus === 'error') return 'Falha ao salvar no Drive — toque para tentar de novo'
  if (s.syncStatus === 'syncing') return 'Salvando no Drive…'
  if (s.hasLocalChanges) return 'Há alterações que ainda não foram enviadas ao Drive — toque para enviar agora'
  if (s.syncStatus === 'ok') return 'Salvo no Drive'
  return ''
})
const syncIcone = computed(() => ({
  syncing: 'fa-cloud-arrow-up fa-beat-fade',
  ok: 'fa-cloud-arrow-up',
  error: 'fa-triangle-exclamation',
  idle: 'fa-cloud-arrow-up'
}[syncEstado.value]))

async function onClickSync() {
  if (!syncClicavel.value) return
  // O envio agora confere se outro aparelho salvou no Drive desde a última
  // sincronização: se sim, abre a decisão (não sobrescreve nada sem escolha),
  // então não precisa mais do aviso genérico antes de enviar.
  await s.syncImediato({ manual: true })
}
</script>
