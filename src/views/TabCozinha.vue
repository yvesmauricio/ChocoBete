<template>
  <div class="tab-cozinha">
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-utensils"></i> Cozinha</h2>
        <div class="tab-actions">
          <button v-if="ingredientesAgrupados.length" class="btn-icon" title="Painel de pesagem" @click="painelPesagemAberto = true">
            <i class="fas fa-scale-balanced"></i>
          </button>
          <button class="btn-icon" @click="s.setTab('producao')" title="Histórico de Produção">
            <i class="fas fa-clock-rotate-left"></i>
          </button>
          <button v-if="s.cozinhaLote.length && !s.loteOriginalEmEdicao" class="btn-icon" @click="limparLote" title="Limpar Lote">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>

      <!-- Barra de categorias — dentro do header para ficar grudada -->
      <div ref="chipsEl" class="cat-chips chips-padded" style="margin: 4px -16px 0; padding-bottom: 10px;">
        <button
          v-for="c in categorias"
          :key="c"
          class="chip"
          :class="{ active: catAtiva === c }"
          :ref="el => setChipRef(el, c)"
          @click="catAtiva = c"
        >{{ c }}</button>
      </div>
    </div>
    <div v-if="s.loteOriginalEmEdicao" class="edit-mode-notice">
      <i class="fas fa-wrench"></i>
      <span>Você está corrigindo um lote de <strong>{{ dataHoraBR(s.loteOriginalEmEdicao) }}</strong></span>
      <button class="btn-discard-banner" @click="handleDescartar">Descartar</button>
    </div>

    <div
      class="cozinha-body"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
      @touchcancel="resetTouch"
    >
      <div ref="gridEl" class="quick-add-grid">
        <button
          v-for="r in receitasFiltradas"
          :key="r.uuid"
          class="qa-btn no-select sticky-touch"
          :class="{ 
            'qa-btn--inlote': qtdNoLote[r.uuid],
            'is-pulsing': stepper.visible && stepper.receita?.uuid === r.uuid
          }"
          @click="onBtnClick(r, $event)"
          @pointerdown="iniciarLongPress(r, $event)"
          @pointerup="cancelarLongPress"
          @pointercancel="cancelarLongPress"
          @contextmenu.prevent
        >
          <span v-if="qtdNoLote[r.uuid]" class="qa-badge">{{ qtdNoLote[r.uuid] }}</span>
          <span class="qa-name">{{ r.nome }}</span>
          <div v-if="normalizar(r.nome).includes('trufa')" class="badge-shortcut">+1 Forma</div>
          <div v-else class="badge-shortcut">+{{ r.rendimento }} {{ r.unidade_rendimento }}</div>
        </button>
      </div>

      <div v-if="s.cozinhaLote.length" class="batch-content">
        <div class="section-label">📋 Modelagem da Produção</div>

        <div class="planned-items">
          <div v-for="(item, idx) in s.cozinhaLote" :key="idx" class="plan-group">
            <div 
              class="plan-card no-select sticky-touch"
              :class="{ 'is-pulsing': stepper.visible && stepper.receita?.uuid === item.receita_id }"
              @pointerdown="iniciarLongPress({ uuid: item.receita_id, nome: item.nome }, $event)"
              @pointerup="cancelarLongPress"
              @pointercancel="cancelarLongPress"
            >
              <div class="plan-info" @click="toggleItemProducao(item)">
                <div class="plan-name">
                  <i class="fas" :class="item.aberto ? 'fa-chevron-down' : 'fa-chevron-right'" style="font-size: 0.7rem; margin-right: 4px; color: var(--gold-dark)"></i>
                  {{ item.nome }}
                </div>
                <div class="plan-sub">
                  <strong style="color: var(--brown-dark)">{{ fmtQ(item.peso_total, 'g') }}</strong> • {{ item.qtd_produzir }} {{ item.unidade }}
                </div>
              </div>
              <div class="qty-ctrl-sm">
                <button class="btn-qty-sm" @click="ajustarQtd(idx, -1)">-</button>
                <input type="number" class="qty-input-cozinha" :value="item.qtd_produzir" @change="e => atualizarQtdManual(idx, e.target.value)" inputmode="decimal" />
                <button class="btn-qty-sm" @click="ajustarQtd(idx, 1)">+</button>
              </div>
            </div>
            <div v-if="item.aberto" class="plan-details">
              <div v-for="ing in calcularIngredientesItem(item)" :key="ing.id" class="plan-ing-row">
                <div class="plan-ing-info">
                  <span class="plan-ing-nome">{{ ing.nome }}</span>
                  <span class="plan-ing-qtd">{{ fmtQ(ing.total, ing.unidade) }}</span>
                </div>
                <div v-if="ing.subIngredientes?.length" class="plan-sub-list">
                  <div v-for="sub in ing.subIngredientes" :key="sub.id" class="plan-sub-item">
                    <span><span class="c-brown">└</span> {{ sub.nome }}</span>
                    <span>{{ fmtQ(sub.total, sub.unidade) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="sheet-card mt-16">
          <div class="sheet-body">
            <div class="section-label">🥣 Total para pesar (Consolidado)</div>
            <div class="checklist">
              <div v-for="ing in ingredientesAgrupados" :key="ing.id" class="check-item" :class="{ 'done': s.cozinhaChecklist[ing.id] }" @click="toggleCheck(ing.id)">
                <div class="check-box"><i class="fas" :class="s.cozinhaChecklist[ing.id] ? 'fa-check-square' : 'fa-square'"></i></div>
                <div class="check-info">
                  <div class="check-main">
                    <div class="check-name">{{ ing.nome }}</div>
                    <div class="check-val">{{ fmtQ(ing.total, ing.unidade) }}</div>
                  </div>
                  <div v-if="ing.subIngredientes?.length" class="plan-sub-list" style="margin-left:0; margin-top:6px;">
                    <div v-for="sub in ing.subIngredientes" :key="sub.id" class="plan-sub-item">
                      <span><span class="c-brown">└</span> {{ sub.nome }}</span>
                      <span>{{ fmtQ(sub.total, sub.unidade) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button v-if="ingredientesAgrupados.length" class="btn btn-secondary btn-sm btn-full mt-12" @click="compartilharComprasLote">
               <i class="fas fa-share-nodes"></i> Compartilhar lista detalhada
            </button>
          </div>
        </div>

        <!-- Estimativa de tempo -->
        <div v-if="tempoEstimadoLote > 0" class="tempo-estimado-bar">
          <div class="teb-left">
            <i class="fas fa-clock"></i>
            <div>
              <div class="teb-titulo">Tempo estimado</div>
              <div class="teb-sub">baseado no histórico de produções</div>
            </div>
          </div>
          <div class="teb-valor">{{ fmtTime(tempoEstimadoLote) }}</div>
        </div>

        <div :class="s.loteOriginalEmEdicao ? 'mt-16 mb-32' : 'cozinha-actions-grid mt-16 mb-32'">
          <button v-if="!s.loteOriginalEmEdicao" class="btn btn-secondary btn-lg" @click="finalizarLote(true)">
            <i class="fas fa-calendar-plus"></i> Agendar
          </button>
          <button class="btn btn-primary btn-lg" :class="{ 'btn-full': s.loteOriginalEmEdicao }" @click="finalizarLote(false)">
            <i class="fas fa-check-double"></i> {{ s.loteOriginalEmEdicao ? 'Salvar Produção' : 'Produzir' }}

          </button>
        </div>

      </div>
      <div v-else class="app-empty">
        <i class="fas fa-mortar-pestle"></i>
        <h3>Lote vazio</h3>
        <p>Toque nas receitas acima para adicionar ao lote e calcular o preparo total.</p>
      </div>
    </div>

<!-- MELHORIA 3: Feedbacks flutuantes (+12 un) -->
<Teleport to="body">
  <div
    v-for="fb in feedbacks"
    :key="fb.id"
    class="feedback-float"
    :style="{ left: fb.x + 'px', top: fb.y + 'px' }"
  >{{ fb.text }}</div>
</Teleport>

<!-- MELHORIA 1: Mini Stepper Flutuante (long press) -->
<Teleport to="body">
  <Transition name="stepper-anim">
    <div
      v-if="stepper.visible"
      class="stepper-popup"
      :class="'arrow-' + stepper.arrowDir"
      :style="{ left: stepper.x + 'px', top: stepper.y + 'px' }"
    >
      <button class="stepper-btn" @pointerdown.prevent="iniciarHoldMenos" @pointerup="pararHold" @pointerleave="pararHold">−</button>
      <span class="stepper-val">{{ stepper.qtd }}</span>
      <button class="stepper-btn" @click="stepperAjustar(1)">+</button>
    </div>
  </Transition>
</Teleport>

<!-- ── Painel de pesagem — somente leitura ── -->
<Teleport to="body">
  <Transition name="fade">
    <div v-if="painelPesagemAberto" class="painel-pesar-overlay" @click.self="painelPesagemAberto = false">
      <div class="painel-pesar">
        <div class="painel-pesar-hdr">
          <div class="painel-pesar-titulo">
            <i class="fas fa-scale-balanced"></i>
            Total para pesar (Consolidado)
          </div>
          <div class="painel-pesar-timer" v-if="s.timerDisplay">
            <i class="fas fa-stopwatch" :class="{ 'fa-beat-fade': s.timer.isRunning }"></i>
            {{ s.timerDisplay }}
          </div>
          <button class="painel-pesar-fechar" @click="painelPesagemAberto = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div class="painel-pesar-receitas" v-if="s.cozinhaLote.length">
          <span
            v-for="item in s.cozinhaLote"
            :key="item.receita_id"
            class="painel-pesar-receita-chip"
          >{{ item.qtd_produzir }}× {{ item.nome }}</span>
        </div>
        <div class="painel-pesar-lista">
          <div
            v-for="(ing, idx) in ingredientesParaPesar"
            :key="ing.id"
            class="painel-pesar-item"
            :class="{ 'painel-pesar-destaque': idx === 0 }"
          >
            <div class="painel-pesar-item-main">
              <span class="painel-pesar-nome">{{ ing.nome.replace('🥣 ', '') }}</span>
              <span class="painel-pesar-qtd">{{ fmtQ(ing.total, ing.unidade) }}</span>
            </div>
            <div v-if="ing.subIngredientes?.length" class="plan-sub-list painel-pesar-composicao">
              <div v-for="sub in ing.subIngredientes" :key="sub.id" class="plan-sub-item">
                <span><span class="c-brown">└</span> {{ sub.nome }}</span>
                <span>{{ fmtQ(sub.total, sub.unidade) }}</span>
              </div>
            </div>
          </div>
          <div v-if="!ingredientesParaPesar.length" class="painel-pesar-vazio">
            Nenhum ingrediente no lote ainda.
          </div>
        </div>
        <div class="painel-pesar-footer">
          <span class="painel-pesar-nota">
            <i class="fas fa-eye"></i> Somente visualização — edite o lote na Cozinha
          </span>
        </div>
      </div>
    </div>
  </Transition>
</Teleport>

  </div>
</template>

<script setup>
import '../assets/checklist.css'
import { ref, computed, reactive, watch, nextTick, onUnmounted, onMounted, inject } from 'vue'
import { useStore } from '../store.js'
import { fmtQtd as fmtQ, getNowLocal, normalizar, isInsumoOculto, dataHoraBR } from '../utils.js' // Corrected import
import { useConfirm } from '../composables/useConfirm.js'

const s = useStore()
const confirm = useConfirm()

// ── FAB ─────────────────────────────────────────────────────
const registerFab   = inject('registerFab', null)
const unregisterFab = inject('unregisterFab', null)
const gridEl = ref(null)

function scrollParaGrid() {
  const main = document.querySelector('.main')
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
}

const _fabConfig = { icon: 'fas fa-layer-group', label: 'Ir para receitas', action: scrollParaGrid }
onMounted(() => { if (s.tab === 'cozinha') registerFab?.(_fabConfig, 'cozinha') })
watch(() => s.tab, (tab) => {
  if (tab === 'cozinha') registerFab?.(_fabConfig, 'cozinha')
  else unregisterFab?.('cozinha')
})

function fmtTime(minutos) {
  if (!minutos) return ''
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return h > 0 ? `${h}h${m > 0 ? ' ' + m + 'min' : ''}` : `${m}min`
}

const tempoEstimadoLote = computed(() => {
  if (!s.cozinhaLote.length) return 0
  const total = s.cozinhaLote.reduce((acc, item) => {
    const r = s.receitas.find(rec => rec.uuid === item.receita_id)
    if (!r) return acc
    const tempoMedio = s.getMediaTempoReceita(item.receita_id)
    const tempoBase = tempoMedio > 0 ? tempoMedio : (r.tempo_preparo_min || 0)
    return acc + (item.qtd_produzir / (r.rendimento || 1)) * tempoBase
  }, 0)
  return Math.round(total)
})

const categorias = ['Todas', 'Trufa', 'Cone', 'Barra', 'Brownie', 'Bolo', 'Ovo', 'Base']
const catAtiva = ref('Trufa')
const chipsEl = ref(null)
const chipRefs = ref({})
const touchStartX = ref(0)
const touchStartY = ref(0)

const holdInterval = ref(null)
const blockClick = ref(false) 
const holdSpeed = ref(300)

function iniciarHoldMenos() {
  if (!stepper.receita) return
  holdSpeed.value = 300
  holdInterval.value = -1 // Marca como ativo antes de começar
  function tick() {
    if (holdInterval.value === null) return // Se foi parado, não executa
    stepperAjustar(-1)
    if (holdInterval.value === null) return // Se o ajuste zerou a qtd e parou o hold, interrompe o loop
    // aceleração progressiva
    holdSpeed.value = Math.max(60, holdSpeed.value * 0.75)
    holdInterval.value = setTimeout(tick, holdSpeed.value)
  }
  tick()
}

function pararHold() {
  clearTimeout(holdInterval.value)
  holdInterval.value = null
}

const receitasFiltradas = computed(() => {
  const base = catAtiva.value === 'Todas'
    ? s.receitas
    : s.receitas.filter(r => r.categoria === catAtiva.value)
  return [...base].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
})

// MELHORIA 2: Mapa reativo de quantidades no lote
const qtdNoLote = computed(() => {
  const map = {}
  s.cozinhaLote.forEach(item => { map[item.receita_id] = item.qtd_produzir })
  return map
})

// MELHORIA 3: Estado dos feedbacks flutuantes
const feedbacks = ref([])
let _feedbackId = 0

// MELHORIA 1: Estado do stepper flutuante
const longPressTimer = ref(null)
const longPressActive = ref(false)
const stepper = reactive({
  visible: false,
  receita: null,
  x: 0,
  y: 0,
  qtd: 0,
  inactivityTimer: null,
  arrowDir: 'down'
})

function setChipRef(el, categoria) {
  if (el) chipRefs.value[categoria] = el
  else delete chipRefs.value[categoria]
}

function scrollCategoriaAtiva() {
  const chipEl = chipRefs.value[catAtiva.value]
  if (!chipEl) return
  chipEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

function navegarCategoria(delta) {
  const idxAtual = categorias.indexOf(catAtiva.value)
  if (idxAtual === -1) return

  const proxIdx = Math.min(categorias.length - 1, Math.max(0, idxAtual + delta))
  if (proxIdx === idxAtual) return

  catAtiva.value = categorias[proxIdx]
  if (navigator.vibrate) navigator.vibrate(8)
}

function onTouchStart(e) {
  if (e.touches.length !== 1) return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

function onTouchEnd(e) {
  if (!touchStartX.value && !touchStartY.value) return

  const touch = e.changedTouches?.[0]
  if (!touch) return

  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value
  const swipeHorizontal = Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2

  if (swipeHorizontal) navegarCategoria(deltaX < 0 ? 1 : -1)
  resetTouch()
}

function resetTouch() {
  touchStartX.value = 0
  touchStartY.value = 0
}

function getPassoProducao(r) {
  const nome = normalizar(r.nome)
  if (nome.includes('trufa')) {
    const peso = Number(r.peso_unitario || 0)
    if (peso >= 30) return 8 // Forma de 8 cavidades
    if (peso > 0) return 12  // Forma de 12 cavidades (19g ou menor)
  }
  return r.rendimento || 1
}

// ─── MELHORIA 3: Feedback visual (+N un) ─────────────────────────────────
function mostrarFeedback(r, e) {
  const el = e.target.closest('.qa-btn')
  if (!el) return
  const rect = el.getBoundingClientRect()
  const passo = getPassoProducao(r)
  const texto = normalizar(r.nome).includes('trufa')
    ? '+1 Forma'
    : `+${passo} ${r.unidade_rendimento}`
  const id = _feedbackId++
  feedbacks.value.push({
    id,
    text: texto,
    x: rect.left + rect.width / 2,
    y: rect.top + 8
  })
  setTimeout(() => {
    feedbacks.value = feedbacks.value.filter(f => f.id !== id)
  }, 750)
}

// ─── MELHORIA 1: Long press → Stepper flutuante ───────────────────────────
function onBtnClick(r, e) {
  if (longPressActive.value || blockClick.value) {
    e.preventDefault()
    e.stopPropagation() // Impede que o clique se propague para outros elementos
    return
  }

  adicionarAoLote(r)
  mostrarFeedback(r, e)
}

function iniciarLongPress(r, e) {
  longPressActive.value = false

  longPressTimer.value = setTimeout(() => {
    longPressActive.value = true
    abrirStepper(r, e)
  }, 400)
}

function cancelarLongPress() {
  clearTimeout(longPressTimer.value)

  // 👇 NÃO reseta imediatamente
  // deixa o click morrer antes
  setTimeout(() => {
    longPressActive.value = false
    blockClick.value = false
  }, 250)
}

function abrirStepper(r, e) {
  if (navigator.vibrate) navigator.vibrate(10)

  // Remove o listener anterior para evitar múltiplas ligações
  document.removeEventListener('pointerdown', onDocPointerDown)

  // Encontra o elemento interativo mais próximo (botão de adição rápida ou card do item planejado)
  // Busca o elemento interativo (botão ou card)
  const el = e.currentTarget || e.target.closest('.qa-btn, .plan-card')
  if (!el) return

  const rect = el.getBoundingClientRect()

  stepper.receita = r
  stepper.qtd = qtdNoLote.value[r.uuid] || 0

  const popupWidth = 140 
  const popupHeight = 54
  const headerSafeZone = 120 // tab-hdr sticky (título + chips juntos)

  stepper.x = Math.max(10, Math.min(rect.left + (rect.width / 2) - (popupWidth / 2), window.innerWidth - popupWidth - 10))
  
  const spaceAbove = rect.top - popupHeight - 15 // Aumentado para dar espaço à seta
  if (spaceAbove > headerSafeZone) {
    stepper.y = spaceAbove
    stepper.arrowDir = 'down'
  } else {
    stepper.y = rect.bottom + 15
    stepper.arrowDir = 'up'
  }

  stepper.visible = true
  resetStepperInactivity()

  document.addEventListener('pointerdown', onDocPointerDown)
}

function fecharStepper() {
  stepper.visible = false
  stepper.receita = null

  clearTimeout(stepper.inactivityTimer)
  document.removeEventListener('pointerdown', onDocPointerDown)
  pararHold()

  longPressActive.value = false

  // 🔒 bloqueia click fantasma
  blockClick.value = true
  setTimeout(() => blockClick.value = false, 200)
}

function onDocPointerDown(e) {
  if (!stepper.visible) return // 🔥 evita lixo pós-fechamento
  if (!e.target.closest('.stepper-popup')) {
    fecharStepper()
  }
}

function stepperAjustar(delta) {
  if (navigator.vibrate) navigator.vibrate(5)
  if (!stepper.receita) return
  
  // Busca a receita original para saber o "passo" (ex: 12 trufas)
  const r = s.receitas.find(rec => rec.uuid === stepper.receita.uuid)
  const passo = r ? getPassoProducao(r) : 1

  if (delta > 0) {
      adicionarAoLote(stepper.receita)
  } else {
    const idx = s.cozinhaLote.findIndex(i => i.receita_id === stepper.receita.uuid)
    if (idx >= 0) ajustarQtd(idx, -passo) 
  }
  stepper.qtd = qtdNoLote.value[stepper.receita?.uuid] || 0
  if (stepper.qtd === 0) {
    pararHold() // 🔥 ADICIONA ISSO
    fecharStepper()
    return
  }
  resetStepperInactivity()
}

function resetStepperInactivity() {
  clearTimeout(stepper.inactivityTimer)
  stepper.inactivityTimer = setTimeout(fecharStepper, 2500)
}

function toggleItemProducao(item) {
  if (longPressActive.value) return
  item.aberto = !item.aberto
}

function handleDescartar() {
  limparLote()
  s.setTab('producao')
}

function toggleCheck(id) {
  s.cozinhaChecklist[id] = !s.cozinhaChecklist[id]
  s.salvarCozinhaLocal()
}

function adicionarAoLote(r) {
  const existente = s.cozinhaLote.find(item => item.receita_id === r.uuid)
  const passo = getPassoProducao(r)
  
  if (existente) {
    existente.qtd_produzir += passo
    existente.peso_total = existente.qtd_produzir * (existente.peso_unitario || 0)
  } else {
    s.cozinhaLote.push({
      receita_id: r.uuid,
      nome: r.nome,
      qtd_produzir: passo,
      rendimento_base: r.rendimento || 1,
      unidade: r.unidade_rendimento,
      peso_unitario: r.peso_unitario || 0,
      peso_total: passo * (r.peso_unitario || 0),
      eh_intermediaria: r.eh_intermediaria,
      ingredientes: r.ingredientes || [],
      aberto: false
    })
  }
  s.salvarCozinhaLocal()
}

function ajustarQtd(idx, delta) {
  const item = s.cozinhaLote[idx]
  item.qtd_produzir = Math.max(0, item.qtd_produzir + delta)
  item.peso_total = item.qtd_produzir * (item.peso_unitario || 0)
  if (item.qtd_produzir === 0) s.cozinhaLote.splice(idx, 1)
  s.salvarCozinhaLocal()
}

function atualizarQtdManual(idx, valor) {
  const n = Number(String(valor).replace(',', '.'))
  if (isNaN(n) || n <= 0) {
    s.cozinhaLote.splice(idx, 1)
    s.salvarCozinhaLocal()
    return
  }
  const item = s.cozinhaLote[idx]
  item.qtd_produzir = n
  item.peso_total = n * (item.peso_unitario || 0)
  s.salvarCozinhaLocal()
}

function calcularIngredientesItem(item) {
  const fator = item.qtd_produzir / (item.rendimento_base || 1);
  // Recria o objeto de receita mínimo para a função do store
  const pseudoRecipe = { 
    eh_intermediaria: item.eh_intermediaria, 
    ingredientes: item.ingredientes 
  };
  
  const mapa = s.getProductionIngredients(pseudoRecipe, fator);
  return Object.values(mapa)
    .filter(ing => !isInsumoOculto(ing.nome))
    .map(ing => ({
      ...ing,
      nome: (ing.tipo === 'receita' ? '🥣 ' : '') + ing.nome,
      total: ing.unidade === 'un' ? Math.ceil(ing.total - 0.001) : ing.total
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

const ingredientesAgrupados = computed(() => {
  const acumulador = {};
  s.cozinhaLote.forEach(item => {
    const fator = item.qtd_produzir / (item.rendimento_base || 1);
    const pseudoRecipe = { 
      eh_intermediaria: item.eh_intermediaria, 
      ingredientes: item.ingredientes 
    };
    const prodIngredients = s.getProductionIngredients(pseudoRecipe, fator);
    for (const key in prodIngredients) {
      const ing = prodIngredients[key];

      // Filtra insumos ocultos antes de acumular
      if (isInsumoOculto(ing.nome)) continue;

      if (!acumulador[key]) {
        acumulador[key] = { 
          ...ing, 
          nome: (ing.tipo === 'receita' ? '🥣 ' : '') + ing.nome,
          total: 0,
          subIngredientes: []
        };
      }
      acumulador[key].total += ing.total;

      // Agrupa sub-ingredientes para o consolidado da cozinha
      if (ing.subIngredientes?.length) {
        ing.subIngredientes.forEach(sub => {
          const existingSub = acumulador[key].subIngredientes.find(s => s.id === sub.id);
          if (existingSub) {
            existingSub.total += sub.total;
          } else {
            acumulador[key].subIngredientes.push({ ...sub });
          }
        });
      }
    }
  });

  return Object.values(acumulador).map(ing => {
    if (ing.unidade === 'un') {
      ing.total = Math.ceil(ing.total - 0.001);
    }
    return ing;
  }).sort((a, b) => a.nome.localeCompare(b.nome));
});

// ── Painel de pesagem — somente leitura, chocolate sempre primeiro ──
const ORDEM_PESAGEM = [
  'chocolate', 'cacau', 'manteiga', 'gordura',
  'leite condensado', 'creme de leite', 'leite',
  'acucar', 'açúcar', 'farinha', 'amido', 'bicarbonato', 'fermento',
  'granulado', 'confeito', 'castanha', 'amendoim', 'ninho', 'nutella'
]

function prioridadePesagem(nome) {
  const n = normalizar(nome)
  for (let i = 0; i < ORDEM_PESAGEM.length; i++) {
    if (n.includes(ORDEM_PESAGEM[i])) return i
  }
  return ORDEM_PESAGEM.length // no fim, ordem alfabética
}

const ingredientesParaPesar = computed(() =>
  [...ingredientesAgrupados.value].sort((a, b) => {
    const pa = prioridadePesagem(a.nome)
    const pb = prioridadePesagem(b.nome)
    if (pa !== pb) return pa - pb
    return a.nome.localeCompare(b.nome)
  })
)

const painelPesagemAberto = ref(false)
const produtosNecessariosLote = computed(() => {
  const mapa = {}
  s.cozinhaLote.forEach(item => {
    const fator = item.qtd_produzir / (item.rendimento_base || 1)
    s.expandirIngredientes(item.ingredientes, fator, mapa)
  })
  return Object.values(mapa)
})

const listaComprasLote = computed(() => {
  return produtosNecessariosLote.value.map(req => {
    const prod = s.produtos.find(p => p.uuid === req.id)
    const estoque = prod?.estoque_atual || 0
    const totalNeeded = req.unidade === 'un' ? Math.ceil(req.total - 0.001) : req.total
    const falta = Math.max(0, totalNeeded - estoque)
    
    if (falta <= 0.001) return null // Considera margem de erro de float
    
    return { ...req, total: totalNeeded, estoque, falta }
  }).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome))
})

function compartilharComprasLote() {
  if (!ingredientesAgrupados.value.length) return

  const itensMsg = ingredientesAgrupados.value.map(i => {
    const prod = s.produtos.find(p => p.uuid === i.id)
    const estoque = prod?.estoque_atual || 0
    const falta = Math.max(0, i.total - estoque)
    const status = falta > 0 ? `⚠️ COMPRAR ${fmtQ(falta, i.unidade)}` : `✅ Ok no estoque`
    return `• *${i.nome.replace('🥣 ', '')}*\n  Necessário: ${fmtQ(i.total, i.unidade)} | ${status}`
  }).join('\n\n')
  
  const msg = `🛒 *LISTA DE INSUMOS PARA PRODUÇÃO*\n\n${itensMsg}\n\n_Gerado por chocobete_`
  
  if (navigator.share) {
    navigator.share({ title: 'Lista de Insumos', text: msg }).catch(() => {})
  } else {
    navigator.clipboard.writeText(msg)
    s.notify('Lista de insumos copiada!')
  }
}

async function finalizarLote(apenasAgendar = false) {
  // MELHORIA 5: Resumo detalhado antes de confirmar
  const linhas = s.cozinhaLote.map(item => `• ${item.qtd_produzir} ${item.unidade}  —  ${item.nome}`)
  const totalItens = s.cozinhaLote.reduce((acc, item) => acc + item.qtd_produzir, 0)
  const tempoStr = tempoEstimadoLote.value > 0 ? `\n⏱ Tempo estimado: ${fmtTime(tempoEstimadoLote.value)}` : ''
  const resumo = linhas.join('\n') + `\n\nTotal: ${totalItens} unidades${tempoStr}`

  const titulo = apenasAgendar 
    ? `Agendar ${s.cozinhaLote.length} receita(s) na agenda?`
    : `Registrar ${s.cozinhaLote.length} receita(s)?`

  const ok = await confirm.ask(
    resumo,
    { 
      title: titulo, 
      icon: apenasAgendar ? 'fas fa-calendar-plus' : 'fas fa-check-double', 
      confirmLabel: apenasAgendar ? 'Agendar' : 'Registrar', 
      type: 'primary' 
    }
  )
  if (!ok) return

  // Se estamos editando um lote que já existia, removemos a versão antiga
  // (incluindo devolução de estoque se não era agendado) para evitar duplicidade
  if (s.loteOriginalEmEdicao) {
    await s.estornarLotePorData(s.loteOriginalEmEdicao)
  }

  // Se é uma edição de lote existente, mantém a data original para não sumir do histórico
  const data = s.loteOriginalEmEdicao || getNowLocal()
  const duracao = 0 // Agora é controlado globalmente após o registro

  // Distribuição do tempo
  let tempoDistribuido = {}
  if (duracao > 0) {
    const tempoTeoricoTotal = s.cozinhaLote.reduce((acc, item) => {
      const r = s.receitas.find(rec => rec.uuid === item.receita_id)
      return acc + ((item.qtd_produzir / (r?.rendimento || 1)) * (r?.tempo_preparo_min || 0))
    }, 0)

    s.cozinhaLote.forEach(item => {
      const r = s.receitas.find(rec => rec.uuid === item.receita_id)
      const teoricoItem = (item.qtd_produzir / (r?.rendimento || 1)) * (r?.tempo_preparo_min || 0)
      const prop = tempoTeoricoTotal > 0 ? (teoricoItem / tempoTeoricoTotal) : (1 / s.cozinhaLote.length)
      tempoDistribuido[item.receita_id] = duracao * prop
    })
  }

  const producoes = s.cozinhaLote.map(item => ({
    receita_id: item.receita_id,
    receita_nome: item.nome,
    quantidade_produzida: item.qtd_produzir,
    unidade_rendimento: item.unidade,
    eh_intermediaria: item.eh_intermediaria,
    agendado: apenasAgendar,
    data_producao: data,
    data_inicio: data,
    data_fim: '',
    tempo_real_min: tempoDistribuido[item.receita_id] || 0,
    ingredientes_snapshot: JSON.parse(JSON.stringify(item.ingredientes)),
    custo_unitario_snapshot: (function() {
      const r = s.receitas.find(rec => rec.uuid === item.receita_id)
      if (!r) return 0
      const tempoItem = tempoDistribuido[item.receita_id] || null
      return s.getCustoProducaoReceita(r, item.qtd_produzir, tempoItem) / (item.qtd_produzir || 1)
    })(),
    preco_unitario_snapshot: s.receitas.find(rec => rec.uuid === item.receita_id)?.preco_sugerido || 0,
    custo_snapshot_version: 2
  }))
  await s.registrarLoteProducao(producoes)
  
  // Realiza a baixa dos insumos no estoque atual
  if (!apenasAgendar) {
    await s.baixarEstoqueInsumos(produtosNecessariosLote.value)
  }

  limparLote()
  s.notify(apenasAgendar ? 'Lote agendado!' : 'Lote registrado! Inicie o cronômetro na lista de produção.')
  s.setTab('producao')
}

function limparLote() {
  s.cozinhaLote = []
  s.cozinhaChecklist = {}
  s.loteOriginalEmEdicao = null
  s.salvarCozinhaLocal()
}

watch(catAtiva, () => {
  nextTick(scrollCategoriaAtiva)
}, { immediate: true })
</script>

<style scoped>
.cozinha-actions-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px; }
/* ── Layout normal da tela de cozinha (agora aba principal) ── */
.tab-cozinha    { display:flex; flex-direction:column; }
.cozinha-body   { flex:1; }

/* ── Filtro de receitas no modal ── */


/* ── Grid de adição rápida ── */
.quick-add-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; padding:16px; border-bottom:1px solid var(--border); }
.qa-btn         { position:relative; background:#fff; border:1px solid var(--border); border-radius:var(--r-md); padding:12px 8px; display:flex; flex-direction:column; align-items:center; gap:4px; box-shadow:var(--shadow-sm); cursor:pointer; user-select:none; -webkit-touch-callout:none; }
.qa-btn:active  { background:var(--gold-bg); transform:scale(.97); }
.qa-btn--inlote { border-color:var(--gold-dark); background:var(--gold-bg); }
.qa-name        { font-size:.85rem; font-weight:700; color:var(--brown); text-align:center; line-height:1.2; }
.qa-un          { font-size:.7rem; color:var(--gold-dark); font-weight:600; }
.qa-badge       { position:absolute; top:6px; right:6px; min-width:20px; height:20px; padding:0 5px; border-radius:10px; background:var(--gold-dark); color:#fff; font-size:.65rem; font-weight:800; display:flex; align-items:center; justify-content:center; pointer-events:none; }

/* ── Plano / itens do lote ── */
.plan-group    { margin-bottom:8px; border:1px solid var(--border); border-radius:var(--r-md); overflow:hidden; background:#fff; }
.planned-items { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
.plan-card     { background:#fff; border:1px solid var(--border); border-radius:var(--r-md); padding:10px 12px; display:flex; justify-content:space-between; align-items:center; }
.plan-details  { background:var(--bg); padding:8px 12px; border-top:1px solid var(--border); }
.plan-ing-row  { padding:4px 0; border-bottom:1px solid rgba(0,0,0,.05); }
.plan-ing-row:last-child { border-bottom:none; }
.plan-ing-info { display:flex; justify-content:space-between; font-size:.85rem; }
.plan-ing-nome { color:var(--brown-mid); font-weight:600; }
.plan-ing-qtd  { font-family:var(--mono); font-weight:700; color:var(--brown); }
.plan-name     { font-weight:700; font-size:.9rem; color:var(--brown); }
.plan-sub      { font-size:.75rem; color:var(--muted); }

.badge-shortcut { padding:2px 10px; border-radius:var(--r-full); background:var(--gold-bg); border:1px solid #e8d5a0; color:var(--gold-dark); font-size:.68rem; font-weight:700; margin-top:4px; white-space:nowrap; }
.batch-content  { padding:16px; }

/* ── Controle de quantidade ── */
.qty-ctrl-sm    { display:flex; align-items:center; gap:12px; background:var(--bg); border-radius:20px; padding:4px; border:1px solid var(--border); }
.btn-qty-sm     { border:none; background:#fff; width:32px; height:32px; border-radius:50%; font-size:1.2rem; font-weight:bold; color:var(--gold-dark); box-shadow:var(--shadow-sm); cursor:pointer; }
.qty-val        { font-family:var(--mono); font-weight:800; font-size:1rem; min-width:24px; text-align:center; }
.qty-input-cozinha { width:60px; border:none; background:#fff; border-radius:4px; text-align:center; font-family:var(--mono); font-weight:800; font-size:1.1rem; color:var(--brown-dark); padding:0; appearance:none; -moz-appearance:textfield; }
.qty-input-cozinha::-webkit-outer-spin-button,
.qty-input-cozinha::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.qty-input-cozinha:focus { outline:none; }

/* ── Checklist (pesagem — variante sem transição, exclusiva desta tela) ── */

.check-item.done .check-box { color: var(--green); }
.check-item.done .check-name { text-decoration: line-through; color: var(--muted); }
.check-item.done .check-val { color: var(--muted); opacity: 0.6; }

/* ── Stepper flutuante ── */
.stepper-popup { position:fixed; z-index:calc(var(--z-critical) - 1); display:flex; align-items:center; background:var(--brown-dark); border-radius:28px; box-shadow:0 8px 24px rgba(0,0,0,.25); padding:4px; touch-action:none; }
.stepper-popup::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: 0; height: 0; border: 8px solid transparent; pointer-events: none; }
.stepper-popup.arrow-down::after { bottom: -15px; border-top-color: var(--brown-dark); }
.stepper-popup.arrow-up::after { top: -15px; border-bottom-color: var(--brown-dark); }

.stepper-btn   { width:44px; height:44px; border:none; background:transparent; color:#fff; font-size:1.5rem; font-weight:700; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; transition:background .1s; user-select:none; -webkit-touch-callout:none; }
.stepper-btn:active { background:rgba(255,255,255,.15); }
.stepper-val        { min-width:36px; text-align:center; font-family:var(--mono); font-size:1.1rem; font-weight:800; color:#fff; }

/* ── Feedback flutuante (+N un) ── */
.feedback-float { position:fixed; transform:translateX(-50%); background:var(--brown-dark); color:#fff; font-size:.8rem; font-weight:800; padding:4px 10px; border-radius:20px; pointer-events:none; z-index:var(--z-critical); animation:floatUp .75s ease forwards; white-space:nowrap; }

/* ── Animações ── */
.stepper-anim-enter-active,
.stepper-anim-leave-active { transition:opacity .15s ease, transform .15s ease; }
.stepper-anim-enter-from,
.stepper-anim-leave-to     { opacity:0; transform:scale(.8); }

@keyframes floatUp {
  0%   { opacity:1; transform:translateX(-50%) translateY(0); }
  100% { opacity:0; transform:translateX(-50%) translateY(-40px); }
}

/* Garante que o toque longo não seja cancelado por micro-movimentos no celular */
.sticky-touch { touch-action: pan-y; }

.view-timer-chip {
  background: rgba(0,0,0,0.3);
  padding: 4px 12px;
  border-radius: 12px;
  margin-left: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid rgba(255,255,255,0.2);
}

/* ── Animação de pulso para item em edição ── */
.is-pulsing {
  animation: pulse-edit 1.2s infinite ease-in-out;
  border-color: var(--gold) !important;
  background: var(--gold-bg) !important;
  z-index: 5;
}
@keyframes pulse-edit {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

.timer-main { color: #fff; font-weight: 800; font-size: 0.9rem; font-family: var(--mono); }
.timer-sub { color: rgba(255,255,255,0.7); font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }

/* Aviso de edição */
.edit-mode-notice { background: var(--gold-bg); border-bottom: 1px solid var(--gold-dim); padding: 8px 12px 8px 16px; display: flex; align-items: center; gap: 10px; font-size: 0.78rem; color: var(--brown-mid); }
.edit-mode-notice i { color: var(--gold-dark); }
.btn-discard-banner { margin-left: auto; background: var(--red-bg); color: var(--red); border: 1px solid var(--red-dim); padding: 4px 10px; border-radius: var(--r-sm); font-size: 0.68rem; font-weight: 800; text-transform: uppercase; transition: all var(--t); }
.btn-discard-banner:active { background: var(--red); color: #fff; transform: scale(0.95); }

/* ── Estimativa de tempo ── */
.tempo-estimado-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-top: 16px;
  padding: 12px 14px;
  background: var(--blue-bg); border: 1px solid #bfdbfe;
  border-radius: var(--r-md);
}
.teb-left { display: flex; align-items: center; gap: 10px; }
.teb-left i { color: var(--blue); font-size: .9rem; flex-shrink: 0; }
.teb-titulo { font-size: .8rem; font-weight: 800; color: var(--brown-dark); }
.teb-sub { font-size: .62rem; color: var(--muted); margin-top: 1px; }
.teb-valor {
  font-size: 1.15rem; font-weight: 800;
  font-family: var(--mono); color: var(--blue);
  flex-shrink: 0;
}
</style>

<style scoped>
/* ── Painel de pesagem ────────────────────────────────── */
.painel-pesar-overlay {
  position: fixed; inset: 0;
  background: rgba(30,18,8,.6);
  z-index: calc(var(--z-modal) + 500);
  display: flex; align-items: flex-end;
}
.painel-pesar {
  width: 100%; max-height: 92vh;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  display: flex; flex-direction: column;
  will-change: transform;
  animation: slideUp .25s var(--t-spring);
}
.painel-pesar-hdr {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--brown-dark);
  border-radius: 20px 20px 0 0;
}
.painel-pesar-titulo {
  flex: 1; font-size: 1rem; font-weight: 800;
  color: #fff; display: flex; align-items: center; gap: 8px;
}
.painel-pesar-timer {
  font-size: .9rem; font-weight: 700; font-family: var(--mono);
  color: var(--gold-light); display: flex; align-items: center; gap: 6px;
}
.painel-pesar-fechar {
  width: 36px; height: 36px; border-radius: 50%;
  border: none; background: rgba(255,255,255,.15);
  color: #fff; font-size: 1rem; display: flex; align-items: center; justify-content: center;
}
.painel-pesar-lista {
  flex: 1; overflow-y: auto;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;
}
.painel-pesar-item {
  display: flex; flex-direction: column;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
}
.painel-pesar-item:last-child { border-bottom: none; }
.painel-pesar-item-main {
  display: flex; align-items: center; justify-content: space-between;
}
.painel-pesar-composicao {
  margin-top: 8px;
}
.painel-pesar-destaque {
  background: var(--gold-bg);
  border-left: 4px solid var(--brown);
  padding-left: 20px;
}
.painel-pesar-nome {
  font-size: 1.05rem; font-weight: 500; color: var(--text);
}
.painel-pesar-receitas {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 12px 20px 4px;
  border-bottom: 1px solid var(--border);
}
.painel-pesar-receita-chip {
  font-size: .72rem; font-weight: 700;
  color: var(--brown-dark);
  background: var(--gold-bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
}
.painel-pesar-destaque .painel-pesar-nome {
  font-weight: 800; color: var(--brown-dark);
}
.painel-pesar-qtd {
  font-size: 1.15rem; font-weight: 800;
  font-family: var(--mono); color: var(--brown-dark);
  flex-shrink: 0;
}
.painel-pesar-destaque .painel-pesar-qtd {
  font-size: 1.3rem; color: var(--brown-dark);
}
.painel-pesar-vazio {
  text-align: center; color: var(--muted);
  padding: 32px 20px; font-size: .85rem;
}
.painel-pesar-footer {
  padding: 10px 20px 16px;
  border-top: 1px solid var(--border);
  background: var(--cream);
}
.painel-pesar-nota {
  font-size: .72rem; color: var(--muted);
  display: flex; align-items: center; gap: 6px;
}
</style>