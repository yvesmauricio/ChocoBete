<template>
  <div
    class="swipe-wrap"
    @touchstart.passive="onStart"
    @touchmove.passive="onMove"
    @touchend="onEnd"
    @click.capture="onClickCapture"
  >
    <!--
      Conteúdo principal desliza para a esquerda ao arrastar,
      revelando os botões de ação posicionados à direita (z-index 0).
    -->
    <div
      class="swipe-content"
      :style="{
        transform: `translateX(${currentX}px)`,
        transition: useTrans ? 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' : 'none'
      }"
    >
      <slot />
    </div>

    <!-- Botões revelados pelo deslize (slot "actions" no pai) -->
    <div class="swipe-btns" :style="{ width: width + 'px' }">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSwipe } from '../composables/useSwipe.js'

const props = defineProps({
  rowId: { type: String, required: true },
  width: { type: Number, default: 120 }   // largura total dos botões de ação (px)
})

const { openSwipeId } = useSwipe()
const isOpen = computed(() => openSwipeId.value === props.rowId)

const currentX  = ref(0)
const useTrans  = ref(false)

// Variáveis de toque (não reativas por performance)
let startX       = 0
let startY       = 0
let hasDragged   = false
let vertScroll   = false

// Anima para posição correta quando o estado global muda
watch(isOpen, (val) => {
  useTrans.value = true
  currentX.value = val ? -props.width : 0
})

// ── Eventos de toque ─────────────────────────────────────────
function onStart(e) {
  // Fecha qualquer outro SwipeRow aberto
  if (openSwipeId.value && openSwipeId.value !== props.rowId) {
    openSwipeId.value = null
  }
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  hasDragged = false
  vertScroll = false
  useTrans.value = false
}

function onMove(e) {
  if (vertScroll) return
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY

  // Detecta scroll vertical (prioriza scroll da página)
  if (!hasDragged && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
    vertScroll = true
    return
  }

  if (Math.abs(dx) > 5) hasDragged = true
  if (!hasDragged) return

  const base = isOpen.value ? -props.width : 0
  currentX.value = Math.min(0, Math.max(-props.width, base + dx))
}

function onEnd() {
  if (!hasDragged || vertScroll) return
  useTrans.value = true
  const threshold = props.width * 0.35
  
  if (currentX.value < -threshold) {
    // Abre: define como o row ativo global
    if (openSwipeId.value !== props.rowId) openSwipeId.value = props.rowId
    else currentX.value = -props.width          // já aberto, snap para posição total
  } else {
    // Fecha
    if (openSwipeId.value === props.rowId) openSwipeId.value = null
    else currentX.value = 0                     // snap de volta
  }
}

// ── Captura de clique ─────────────────────────────────────────
function onClickCapture(e) {
  if (!isOpen.value) return                        // nada a fazer, row fechado
  if (e.target.closest('.swipe-btns')) return      // deixa clique no botão passar
  e.stopPropagation()                              // toque no conteúdo: só fecha
  openSwipeId.value = null
}
</script>

<style scoped>
.swipe-wrap {
  position: relative;
  overflow: hidden;
  background: var(--surface, #fff);
  margin: 0 12px 8px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--r-md, 10px);
  box-shadow: 0 1px 3px rgba(61,32,8,.05);
}

/* Conteúdo principal: fica na frente, desloca-se para a esquerda */
.swipe-content {
  position: relative;
  z-index: 1;
  width: 100%;
  background: var(--card, #fff);
}

/* Botões de ação: sempre à direita, revelados conforme o conteúdo desliza */
.swipe-btns {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  z-index: 0;
  overflow: hidden;
  background: var(--surface, #fff);
}

/* A divisória precisa ficar no wrapper fixo, não no conteúdo que desliza */
:deep(.list-row) {
  border-bottom: none;
}
</style>
