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

const s = useStore()
const trocarPerfil = inject('trocarPerfil', () => {})
</script>
