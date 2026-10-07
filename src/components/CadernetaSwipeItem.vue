<template>
  <SwipeRow :row-id="rowId" :width="actionsWidth">
    <div class="swipe-front" @click="$emit('click')">
      <slot />
    </div>
    <template #actions>
      <!-- Saldo devedor da cliente — só aparece quando a prop `saldo` é informada -->
      <div v-if="mostrarSaldo" class="swipe-saldo" :class="{ 'swipe-saldo--ok': !saldo }">
        <template v-if="saldo > 0">
          <span class="swipe-saldo-label">Deve</span>
          <span class="swipe-saldo-valor">R$ {{ saldoFmt }}</span>
        </template>
        <template v-else>
          <i class="fas fa-circle-check"></i>
          <span class="swipe-saldo-label">Em dia</span>
        </template>
      </div>
      <!-- Enviar comprovante por WhatsApp — só aparece quando actions inclui 'receipt' -->
      <button v-if="actions.includes('receipt')" class="swipe-action-btn receipt" @click.stop="$emit('receipt')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span>Comprovante</span>
      </button>
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
        <span>{{ deleteLabel }}</span>
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
  // Lista de ações visíveis: 'receipt' | 'receive' | 'edit' | 'delete'
  actions: { type: Array, default: () => ['edit', 'delete'] },
  // Texto do botão de remover (ex.: "Remover" quando a ação pode ser arquivar)
  deleteLabel: { type: String, default: 'Excluir' },
  // Saldo devedor (R$) mostrado junto das ações. null = não mostra o painel.
  saldo: { type: Number, default: null }
})
defineEmits(['click', 'edit', 'delete', 'receive', 'receipt'])

// Id único usado pelo singleton global de swipe (useSwipe): garante que só
// uma linha fique aberta por vez em todo o app, não só dentro desta lista.
const rowId = computed(() => `${props.scope}-${props.id}`)

const mostrarSaldo = computed(() => props.saldo !== null && props.saldo !== undefined)
const saldoFmt = computed(() =>
  Number(props.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
)
const LARGURA_SALDO = 104

// Largura da área de ações proporcional ao número de botões (+ painel de saldo, quando houver)
const actionsWidth = computed(() => props.actions.length * 72 + (mostrarSaldo.value ? LARGURA_SALDO : 0))

const { openSwipeId } = useSwipe()

defineExpose({
  close: () => { if (openSwipeId.value === rowId.value) openSwipeId.value = null },
  id: props.id
})
</script>
<style scoped>
.swipe-saldo {
  flex: 0 0 104px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; padding: 0 6px; text-align: center;
  background: var(--red-bg, #fef2f2); color: var(--red, #dc2626);
  border-left: 1px solid var(--border, #e5e7eb);
}
.swipe-saldo--ok { background: var(--green-bg, #f0fdf4); color: var(--green, #16a34a); }
.swipe-saldo i { font-size: 16px; }
.swipe-saldo-label { font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.swipe-saldo-valor { font-size: 14px; font-weight: 800; line-height: 1.1; white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>