<template>
  <!-- O SVG é gerado por etiquetasPdfCore.js (texto escapado) — mesmo motor da impressão. -->
  <div class="etq-prev" role="img" :aria-label="descricao" v-html="svg"></div>
</template>

<script setup>
import { computed } from 'vue'
import { montarSvgPreview } from '../composables/etiquetasPdfCore.js'

const props = defineProps({
  sabores: { type: Array, required: true },   // até 3 textos; o do meio é o destaque
  contato: { type: String, default: '' },
  estilo: { type: Object, default: null }
})

const svg = computed(() => montarSvgPreview(props.sabores, props.contato, props.estilo || undefined))
const descricao = computed(() => `Pré-visualização de etiquetas: ${props.sabores.slice(0, 3).join(', ')}`)
</script>

<style scoped>
.etq-prev {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 10px 8px;
  box-shadow: var(--shadow-sm);
  line-height: 0;
}
.etq-prev :deep(svg) { display: block; width: 100%; height: auto; }
</style>
