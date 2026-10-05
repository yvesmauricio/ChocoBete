<template>
  <div
    class="finance-list-row"
    :class="[variantClass, { selected, muted, interactive }]"
    @click="$emit('click')"
  >
    <slot v-if="$slots.default" />
    <template v-else>
      <div v-if="$slots.icon" class="finance-row-icon">
        <slot name="icon" />
      </div>
      <div class="finance-row-main">
        <div class="finance-row-title"><slot name="title" /></div>
        <div v-if="$slots.sub" class="finance-row-sub"><slot name="sub" /></div>
      </div>
      <div v-if="$slots.right" class="finance-row-right">
        <slot name="right" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
  interactive: { type: Boolean, default: true }
})

defineEmits(['click'])

const variantClass = computed(() => ({
  entrada: 'finance-row-entrada',
  operacional: 'finance-row-operacional',
  saida: 'finance-row-operacional',
  pessoal: 'finance-row-pessoal',
  interna: 'finance-row-interna'
}[props.variant] || ''))
</script>

<style scoped>
.finance-list-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 5px solid transparent;
  border-radius: var(--r-md);
  box-shadow: var(--shadow-sm);
  transition: background 0.15s, border-left-color 0.15s;
}

.finance-list-row.interactive { cursor: pointer; }
.finance-list-row.interactive:active { background: var(--cream); }
.finance-list-row.selected { background: var(--gold-bg); }
.finance-list-row.muted { opacity: .65; background: var(--gold-bg); }

.finance-row-entrada { border-left-color: var(--green); }
.finance-row-operacional { border-left-color: var(--red); }
.finance-row-pessoal { border-left-color: var(--purple); }
.finance-row-interna { border-left-color: var(--gold); }

.finance-row-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.finance-row-main {
  flex: 1;
  min-width: 0;
}

.finance-row-title {
  font-size: .9rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.finance-row-sub {
  font-size: .75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.finance-row-right {
  text-align: right;
  flex-shrink: 0;
}
</style>
