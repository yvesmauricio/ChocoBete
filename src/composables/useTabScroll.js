import { ref, watch, nextTick } from 'vue'

/**
 * Auto-scroll para a aba ativa em barras horizontais.
 *
 * Uso:
 *   const { stripEl, setTabRef, scrollToActive } = useTabScroll(abaAtiva)
 *
 *   <div ref="stripEl" class="aba-nav">
 *     <button :ref="el => setTabRef(el, aba.id)" @click="abaAtiva = aba.id">…</button>
 *   </div>
 */
export function useTabScroll(activeRef) {
  const stripEl  = ref(null)
  const tabRefs  = ref({})

  function setTabRef(el, id) {
    if (el) tabRefs.value[id] = el
    else delete tabRefs.value[id]
  }

  function scrollToActive(id) {
    const el = tabRefs.value[id ?? activeRef.value]
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  watch(activeRef, id => nextTick(() => scrollToActive(id)))

  return { stripEl, setTabRef, scrollToActive }
}
