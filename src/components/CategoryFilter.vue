<template>
  <div class="cat-filter-wrap">
    <div ref="stripEl" class="cat-chips chips-padded">
      <button
        v-for="item in normalizedItems"
        :key="item.value"
        :ref="el => setRef(el, item.value)"
        class="chip"
        :class="{ active: modelValue === item.value }"
        @click="select(item.value)"
      >{{ item.label }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  items:       { type: Array,  required: true },
  modelValue:  { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])

const normalizedItems = computed(() =>
  props.items.map(i => typeof i === 'string' ? { value: i, label: i } : i)
)

// ── Auto-scroll para o chip ativo ────────────────────────────
const stripEl  = ref(null)
const chipRefs = ref({})

function setRef(el, value) {
  if (el) chipRefs.value[value] = el
  else delete chipRefs.value[value]
}

function scrollToActive(value) {
  const chip = chipRefs.value[value]
  if (chip) chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

function select(value) {
  emit('update:modelValue', value)
  nextTick(() => scrollToActive(value))
}

// Ao mudar externamente (ex: reset de filtro)
watch(() => props.modelValue, v => nextTick(() => scrollToActive(v)))
</script>
