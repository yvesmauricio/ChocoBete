<template>
  <div class="cat-filter-wrap">
    <div class="cat-chips chips-padded">
      <button
        v-for="item in normalizedItems"
        :key="item.value"
        class="chip"
        :class="{ active: modelValue === item.value }"
        @click="emit('update:modelValue', item.value)"
      >{{ item.label }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Barra de filtro por categoria (chips horizontais com scroll).
 *
 * Props:
 *   items        — Array de strings ['Todas', 'Trufa', 'Brigadeiro']
 *                  OU array de objetos [{ value: 'trufa', label: 'Trufa' }]
 *   modelValue   — valor ativo (v-model)
 *
 * Exemplos:
 *   <CategoryFilter v-model="catAtiva" :items="['Todas', 'Trufa', 'Pão de mel']" />
 *   <CategoryFilter v-model="filtroAtivo" :items="[{ value: '7dias', label: '7 Dias' }, ...]" />
 */
const props = defineProps({
  items: { type: Array, required: true },
  modelValue: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])

const normalizedItems = computed(() =>
  props.items.map(i =>
    typeof i === 'string' ? { value: i, label: i } : i
  )
)
</script>
