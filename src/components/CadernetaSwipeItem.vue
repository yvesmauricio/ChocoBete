<template>
  <SwipeRow :row-id="rowId" :width="actionsWidth">
    <div class="swipe-front" @click="$emit('click')">
      <slot />
    </div>
    <template #actions>
      <!-- Receber (verde) — só aparece quando actions inclui 'receive' -->
      <button v-if="actions.includes('receive')" class="swipe-action-btn receive" @click.stop="$emit('receive')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/>
        </svg>
        <span>Receber</span>
      </button>
      <button v-if="actions.includes('edit')" class="swipe-action-btn edit" @click.stop="$emit('edit')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>Editar</span>
      </button>
      <button v-if="actions.includes('delete')" class="swipe-action-btn del" @click.stop="$emit('delete')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        <span>Excluir</span>
      </button>
    </template>
  </SwipeRow>
</template>

<script setup>
import { computed } from 'vue'
import SwipeRow from './SwipeRow.vue'
import { useSwipe } from '../composables/useSwipe.js'

const props = defineProps({
  id: [String, Number],
  // Namespace opcional pra evitar colisão de rowId entre listas diferentes
  // (ex.: um cliente e uma loja podem ter o mesmo id numérico)
  scope: { type: String, default: 'cad' },
  // Lista de ações visíveis: 'receive' | 'edit' | 'delete'
  actions: { type: Array, default: () => ['edit', 'delete'] }
})
defineEmits(['click', 'edit', 'delete', 'receive'])

// Id único usado pelo singleton global de swipe (useSwipe): garante que só
// uma linha fique aberta por vez em todo o app, não só dentro desta lista.
const rowId = computed(() => `${props.scope}-${props.id}`)

// Largura da área de ações proporcional ao número de botões
const actionsWidth = computed(() => props.actions.length * 72)

const { openSwipeId } = useSwipe()

defineExpose({
  close: () => { if (openSwipeId.value === rowId.value) openSwipeId.value = null },
  id: props.id
})
</script>
