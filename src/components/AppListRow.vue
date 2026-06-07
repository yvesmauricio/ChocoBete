<template>
  <SwipeRow :row-id="id" :width="actionsWidth">
    <div class="list-row" :class="accentClass" @click="$emit('click')">
      <div v-if="accentClass" class="row-accent-bar"></div>
      <div v-if="$slots.icon" class="row-icon-wrap">
        <slot name="icon" />
      </div>
      <div class="row-info">
        <div class="row-name"><slot name="title" /></div>
        <div class="row-sub"><slot name="sub" /></div>
      </div>
      <div v-if="$slots.right" class="row-right">
        <slot name="right" />
      </div>
      <i v-if="chevron" class="fas fa-chevron-right row-chevron"></i>
    </div>
    <template #actions>
      <slot name="actions" />
    </template>
  </SwipeRow>
</template>

<script setup>
import SwipeRow from './SwipeRow.vue'
defineProps({
  id: { type: String, required: true },
  actionsWidth: { type: Number, default: 120 },
  chevron: { type: Boolean, default: true },
  accentClass: { type: String, default: '' }
})
defineEmits(['click'])
</script>

<style scoped>
.list-row { position: relative; }
.row-icon-wrap {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 4px;
}
.row-accent-bar {
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 4px;
  border-radius: 0 4px 4px 0;
  z-index: 2;
}
/* Cores de Destaque sugeridas */
.list-row.gold .row-accent-bar { background: var(--gold); }
.list-row.blue .row-accent-bar { background: var(--blue); }
</style>