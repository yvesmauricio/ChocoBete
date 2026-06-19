<template>
  <Teleport to="body">
    <div class="modal-bg" @click.self="!persistent && emit('close')">
      <div class="modal-box">
        <div class="modal-hdr">
          <button class="modal-back" @click="emit('close')">
            <i class="fas fa-arrow-left"></i>
          </button>
          <span class="modal-title"><slot name="title">{{ title }}</slot></span>
          <div class="modal-hdr-end"></div>
        </div>
        <div class="modal-body"><slot /></div>
        <div v-if="$slots.foot" class="modal-foot"><slot name="foot" /></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({ title: String, persistent: Boolean })
const emit = defineEmits(['close'])
</script>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: stretch;
  justify-content: center;
  animation: modalFadeIn .15s ease;
}
@keyframes modalFadeIn {
  from { opacity: 0 }
  to   { opacity: 1 }
}

.modal-box {
  width: 100%;
  max-width: 480px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  animation: modalSlideIn .2s cubic-bezier(.34,1.56,.64,1);
}
@keyframes modalSlideIn {
  from { transform: translateX(28px); opacity: 0 }
  to   { transform: translateX(0);    opacity: 1 }
}

/* ── Header — barra de navegação estilo app nativo ── */
.modal-hdr {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px 0 4px;
  padding-top: max(0px, env(safe-area-inset-top));
  min-height: calc(56px + max(0px, env(safe-area-inset-top)));
  background: var(--brown);
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.modal-back {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.85);
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--t), transform var(--t);
}
.modal-back:active {
  background: rgba(255,255,255,.12);
  transform: scale(.9);
}

.modal-title {
  flex: 1;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -.1px;
}

.modal-hdr-end {
  width: 44px;
  flex-shrink: 0;
}

/* ── Body — scroll interno ── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  background: var(--bg);
}

/* ── Footer — barra de ação fixa ── */
.modal-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  padding-bottom: max(16px, calc(12px + env(safe-area-inset-bottom)));
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
