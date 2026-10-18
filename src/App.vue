<template>
  <div class="shell" :class="{ 'shell--bete': perfilInfo?.tipo === 'caderneta', 'shell--selecao': perfil === null }">

    <!-- ══ TELA DE SELEÇÃO DE PERFIL ══════════════════════════ -->
    <Transition name="fade">
      <SelecaoPerfil
        v-if="perfil === null"
        :config="s.perfis"
        @selecionar="onSelecionarPerfil"
      />
    </Transition>

    <!-- ══ MODO ADMIN / PERFIS EXTRAS (mesma casca, módulos variam) ═══
         Serve tanto o perfil fixo "ym" (Admin) quanto qualquer perfil
         extra criado em Ajustes → Perfis (ex.: Produção, Financeiro). -->
    <template v-if="perfilInfo?.tipo === 'admin'">
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
        <TabEtiquetas    v-show="s.tab === 'etiquetas'" />
        <TabCardapio     v-show="s.tab === 'cardapio'" />
      </main>

      <AppNav :modulos="perfilInfo.modulos" />

      <!-- FAB contextual — canto inferior direito, acima da nav -->
      <Transition name="fab-pop">
        <button
          v-if="fabConfig"
          class="fab" :class="`fab--${s.tab}`"
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
          @mousedown="onMouseDragStart"
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

      <!-- O indicador de sync do perfil Admin agora é um botão no próprio
           AppHeader (mesmo tamanho do botão "trocar perfil"), não mais
           uma bolinha discreta — ver AppHeader.vue. -->
    </template>

    <!-- ══ MODO BETE (Caderneta) ═══════════════════════════════ -->
    <template v-if="perfilInfo?.tipo === 'caderneta'">
      <main class="main main--bete">
        <TabCaderneta @trocar-perfil="trocarPerfil" />
      </main>

      <!-- O indicador de sync da Bete agora é um botão no cabeçalho do Início
           (TabCaderneta.vue), não mais uma bolinha flutuante. -->

    </template>

    <!-- ─── Confirmação Global (compartilhada) ────────────────── -->
    <ConfirmDialog />

    <!-- Aviso de nova versão do app (PWA) -->
    <AtualizacaoBanner />

    <!-- Toast global -->
    <Transition name="fade" mode="out-in">
      <div
        v-if="s.toast"
        :key="s.toast.id"
        class="toast"
        :class="[`toast-${s.toast.tipo}`, { 'toast--sutil': perfilInfo?.tipo === 'caderneta' }]"
      >
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
import { useAndroidBackGuard } from './composables/useAndroidBackGuard.js'
import { tentarReconectarSilenciosamente } from './services/googleDriveBackup.js'
import AppHeader      from './components/AppHeader.vue'
import AppNav         from './components/AppNav.vue'
import ConfirmDialog  from './components/ConfirmDialog.vue'
import AtualizacaoBanner from './components/AtualizacaoBanner.vue'
import TabReceitas    from './views/TabReceitas.vue'
import TabProducao    from './views/TabProducao.vue'
import TabPainel      from './views/TabPainel.vue'
import TabInsumos     from './views/TabInsumos.vue'
import TabInteligencia from './views/TabInteligencia.vue'
import TabFinanceiro  from './views/TabFinanceiro.vue'
import TabCozinha     from './views/TabCozinha.vue'
import TabAjustes     from './views/TabAjustes.vue'
import TabBriefing    from './views/TabBriefing.vue'
import TabEtiquetas   from './views/TabEtiquetas.vue'
import TabCardapio    from './views/TabCardapio.vue'
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
const perfil = ref(null) // null = mostrando seleção

// Resolve o id selecionado ('ym', 'bete', ou o id de um perfil extra) para
// o "tipo" de casca que a tela deve montar. Perfis extras usam a mesma
// casca do Admin ('admin'), só filtrando os módulos exibidos.
const perfilInfo = computed(() => {
  if (perfil.value === 'ym') return { tipo: 'admin', modulos: s.perfis.ym.modulos }
  if (perfil.value === 'bete') return { tipo: 'caderneta' }
  const extra = s.perfis.extras.find(e => e.id === perfil.value)
  if (extra) return { tipo: 'admin', modulos: extra.modulos, nome: extra.nome }
  return null
})

async function onSelecionarPerfil(p) {
  // Não persiste: a cada abertura do app volta pra seleção de perfil
  // Isso é proposital — segurança de separação dos dados

  // Para a Bete: antes de abrir, traz o que outro aparelho tiver salvo no
  // Drive (se não há alterações pendentes aqui). Antes ela só ENVIAVA ao
  // entrar — um app que ficou aberto por horas mandava a foto velha por
  // cima do que o outro aparelho tinha feito. O limite de 4 s evita travar
  // a entrada com internet ruim.
  if (p === 'bete' && s.googleDriveConfigured) {
    await Promise.race([s.iniciarSync(), new Promise(resolve => setTimeout(resolve, 4000))])
    perfil.value = p
    if (s.hasLocalChanges) s.syncImediato()
    return
  }
  perfil.value = p
}

function trocarPerfil() {
  perfil.value = null
}

// Disponibiliza trocarPerfil para qualquer componente filho (ex: AppHeader)
provide('trocarPerfil', trocarPerfil)

// ── Sync ─────────────────────────────────────────────────
// Nota: para a Bete, o sync já dispara em cada alteração real de dados
// (ver s.syncImediato() nas funções de salvar/receber/quitar/excluir em
// TabCaderneta.vue). Não sincronizamos aqui de novo ao voltar o foco —
// isso disparava um sync extra a cada troca de tela ou volta do WhatsApp,
// mesmo sem nada ter mudado.
let escondidoDesde = 0
const REVERIFICAR_APOS_MS = 5 * 60_000
const onVisibilityChange = async () => {
  if (document.visibilityState === 'hidden') {
    escondidoDesde = Date.now()
    s.salvarBackupLocalAgora() // grava já a cópia na pasta local, sem esperar o intervalo
    return
  }
  if (document.visibilityState === 'visible') {
    if (perfilInfo.value?.tipo === 'admin') {
      await s.iniciarSync()
    } else if (perfilInfo.value?.tipo === 'caderneta' && escondidoDesde && Date.now() - escondidoDesde > REVERIFICAR_APOS_MS) {
      // Bete: só reconfere o Drive se ficou um tempo fora do app (voltar do
      // WhatsApp em segundos não precisa) — evita enviar por cima de algo novo.
      await s.iniciarSync()
    }
  }
}

// Voltou a internet: envia o que ficou pendente enquanto estava offline.
const onOnline = () => { if (s.hasLocalChanges) s.syncImediato() }

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

// Mesmo arrastar do cronômetro, com o mouse (desktop). Os listeners de
// move/up ficam na janela só enquanto o botão está pressionado, pra o timer
// seguir o cursor mesmo se ele sair de cima do elemento.
const onMouseDragStart = (e) => {
  if (e.button !== 0) return
  isDragging = true; dragMoved = false
  dragStart.x = e.clientX; dragStart.y = e.clientY
  lastPos.x = timerPos.x; lastPos.y = timerPos.y
  window.addEventListener('mousemove', onMouseDragMove)
  window.addEventListener('mouseup', onMouseDragEnd)
}
const onMouseDragMove = (e) => {
  if (!isDragging) return
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragMoved = true
  timerPos.x = lastPos.x + dx; timerPos.y = lastPos.y + dy
}
const onMouseDragEnd = () => {
  isDragging = false
  window.removeEventListener('mousemove', onMouseDragMove)
  window.removeEventListener('mouseup', onMouseDragEnd)
}
const onTimerClick = () => { if (!dragMoved) s.setTab('producao') }

// Impede que o botão/gesto "Voltar" do Android feche o app de primeira —
// o primeiro toque navega para a aba inicial; só sai do app a partir dela.
useAndroidBackGuard({
  getTab: () => s.tab,
  setTab: (t) => s.setTab(t),
  tabInicial: 'painel',
})

onMounted(async () => {
  await s.init()
  if (s.perfis.inicial !== 'selecao') perfil.value = s.perfis.inicial
  tentarReconectarSilenciosamente()
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseDragMove)
  window.removeEventListener('mouseup', onMouseDragEnd)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onOnline)
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

</style>