<template>
  <div class="tab-cozinha">
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-utensils"></i> Produzir</h2>
        <div class="tab-actions">
          <button class="btn-icon filtro-toggle-btn" :class="{ active: buscaAberta || busca }" title="Buscar receita" @click="alternarBusca">
            <i class="fas fa-search"></i>
          </button>
          <button v-if="ingredientesAgrupados.length" class="btn-icon" title="Painel de pesagem" @click="painelPesagemAberto = true">
            <i class="fas fa-scale-balanced"></i>
          </button>
          <button class="btn-icon" @click="s.setTab('producao')" title="Produções" aria-label="Ver produções">
            <i class="fas fa-clock-rotate-left"></i>
          </button>
          <button v-if="s.cozinhaLote.length && !s.loteOriginalEmEdicao" class="btn-icon" @click="limparLote" title="Limpar Lote">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>

      <div v-if="buscaAberta" class="search-wrap cz-busca">
        <i class="fas fa-search search-icon"></i>
        <input ref="buscaEl" v-model="busca" class="search-input" type="search" placeholder="Buscar receita…" />
      </div>

      <!-- Barra de categorias — dentro do header para ficar grudada -->
      <div ref="chipsEl" class="cat-chips chips-padded" style="margin: 4px -16px 0; padding-bottom: 10px;">
        <button
          v-for="c in categorias"
          :key="c"
          class="chip"
          :class="{ active: catAtiva === c }"
          :ref="el => setChipRef(el, c)"
          @click="catAtiva = c; busca = ''"
        >{{ c === 'No lote' ? `No lote (${s.cozinhaLote.length})` : c }}</button>
      </div>
    </div>
    <div v-if="s.loteOriginalEmEdicao" class="edit-mode-notice">
      <i class="fas fa-wrench"></i>
      <span>Você está corrigindo um lote de <strong>{{ dataHoraBR(s.loteOriginalEmEdicao) }}</strong></span>
      <button class="btn-discard-banner" @click="handleDescartar">Descartar</button>
    </div>

    <div
      class="cozinha-body"
      :class="{ 'cozinha-body--acao-fixa': s.cozinhaLote.length }"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
      @touchcancel="resetTouch"
    >
      <div ref="gridEl" class="quick-add-grid">
        <div
          v-for="r in receitasFiltradas"
          :key="r.uuid"
          class="qa-card no-select"
          :class="[catClasse(r), { 'qa-card--inlote': qtdItem(r) }]"
          role="button"
          tabindex="0"
          @click="onCardClick(r, $event)"
          @keydown.enter.self.prevent="onCardClick(r, $event)"
        >
          <div class="qa-top">
            <div class="qa-ico"><i class="fas" :class="iconeReceita(r)"></i></div>
            <span class="qa-passo">{{ rotuloPasso(r) }}</span>
          </div>
          <!-- Mesmo tamanho de fonte em todos os cards; até 2 linhas, sempre com a mesma altura -->
          <span class="qa-name" :title="r.nome">{{ r.nome }}</span>

          <!-- Já no lote: ajuste de quantidade no próprio card -->
          <div v-if="qtdItem(r)" class="qa-ctrl" @click.stop>
            <div class="qa-stepper">
              <button type="button" class="qa-step-btn" :aria-label="`Diminuir ${getPassoProducao(r)}`" @click="diminuirPasso(r)">−{{ getPassoProducao(r) }}</button>
              <div class="qa-qtd">
                <input
                  type="number"
                  class="qa-qtd-input"
                  :value="qtdItem(r)"
                  inputmode="decimal"
                  :aria-label="`Quantidade de ${r.nome}`"
                  @focus="$event.target.select()"
                  @change="e => editarQtdCard(r, e.target.value)"
                />
                <small>{{ r.unidade_rendimento || 'un' }}</small>
              </div>
              <button type="button" class="qa-step-btn qa-step-btn--mais" :aria-label="`Aumentar ${getPassoProducao(r)}`" @click="aumentarPasso(r, $event)">+{{ getPassoProducao(r) }}</button>
            </div>
            <!-- Ajuste fino: tirar uma unidade por vez -->
            <button v-if="getPassoProducao(r) > 1" type="button" class="qa-fine" aria-label="Diminuir 1 unidade" @click="diminuirUm(r)">
              <i class="fas fa-minus"></i> Tirar 1 {{ r.unidade_rendimento || 'un' }}
            </button>
          </div>
          <div v-else class="qa-add"><i class="fas fa-plus"></i> Adicionar</div>
        </div>

        <div v-if="!receitasFiltradas.length" class="qa-vazio">
          {{ busca ? 'Nenhuma receita encontrada.' : catAtiva === 'No lote' ? 'Nenhuma receita no lote ainda.' : 'Nenhuma receita nesta categoria.' }}
        </div>
      </div>

      <div v-if="s.cozinhaLote.length" class="batch-content">
        <div class="section-label"><i class="fas fa-clipboard-list"></i> Ingredientes por receita</div>

        <div class="planned-items">
          <div v-for="(item, idx) in s.cozinhaLote" :key="idx" class="plan-group">
            <div class="plan-card no-select" @click="toggleItemProducao(item)">
              <div class="plan-info">
                <div class="plan-name">
                  <i class="fas" :class="item.aberto ? 'fa-chevron-down' : 'fa-chevron-right'" style="font-size: 0.7rem; margin-right: 4px; color: var(--gold-dark)"></i>
                  {{ item.nome }}
                </div>
                <div class="plan-sub">
                  <strong style="color: var(--brown-dark)">{{ fmtQ(item.peso_total, 'g') }}</strong> • {{ item.qtd_produzir }} {{ item.unidade }}
                </div>
              </div>
            </div>
            <div v-if="item.aberto" class="plan-details">
              <div v-for="ing in calcularIngredientesItem(item)" :key="ing.id" class="plan-ing-row">
                <div class="plan-ing-info">
                  <span class="plan-ing-nome"><i v-if="ing.tipo === 'receita'" class="fas fa-mortar-pestle insumo-tipo-ico"></i> {{ ing.nome }}</span>
                  <span class="plan-ing-qtd">{{ fmtQ(ing.total, ing.unidade) }}</span>
                </div>
                <SubComposicao :subs="ing.subIngredientes" />
              </div>
            </div>
          </div>
        </div>

        <div class="sheet-card mt-16">
          <div class="sheet-body">
            <div class="section-label"><i class="fas fa-mortar-pestle"></i> Total para pesar (Consolidado)</div>
            <div class="checklist">
              <div v-for="ing in ingredientesAgrupados" :key="ing.id" class="check-item" :class="{ 'done': s.cozinhaChecklist[ing.id] }" @click="toggleCheck(ing.id)">
                <div class="check-box"><i class="fas" :class="s.cozinhaChecklist[ing.id] ? 'fa-check-square' : 'fa-square'"></i></div>
                <div class="check-info">
                  <div class="check-main">
                    <div class="check-name">{{ ing.nome }}</div>
                    <div class="check-val">{{ fmtQ(ing.total, ing.unidade) }}</div>
                  </div>
                  <SubComposicao :subs="ing.subIngredientes" style="margin-left:0; margin-top:6px;" />
                </div>
              </div>
            </div>
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

        <!-- Ação rara: fora da barra fixa para não competir com Produzir/Agendar -->
        <button v-if="!s.loteOriginalEmEdicao" class="btn btn-secondary btn-full mt-16 cozinha-presente-btn" @click="finalizarLote(false, true)">
          <i class="fas fa-gift"></i> Registrar como presente
          <small>não gera venda • baixa o estoque</small>
        </button>

      </div>
      <div v-else class="app-empty">
        <i class="fas fa-mortar-pestle"></i>
        <h3>Lote vazio</h3>
        <p>Toque nas receitas para adicionar ao lote e calcular o preparo total.</p>
      </div>
    </div>

    <!-- ── Ações do lote — fixas no rodapé, sempre visíveis (sem depender de rolagem) ── -->
    <div v-if="s.cozinhaLote.length" :class="s.loteOriginalEmEdicao ? 'cozinha-actions-fixa' : 'cozinha-actions-fixa cozinha-actions-fixa--grid'">
      <button type="button" class="cz-resumo" @click="painelPesagemAberto = true" aria-label="Ver total para pesar">
        <span class="cz-resumo-txt">
          <strong>{{ s.cozinhaLote.length }} {{ s.cozinhaLote.length === 1 ? 'receita' : 'receitas' }}</strong>
          <small>
            <template v-if="resumoLote.peso > 0">{{ fmtQ(resumoLote.peso, 'g') }}</template>
            <template v-if="resumoLote.peso > 0 && tempoEstimadoLote > 0"> · </template>
            <template v-if="tempoEstimadoLote > 0">~{{ fmtTime(tempoEstimadoLote) }}</template>
            <template v-if="!(resumoLote.peso > 0) && !(tempoEstimadoLote > 0)">toque para ver o total a pesar</template>
          </small>
        </span>
        <span class="cz-resumo-link">Ver pesagem <i class="fas fa-chevron-up"></i></span>
      </button>
      <button v-if="!s.loteOriginalEmEdicao" class="btn btn-secondary btn-lg" @click="finalizarLote(true)">
        <i class="fas fa-calendar-plus"></i> Agendar
      </button>
      <button class="btn btn-primary btn-lg" :class="{ 'btn-full': s.loteOriginalEmEdicao }" @click="finalizarLote(false)">
        <i class="fas fa-check-double"></i> {{ s.loteOriginalEmEdicao ? 'Salvar Produção' : 'Produzir' }}
      </button>
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
          >{{ item.qtd_produzir }}× {{ item.nome }}<span v-if="formasParaItem(item)"> ({{ formasParaItem(item) }})</span></span>
        </div>
        <div class="painel-pesar-lista">
          <div
            v-for="(ing, idx) in ingredientesParaPesar"
            :key="ing.id"
            class="painel-pesar-item"
            :class="{ 'painel-pesar-destaque': idx === 0 }"
          >
            <div class="painel-pesar-item-main">
              <span class="painel-pesar-nome"><i v-if="ing.tipo === 'receita'" class="fas fa-mortar-pestle insumo-tipo-ico"></i> {{ ing.nome }}</span>
              <span class="painel-pesar-qtd">{{ fmtQ(ing.total, ing.unidade) }}</span>
            </div>
            <SubComposicao :subs="ing.subIngredientes" class="painel-pesar-composicao" />
          </div>
          <div v-if="!ingredientesParaPesar.length" class="painel-pesar-vazio">
            Nenhum ingrediente no lote ainda.
          </div>
        </div>
        <div class="painel-pesar-footer">
          <span class="painel-pesar-nota">
            <i class="fas fa-eye"></i> Somente visualização — edite o lote na tela Produzir
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
import { ref, computed, watch, nextTick, onMounted, inject } from 'vue'
import { useStore } from '../store.js'
import SubComposicao from '../components/SubComposicao.vue'
import { fmtQtd as fmtQ, getNowLocal, normalizar, dataHoraBR } from '../utils.js' // Corrected import
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

const categorias = ['Todas', 'No lote', 'Trufa', 'Cone', 'Barra', 'Brownie', 'Bolo', 'Ovo', 'Base', 'Presentes', 'Festa']
const catAtiva = ref('Trufa')
const chipsEl = ref(null)
const chipRefs = ref({})
const touchStartX = ref(0)
const touchStartY = ref(0)

// Categorias com chip/identidade própria: nelas o nome NÃO transforma a receita
// em "trufa" (ex.: "Caixa 6 trufas Tradicionais" é Presentes e não entra em Trufa).
// Receitas de categoria vazia/antiga (ex.: "Festa") ainda são reconhecidas pelo nome.
const CATEGORIAS_PROPRIAS = ['cone', 'barra', 'brownie', 'bolo', 'ovo', 'pascoa', 'base', 'presentes']
function ehTrufa(r) {
  const cat = normalizar(r.categoria)
  if (cat.includes('trufa')) return true
  if (CATEGORIAS_PROPRIAS.some(c => cat.includes(c))) return false
  return normalizar(r.nome).includes('trufa')
}

function ehFesta(r) {
  return normalizar(r.tamanho) === 'festa'
}

// Busca (ícone de lupa no cabeçalho)
const busca = ref('')
const buscaAberta = ref(false)
const buscaEl = ref(null)
function alternarBusca() {
  buscaAberta.value = !buscaAberta.value
  if (buscaAberta.value) nextTick(() => buscaEl.value?.focus())
  else busca.value = ''
}

const receitasFiltradas = computed(() => {
  const termo = normalizar(busca.value || '').trim()
  if (termo) {
    return s.receitas
      .filter(r => normalizar(r.nome).includes(termo))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }

  if (catAtiva.value === 'No lote') {
    return s.receitas
      .filter(r => qtdNoLote.value[r.uuid])
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }

  if (catAtiva.value === 'Todas') {
    return [...s.receitas].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }

  if (catAtiva.value === 'Festa') {
    return [...s.receitas]
      .filter(r => ehTrufa(r) && ehFesta(r))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }

  if (catAtiva.value === 'Trufa') {
    return [...s.receitas]
      .filter(r => ehTrufa(r) && !ehFesta(r))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }

  const base = s.receitas.filter(r => r.categoria === catAtiva.value)
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
  if (ehTrufa(r)) {
    const peso = Number(r.peso_unitario || 0)
    if (peso >= 30) return 8 // Forma de 8 cavidades
    if (peso > 0) return 12  // Forma de 12 cavidades (19g ou menor — ex: tamanho "Festa")
  }
  return r.rendimento || 1
}

// ─── MELHORIA 3: Feedback visual (+N un) ─────────────────────────────────
function mostrarFeedback(r, e) {
  const el = e.target.closest('.qa-card')
  if (!el) return
  const rect = el.getBoundingClientRect()
  const passo = getPassoProducao(r)
  const texto = ehTrufa(r)
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

// ─── Cards: toque soma um passo; controles de quantidade no próprio card ───
function qtdItem(r) { return qtdNoLote.value[r.uuid] || 0 }
function idxNoLote(r) { return s.cozinhaLote.findIndex(i => i.receita_id === r.uuid) }

function onCardClick(r, e) {
  adicionarAoLote(r)
  mostrarFeedback(r, e)
}

function aumentarPasso(r, e) {
  adicionarAoLote(r)
  if (e) mostrarFeedback(r, e)
  if (navigator.vibrate) navigator.vibrate(5)
}

// Diminui um passo (uma forma / um rendimento). Zera → sai do lote.
function diminuirPasso(r) {
  const idx = idxNoLote(r)
  if (idx >= 0) ajustarQtd(idx, -getPassoProducao(r))
  if (navigator.vibrate) navigator.vibrate(5)
}

// Ajuste fino: tira uma unidade por vez.
function diminuirUm(r) {
  const idx = idxNoLote(r)
  if (idx >= 0) ajustarQtd(idx, -1)
  if (navigator.vibrate) navigator.vibrate(5)
}

function editarQtdCard(r, valor) {
  const idx = idxNoLote(r)
  if (idx >= 0) atualizarQtdManual(idx, valor)
}

// Aparência do card por categoria
function catClasse(r) {
  if (ehTrufa(r)) return ehFesta(r) ? 'cat-festa' : 'cat-trufa'
  const c = normalizar(r.categoria)
  const k = ['cone', 'barra', 'brownie', 'bolo', 'ovo', 'base', 'presentes'].find(x => c.includes(x))
  return k ? `cat-${k}` : 'cat-outro'
}

const ICONES_CAT = {
  'cat-trufa': 'fa-circle', 'cat-festa': 'fa-champagne-glasses', 'cat-cone': 'fa-ice-cream',
  'cat-barra': 'fa-bars', 'cat-brownie': 'fa-cookie', 'cat-bolo': 'fa-cake-candles',
  'cat-ovo': 'fa-egg', 'cat-base': 'fa-blender', 'cat-presentes': 'fa-gift', 'cat-outro': 'fa-cookie-bite'
}
function iconeReceita(r) {
  if (r.eh_intermediaria) return 'fa-blender'
  if (r.eh_kit) return 'fa-gift'
  return ICONES_CAT[catClasse(r)] || 'fa-cookie-bite'
}

function rotuloPasso(r) {
  const passo = getPassoProducao(r)
  const un = r.unidade_rendimento || 'un'
  return ehTrufa(r) ? `+1 forma (${passo} ${un})` : `+${passo} ${un}`
}

// Resumo do lote (barra fixa)
const resumoLote = computed(() => ({
  peso: s.cozinhaLote.reduce((acc, i) => acc + (i.peso_total || 0), 0)
}))

function toggleItemProducao(item) {
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

// Quantos níveis de sub-receita abrir na lista de pesagem (receita dentro de receita dentro de...)
const PROFUNDIDADE_SUBRECEITAS = 6

/** Reordena a lista plana em profundidade (pai → filhos) usando paiChave. */
function ordenarEmArvore(lista) {
  const filhosPor = new Map()
  lista.forEach(x => {
    const k = x.paiChave || ''
    if (!filhosPor.has(k)) filhosPor.set(k, [])
    filhosPor.get(k).push(x)
  })
  const saida = []
  const visitar = (k) => (filhosPor.get(k) || []).forEach(x => { saida.push(x); visitar(x.chave) })
  visitar('')
  return saida
}

function calcularIngredientesItem(item) {
  const fator = item.qtd_produzir / (item.rendimento_base || 1);
  // Recria o objeto de receita mínimo para a função do store
  const pseudoRecipe = { 
    eh_intermediaria: item.eh_intermediaria, 
    ingredientes: item.ingredientes 
  };
  
  const mapa = s.getProductionIngredients(pseudoRecipe, fator, PROFUNDIDADE_SUBRECEITAS);
  return Object.values(mapa)
    .filter(ing => !ing.oculto)
    .map(ing => ({
      ...ing,
      total: ing.unidade === 'un' ? Math.ceil(ing.total - 0.001) : ing.total
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

function formasParaItem(item) {
  const r = s.receitas.find(rcp => rcp.uuid === item.receita_id)
  if (!r) return null
  const passo = getPassoProducao(r) || (r.rendimento || 1)
  if (!passo || passo <= 1) return null
  return Math.ceil((item.qtd_produzir || 0) / passo)
}

const ingredientesAgrupados = computed(() => {
  const acumulador = {};
  s.cozinhaLote.forEach(item => {
    const fator = item.qtd_produzir / (item.rendimento_base || 1);
    const pseudoRecipe = { 
      eh_intermediaria: item.eh_intermediaria, 
      ingredientes: item.ingredientes 
    };
    const prodIngredients = s.getProductionIngredients(pseudoRecipe, fator, PROFUNDIDADE_SUBRECEITAS);
    for (const key in prodIngredients) {
      const ing = prodIngredients[key];

      // Filtra insumos ocultos antes de acumular
      if (ing.oculto) continue;

      if (!acumulador[key]) {
        acumulador[key] = { 
          ...ing, 
          total: 0,
          subIngredientes: []
        };
      }
      acumulador[key].total += ing.total;

      // Agrupa sub-ingredientes para o consolidado da cozinha
      if (ing.subIngredientes?.length) {
        ing.subIngredientes.forEach(sub => {
          const existingSub = acumulador[key].subIngredientes.find(s => s.chave === sub.chave);
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
    ing.subIngredientes = ordenarEmArvore(ing.subIngredientes);
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

async function finalizarLote(apenasAgendar = false, isPresente = false) {
  // MELHORIA 5: Resumo detalhado antes de confirmar
  const linhas = s.cozinhaLote.map(item => `• ${item.qtd_produzir} ${item.unidade}  —  ${item.nome}`)
  const totalItens = s.cozinhaLote.reduce((acc, item) => acc + item.qtd_produzir, 0)
  const tempoStr = tempoEstimadoLote.value > 0 ? `\n⏱ Tempo estimado: ${fmtTime(tempoEstimadoLote.value)}` : ''
  const resumo = linhas.join('\n') + `\n\nTotal: ${totalItens} unidades${tempoStr}`

  const titulo = apenasAgendar
    ? `Agendar ${s.cozinhaLote.length} receita(s) na agenda?`
    : isPresente
      ? `Registrar produção de presente?`
      : `Registrar ${s.cozinhaLote.length} receita(s)?`

  const ok = await confirm.ask(
    resumo,
    {
      title: titulo,
      icon: apenasAgendar ? 'fas fa-calendar-plus' : isPresente ? 'fas fa-gift' : 'fas fa-check-double',
      confirmLabel: apenasAgendar ? 'Agendar' : isPresente ? 'Presentear' : 'Registrar',
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
    // rendimento da receita no momento da produção — necessário pra estornar o estoque na escala certa
    rendimento_base: item.rendimento_base || 1,
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
    custo_snapshot_version: 2,
    gerar_financeiro: isPresente ? false : true,
    origem: isPresente ? 'bete' : undefined
  }))
  await s.registrarLoteProducao(producoes)
  
  // Realiza a baixa dos insumos no estoque atual
  if (!apenasAgendar) {
    await s.baixarEstoqueInsumos(produtosNecessariosLote.value)
  }

  limparLote()
  s.notify(apenasAgendar ? 'Lote agendado!' : isPresente ? 'Presente registrado!' : 'Lote registrado! Inicie o cronômetro na aba Produções.')
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
/* ── Layout normal da tela de cozinha (agora aba principal) ── */
.tab-cozinha    { display:flex; flex-direction:column; }
.cozinha-body   { flex:1; }

/* Reserva espaço para a barra de ações fixa não cobrir o fim do conteúdo */
.cozinha-body--acao-fixa { padding-bottom: 190px; }

/* Barra de ações do lote — fixa no rodapé, acima da AppNav inferior,
   sempre visível (mesmo padrão usado na tela de Etiquetas). Evita que
   o usuário precise rolar até o fim para Agendar/Presentear/Produzir. */
.cozinha-actions-fixa {
  position: fixed;
  left: 0; right: 0;
  bottom: calc(64px + env(safe-area-inset-bottom));
  max-width: 480px; margin: 0 auto;
  padding: 10px 16px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: 0 -6px 18px rgba(61,31,7,.08);
  z-index: calc(var(--z-header) + 1);
}
.cozinha-actions-fixa--grid { display: grid; grid-template-columns: 1fr 1.7fr; gap: 10px; }
/* Resumo do lote no topo da barra fixa (abre o painel de pesagem) */
.cz-resumo { grid-column: 1 / -1; display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; margin:0 0 10px; padding:2px 2px 8px; background:none; border:none; border-bottom:1px solid var(--border); text-align:left; cursor:pointer; font-family:var(--font); -webkit-tap-highlight-color:transparent; }
.cz-resumo-txt { display:flex; flex-direction:column; gap:1px; min-width:0; }
.cz-resumo-txt strong { font-size:.95rem; font-weight:800; color:var(--brown-dark); }
.cz-resumo-txt small { font-size:.74rem; font-weight:600; color:var(--muted); }
.cz-resumo-link { flex:none; display:inline-flex; align-items:center; gap:6px; font-size:.78rem; font-weight:800; color:var(--gold-dark); }
.cz-resumo-link i { font-size:.65rem; }
.cozinha-presente-btn { flex-direction: column; gap: 2px; padding: 10px 12px; }
.cozinha-presente-btn small { font-size: .68rem; font-weight: 600; color: var(--muted); }

/* ── Filtro de receitas no modal ── */


/* ── Grid de adição rápida ── */
.quick-add-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; padding:14px 16px 18px; border-bottom:1px solid var(--border); }
@media (min-width: 520px) { .quick-add-grid { grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); } }

.qa-card { --tint:var(--gold-bg); --cor:var(--gold-dark);
  position:relative; display:flex; flex-direction:column; gap:8px; padding:12px;
  background:#fff; border:1.5px solid var(--border); border-radius:var(--r-md); box-shadow:var(--shadow-sm);
  cursor:pointer; user-select:none; -webkit-touch-callout:none; touch-action:manipulation;
  transition:border-color var(--t), background var(--t), transform var(--t); }
.qa-card:active { transform:scale(.98); }
.qa-card:focus-visible { outline:2px solid var(--gold-dark); outline-offset:2px; }
.qa-card--inlote { border-color:var(--gold-dark); background:var(--gold-bg); }

.qa-card.cat-trufa, .qa-card.cat-festa { --tint:var(--purple-bg); --cor:var(--purple); }
.qa-card.cat-cone      { --tint:var(--teal-bg);   --cor:var(--teal); }
.qa-card.cat-barra     { --tint:var(--green-bg);  --cor:var(--green); }
.qa-card.cat-brownie   { --tint:var(--orange-bg); --cor:var(--orange); }
.qa-card.cat-bolo      { --tint:var(--gold-bg);   --cor:var(--gold-dark); }
.qa-card.cat-ovo       { --tint:var(--blue-bg);   --cor:var(--blue); }
.qa-card.cat-base      { --tint:var(--cream-deep); --cor:var(--brown-mid); }
.qa-card.cat-presentes { --tint:var(--red-bg);    --cor:var(--red); }

/* Linha de cima: ícone da categoria + quanto cada toque soma */
.qa-top  { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
.qa-ico  { flex:none; width:36px; height:36px; border-radius:11px; background:var(--tint); color:var(--cor); display:flex; align-items:center; justify-content:center; font-size:1rem; }
.qa-card--inlote .qa-ico { background:#fff; }
.qa-passo { min-width:0; padding:3px 9px; border-radius:var(--r-full); background:var(--tint); color:var(--cor); font-size:.68rem; font-weight:800; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.qa-card--inlote .qa-passo { background:#fff; }

/* Nome: fonte única, até 2 linhas, altura reservada (cards sempre alinhados) */
.qa-name { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-clamp:2; overflow:hidden;
  font-size:.9rem; font-weight:800; line-height:1.25; min-height:2.5em; color:var(--brown); overflow-wrap:anywhere; }

/* Adicionar (ainda fora do lote): mesma altura do controle de quantidade */
.qa-add  { display:flex; align-items:center; justify-content:center; gap:6px; height:44px; border:1.5px dashed var(--border2); border-radius:var(--r-full); font-size:.8rem; font-weight:800; color:var(--cor); }
.qa-add i { font-size:.7rem; }

/* Controle de quantidade dentro do card */
.qa-ctrl    { display:flex; flex-direction:column; gap:8px; cursor:default; }
.qa-stepper { display:flex; align-items:center; justify-content:space-between; gap:4px; }
.qa-step-btn { flex:none; min-width:48px; height:44px; padding:0 8px; border:1.5px solid var(--border2); border-radius:var(--r-full); background:#fff; color:var(--brown-mid); font-family:var(--mono); font-size:.85rem; font-weight:800; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.qa-step-btn:active { background:var(--cream-deep); }
.qa-step-btn--mais { background:var(--gold-dark); border-color:var(--gold-dark); color:#fff; }
.qa-step-btn--mais:active { background:var(--brown-mid); }
.qa-qtd { display:flex; flex-direction:column; align-items:center; min-width:0; flex:1; line-height:1.1; }
.qa-qtd small { font-size:.62rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.3px; }
.qa-qtd-input { width:100%; max-width:60px; border:none; background:transparent; text-align:center; font-family:var(--mono); font-size:1.15rem; font-weight:800; color:var(--brown-dark); padding:0; appearance:none; -moz-appearance:textfield; }
.qa-qtd-input::-webkit-outer-spin-button,
.qa-qtd-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.qa-qtd-input:focus { outline:none; border-bottom:2px solid var(--gold-dark); }
/* Ajuste fino: largura total do card, fácil de tocar */
.qa-fine { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; height:38px; border:1px dashed var(--border2); border-radius:var(--r-full); background:transparent; color:var(--muted); font-size:.76rem; font-weight:700; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.qa-fine i { font-size:.62rem; }
.qa-fine:active { background:var(--red-bg); color:var(--red); border-color:var(--red-dim); }
.qa-vazio { grid-column:1 / -1; text-align:center; padding:28px 12px; font-size:.85rem; color:var(--muted); }

.cz-busca { margin:4px 0 8px; }

/* ── Plano / itens do lote ── */
.plan-group    { margin-bottom:8px; border:1px solid var(--border); border-radius:var(--r-md); overflow:hidden; background:#fff; }
.planned-items { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
.plan-card     { cursor:pointer; background:#fff; border:1px solid var(--border); border-radius:var(--r-md); padding:10px 12px; display:flex; justify-content:space-between; align-items:center; }
.plan-details  { background:var(--bg); padding:8px 12px; border-top:1px solid var(--border); }
.plan-ing-row  { padding:4px 0; border-bottom:1px solid rgba(0,0,0,.05); }
.plan-ing-row:last-child { border-bottom:none; }
.plan-ing-info { display:flex; justify-content:space-between; font-size:.85rem; }
.plan-ing-nome { color:var(--brown-mid); font-weight:600; }
.insumo-tipo-ico { color:var(--gold-dark); font-size:.78em; }
.plan-ing-qtd  { font-family:var(--mono); font-weight:700; color:var(--brown); }
.plan-name     { font-weight:700; font-size:.9rem; color:var(--brown); }
.plan-sub      { font-size:.75rem; color:var(--muted); }

.batch-content  { padding:16px; }

/* ── Controle de quantidade ── */

/* ── Checklist (pesagem — variante sem transição, exclusiva desta tela) ── */

.check-item.done .check-box { color: var(--green); }
.check-item.done .check-name { text-decoration: line-through; color: var(--muted); }
.check-item.done .check-val { color: var(--muted); opacity: 0.6; }

/* ── Feedback flutuante (+N un) ── */
.feedback-float { position:fixed; transform:translateX(-50%); background:var(--brown-dark); color:#fff; font-size:.8rem; font-weight:800; padding:4px 10px; border-radius:20px; pointer-events:none; z-index:var(--z-critical); animation:floatUp .75s ease forwards; white-space:nowrap; }

/* ── Animações ── */
@keyframes floatUp {
  0%   { opacity:1; transform:translateX(-50%) translateY(0); }
  100% { opacity:0; transform:translateX(-50%) translateY(-40px); }
}

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