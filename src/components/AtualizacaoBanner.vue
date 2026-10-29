<template>
  <Teleport to="body">
    <Transition name="upd-slide">
      <div v-if="novaVersao && aviso" class="upd-banner" role="status" aria-live="polite">
        <i class="fas fa-circle-arrow-up upd-icon"></i>
        <div class="upd-texto">
          <strong>Nova versão disponível</strong>
          <span>Termine o que estiver fazendo e atualize.</span>
        </div>
        <button class="upd-btn upd-btn--sec" @click="adiarAtualizacao">Depois</button>
        <button class="upd-btn upd-btn--pri" @click="aplicarAtualizacao">Atualizar</button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { novaVersao, aviso, aplicarAtualizacao, adiarAtualizacao } from '../services/atualizacaoApp.js'
</script>

<style scoped>
.upd-banner {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  left: 12px;
  right: 12px;
  margin: 0 auto;
  max-width: 480px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--brown-dark);
  color: #fff;
  border-radius: var(--r-lg);
  box-shadow: 0 8px 28px rgba(30, 18, 8, 0.35);
}
.upd-icon { font-size: 1.3rem; color: var(--gold-light); flex-shrink: 0; }
.upd-texto { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.25; }
.upd-texto strong { font-size: .88rem; }
.upd-texto span { font-size: .74rem; opacity: .8; }
.upd-btn {
  border: 0; border-radius: var(--r-full);
  padding: 8px 14px; font-size: .8rem; font-weight: 700;
  cursor: pointer; flex-shrink: 0;
}
.upd-btn--pri { background: var(--gold-light); color: var(--brown-dark); }
.upd-btn--sec { background: transparent; color: rgba(255, 255, 255, .8); padding: 8px 6px; font-weight: 600; }

.upd-slide-enter-active, .upd-slide-leave-active { transition: transform .25s ease, opacity .25s ease; }
.upd-slide-enter-from, .upd-slide-leave-to { transform: translateY(-20px); opacity: 0; }
</style>
