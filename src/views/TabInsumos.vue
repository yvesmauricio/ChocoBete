<template>
  <div class="tab-insumos">
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-boxes"></i> Estoque</h2>
        <div class="tab-actions">
          <button
            class="btn-icon filtro-toggle-btn"
            :class="{ active: filtrosAbertos }"
            title="Buscar e filtrar"
            @click="filtrosAbertos = !filtrosAbertos"
          >
            <i class="fas fa-filter"></i>
            <span v-if="filtrosAtivos" class="filtro-toggle-dot"></span>
          </button>
        </div>
      </div>
      <Transition name="slide-down">
      <div v-if="filtrosAbertos">
        <div class="search-wrap">
          <i class="fas fa-search search-icon"></i>
          <input v-model="busca" class="search-input" type="search" placeholder="Buscar ingrediente ou embalagem..." />
        </div>
        <CategoryFilter v-model="catAtiva" :items="categorias" />
      </div>
      </Transition>
    </div>

    <section class="tab-content">
      <div v-if="s.loading" class="loading-box"><div class="spinner spinner-sm"></div></div>

      <template v-else-if="listaFiltrada.length">
        <!-- Cabeçalho de colunas (só aparece no layout de desktop) -->
        <div class="tbl-head tbl-head--insumos" aria-hidden="true">
          <span class="th-main">Ingrediente</span>
          <span class="th-cols"><span>Custo</span><span>Estoque</span><span>Mínimo</span><span>Status</span></span>
        </div>
        <AppListRow
          v-for="p in listaFiltrada"
          :key="p.uuid"
          :id="p.uuid"
          @click="abrir(p)"
          @mousedown="lpStart($event, p)"
          @mouseup="lpCancel"
          @mouseleave="lpCancel"
          @touchstart.passive="lpStart($event, p)"
          @touchend="lpCancel"
          @touchmove.passive="lpCancel"
          :chevron="false"
          :actions-width="350"
        >
          <template #icon>
            <div class="ing-icon" :class="p.tipo === 'embalagem' ? 'badge-orange' : 'badge-muted'">
              <i :class="p.tipo === 'embalagem' ? 'fas fa-box' : 'fas fa-mortar-pestle'"></i>
            </div>
          </template>
          <template #title>{{ p.nome }}</template>
          <template #sub>
            <span class="ing-preco">{{ R$(p.custo_por_unidade || 0) }}</span>
            <span class="ing-dot">•</span>
            <span :class="{'c-red fw700': (p.estoque_atual || 0) <= (p.estoque_minimo || 0)}">
              Estoque: {{ fmtQ(p.estoque_atual, p.unidade_base) }}
            </span>
          </template>
          <!-- Colunas da tabela (desktop). No celular ficam escondidas: lá vale o resumo em #sub. -->
          <template #right>
            <div class="row-cols row-cols--insumos">
              <span class="rc rc-num">{{ R$(p.custo_por_unidade || 0) }}<small>/{{ p.unidade_base }}</small></span>
              <span class="rc rc-num">{{ fmtQ(p.estoque_atual, p.unidade_base) }}</span>
              <span class="rc rc-num rc-muted">{{ fmtQ(p.estoque_minimo || 0, p.unidade_base) }}</span>
              <span class="rc">
                <span v-if="(p.estoque_atual || 0) <= (p.estoque_minimo || 0)" class="badge badge-red"><i class="fas fa-triangle-exclamation"></i> Repor</span>
                <span v-else class="badge badge-green"><i class="fas fa-check"></i> Ok</span>
              </span>
            </div>
          </template>
          <template #actions>
            <button class="swipe-btn edit" @click="abrir(p)">
              <i class="fas fa-pencil"></i>
              <span>Editar</span>
            </button>
            <button class="swipe-btn print" @click="abrirHistorico(p)">
              <i class="fas fa-chart-line"></i>
              <span>Histórico</span>
            </button>
            <button class="swipe-btn festa" @click="abrirSimulador(p)">
              <i class="fas fa-calculator"></i>
              <span>Simular</span>
            </button>
            <button class="swipe-btn copy" @click="duplicar(p)">
              <i class="fas fa-copy"></i>
              <span>Copiar</span>
            </button>
            <button class="swipe-btn del" @click="excluir(p)">
              <i class="fas fa-trash"></i>
              <span>Excluir</span>
            </button>
          </template>
        </AppListRow>
      </template>

      <div v-else class="empty">
        <i class="fas fa-box-open"></i>
        <h3>{{ busca ? 'Nenhum resultado' : 'Nenhum item no estoque' }}</h3>
        <button v-if="!busca" class="btn btn-primary mt-12" @click="abrir(null)">
          <i class="fas fa-plus"></i> Novo Ingrediente
        </button>
      </div>
    </section>

    <!-- Modal Detalhe/Edição -->
    <BaseModal v-if="modal === 'detalhe'" :title="form.uuid ? 'Editar Item' : 'Novo Item'" @close="fecharModal">
      <div class="form-section">
        <div class="form-section-label"><i class="fas fa-tag"></i> Identificação</div>
        <div class="fg">
          <label class="label label-req">Nome</label>
          <input v-model="form.nome" class="input" placeholder="Ex: Chocolate Meio Amargo" />
        </div>
        <div class="fg">
          <label class="label">Tipo</label>
          <div class="option-grid option-grid-2">
            <button type="button" class="option-card" :class="{ active: form.tipo === 'insumo' }" @click="form.tipo = 'insumo'">
              <i class="fas fa-mortar-pestle option-ico"></i>
              <span class="option-label">Ingrediente</span>
            </button>
            <button type="button" class="option-card" :class="{ active: form.tipo === 'embalagem' }" @click="form.tipo = 'embalagem'">
              <i class="fas fa-box option-ico"></i>
              <span class="option-label">Embalagem</span>
            </button>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-label"><i class="fas fa-balance-scale"></i> Unidades & Custos</div>
        <div class="fg">
          <label class="label">Preço de compra</label>
          <div class="input-with-prefix">
            <span class="input-prefix">R$</span>
            <input :value="maskMoney(form.custo_por_unidade)" @input="e => form.custo_por_unidade = parseMoney(e.target.value)" inputmode="numeric" class="input input-prefixed" />
          </div>
        </div>
        <div class="grid-2">
          <div class="fg">
            <label class="label">Qtd na embalagem</label>
            <input v-model.number="form.fator_conversao" class="input" type="number" step="0.001" />
          </div>
          <div class="fg">
            <label class="label">Unidade base</label>
            <select v-model="form.unidade_base" class="input">
              <option value="g">gramas (g)</option>
              <option value="ml">mililitros (ml)</option>
              <option value="un">unidade (un)</option>
              <option value="kg">quilos (kg)</option>
            </select>
          </div>
        </div>
        <div class="custo-card" v-if="form.custo_por_unidade > 0">
          <i class="fas fa-calculator custo-ico"></i>
          <span>Custo calculado: <strong>{{ R$(s.getPrecoUnitarioInsumo(form)) }}</strong> por {{ form.unidade_base }}</span>
        </div>

        <button type="button" class="valor-toggle" :class="{ active: form.compra_por_valor }" @click="form.compra_por_valor = !form.compra_por_valor">
          <div class="valor-toggle-ico"><i class="fas fa-money-bill-wave"></i></div>
          <div class="valor-toggle-txt">
            <strong>Eu peço por valor</strong>
            <span>Ex.: "R$ 30 de {{ form.nome || 'Amendoim' }}", não por peso</span>
          </div>
          <span class="switch"><span class="switch-knob"></span></span>
        </button>
        <div v-if="form.compra_por_valor" class="custo-card valor-hint">
          <i class="fas fa-circle-info custo-ico"></i>
          <span>Na lista de compras, esse item aparece como <strong>"peça ~R$ X"</strong> em vez de gramas — calculado pelo preço cadastrado acima.</span>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-label"><i class="fas fa-warehouse"></i> Gestão de Estoque</div>
        <div class="grid-2">
          <div class="fg">
            <label class="label">Estoque atual</label>
            <input v-model.number="form.estoque_atual" class="input" type="number" step="0.01" />
          </div>
          <div class="fg">
            <label class="label">Mínimo ideal</label>
            <input v-model.number="form.estoque_minimo" class="input" type="number" step="0.01" />
          </div>
        </div>
        <p class="hint mt-8">O estoque é baixado automaticamente ao finalizar produções na Cozinha.</p>
      </div>

      <template #foot>
        <button v-if="form.uuid" class="btn btn-danger btn-icon-only" @click="excluir(form)"><i class="fas fa-trash"></i></button>
        <div class="spacer"></div>
        <button class="btn btn-secondary" @click="fecharModal">Cancelar</button>
        <button class="btn btn-primary" :disabled="!form.nome" @click="salvar">Salvar</button>
      </template>
    </BaseModal>

    <!-- ─── Modal Histórico de Preços ──────────────────────────── -->
    <Teleport to="body">
      <div v-if="modalHistorico" class="bottom-sheet-overlay" @click.self="modalHistorico = null">
        <div class="lc-modal">
          <div class="lc-modal-hdr">
            <span class="lc-modal-titulo"><i class="fas fa-chart-line"></i> {{ modalHistorico.nome }}</span>
            <button class="lc-modal-close" @click="modalHistorico = null"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="lc-modal-body">
            <div v-if="loadingHistorico" class="loading-box"><div class="spinner spinner-sm"></div></div>
            <template v-else-if="historicoPrecos.length === 0">
              <div class="lc-hist-empty">
                <i class="fas fa-clock-rotate-left"></i>
                <p>Nenhum registro ainda.<br>O histórico é criado a cada compra (entrada de estoque) ou alteração de preço.</p>
              </div>
            </template>
            <template v-else>
              <div class="lc-hist-resumo">
                <div class="lc-hist-kpi">
                  <span class="lc-hist-kpi-lbl">Atual</span>
                  <span class="lc-hist-kpi-val">{{ R$(historicoPrecos[historicoPrecos.length-1].custo_por_unidade) }}</span>
                </div>
                <div class="lc-hist-kpi" v-if="historicoPrecos.length > 1">
                  <span class="lc-hist-kpi-lbl">Variação</span>
                  <span class="lc-hist-kpi-val" :class="variacaoPreco >= 0 ? 'c-red' : 'c-green'">
                    {{ variacaoPreco >= 0 ? '+' : '' }}{{ variacaoPreco.toFixed(1) }}%
                  </span>
                </div>
              </div>
              <div class="lc-hist-chart-wrap">
                <svg class="lc-hist-svg" viewBox="0 0 300 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="barGradIns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="var(--brown)" stop-opacity="0.9"/>
                      <stop offset="100%" stop-color="var(--brown)" stop-opacity="0.3"/>
                    </linearGradient>
                  </defs>
                  <template v-for="(h, idx) in historicoPrecos" :key="idx">
                    <rect
                      :x="idx * (300 / historicoPrecos.length) + 3"
                      :y="90 - (h.custo_por_unidade / maxPrecoHist * 75)"
                      :width="(300 / historicoPrecos.length) - 6"
                      :height="(h.custo_por_unidade / maxPrecoHist * 75)"
                      rx="3" fill="url(#barGradIns)"
                    />
                  </template>
                </svg>
              </div>
              <div class="lc-hist-tabela">
                <div v-for="(h, idx) in [...historicoPrecos].reverse()" :key="idx" class="lc-hist-row">
                  <span class="lc-hist-data">{{ new Date(h.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) }}</span>
                  <span class="lc-hist-qtd" v-if="h.quantidade_comprada">+{{ fmtQ(h.quantidade_comprada, modalHistorico?.unidade_base) }}</span>
                  <span class="lc-hist-preco">{{ R$(h.custo_por_unidade) }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ─── Modal "Quanto dá pra fazer?" ───────────────────────── -->
    <Teleport to="body">
      <div v-if="modalSimulador" class="bottom-sheet-overlay" @click.self="fecharSimulador">
        <div class="lc-modal">
          <div class="lc-modal-hdr">
            <span class="lc-modal-titulo"><i class="fas fa-calculator"></i> Quanto dá pra fazer?</span>
            <button class="lc-modal-close" @click="fecharSimulador"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="lc-modal-body">
            <div class="fg">
              <label class="label">Quanto de {{ modalSimulador.nome }} eu tenho?</label>
              <div class="input-with-suffix">
                <input v-model.number="simQtd" class="input" type="number" inputmode="decimal" min="0" step="any" />
                <span class="input-suffix">{{ modalSimulador.unidade_base }}</span>
              </div>
            </div>

            <div class="fg mt-14">
              <label class="label">Com qual receita?</label>
              <div class="search-wrap">
                <i class="fas fa-search search-icon"></i>
                <input v-model="simBusca" class="search-input" type="search" placeholder="Buscar receita..." />
              </div>
            </div>

            <div class="picker-list mt-10 sim-picker-list">
              <div
                v-for="item in simReceitasFiltradas"
                :key="item.receita.uuid"
                class="picker-row"
                :class="{ active: simReceitaSelecionada?.uuid === item.receita.uuid }"
                @click="simReceitaSelecionada = item.receita"
              >
                <i class="fas fa-mortar-pestle picker-tipo-badge"></i>
                <div class="picker-row-info">
                  <div class="picker-row-nome">{{ item.receita.nome }}</div>
                  <div class="picker-row-sub">
                    {{ item.uso > 0 ? `Usa ${fmtQ(item.uso, modalSimulador.unidade_base)} de ${modalSimulador.nome} por un.` : `Não usa ${modalSimulador.nome}` }}
                  </div>
                </div>
                <i v-if="simReceitaSelecionada?.uuid === item.receita.uuid" class="fas fa-check-circle c-gold"></i>
              </div>
              <div v-if="!simReceitasFiltradas.length" class="picker-vazio">Nenhuma receita encontrada</div>
            </div>

            <!-- Escopo: só faz sentido perguntar se a receita tem algum ingrediente marcado como Casca -->
            <div v-if="simReceitaSelecionada && simPapelDisponivel" class="fg mt-14">
              <label class="label">Contar {{ modalSimulador.nome }} só na...</label>
              <div class="option-grid sim-escopo-grid">
                <button type="button" class="option-card" :class="{ active: simPapel === 'casca' }" @click="simPapel = 'casca'">
                  <i class="fas fa-cookie option-ico"></i>
                  <span class="option-label">Casca</span>
                </button>
                <button type="button" class="option-card" :class="{ active: simPapel === 'recheio' }" @click="simPapel = 'recheio'">
                  <i class="fas fa-heart option-ico"></i>
                  <span class="option-label">Recheio</span>
                </button>
                <button type="button" class="option-card" :class="{ active: simPapel === 'inteira' }" @click="simPapel = 'inteira'">
                  <i class="fas fa-layer-group option-ico"></i>
                  <span class="option-label">Receita toda</span>
                </button>
              </div>
            </div>

            <!-- Resultado -->
            <div v-if="simReceitaSelecionada" class="sim-resultado">
              <template v-if="simUsoPorUnidade > 0">
                <div class="sim-resultado-num">{{ simUnidadesPossiveis }}</div>
                <div class="sim-resultado-label">
                  {{ simPapel === 'casca' ? 'casca(s)/cobertura(s)' : simPapel === 'recheio' ? 'recheio(s)' : (simUnidadesPossiveis === 1 ? 'unidade' : 'unidades') }} de {{ simReceitaSelecionada.nome }}
                </div>
                <div class="sim-resultado-sobra" v-if="simSobra > 0">
                  Sobra {{ fmtQ(simSobra, modalSimulador.unidade_base) }} de {{ modalSimulador.nome }}
                </div>

                <!-- Complemento: pra rechear (ou pra cobrir, se o escopo foi recheio) essas unidades -->
                <div v-if="simNecessidadesComplementares.length" class="sim-complemento">
                  <div class="sim-complemento-titulo">
                    Pra {{ simPapel === 'casca' ? 'rechear' : 'cobrir' }} essas {{ simUnidadesPossiveis }}, vai precisar de:
                  </div>
                  <div v-for="item in simNecessidadesComplementares" :key="item.id" class="sim-complemento-item">
                    <span>{{ item.nome }}</span>
                    <span class="fw700">{{ fmtQ(item.total, item.unidade) }}</span>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="sim-resultado-vazio">
                  <i class="fas fa-circle-info"></i>
                  {{ simReceitaSelecionada.nome }} não usa {{ modalSimulador.nome }}{{ simPapel !== 'inteira' ? ` n${simPapel === 'casca' ? 'a casca' : 'o recheio'}` : ' (nem em bases/recheios)' }} — não dá pra calcular.
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <ModalCompra
      :modal-preco="modalPreco"
      :fechar-modal-preco="fecharModalPreco"
      :on-preco-emb-input="onPrecoEmbInput"
      :on-frac-valor-input="onFracValorInput"
      :bloquear-letras="bloquearLetras"
      :calc-fracionado="calcFracionado"
      :confirmar-preco-emb="confirmarPrecoEmb"
      :confirmar-preco-frac="confirmarPrecoFrac"
      v-model:modo-preco="modoPreco"
      v-model:preco-emb-input="precoEmbInput"
      v-model:preco-emb-calculado="precoEmbCalculado"
      v-model:frac-valor="fracValor"
      v-model:frac-qtd="fracQtd"
      v-model:frac-resultado="fracResultado"
      v-model:qtd-entrada-input="qtdEntradaInput"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, inject, watch } from 'vue'
import { useStore } from '../store.js'
import { R$, normalizar, maskMoney, parseMoney, fmtQtd as fmtQ } from '../utils.js'
import BaseModal from '../components/BaseModal.vue'
import AppListRow from '../components/AppListRow.vue'
import CategoryFilter from '../components/CategoryFilter.vue'
import { useModalStack } from '../composables/useModalStack.js'
import { useConfirm } from '../composables/useConfirm.js'
import ModalCompra from '../components/ModalCompra.vue'
import { useModalCompra } from '../composables/useModalCompra.js'

const s = useStore()

// ── FAB ─────────────────────────────────────────────────────
const registerFab   = inject('registerFab', null)
const unregisterFab = inject('unregisterFab', null)
const _fabConfig = { icon: 'fas fa-plus', label: 'Novo Insumo', action: () => abrir(null) }
onMounted(() => { if (s.tab === 'insumos') registerFab?.(_fabConfig, 'insumos') })
watch(() => s.tab, (tab) => {
  if (tab === 'insumos') registerFab?.(_fabConfig, 'insumos')
  else unregisterFab?.('insumos')
})
const { modal, abrirModal, fecharModal } = useModalStack()
const confirm = useConfirm()
const {
  modalPreco,
  modoPreco,
  precoEmbInput,
  precoEmbCalculado,
  fracValor,
  fracQtd,
  fracResultado,
  qtdEntradaInput,
  abrirModalPreco,
  fecharModalPreco,
  onPrecoEmbInput,
  onFracValorInput,
  bloquearLetras,
  calcFracionado,
  confirmarPrecoEmb,
  confirmarPrecoFrac,
} = useModalCompra()

const busca = ref('')
const catAtiva = ref('Todas')
const categorias = ['Todas', 'Ingrediente', 'Embalagem']

// ── Cabeçalho colapsável: busca/categoria ocultos por padrão ──
const filtrosAbertos = ref(false)
const filtrosAtivos = computed(() => !!busca.value.trim() || catAtiva.value !== 'Todas')
watch(filtrosAtivos, ativo => { if (ativo) filtrosAbertos.value = true }, { immediate: true })
const tipoInsumoMap = { 'Ingrediente': 'insumo', 'Embalagem': 'embalagem' }

const listaFiltrada = computed(() => {
  const q = normalizar(busca.value)
  const tipoAlvo = tipoInsumoMap[catAtiva.value]
  return s.produtos.filter(p => {
    const matchBusca = !q || normalizar(p.nome).includes(q)
    const matchCat = catAtiva.value === 'Todas' || p.tipo === tipoAlvo
    return matchBusca && matchCat
  }).sort((a,b) => a.nome.localeCompare(b.nome))
})

const form = reactive({ uuid: null, nome: '', tipo: 'insumo', unidade_compra: 'kg', unidade_base: 'g', fator_conversao: 1000, custo_por_unidade: 0, estoque_atual: 0, estoque_minimo: 0, compra_por_valor: false })

let _lpTimer = null
let _lpOpened = false
function lpStart(e, produto) {
  lpCancel()
  _lpOpened = false
  _lpTimer = setTimeout(() => {
    _lpTimer = null
    _lpOpened = true
    // Fecha histórico/edição/simulador antes de abrir a entrada, para nunca
    // termos dois modais sobrepostos (mesmo z-index) ao mesmo tempo.
    modalHistorico.value = null
    modalSimulador.value = null
    if (modal.value === 'detalhe') fecharModal()
    abrirModalPreco(produto)
  }, 500)
}
function lpCancel() {
  if (_lpTimer) {
    clearTimeout(_lpTimer)
    _lpTimer = null
  }
  if (_lpOpened) {
    setTimeout(() => { _lpOpened = false }, 250)
  }
}

// ── Histórico de Preços ──
const modalHistorico = ref(null)
const historicoPrecos = ref([])
const loadingHistorico = ref(false)
const maxPrecoHist = computed(() => Math.max(...historicoPrecos.value.map(h => h.custo_por_unidade), 0.01))
const variacaoPreco = computed(() => {
  if (historicoPrecos.value.length < 2) return 0
  const p = historicoPrecos.value[0].custo_por_unidade
  const u = historicoPrecos.value[historicoPrecos.value.length - 1].custo_por_unidade
  return ((u - p) / p) * 100
})

async function abrirHistorico(item) {
  // Garante que nenhum outro modal (entrada/edição/simulador) fique aberto
  // por baixo, senão ele acaba renderizado por cima do histórico (mesmo z-index).
  lpCancel()
  fecharModalPreco()
  if (modal.value === 'detalhe') fecharModal()
  modalSimulador.value = null

  modalHistorico.value = item
  loadingHistorico.value = true
  try {
    historicoPrecos.value = await s.historicoPrecoProduto(item.uuid)
  } finally {
    loadingHistorico.value = false
  }
}

function abrir(p = null) {
  if (_lpOpened) return
  modalHistorico.value = null
  modalSimulador.value = null
  fecharModalPreco()
  if (p) Object.assign(form, JSON.parse(JSON.stringify(p)))
  else Object.assign(form, { uuid: null, nome: '', tipo: 'insumo', unidade_compra: 'kg', unidade_base: 'g', fator_conversao: 1000, custo_por_unidade: 0, estoque_atual: 0, estoque_minimo: 0, compra_por_valor: false })
  abrirModal('detalhe')
}

async function salvar() {
  await s.salvarProduto({ ...form })
  fecharModal()
}

async function excluir(p) {
  const ok = await confirm.ask(`Excluir permanentemente ${p.nome}?`, { type: 'danger' })
  if (ok) {
    await s.excluirProduto(p.uuid)
    fecharModal()
  }
}

function duplicar(p) {
  const clone = JSON.parse(JSON.stringify(p))
  clone.uuid = null
  clone.nome += ' (Cópia)'
  abrir(clone)
}

// ── Simulador "Quanto dá pra fazer?" ──────────────────────────────
// Dado um insumo e uma quantidade dele (por padrão, o estoque atual,
// mas editável — pode ser uma quantidade hipotética), calcula quantas
// unidades de uma receita escolhida dá pra produzir. Usa expandirIngredientes
// (já existente na store) pra resolver o consumo mesmo quando o insumo
// está "escondido" dentro de uma base/recheio (sub-receita), não só
// quando ele é ingrediente direto da receita final.
const modalSimulador = ref(null)      // produto (insumo) sendo simulado
const simQtd = ref(0)
const simBusca = ref('')
const simReceitaSelecionada = ref(null)
const simPapel = ref('inteira')       // 'casca' | 'recheio' | 'inteira'

// Convenção já usada no resto do app (ver TabReceitas.vue): "casca" é só
// o que está explicitamente marcado como tal; "recheio" é tudo o mais
// (inclusive ingredientes sem papel definido).
function ingredientesDoEscopo(receita, escopo) {
  const ings = receita?.ingredientes || []
  if (escopo === 'casca')   return ings.filter(i => i.papel === 'casca')
  if (escopo === 'recheio') return ings.filter(i => i.papel !== 'casca')
  return ings // 'inteira'
}

function usoInsumoPorUnidade(receita, insumoUuid, escopo = 'inteira') {
  if (!receita || !Number(receita.rendimento)) return 0
  const subset = ingredientesDoEscopo(receita, escopo)
  if (!subset.length) return 0
  const mapa = s.expandirIngredientes(subset, 1 / receita.rendimento)
  return mapa[insumoUuid]?.total || 0
}

// Só oferece o seletor de escopo se a receita realmente diferencia
// casca de recheio (algum ingrediente marcado com papel === 'casca').
const simPapelDisponivel = computed(() =>
  (simReceitaSelecionada.value?.ingredientes || []).some(i => i.papel === 'casca')
)

// Ao trocar de receita, escolhe um escopo padrão sensato: se a receita
// distingue casca/recheio, parte para "casca" (é o caso mais comum —
// cobertura de chocolate); senão, considera a receita inteira.
watch(simReceitaSelecionada, (r) => {
  if (!r) return
  simPapel.value = (r.ingredientes || []).some(i => i.papel === 'casca') ? 'casca' : 'inteira'
})

const simReceitasFiltradas = computed(() => {
  if (!modalSimulador.value) return []
  const insumoUuid = modalSimulador.value.uuid
  const q = normalizar(simBusca.value)
  return s.receitas
    .filter(r => Number(r.rendimento) > 0 && (!q || normalizar(r.nome).includes(q)))
    .map(r => ({ receita: r, uso: usoInsumoPorUnidade(r, insumoUuid, 'inteira') }))
    .sort((a, b) => {
      // receitas que realmente usam o insumo aparecem primeiro
      if ((b.uso > 0) !== (a.uso > 0)) return (b.uso > 0) ? 1 : -1
      return a.receita.nome.localeCompare(b.receita.nome)
    })
})

const simUsoPorUnidade = computed(() =>
  simReceitaSelecionada.value && modalSimulador.value
    ? usoInsumoPorUnidade(simReceitaSelecionada.value, modalSimulador.value.uuid, simPapel.value)
    : 0
)
const simUnidadesPossiveis = computed(() => {
  if (simUsoPorUnidade.value <= 0) return 0
  return Math.floor((Number(simQtd.value) || 0) / simUsoPorUnidade.value)
})
const simSobra = computed(() => {
  if (simUsoPorUnidade.value <= 0) return 0
  return Math.max(0, (Number(simQtd.value) || 0) - simUnidadesPossiveis.value * simUsoPorUnidade.value)
})

// Se o cálculo principal foi restrito a "casca" ou "recheio", mostra o que
// vai ser necessário do OUTRO lado (recheio ou casca) pra completar as
// unidades que vão dar pra fazer.
const simNecessidadesComplementares = computed(() => {
  const r = simReceitaSelecionada.value
  const unidades = simUnidadesPossiveis.value
  if (!r || !unidades) return []
  const escopoComplementar = simPapel.value === 'casca' ? 'recheio' : simPapel.value === 'recheio' ? 'casca' : null
  if (!escopoComplementar) return []
  const subset = ingredientesDoEscopo(r, escopoComplementar)
  if (!subset.length) return []
  const mapaPorUnidade = s.expandirIngredientes(subset, 1 / r.rendimento)
  return Object.values(mapaPorUnidade)
    .map(item => ({ ...item, total: item.total * unidades }))
    .sort((a, b) => b.total - a.total)
})

function abrirSimulador(p) {
  lpCancel()
  fecharModalPreco()
  if (modal.value === 'detalhe') fecharModal()
  modalHistorico.value = null
  modalSimulador.value = p
  simQtd.value = p.estoque_atual || 0
  simBusca.value = ''
  simReceitaSelecionada.value = null
  simPapel.value = 'inteira'
}
function fecharSimulador() {
  modalSimulador.value = null
  simReceitaSelecionada.value = null
}
</script>

<style scoped>
.tab-content { padding-top: 12px; }

.input-with-suffix { display:flex; align-items:stretch; border:1.5px solid var(--border); border-radius:var(--r-sm); overflow:hidden; transition:border-color var(--t); }
.input-with-suffix:focus-within { border-color:var(--brown-mid); box-shadow:0 0 0 3px rgba(122,69,32,.12); }
.input-with-suffix .input { border:none; box-shadow:none; flex:1; min-width:0; }
.input-suffix { display:flex; align-items:center; padding:0 11px; background:var(--cream-deep); color:var(--muted); font-size:.82rem; font-weight:700; border-left:1.5px solid var(--border); white-space:nowrap; flex-shrink:0; }

.sim-picker-list { max-height: 240px; overflow-y: auto; }
.picker-row.active { border-color: var(--gold-dark); background: var(--gold-bg); }

.sim-escopo-grid { grid-template-columns: repeat(3, 1fr); }
.sim-escopo-grid .option-card { flex-direction: column; gap: 4px; padding: 10px 6px; min-height: unset; }
.sim-escopo-grid .option-label { font-size: .72rem; text-align: center; }

.sim-resultado { margin-top: 18px; padding: 16px; border-radius: var(--r-md); background: var(--cream-deep); text-align: center; }
.sim-resultado-num { font-size: 2.2rem; font-weight: 800; color: var(--brown); line-height: 1; }
.sim-resultado-label { font-size: .85rem; color: var(--brown-mid); font-weight: 600; margin-top: 4px; }
.sim-resultado-sobra { font-size: .78rem; color: var(--muted); margin-top: 8px; }
.sim-resultado-vazio { font-size: .85rem; color: var(--muted); display: flex; align-items: center; gap: 8px; justify-content: center; padding: 8px 0; }

.sim-complemento { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border); text-align: left; }
.sim-complemento-titulo { font-size: .78rem; font-weight: 700; color: var(--brown-mid); margin-bottom: 6px; }
.sim-complemento-item { display: flex; justify-content: space-between; font-size: .85rem; color: var(--text); padding: 4px 0; }

.cp-check { display: flex; align-items: center; gap: 9px; margin-top: 9px; color: var(--text); font-size: .84rem; font-weight: 600; }
.cp-check input { width: 16px; height: 16px; accent-color: var(--brown); flex-shrink: 0; }

/* ── Toggle "compra por valor" ── */
.valor-toggle {
  width: 100%; display: flex; align-items: center; gap: 12px;
  margin-top: 10px; padding: 12px 13px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-sm);
  cursor: pointer; text-align: left; transition: border-color .15s, background .15s;
}
.valor-toggle.active { border-color: #e8d5a0; background: var(--gold-bg); }
.valor-toggle-ico {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg); color: var(--muted); font-size: .85rem;
  transition: background .15s, color .15s;
}
.valor-toggle.active .valor-toggle-ico { background: var(--brown-dark); color: #fff; }
.valor-toggle-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.valor-toggle-txt strong { font-size: .83rem; color: var(--text); }
.valor-toggle.active .valor-toggle-txt strong { color: var(--brown-dark); }
.valor-toggle-txt span { font-size: .74rem; color: var(--muted); line-height: 1.3; }
.switch {
  width: 38px; height: 22px; border-radius: 20px; flex-shrink: 0;
  background: var(--border2); position: relative; transition: background .15s;
}
.valor-toggle.active .switch { background: var(--brown-dark); }
.switch-knob {
  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: left .15s;
}
.valor-toggle.active .switch-knob { left: 18px; }
.valor-hint { margin-top: 8px; align-items: flex-start; }
.valor-hint strong { color: var(--brown-dark); }
</style>
