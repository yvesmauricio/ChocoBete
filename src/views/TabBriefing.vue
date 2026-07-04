<template>
  <div class="tab-briefing view-maximized">
    <header class="view-header">
      <button class="view-back-btn" @click="s.setTab('producao')" aria-label="Voltar">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h2 class="view-title"><i class="fas fa-clipboard-list"></i> Pedido do Dia</h2>
      <div class="spacer"></div>
      <button v-if="lote.length" class="view-action-btn" @click="limpar" title="Limpar tudo">
        <i class="fas fa-trash-alt"></i>
      </button>
    </header>

    <!-- BUSCA + FILTROS -->
    <div class="search-bar">
      <i class="fas fa-search search-icon"></i>
      <input
        v-model="busca"
        class="search-input"
        type="search"
        placeholder="Buscar receita..."
        inputmode="search"
      />
    </div>
    <div class="chips-bar">
      <button
        v-for="c in categorias"
        :key="c"
        class="chip"
        :class="{ active: catAtiva === c }"
        @click="catAtiva = c"
      >{{ c }}</button>
    </div>

    <div class="briefing-body">

      <!-- GRID DE RECEITAS -->
      <div class="receitas-grid">
        <button
          v-for="r in receitasFiltradas"
          :key="r.uuid"
          class="rb-btn"
          :class="{ 'rb-btn--ativo': qtdMap[r.uuid] }"
          @click="adicionar(r)"
          @pointerdown="iniciarLong(r, $event)"
          @pointerup="cancelarLong"
          @pointercancel="cancelarLong"
          @contextmenu.prevent
        >
          <span v-if="qtdMap[r.uuid]" class="rb-badge">{{ qtdMap[r.uuid] }}</span>
          <span class="rb-nome">{{ r.nome }}</span>
          <span class="rb-rend">+{{ r.rendimento }} {{ r.unidade_rendimento }}</span>
        </button>
      </div>

      <!-- PAINEL DE INSUMOS (só aparece quando tem itens) -->
      <template v-if="lote.length">

        <!-- RESUMO DO PEDIDO -->
        <div class="section-label mt-16">📋 Pedido montado</div>
        <div class="pedido-lista">
          <div v-for="(item, idx) in lote" :key="idx" class="pedido-item">
            <div class="pedido-info">
              <span class="pedido-nome">{{ item.nome }}</span>
              <span class="pedido-sub">{{ item.qtd }} {{ item.unidade }}</span>
            </div>
            <div class="qty-ctrl">
              <button class="btn-q" @click="ajustar(idx, -passo(item))">−</button>
              <span class="qty-val">{{ item.qtd }}</span>
              <button class="btn-q" @click="ajustar(idx, passo(item))">+</button>
            </div>
          </div>
        </div>

        <!-- INSUMOS CONSOLIDADOS — a lista principal que você pediu -->
        <div class="section-label mt-20">
          🍫 O que separar agora
          <span class="section-count">{{ ingredientesAgrupados.length }} insumos</span>
        </div>

        <div class="insumos-lista">
          <div
            v-for="ing in ingredientesAgrupados"
            :key="ing.id"
            class="insumo-row"
            :class="{
              'insumo-row--ok': estoqueOk(ing),
              'insumo-row--falta': !estoqueOk(ing)
            }"
          >
            <div class="insumo-info">
              <span class="insumo-nome">{{ ing.nome }}</span>
              <span v-if="ing.subIngredientes?.length" class="insumo-subs">
                <span v-for="sub in ing.subIngredientes" :key="sub.id" class="insumo-sub-chip">
                  {{ sub.nome }}: {{ fmtQ(sub.total, sub.unidade) }}
                </span>
              </span>
            </div>
            <div class="insumo-direita">
              <span class="insumo-qtd">{{ fmtQ(ing.total, ing.unidade) }}</span>
              <span v-if="!estoqueOk(ing)" class="insumo-falta">
                falta {{ fmtQ(faltaEstoque(ing), ing.unidade) }}
              </span>
              <span v-else class="insumo-ok-label">✓ ok</span>
            </div>
          </div>
        </div>

        <!-- CONSULTA RÁPIDA DE RECEITA -->
        <div class="section-label mt-20">
          📖 Consultar receita
          <span class="section-count">modo preparo</span>
        </div>
        <div class="receita-consulta-lista">
          <div
            v-for="item in lote"
            :key="item.receita_id"
            class="receita-consulta-card"
          >
            <div class="rc-hdr" @click="toggleConsulta(item.receita_id)">
              <span class="rc-nome">{{ item.nome }}</span>
              <span class="rc-qtd">{{ item.qtd }} {{ item.unidade }}</span>
              <i class="fas" :class="consultaAberta[item.receita_id] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--gold-dark);font-size:.75rem;margin-left:auto"></i>
            </div>
            <div v-if="consultaAberta[item.receita_id]" class="rc-body">
              <div
                v-for="ing in ingredientesReceita(item)"
                :key="ing.id"
                class="rc-ing-row"
              >
                <span class="rc-ing-nome">{{ ing.nome }}</span>
                <span class="rc-ing-qtd">{{ fmtQ(ing.total, ing.unidade) }}</span>
              </div>
              <div v-if="receitaObj(item.receita_id)?.modo_preparo" class="rc-modo">
                <div class="rc-modo-label">Modo de preparo</div>
                <div class="rc-modo-texto">{{ receitaObj(item.receita_id).modo_preparo }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- AÇÕES -->
        <div class="briefing-actions mt-20 mb-32">
          <button class="btn btn-secondary btn-lg" @click="compartilhar">
            <i class="fas fa-share-nodes"></i> Compartilhar lista
          </button>
          <button class="btn btn-primary btn-lg" @click="irParaCozinha">
            <i class="fas fa-utensils"></i> Abrir Cozinha
          </button>
        </div>

      </template>

      <div v-else class="empty-state">
        <i class="fas fa-clipboard"></i>
        <p>Toque nas receitas acima para montar o pedido do dia e ver os insumos a separar.</p>
      </div>

    </div>

    <!-- Stepper flutuante (long press) -->
    <Teleport to="body">
      <Transition name="sp-anim">
        <div
          v-if="stepper.visible"
          class="stepper-pop"
          :class="'arrow-' + stepper.dir"
          :style="{ left: stepper.x + 'px', top: stepper.y + 'px' }"
        >
          <button class="sp-btn" @click="stepperAjustar(-1)">−</button>
          <span class="sp-val">{{ stepper.qtd }}</span>
          <button class="sp-btn" @click="stepperAjustar(1)">+</button>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onUnmounted } from 'vue'
import { useStore } from '../store.js'
import { fmtQtd as fmtQ, normalizar } from '../utils.js'

const s = useStore()

// ── estado ──────────────────────────────────────────────────────────
const busca    = ref('')
const catAtiva = ref('Todas')
const lote     = ref([])
const consultaAberta = reactive({})

const categorias = ['Todas', 'Trufa', 'Cone', 'Barra', 'Brownie', 'Bolo', 'Ovo', 'Base']

// ── filtros ─────────────────────────────────────────────────────────
const receitasFiltradas = computed(() => {
  let base = catAtiva.value === 'Todas'
    ? s.receitas
    : s.receitas.filter(r => r.categoria === catAtiva.value)
  if (busca.value.trim()) {
    const q = normalizar(busca.value)
    base = base.filter(r => normalizar(r.nome).includes(q))
  }
  return [...base].sort((a, b) => a.nome.localeCompare(b.nome))
})

// ── mapa de qtds ────────────────────────────────────────────────────
const qtdMap = computed(() => {
  const m = {}
  lote.value.forEach(i => { m[i.receita_id] = i.qtd })
  return m
})

// ── passo por receita (trufas = 12, outros = rendimento) ────────────
function passo(item) {
  const r = s.receitas.find(x => x.uuid === item.receita_id)
  if (!r) return 1
  const nome = normalizar(r.nome)
  if (nome.includes('trufa')) {
    const peso = Number(r.peso_unitario || 0)
    return peso >= 30 ? 8 : 12
  }
  return r.rendimento || 1
}

// ── adicionar / ajustar ─────────────────────────────────────────────
function adicionar(r) {
  if (longActive.value) return
  const existente = lote.value.find(i => i.receita_id === r.uuid)
  const p = passoReceita(r)
  if (existente) {
    existente.qtd += p
  } else {
    lote.value.push({
      receita_id: r.uuid,
      nome: r.nome,
      qtd: p,
      unidade: r.unidade_rendimento,
      rendimento_base: r.rendimento || 1,
      peso_unitario: r.peso_unitario || 0,
      eh_intermediaria: r.eh_intermediaria,
      ingredientes: r.ingredientes || []
    })
  }
}

function passoReceita(r) {
  const nome = normalizar(r.nome)
  if (nome.includes('trufa')) {
    const peso = Number(r.peso_unitario || 0)
    return peso >= 30 ? 8 : 12
  }
  return r.rendimento || 1
}

function ajustar(idx, delta) {
  const item = lote.value[idx]
  item.qtd = Math.max(0, item.qtd + delta)
  if (item.qtd === 0) lote.value.splice(idx, 1)
}

function limpar() {
  lote.value = []
}

function toggleConsulta(id) {
  consultaAberta[id] = !consultaAberta[id]
}

function receitaObj(id) {
  return s.receitas.find(r => r.uuid === id)
}

// ── cálculo consolidado de insumos ──────────────────────────────────
const ingredientesAgrupados = computed(() => {
  const acum = {}
  lote.value.forEach(item => {
    const fator = item.qtd / (item.rendimento_base || 1)
    const pseudo = { eh_intermediaria: item.eh_intermediaria, ingredientes: item.ingredientes }
    const mapa = s.getProductionIngredients(pseudo, fator)
    for (const key in mapa) {
      const ing = mapa[key]
      if (ing.oculto) continue
      if (!acum[key]) {
        acum[key] = { ...ing, nome: (ing.tipo === 'receita' ? '🥣 ' : '') + ing.nome, total: 0, subIngredientes: [] }
      }
      acum[key].total += ing.total
      if (ing.subIngredientes?.length) {
        ing.subIngredientes.forEach(sub => {
          const ex = acum[key].subIngredientes.find(s => s.id === sub.id)
          if (ex) ex.total += sub.total
          else acum[key].subIngredientes.push({ ...sub })
        })
      }
    }
  })
  return Object.values(acum)
    .map(i => ({ ...i, total: i.unidade === 'un' ? Math.ceil(i.total - 0.001) : i.total }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
})

// insumos por receita individual (consulta rápida)
function ingredientesReceita(item) {
  const fator = item.qtd / (item.rendimento_base || 1)
  const pseudo = { eh_intermediaria: item.eh_intermediaria, ingredientes: item.ingredientes }
  const mapa = s.getProductionIngredients(pseudo, fator)
  return Object.values(mapa)
    .filter(i => !i.oculto)
    .map(i => ({ ...i, nome: (i.tipo === 'receita' ? '🥣 ' : '') + i.nome,
      total: i.unidade === 'un' ? Math.ceil(i.total - 0.001) : i.total }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

// ── estoque ──────────────────────────────────────────────────────────
function estoqueAtual(ing) {
  const prod = s.produtos.find(p => p.uuid === ing.id)
  return prod?.estoque_atual || 0
}
function estoqueOk(ing) { return estoqueAtual(ing) >= ing.total - 0.001 }
function faltaEstoque(ing) { return Math.max(0, ing.total - estoqueAtual(ing)) }

// ── compartilhar ─────────────────────────────────────────────────────
function compartilhar() {
  const pedidoLines = lote.value.map(i => `• ${i.nome}: ${i.qtd} ${i.unidade}`).join('\n')
  const insumoLines = ingredientesAgrupados.value.map(i => {
    const status = estoqueOk(i) ? '✅' : `⚠️ FALTA ${fmtQ(faltaEstoque(i), i.unidade)}`
    return `• ${i.nome.replace('🥣 ', '')}: ${fmtQ(i.total, i.unidade)} ${status}`
  }).join('\n')
  const msg = `📋 *PEDIDO DO DIA*\n${pedidoLines}\n\n🍫 *INSUMOS A SEPARAR*\n${insumoLines}\n\n_chocobete_`
  if (navigator.share) {
    navigator.share({ title: 'Pedido do Dia', text: msg }).catch(() => {})
  } else {
    navigator.clipboard.writeText(msg)
    s.notify('Lista copiada!')
  }
}

// ── ir para Cozinha carregando o lote ────────────────────────────────
function irParaCozinha() {
  // Transfere o briefing para o cozinhaLote do store (mesmo formato)
  s.cozinhaLote = lote.value.map(item => ({
    receita_id: item.receita_id,
    nome: item.nome,
    qtd_produzir: item.qtd,
    rendimento_base: item.rendimento_base,
    unidade: item.unidade,
    peso_unitario: item.peso_unitario,
    peso_total: item.qtd * item.peso_unitario,
    eh_intermediaria: item.eh_intermediaria,
    ingredientes: item.ingredientes,
    aberto: false
  }))
  s.salvarCozinhaLocal()
  s.setTab('cozinha')
}

// ── stepper (long press) ────────────────────────────────────────────
const longTimer  = ref(null)
const longActive = ref(false)
const stepper = reactive({ visible: false, receita: null, x: 0, y: 0, qtd: 0, dir: 'down', timer: null })

function iniciarLong(r, e) {
  longActive.value = false
  longTimer.value = setTimeout(() => {
    longActive.value = true
    abrirStepper(r, e)
  }, 400)
}
function cancelarLong() {
  clearTimeout(longTimer.value)
  setTimeout(() => { longActive.value = false }, 250)
}
function abrirStepper(r, e) {
  if (navigator.vibrate) navigator.vibrate(10)
  const el = e.currentTarget || e.target.closest('.rb-btn')
  if (!el) return
  const rect = el.getBoundingClientRect()
  stepper.receita = r
  stepper.qtd = qtdMap.value[r.uuid] || 0
  const pw = 140, ph = 54, safe = 110
  stepper.x = Math.max(10, Math.min(rect.left + rect.width / 2 - pw / 2, window.innerWidth - pw - 10))
  const above = rect.top - ph - 15
  if (above > safe) { stepper.y = above; stepper.dir = 'down' }
  else { stepper.y = rect.bottom + 15; stepper.dir = 'up' }
  stepper.visible = true
  resetStepperTimer()
  document.addEventListener('pointerdown', onDocPointer)
}
function fecharStepper() {
  stepper.visible = false; stepper.receita = null
  clearTimeout(stepper.timer)
  document.removeEventListener('pointerdown', onDocPointer)
  longActive.value = false
}
function onDocPointer(e) {
  if (!e.target.closest('.stepper-pop')) fecharStepper()
}
function stepperAjustar(delta) {
  if (!stepper.receita) return
  if (navigator.vibrate) navigator.vibrate(5)
  if (delta > 0) {
    adicionar(stepper.receita)
  } else {
    const idx = lote.value.findIndex(i => i.receita_id === stepper.receita.uuid)
    if (idx >= 0) ajustar(idx, -passoReceita(stepper.receita))
  }
  stepper.qtd = qtdMap.value[stepper.receita?.uuid] || 0
  if (stepper.qtd === 0) { fecharStepper(); return }
  resetStepperTimer()
}
function resetStepperTimer() {
  clearTimeout(stepper.timer)
  stepper.timer = setTimeout(fecharStepper, 2500)
}
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointer)
  clearTimeout(stepper.timer)
})
</script>

<style scoped>
/* ── Layout full-screen ── */
.view-maximized { position:fixed; inset:0; z-index:calc(var(--z-modal) + 1000); background:var(--bg); display:flex; flex-direction:column; }
.view-header    { height:56px; background:var(--brown-dark); display:flex; align-items:center; padding:0 8px; flex-shrink:0; }
.view-back-btn  { width:48px; height:48px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; color:#fff; font-size:1.15rem; border-radius:50%; }
.view-title     { font-size:1.1rem; font-weight:800; color:#fff; display:flex; align-items:center; gap:10px; }
.view-action-btn{ width:48px; height:48px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; color:rgba(255,255,255,.85); font-size:1rem; }

/* ── Busca ── */
.search-bar { display:flex; align-items:center; gap:8px; padding:10px 16px 8px; background:var(--surface); border-bottom:1px solid var(--border); flex-shrink:0; }
.search-icon { color:var(--muted); font-size:.85rem; }
.search-input { flex:1; border:none; background:transparent; font-size:.95rem; color:var(--brown-dark); outline:none; }
.search-input::placeholder { color:var(--muted); }

/* ── Chips ── */
.chips-bar { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:8px 16px 10px; background:var(--surface); border-bottom:1px solid var(--border); flex-shrink:0; }
.chips-bar::-webkit-scrollbar { display:none; }

/* ── Body ── */
.briefing-body { flex:1; overflow-y:auto; padding:0 16px 40px; }

/* ── Grid de receitas ── */
.receitas-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px,1fr)); gap:8px; padding:14px 0; }
.rb-btn { position:relative; background:#fff; border:1px solid var(--border); border-radius:var(--r-md); padding:12px 8px 10px; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; touch-action:none; user-select:none; -webkit-touch-callout:none; box-shadow:var(--shadow-sm); }
.rb-btn:active { transform:scale(.96); background:var(--gold-bg); }
.rb-btn--ativo  { border-color:var(--gold-dark); background:var(--gold-bg); }
.rb-nome { font-size:.82rem; font-weight:700; color:var(--brown); text-align:center; line-height:1.2; }
.rb-rend { font-size:.68rem; color:var(--gold-dark); font-weight:600; margin-top:2px; }
.rb-badge { position:absolute; top:5px; right:6px; min-width:18px; height:18px; padding:0 4px; border-radius:9px; background:var(--gold-dark); color:#fff; font-size:.6rem; font-weight:800; display:flex; align-items:center; justify-content:center; }

/* ── Section label ── */
.section-label { font-size:.72rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin-bottom:8px; display:flex; align-items:center; gap:6px; }
.section-count { font-size:.7rem; font-weight:600; color:var(--gold-dark); background:var(--gold-bg); padding:2px 7px; border-radius:10px; text-transform:none; letter-spacing:0; }

/* ── Pedido ── */
.pedido-lista { display:flex; flex-direction:column; gap:6px; }
.pedido-item { display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px solid var(--border); border-radius:var(--r-md); padding:10px 12px; gap:8px; }
.pedido-info { flex:1; min-width:0; }
.pedido-nome { display:block; font-size:.88rem; font-weight:700; color:var(--brown); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pedido-sub  { font-size:.72rem; color:var(--muted); }
.qty-ctrl { display:flex; align-items:center; gap:10px; background:var(--bg); border:1px solid var(--border); border-radius:20px; padding:3px; flex-shrink:0; }
.btn-q { width:30px; height:30px; border:none; background:#fff; border-radius:50%; font-size:1.1rem; font-weight:700; color:var(--gold-dark); box-shadow:var(--shadow-sm); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.qty-val { font-family:var(--mono); font-weight:800; font-size:.95rem; min-width:22px; text-align:center; color:var(--brown-dark); }

/* ── Insumos consolidados ── */
.insumos-lista { display:flex; flex-direction:column; gap:6px; }
.insumo-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:11px 14px; border-radius:var(--r-md); border:1px solid var(--border); background:#fff; }
.insumo-row--falta { border-left:3px solid #E24B4A; background:#fff9f9; }
.insumo-row--ok    { border-left:3px solid #639922; }
.insumo-info { flex:1; min-width:0; }
.insumo-nome { font-size:.9rem; font-weight:700; color:var(--brown-dark); display:block; }
.insumo-subs { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
.insumo-sub-chip { font-size:.68rem; color:var(--muted); background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:1px 6px; }
.insumo-direita { text-align:right; flex-shrink:0; }
.insumo-qtd { display:block; font-family:var(--mono); font-size:1rem; font-weight:800; color:var(--brown-dark); }
.insumo-falta { display:block; font-size:.7rem; color:#E24B4A; font-weight:700; margin-top:2px; }
.insumo-ok-label { display:block; font-size:.7rem; color:#639922; font-weight:700; margin-top:2px; }

/* ── Consulta de receita ── */
.receita-consulta-lista { display:flex; flex-direction:column; gap:8px; }
.receita-consulta-card { background:#fff; border:1px solid var(--border); border-radius:var(--r-md); overflow:hidden; }
.rc-hdr { display:flex; align-items:center; gap:8px; padding:11px 14px; cursor:pointer; }
.rc-hdr:active { background:var(--gold-bg); }
.rc-nome { font-size:.88rem; font-weight:700; color:var(--brown); flex:1; }
.rc-qtd  { font-size:.75rem; color:var(--muted); background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:2px 8px; flex-shrink:0; }
.rc-body { padding:0 14px 12px; border-top:1px solid var(--border); background:var(--bg); }
.rc-ing-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid rgba(0,0,0,.05); }
.rc-ing-row:last-child { border-bottom:none; }
.rc-ing-nome { font-size:.82rem; color:var(--brown-mid); font-weight:600; }
.rc-ing-qtd  { font-family:var(--mono); font-size:.82rem; font-weight:700; color:var(--brown); }
.rc-modo { margin-top:10px; padding-top:8px; border-top:1px dashed var(--border); }
.rc-modo-label { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-bottom:4px; }
.rc-modo-texto { font-size:.82rem; color:var(--brown-mid); line-height:1.5; white-space:pre-wrap; }

/* ── Ações ── */
.briefing-actions { display:grid; grid-template-columns:1fr 1.3fr; gap:10px; }

/* ── Empty ── */
.empty-state { display:flex; flex-direction:column; align-items:center; gap:12px; padding:48px 24px; color:var(--muted); text-align:center; }
.empty-state i { font-size:2rem; opacity:.35; }
.empty-state p { font-size:.88rem; line-height:1.5; max-width:260px; }

/* ── Stepper flutuante ── */
.stepper-pop { position:fixed; z-index:9999; display:flex; align-items:center; background:var(--brown-dark); border-radius:28px; box-shadow:0 8px 24px rgba(0,0,0,.25); padding:4px; touch-action:none; }
.stepper-pop::after { content:''; position:absolute; left:50%; transform:translateX(-50%); width:0; height:0; border:8px solid transparent; pointer-events:none; }
.stepper-pop.arrow-down::after { bottom:-15px; border-top-color:var(--brown-dark); }
.stepper-pop.arrow-up::after  { top:-15px; border-bottom-color:var(--brown-dark); }
.sp-btn { width:44px; height:44px; border:none; background:transparent; color:#fff; font-size:1.5rem; font-weight:700; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.sp-btn:active { background:rgba(255,255,255,.15); }
.sp-val { min-width:36px; text-align:center; font-family:var(--mono); font-size:1.1rem; font-weight:800; color:#fff; }
.sp-anim-enter-active, .sp-anim-leave-active { transition:opacity .15s, transform .15s; }
.sp-anim-enter-from, .sp-anim-leave-to { opacity:0; transform:scale(.8); }

.mt-16 { margin-top:16px; }
.mt-20 { margin-top:20px; }
.mb-32 { margin-bottom:32px; }
</style>
