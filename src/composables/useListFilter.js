import { ref, computed } from 'vue'
import { normalizar } from '../utils.js'

export function useListFilter(sourceArray, categoryMap = {}, initialCategory = 'Todas') {
  const busca = ref('')
  const categoriaAtiva = ref(initialCategory)

  const listaFiltrada = computed(() => {
    let r = sourceArray.value

    if (categoriaAtiva.value !== 'Todas' && categoryMap[categoriaAtiva.value]) {
      r = r.filter(item => item.tipo === categoryMap[categoriaAtiva.value])
    }

    if (busca.value.trim()) {
      const q = normalizar(busca.value)
      r = r.filter(item => normalizar(item.nome).includes(q))
    }
    return [...r].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  })

  return { busca, categoriaAtiva, listaFiltrada }
}