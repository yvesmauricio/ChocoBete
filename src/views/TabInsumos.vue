<template>
  <div class="tab-insumos">
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-boxes"></i> Estoque</h2>
      </div>
      <div class="search-wrap">
        <i class="fas fa-search search-icon"></i>
        <input v-model="busca" class="search-input" type="search" placeholder="Buscar ingrediente ou embalagem..." />
      </div>
      <CategoryFilter v-model="catAtiva" :items="categorias" />
    </div>

    <section class="tab-content">
      <div v-if="s.loading" class="loading-box"><div class="spinner spinner-sm"></div></div>

      <template v-else-if="listaFiltrada.length">
        <AppListRow
          v-for="p in listaFiltrada"
          :key="p.uuid"
          :id="p.uuid"
          @click="abrir(p)"
          :chevron="false"
          :actions-width="210"
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
            <span :class="{'c-red fw700': p.estoque_minimo > 0 && (p.estoque_atual || 0) <= p.estoque_minimo}">
              Estoque: {{ fmtQ(p.estoque_atual, p.unidade_base) }} <span class="ing-min-label">/ Mín: {{ fmtQ(p.estoque_minimo, p.unidade_base) }}</span>
            </span>
          </template>
          <template #actions>
            <button class="swipe-btn edit" @click="abrir(p)"><i class="fas fa-pencil"></i></button>
            <button class="swipe-btn print" @click="abrirHistorico(p)" title="Histórico"><i class="fas fa-chart-line"></i></button>
            <button class="swipe-btn copy" @click="duplicar(p)"><i class="fas fa-copy"></i></button>
            <button class="swipe-btn del" @click="excluir(p)"><i class="fas fa-trash"></i></button>
          </template>
        </AppListRow>
      </template>

      <div v-else class="app-empty">
        <i class="fas fa-box-open"></i>
        <h3>{{ busca ? 'Nenhum resultado' : 'Nenhum item no estoque' }}</h3>
        <p v-if="!busca">Toque no botão + para cadastrar ingredientes ou embalagens.</p>
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
      </div>

      <div class="form-section">
        <div class="form-section-label"><i class="fas fa-warehouse"></i> Gestão de Estoque</div>
        <div class="grid-2">
          <div class="fg">
            <label class="label">Estoque atual</label>
            <input v-model.number="form.estoque_atual" class="input" type="number" step="0.01" min="0" />
          </div>
          <div class="fg">
            <label class="label">Mínimo ideal</label>
            <input v-model.number="form.estoque_minimo" class="input" type="number" step="0.01" min="0" />
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
                <p>Nenhum registro ainda.<br>O histórico é criado quando você altera o preço de compra.</p>
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
                  <span class="lc-hist-preco">{{ R$(h.custo_por_unidade) }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
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

const busca = ref('')
const catAtiva = ref('Todas')
const categorias = ['Todas', 'Ingrediente', 'Embalagem']
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

const form = reactive({ uuid: null, nome: '', tipo: 'insumo', unidade_compra: 'kg', unidade_base: 'g', fator_conversao: 1000, custo_por_unidade: 0, estoque_atual: 0, estoque_minimo: 0 })

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
  modalHistorico.value = item
  loadingHistorico.value = true
  try {
    historicoPrecos.value = await s.historicoPrecoProduto(item.uuid)
  } finally {
    loadingHistorico.value = false
  }
}

function abrir(p = null) {
  if (p) Object.assign(form, JSON.parse(JSON.stringify(p)))
  else Object.assign(form, { uuid: null, nome: '', tipo: 'insumo', unidade_compra: 'kg', unidade_base: 'g', fator_conversao: 1000, custo_por_unidade: 0, estoque_atual: 0, estoque_minimo: 0 })
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
</script>

<style scoped>
.tab-content { padding-top: 12px; }
</style>