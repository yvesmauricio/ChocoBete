<template>
  <div v-if="subs?.length" class="plan-sub-list sub-composicao">
    <div
      v-for="sub in subs"
      :key="sub.chave || sub.id"
      class="plan-sub-item"
      :class="{ 'sub-item-receita': sub.tipo === 'receita' }"
      :style="{ paddingLeft: ((sub.nivel || 1) - 1) * 14 + 'px' }"
    >
      <span>
        <span class="c-brown">└</span>
        <i v-if="sub.tipo === 'receita'" class="fas fa-mortar-pestle sub-ico"></i>
        {{ sub.nome }}
      </span>
      <span>{{ fmtQ(sub.total, sub.unidade) }}</span>
    </div>
  </div>
</template>

<script setup>
import { fmtQtd as fmtQ } from '../utils.js'

defineProps({
  subs: { type: Array, default: () => [] }
})
</script>

<style scoped>
.sub-item-receita { font-weight: 700; }
.sub-ico { font-size: .65rem; margin: 0 2px; opacity: .75; }
</style>
