<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="state.visible" class="confirm-overlay" @click.self="respond(false)">
        <div class="confirm-box">
          <div class="confirm-icon-wrap" :class="`icon-${state.type}`">
            <i :class="state.icon"></i>
          </div>
          <h3 class="confirm-title">{{ state.title }}</h3>
          <p class="confirm-msg">{{ state.message }}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary" @click="respond(false)">{{ state.cancelLabel }}</button>
            <button class="btn" :class="btnClass" @click="respond(true)">{{ state.confirmLabel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useConfirm } from '../composables/useConfirm.js'

const { state, respond } = useConfirm()

const btnClass = computed(() => ({
  danger:  'btn-danger',
  warning: 'btn-warning',
  primary: 'btn-primary'
}[state.type] ?? 'btn-primary'))
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.48);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.confirm-box {
  background: var(--card);
  border-radius: 20px 20px 0 0;
  padding: 32px 24px 28px;
  width: 100%;
  max-width: 480px;
  text-align: center;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.2);
}

.confirm-icon-wrap {
  width: 60px; height: 60px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.6rem;
  margin: 0 auto 16px;
}
.icon-danger  { background: #fee2e2; color: #dc2626; }
.icon-warning { background: #fff7ed; color: #ea580c; }
.icon-primary { background: var(--gold-bg); color: var(--gold-dark); }

.confirm-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--brown-dark, #3b1c08);
  margin-bottom: 8px;
}

.confirm-msg {
  font-size: 0.875rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 24px;
  white-space: pre-line; /* permite \n no resumo do lote */
  text-align: left;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}
.confirm-actions .btn { flex: 1; }

/* Animação: overlay fade + box sobe do fundo */
.confirm-fade-enter-active { transition: opacity 0.2s ease; }
.confirm-fade-leave-active { transition: opacity 0.18s ease; }
.confirm-fade-enter-active .confirm-box { transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1); }
.confirm-fade-leave-active .confirm-box { transition: transform 0.18s ease; }
.confirm-fade-enter-from,
.confirm-fade-leave-to    { opacity: 0; }
.confirm-fade-enter-from .confirm-box,
.confirm-fade-leave-to .confirm-box    { transform: translateY(60px); }
</style>
