<template>
  <div class="bc" :class="{ 'bc--topo': topo }" role="status" :title="`Somente consulta — ${detalhe}`">
    <div class="bc-ico"><i class="fas fa-eye"></i></div>
    <div class="bc-txt">
      <div class="bc-l1">Somente consulta</div>
      <div class="bc-l2">
        <span class="bc-quando">{{ quando }}</span>
        <span class="bc-detalhe">· {{ detalhe }}</span>
      </div>
    </div>
    <button class="bc-btn" :disabled="atualizando || !s.googleDriveConfigured" :title="s.googleDriveConfigured ? 'Buscar os dados mais recentes' : 'Conecte o Google Drive para atualizar'" @click="atualizar">
      <i class="fas fa-rotate" :class="{ 'fa-spin': atualizando }"></i>
      <span>Atualizar</span>
    </button>
  </div>
</template>

<script setup>
// Faixa fixa no topo da tela (no fluxo, sem cobrir dados) avisando que este aparelho está
// só consultando uma área que outro aparelho edita — com o botão de atualizar na hora.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useStore } from '../store.js'

defineProps({
  detalhe: { type: String, required: true },
  topo: { type: Boolean, default: false } // sem cabeçalho acima: respeita a área segura do aparelho
})

const s = useStore()
const atualizando = ref(false)
const agora = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { agora.value = Date.now() }, 30000) })
onUnmounted(() => clearInterval(timer))

/** "Atualizado agora / há 5 min / há 2 h / em 07/11 14:32" */
const quando = computed(() => {
  if (!s.googleDriveConfigured) return 'Drive desconectado'
  const iso = s.ultimaChecagemSync || s.ultimoSyncTs
  if (!iso) return 'Ainda não atualizado'
  const min = Math.floor((agora.value - Date.parse(iso)) / 60000)
  if (min < 1) return 'Atualizado agora'
  if (min < 60) return `Atualizado há ${min} min`
  if (min < 60 * 24) return `Atualizado há ${Math.floor(min / 60)} h`
  const d = new Date(iso)
  return `Atualizado em ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

async function atualizar() {
  if (atualizando.value) return
  atualizando.value = true
  try {
    const r = await s.atualizarAgora()
    agora.value = Date.now()
    if (r === 'ok') s.notify('Dados atualizados.', 'success', 2200)
    else if (r === 'offline') s.notify('Sem internet. Tente de novo quando conectar.', 'warning', 3500)
    else if (r === 'sem_drive') s.notify('Conecte o Google Drive em Ajustes para atualizar.', 'warning', 3500)
    else if (r === 'erro') s.notify('Não foi possível atualizar agora. Tente de novo.', 'error', 3500)
    // 'atencao': a própria sincronização já abriu a tela de decisão
  } finally {
    atualizando.value = false
  }
}
</script>

<style scoped>
.bc { display: flex; align-items: center; gap: 10px; padding: 8px 12px; flex-shrink: 0; background: var(--gold-bg); border-bottom: 1px solid rgba(200, 137, 10, .35); }
.bc--topo { padding-top: max(8px, env(safe-area-inset-top)); }
.bc-ico { width: 30px; height: 30px; border-radius: 50%; background: rgba(200, 137, 10, .18); color: var(--gold-dark); display: flex; align-items: center; justify-content: center; font-size: .8rem; flex-shrink: 0; }
.bc-txt { flex: 1; min-width: 0; line-height: 1.25; }
.bc-l1 { font-size: .8rem; font-weight: 800; color: var(--gold-dark); white-space: nowrap; }
.bc-l2 { display: flex; gap: 4px; min-width: 0; font-size: .7rem; color: var(--muted); }
.bc-quando { font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.bc-detalhe { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bc-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--gold); background: var(--surface); color: var(--brown-dark); font: inherit; font-size: .76rem; font-weight: 800; cursor: pointer; flex-shrink: 0; transition: transform var(--t); }
.bc-btn:active { transform: scale(.95); }
.bc-btn:disabled { opacity: .6; cursor: default; }
.bc-btn:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }
</style>
