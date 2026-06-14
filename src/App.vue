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
        <TabBriefing     v-show="s.tab === 'briefing'" />
        <TabAjustes      v-show="s.tab === 'ajustes'" />
      </main>

      <AppNav />

      <!-- FAB contextual — canto inferior direito, acima da nav -->
      <Transition name="fab-pop">
        <button
          v-if="fabConfig"
          class="fab"
          :title="fabConfig.label"
          @click="fabConfig.action()"
        >
          <i :class="fabConfig.icon"></i>
        </button>
      </Transition>

      <!-- Cronômetro Flutuante — começa no canto inferior esquerdo, arrastável -->
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

      <!-- Indicador de Sync — dentro do header (não flutua sobre conteúdo) -->
      <Transition name="fade">
        <div
          v-if="s.googleDriveConfigured"
          class="sync-indicator"
          :class="[`sync-${s.syncStatus}`, { 'sync-pending': s.hasLocalChanges && s.syncStatus === 'idle' }]"
        >
          <template v-if="s.syncStatus === 'idle' || s.syncStatus === 'error'">
            <button class="btn-sync-now" @click="s.syncImediato">
              <i :class="s.syncStatus === 'error' ? 'fas fa-triangle-exclamation' : (s.hasLocalChanges ? 'fas fa-cloud-arrow-up fa-bounce' : 'fas fa-cloud-check')"></i>
              <span v-if="s.syncStatus === 'error'">Falha</span>
              <span v-else-if="s.hasLocalChanges">Sincronizar</span>
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
import TabBriefing    from './views/TabBriefing.vue'
import TabAjustes     from './views/TabAjustes.vue'
import TabBriefing    from './views/TabBriefing.vue'
import TabCaderneta   from './views/TabCaderneta.vue'
import SelecaoPerfil  from './views/SelecaoPerfil.vue'

const s = useStore()

// ── FAB contextual ──────────────────────────────────────────
const fabConfig  = ref(null)
const fabOwnerId = ref(null)
provide('registerFab', (config, ownerId) => {
  fabOwnerId.value = ownerId
  fabConfig.value  = config
})
provide('unregisterFab', (ownerId) => {
  if (fabOwnerId.value === ownerId) {
    fabConfig.value  = null
    fabOwnerId.value = null
  }
})

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
/* ── Posições fixas dos elementos flutuantes (sem colisão) ─────
   
   Zona superior (topo, fora do conteúdo):
     Toast           → topo-centro, z mais alto, some sozinho
     Sync            → dentro do AppHeader (não flutua)

   Zona inferior (acima da nav = bottom: 64px + gap):
     FAB             → canto direito  (bottom: 80px, right: 16px)
     Timer           → canto esquerdo (bottom: 80px, left: 16px)  ← posição inicial
     
   Não sobrepõem porque estão em lados opostos.
   O timer é arrastável — se o usuário mover para a direita pode colidir
   com o FAB, mas só se arrastar intencionalmente.
──────────────────────────────────────────────────────────────── */

/* ── FAB ─────────────────────────────────────────────────── */
.fab {
  position: fixed;
  bottom: 80px;
  right: 16px;
  width: 52px; height: 52px;
  border-radius: 50%;
  background: var(--brown-dark);
  color: #fff;
  border: none;
  font-size: 1.3rem;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 12px rgba(61,31,7,.3);
  z-index: calc(var(--z-header) + 5);
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}
.fab:active { transform: scale(.91); box-shadow: 0 2px 8px rgba(61,31,7,.2); }
.fab-pop-enter-active { animation: fab-in .22s cubic-bezier(.34,1.56,.64,1); }
.fab-pop-leave-active { animation: fab-in .15s ease-in reverse; }
@keyframes fab-in {
  from { opacity:0; transform: scale(.4); }
  to   { opacity:1; transform: scale(1); }
}

/* ── Sync indicator — discreto, dentro da área do header ─── */
.sync-indicator {
  position: fixed;
  top: 10px;
  right: 56px; /* não sobrepõe ícones do AppHeader */
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.7rem; font-weight: 600;
  z-index: calc(var(--z-header) + 2);
  pointer-events: auto;
  transition: background .3s, opacity .3s;
  max-width: 140px;
}
/* "Drive em dia" — invisível por padrão, não polui a tela */
.sync-indicator:not(.sync-pending):not(.sync-syncing):not(.sync-ok):not(.sync-error) {
  opacity: 0;
  pointer-events: none;
}
.sync-idle    { opacity: 0; pointer-events: none; }
.sync-pending { background: #7c4f00; color: #fff; border: 1px solid #a06400; }
.sync-syncing { background: #0c447c; color: #fff; border: 1px solid #185FA5; }
.sync-ok      { background: #27500a; color: #fff; border: 1px solid #3B6D11; }
.sync-error   { background: #791f1f; color: #fff; border: 1px solid #A32D2D; }
.btn-sync-now { background: transparent; border: none; color: inherit; font-size: inherit; font-weight: inherit; display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 0; }

/* Sync da Bete — mesma posição, sem nav embaixo */
.bete-sync { top: 10px; right: 12px; bottom: auto; }

</style>
