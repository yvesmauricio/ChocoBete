<template>
  <header class="hdr">
    <div class="hdr-logo">
      <div class="hdr-logo-icon">🍫</div>
      <div class="hdr-text">
        <div class="hdr-name">{{ s.company.nome }}</div>
        <div class="hdr-slogan">{{ s.company.slogan }}</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="hdr-actions">
        <!-- Trocar perfil -->
        <button
          class="hdr-btn hdr-btn-perfil"
          title="Trocar perfil"
          @click="trocarPerfil"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M16 3h5v5M4 20L21 3M8 21H3v-5"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { inject } from 'vue'
import { useStore } from '../store.js'

const s = useStore()
const trocarPerfil = inject('trocarPerfil', () => {})
</script>
