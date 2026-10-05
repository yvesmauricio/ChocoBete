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
  if (s.syncStatus === 'error') return 'error'
  if (s.syncStatus === 'syncing' || s.hasLocalChanges) return 'syncing'
  if (s.syncStatus === 'ok') return 'ok'
  return 'idle'
})
const temAlteracoesPendentes = computed(() => s.hasLocalChanges && s.syncStatus !== 'syncing')
const syncClicavel = computed(() => s.syncStatus === 'error' || temAlteracoesPendentes.value)
const syncTitulo = computed(() => {
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
  // Aviso explícito antes de enviar — principalmente pro caso de haver
  // mais de um aparelho usando essa mesma conta Google ao mesmo tempo
  // (ex.: celular da cozinha + computador em uso em paralelo): confirmar
  // aqui evita enviar sem perceber e sobrescrever algo mais novo no Drive.
  if (temAlteracoesPendentes.value) {
    const ok = await confirmar.ask(
      'Este aparelho tem alterações salvas aqui que ainda não foram enviadas ao Google Drive. Enviar agora vai atualizar o Drive com os dados deste aparelho — se outro aparelho também tiver mudanças recentes não enviadas, elas podem ser substituídas. Enviar mesmo assim?',
      { title: 'Enviar alterações pendentes', confirmLabel: 'Enviar agora', type: 'warning', icon: 'fas fa-cloud-arrow-up' }
    )
    if (!ok) return
  }
  s.syncImediato()
}
</script>
