<template>
  <div class="shell">

    <!-- ══ TELA DE SELEÇÃO DE PERFIL ══════════════════════════ -->
    <Transition name="fade">
      <SelecaoPerfil
        v-if="perfil === null"
        @selecionar="onSelecionarPerfil"
      />
    </Transition>

    <!-- ══ MODO YM (Receitas completo) ════════════════════════ -->
    <template v-if="perfil === 'ym'">
      <AppHeader />

      <main class="main">
        <TabReceitas     v-show="s.tab === 'receitas'" />
        <TabProducao     v-show="s.tab === 'producao'" />
        <TabPainel       v-show="s.tab === 'painel'" />
        <TabInsumos      v-show="s.tab === 'insumos'" />
        <TabInteligencia v-show="s.tab === 'inteligencia'" />
        <TabFinanceiro   v-show="s.tab === 'financeiro'" />
        <TabCozinha      v-show="s.tab === 'cozinha'" />
        <TabAjustes      v-show="s.tab === 'ajustes'" />
      </main>

      <AppNav />

      <!-- Cronômetro Flutuante Global -->
      <Transition name="fade">
        <div v-if="s.timerDisplay"
          class="floating-timer"
          :style="{ transform: `translate(${timerPos.x}px, ${timerPos.y}px)` }"
          @click="onTimerClick"
          @touchstart="onDragStart"
          @touchmove="onDragMove"
          @touchend="onDragEnd"
        >
          <div class="floating-timer-content">
            <i class="fas fa-stopwatch" :class="{ 'fa-beat-fade': s.timer.isRunning }"></i>
            <span class="timer-val">{{ s.timerDisplay }}</span>
          </div>
          <div class="floating-timer-label">
            {{ s.timer.isRunning ? 'Produzindo...' : 'Pausado' }}
            <span v-if="s.activeLoteName" class="lote-indicator">({{ s.activeLoteName }})</span>
          </div>
        </div>
      </Transition>

      <!-- Indicador de Sync Drive -->
      <Transition name="fade">
        <div
          v-if="s.googleDriveConfigured"
          class="sync-indicator"
          :class="[ `sync-${s.syncStatus}`, { 'sync-pending': s.hasLocalChanges && s.syncStatus === 'idle' } ]"
        >
          <template v-if="s.syncStatus === 'idle' || s.syncStatus === 'error'">
            <button class="btn-sync-now" @click="s.syncImediato">
              <i :class="s.syncStatus === 'error' ? 'fas fa-triangle-exclamation' : (s.hasLocalChanges ? 'fas fa-cloud-arrow-up fa-bounce' : 'fas fa-cloud-arrow-up')"></i>
              <span v-if="s.syncStatus === 'error'">Falha no Sync</span>
              <span v-else-if="s.hasLocalChanges">Sincronizar alterações?</span>
              <span v-else>Drive em dia</span>
            </button>
          </template>
          <template v-else>
            <i :class="syncIcon"></i>
            <span>{{ syncLabel }}</span>
          </template>
        </div>
      </Transition>
    </template>

    <!-- ══ MODO BETE (Caderneta) ═══════════════════════════════ -->
    <template v-if="perfil === 'bete'">
      <main class="main">
        <TabCaderneta @trocar-perfil="trocarPerfil" />
      </main>

      <!-- Indicador de Sync Drive — Bete -->
      <Transition name="fade">
        <div
          v-if="s.googleDriveConfigured && (s.syncStatus !== 'idle' || s.hasLocalChanges)"
          class="sync-indicator bete-sync"
          :class="[ `sync-${s.syncStatus}`, { 'sync-pending': s.hasLocalChanges && s.syncStatus === 'idle' } ]"
        >
          <i :class="{
            'fas fa-rotate fa-spin': s.syncStatus === 'syncing',
            'fas fa-cloud-check':    s.syncStatus === 'ok',
            'fas fa-cloud-arrow-up fa-bounce': s.hasLocalChanges && s.syncStatus === 'idle',
            'fas fa-triangle-exclamation':     s.syncStatus === 'error',
          }"></i>
          <span v-if="s.syncStatus === 'syncing'">Salvando…</span>
          <span v-else-if="s.syncStatus === 'ok'">Salvo no Drive ✓</span>
          <span v-else-if="s.syncStatus === 'error'">Falha ao salvar</span>
          <span v-else-if="s.hasLocalChanges">Salvando…</span>
        </div>
      </Transition>
    </template>

    <!-- ─── Confirmação Global (compartilhada) ────────────────── -->
    <ConfirmDialog />

    <!-- Toast global -->
    <Transition name="fade">
      <div v-if="s.toast" :key="s.toast.id" class="toast" :class="`toast-${s.toast.tipo}`">
        {{ s.toast.msg }}
      </div>
    </Transition>

    <!-- Loader global -->
    <Transition name="fade">
      <div v-if="s.loading" class="loader-overlay">
        <div class="spinner"></div>
        <p>Carregando dados…</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, computed, ref, provide } from 'vue'
import { useStore } from './store.js'
import { tentarReconectarSilenciosamente } from './services/googleDriveBackup.js'
import AppHeader      from './components/AppHeader.vue'
import AppNav         from './components/AppNav.vue'
import ConfirmDialog  from './components/ConfirmDialog.vue'
import TabReceitas    from './views/TabReceitas.vue'
import TabProducao    from './views/TabProducao.vue'
import TabPainel      from './views/TabPainel.vue'
import TabInsumos     from './views/TabInsumos.vue'
import TabInteligencia from './views/TabInteligencia.vue'
import TabFinanceiro  from './views/TabFinanceiro.vue'
import TabCozinha     from './views/TabCozinha.vue'
import TabAjustes     from './views/TabAjustes.vue'
import TabCaderneta   from './views/TabCaderneta.vue'
import SelecaoPerfil  from './views/SelecaoPerfil.vue'

const s = useStore()

// ── Perfil ─────────────────────────────────────────────────
const PERFIL_KEY = 'choco_perfil_ativo'
const perfil = ref(null) // null = mostrando seleção

function onSelecionarPerfil(p) {
  perfil.value = p
  // Não persiste: a cada abertura do app volta pra seleção de perfil
  // Isso é proposital — segurança de separação dos dados

  // Para a Bete: sincroniza imediatamente ao entrar para confirmar conexão com Drive
  if (p === 'bete' && s.googleDriveConfigured) {
    s.syncImediato()
  }
}

function trocarPerfil() {
  perfil.value = null
}

// Disponibiliza trocarPerfil para qualquer componente filho (ex: AppHeader)
provide('trocarPerfil', trocarPerfil)

// ── Sync ─────────────────────────────────────────────────
const onVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    if (perfil.value === 'ym') {
      await s.iniciarSync()
    } else if (perfil.value === 'bete') {
      // Sync imediato para a Bete ao voltar ao app — garante que nada se perde
      await s.syncImediato()
    }
  }
}

const syncIcon = computed(() => ({
  'fas fa-rotate fa-spin': s.syncStatus === 'syncing',
  'fas fa-check-circle':   s.syncStatus === 'ok',
  'fas fa-exclamation-triangle': s.syncStatus === 'error',
}))

const syncLabel = computed(() => ({
  syncing: 'Sincronizando…',
  ok:      'Drive atualizado',
  error:   'Falha no sync',
  idle:    '',
}[s.syncStatus] ?? ''))

// ── Timer drag ───────────────────────────────────────────
const timerPos = reactive({ x: 0, y: 0 })
let dragStart = { x: 0, y: 0 }
let lastPos   = { x: 0, y: 0 }
let isDragging  = false
let dragMoved   = false

const onDragStart = (e) => {
  isDragging = true; dragMoved = false
  dragStart.x = e.touches[0].clientX; dragStart.y = e.touches[0].clientY
  lastPos.x = timerPos.x; lastPos.y = timerPos.y
}
const onDragMove = (e) => {
  if (!isDragging) return
  const dx = e.touches[0].clientX - dragStart.x
  const dy = e.touches[0].clientY - dragStart.y
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragMoved = true
  timerPos.x = lastPos.x + dx; timerPos.y = lastPos.y + dy
}
const onDragEnd  = () => { isDragging = false }
const onTimerClick = () => { if (!dragMoved) s.setTab('producao') }

onMounted(async () => {
  await s.init()
  tentarReconectarSilenciosamente()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
/* ── Indicador de sync ──────────────────────────────── */
.sync-indicator {
  position: fixed; bottom: 72px; right: 12px;
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 20px;
  font-size: 0.72rem; font-weight: 600;
  z-index: calc(var(--z-header) * 9);
  opacity: 0.92; backdrop-filter: blur(4px);
  transition: background 0.3s, color 0.3s;
}
.sync-idle    { background: rgba(30,18,8,.05); color: var(--muted); border: 1px solid var(--border); }

/* Indicador de sync posicionado no topo para a Bete (não conflita com nav dela) */
.bete-sync {
  bottom: auto;
  top: 12px;
  right: 12px;
  font-size: 0.75rem;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 700;
  pointer-events: none;
}
.btn-sync-now { background: transparent; border: none; color: inherit; font-size: inherit; font-weight: inherit; display: flex; align-items: center; gap: 5px; cursor: pointer; }
.sync-pending { background: rgba(200,137,10,.18) !important; color: var(--gold-dark) !important; border: 1px solid rgba(200,137,10,.3) !important; }
.sync-syncing { background: rgba(59,130,246,.15); color: #3b82f6; border: 1px solid rgba(59,130,246,.3); }
.sync-ok      { background: rgba(34,197,94,.12); color: #16a34a; border: 1px solid rgba(34,197,94,.25); }
.sync-error   { background: rgba(239,68,68,.12); color: #dc2626; border: 1px solid rgba(239,68,68,.25); }


</style>
