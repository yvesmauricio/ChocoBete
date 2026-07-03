<template>
  <div>
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-industry"></i> Produção</h2>
        <div class="tab-actions">
          <button class="btn-icon" @click="gerarRelatorio" title="Gerar Relatório de Produção"><i class="fas fa-file-pdf"></i></button>
          <button class="btn btn-primary btn-sm" @click="s.setTab('cozinha')"><i class="fas fa-plus"></i> Produzir</button>
        </div>
      </div>
      <div class="search-wrap">
        <i class="fas fa-search search-icon"></i>
        <input v-model="busca" class="search-input" type="search" placeholder="Buscar por receita, categoria ou data..." />
      </div>
      <div class="cat-filter-wrap">
        <div class="cal-header mes-nav-producao">
          <button class="cal-nav" :disabled="!podeVoltarMes" @click="mesAnterior"><i class="fas fa-chevron-left"></i></button>
          <span class="cal-titulo mes-nav-producao-titulo">{{ labelMesAtivo }}</span>
          <button class="cal-nav" :disabled="!podeAvancarMes" @click="mesProximo"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>
    </div>

    <div v-if="s.loading" class="loading-box">
      <div class="spinner spinner-sm"></div>
    </div>

    <template v-else-if="gruposProducao.length">
      <div class="production-groups">
        <div v-for="grupo in gruposProducao" :key="grupo.id" class="production-card"
          :class="{ 'card-agendado': grupo.agendado, 'card-locked': s.loteOriginalEmEdicao === grupo.id }">

          <!-- Cabeçalho do lote -->
          <SwipeRow v-if="s.loteOriginalEmEdicao !== grupo.id" :row-id="'lote-' + grupo.id" :width="210" class="lote-swipe">
            <div class="lote-hdr-row">
              <div class="lote-hdr" @click="toggleGrupo(grupo.id)">
                <div class="lote-dot"
                  :class="s.timer.activeLoteId === grupo.id ? 'dot-running' : grupo.duracaoMinutos > 0 ? 'dot-done' : grupo.agendado ? 'dot-scheduled' : 'dot-pending'">
                </div>
                <div class="lote-info">
                  <div class="lote-titulo">{{ dataHoraBR(grupo.data) }}</div>
                  <div class="lote-meta">
                    <!-- Status / tempo -->
                    <span v-if="s.timer.activeLoteId === grupo.id" class="lbadge lbadge-running">
                      <i class="fas fa-spinner fa-spin"></i> Produzindo...
                    </span>
                    <span v-else-if="grupo.duracaoMinutos > 0" class="lbadge lbadge-done">
                      <i class="fas fa-clock"></i> {{ fmtTime(grupo.duracaoMinutos) }}
                    </span>
                    <span v-else-if="grupo.agendado" class="lbadge lbadge-scheduled">
                      <i class="fas fa-calendar-check"></i> Agendado
                    </span>
                    <span v-else-if="tempoEstimadoGrupo[grupo.id] > 0" class="lbadge lbadge-est">
                      <i class="fas fa-hourglass-half"></i> ~{{ fmtTime(tempoEstimadoGrupo[grupo.id]) }}
                    </span>
                    <span class="lbadge-sep" v-if="grupo.itens.length">·</span>
                    <span class="lbadge-info">{{ grupo.itens.length }} {{ grupo.itens.length === 1 ? 'item' : 'itens' }}</span>
                  </div>
                </div>
              </div>

              <!-- Ações fixas: timer precisa de acesso imediato, não fica no swipe -->
              <div class="lote-acts" @click.stop>
                <!-- Timer -->
                <template v-if="!grupo.duracaoMinutos || s.timer.activeLoteId === grupo.id">
                  <button v-if="s.timer.activeLoteId === grupo.id && s.timer.isRunning"
                    class="lote-act-btn act-pause" @click="s.pauseTimer" title="Pausar">
                    <i class="fas fa-pause"></i>
                  </button>
                  <button v-else-if="s.timer.activeLoteId === grupo.id && !s.timer.isRunning"
                    class="lote-act-btn act-play" @click="s.startTimer(grupo.id)" title="Retomar">
                    <i class="fas fa-play"></i>
                  </button>
                  <button v-else
                    class="lote-act-btn act-play" @click="s.startTimer(grupo.id)" title="Iniciar timer">
                    <i class="fas fa-play"></i>
                  </button>
                  <button v-if="s.timer.activeLoteId === grupo.id"
                    class="lote-act-btn act-stop" @click="confirmStopTimer" title="Parar timer">
                    <i class="fas fa-stop"></i>
                  </button>
                </template>
                <!-- Retomar na Cozinha -->
                <button class="lote-act-btn act-retomar" @click="handleRetomar(grupo)" title="Editar na Cozinha">
                  <i class="fas fa-utensils"></i>
                </button>
                <!-- Expandir/recolher -->
                <button class="lote-act-btn lote-toggle" @click="toggleGrupo(grupo.id)" title="Ver itens">
                  <i class="fas fa-chevron-down" :class="{ open: isGrupoAberto(grupo.id) }"></i>
                </button>
              </div>
            </div>

            <template #actions>
              <button class="swipe-btn edit" @click="abrirModalEdicaoLote(grupo)">
                <i class="fas fa-calendar-alt"></i>
                <span>Data</span>
              </button>
              <button class="swipe-btn print" @click="irParaEtiquetas(agruparPorSabor(grupo.itens || []))">
                <i class="fas fa-tags"></i>
                <span>Etiquetas</span>
              </button>
              <button class="swipe-btn share" @click="compartilharLote(grupo)">
                <i class="fas fa-share-nodes"></i>
                <span>Enviar</span>
              </button>
            </template>
          </SwipeRow>

          <!-- Lote travado (em edição na Cozinha): sem swipe, só status + retomar -->
          <div v-else class="lote-hdr-row">
            <div class="lote-hdr" @click="toggleGrupo(grupo.id)">
              <div class="lote-dot" :class="s.timer.activeLoteId === grupo.id ? 'dot-running' : grupo.duracaoMinutos > 0 ? 'dot-done' : grupo.agendado ? 'dot-scheduled' : 'dot-pending'"></div>
              <div class="lote-info">
                <div class="lote-titulo">{{ dataHoraBR(grupo.data) }}</div>
                <div class="lote-meta">
                  <span class="lbadge lbadge-scheduled"><i class="fas fa-pencil"></i> Editando na Cozinha...</span>
                  <span class="lbadge-sep" v-if="grupo.itens.length">·</span>
                  <span class="lbadge-info">{{ grupo.itens.length }} {{ grupo.itens.length === 1 ? 'item' : 'itens' }}</span>
                </div>
              </div>
            </div>
            <div class="lote-acts" @click.stop>
              <button class="lote-act-btn act-retomar" @click="continuarEdicao" title="Continuar editando na Cozinha">
                <i class="fas fa-utensils"></i>
              </button>
              <button class="lote-act-btn act-cancelar" @click="cancelarEdicao" title="Cancelar edição">
                <i class="fas fa-xmark"></i>
              </button>
            </div>
          </div>

          <!-- Itens do lote -->
          <div v-if="isGrupoAberto(grupo.id)" class="lote-body">
            <template v-if="s.loteOriginalEmEdicao !== grupo.id">
              <SwipeRow v-for="p in grupo.itens" :key="p.uuid || p.id" :row-id="'item-' + (p.uuid || p.id)" :width="210" class="item-swipe">
                <div class="item-linha">
                  <div class="item-icon" :class="p.eh_intermediaria ? 'ic-blue' : 'ic-gold'">
                    <i :class="p.eh_intermediaria ? 'fas fa-blender' : 'fas fa-cookie-bite'"></i>
                  </div>
                  <div class="item-info">
                    <span class="item-nome">{{ limpar(p.nome_receita || p.receita_nome) }}</span>
                  </div>
                  <div class="item-qtd" v-if="!itemEditando || itemEditando !== (p.uuid || p.id)">
                    {{ p.quantidade_produzida || p.quantidade }} <small>{{ p.unidade_rendimento || 'un' }}</small>
                  </div>
                  <!-- Edição inline de quantidade -->
                  <div v-else class="item-edit-inline" @click.stop>
                    <input type="number" class="item-qty-input" v-model.number="editQtd"
                      inputmode="decimal" @keyup.enter="salvarEdicaoItem(p)" @blur="cancelarEdicaoItem" />
                    <button class="item-edit-ok" @mousedown.prevent="salvarEdicaoItem(p)">
                      <i class="fas fa-check"></i>
                    </button>
                  </div>
                </div>
                <template #actions>
                  <button class="swipe-btn edit" @click="iniciarEdicaoItem(p)">
                    <i class="fas fa-pencil"></i>
                    <span>Editar</span>
                  </button>
                  <button class="swipe-btn print" @click="imprimirEtiqueta(p)">
                    <i class="fas fa-tag"></i>
                    <span>Etiqueta</span>
                  </button>
                  <button class="swipe-btn del" @click="estornar(p)">
                    <i class="fas fa-trash"></i>
                    <span>Excluir</span>
                  </button>
                </template>
              </SwipeRow>
            </template>
            <template v-else>
              <div v-for="p in grupo.itens" :key="p.uuid || p.id" class="item-linha">
                <div class="item-icon" :class="p.eh_intermediaria ? 'ic-blue' : 'ic-gold'">
                  <i :class="p.eh_intermediaria ? 'fas fa-blender' : 'fas fa-cookie-bite'"></i>
                </div>
                <div class="item-info">
                  <span class="item-nome">{{ limpar(p.nome_receita || p.receita_nome) }}</span>
                </div>
                <div class="item-qtd">
                  {{ p.quantidade_produzida || p.quantidade }} <small>{{ p.unidade_rendimento || 'un' }}</small>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="!s.loading" class="empty">
      <i class="fas fa-industry"></i>
      <h3>Nenhuma produção no período</h3>
      <button class="btn btn-primary mt-12" @click="s.setTab('cozinha')"><i class="fas fa-plus"></i> Iniciar Lote</button>
    </div>

    <!-- ─── Modal Editar Datas do Lote ──────────────────────── -->
    <BaseModal v-if="currentModal === 'edicao-lote'" title="Editar Lote" @close="fecharModal">
      <div class="form-section">
        <div class="form-section-label"><i class="fas fa-fingerprint"></i> Data de registro</div>
        <div class="fg">
          <label class="label">Quando o lote foi feito</label>
          <input v-model="formEdicaoLote.data_producao" type="datetime-local" class="input" />
          <div class="hint"><i class="fas fa-info-circle"></i> Altere se o lote foi registrado no dia errado.</div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-label"><i class="fas fa-stopwatch"></i> Tempo de execução</div>
        <div class="fg">
            <label class="label"><i class="fas fa-play c-green" style="font-size:.7rem"></i> Início da execução</label>
            <input v-model="formEdicaoLote.data_inicio" type="datetime-local" class="input" />
          </div>
          <div class="fg">
            <label class="label"><i class="fas fa-stop c-red" style="font-size:.7rem"></i> Fim da execução</label>
            <input v-model="formEdicaoLote.data_fim" type="datetime-local" class="input" />
          </div>
        <div v-if="duracaoEdicaoLote > 0" class="duracao-pill">
          <i class="fas fa-clock"></i> {{ fmtTime(duracaoEdicaoLote) }} registrado
        </div>
        <div v-else-if="formEdicaoLote.data_inicio && formEdicaoLote.data_fim" class="hint-error mt-8">
          <i class="fas fa-circle-exclamation"></i> O fim deve ser posterior ao início.
        </div>
      </div>

      <template #foot>
        <div class="spacer"></div>
        <button class="btn btn-secondary" @click="fecharModal">Cancelar</button>
        <button class="btn btn-primary" @click="salvarEdicaoLote">
          <i v-if="saving" class="fas fa-spinner fa-spin"></i>
          <span v-else>Salvar</span>
        </button>
      </template>
    </BaseModal>

  </div>
</template>

<script setup>
import '../assets/checklist.css'
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useStore } from '../store.js';
import { R$, dataHoraBR, fmtQtd as fmtQ, getNowLocal, normalizar, isInsumoOculto, textoEtiquetaReceita, limparApenasSabor } from '../utils.js'; // Corrected import
import BaseModal from '../components/BaseModal.vue'
import AppListRow from '../components/AppListRow.vue'
import SwipeRow from '../components/SwipeRow.vue'
import { useSwipe } from '../composables/useSwipe.js'
import { useModalStack } from '../composables/useModalStack.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useListFilter } from '../composables/useListFilter.js'
import { gerarRelatorioProducao } from '../composables/useGerarDocumento.js'

const s = useStore()
const { closeAll } = useSwipe()
const { modal: currentModal, abrirModal, fecharModal } = useModalStack()
const confirm = useConfirm()

const formEdicaoLote = reactive({ data_producao_original: '', data_producao: '', data_inicio: '', data_fim: '' })

// Converte ISO UTC para string datetime-local (YYYY-MM-DDTHH:MM) no fuso local
function isoParaLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 16)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
         'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// Converte string datetime-local (YYYY-MM-DDTHH:MM, horário local) para ISO UTC
function localParaISO(local) {
  if (!local) return ''
  return new Date(local).toISOString()
}
const saving = ref(false)

async function confirmStopTimer() {
  const ok = await confirm.ask('Deseja finalizar o cronômetro e registrar o tempo neste lote?', {
    title: 'Finalizar Tempo',
    confirmLabel: 'Finalizar',
    type: 'primary'
  })
  if (ok) {
    await s.stopTimer()
  }
}

function fmtTime(minutos) {
  if (!minutos) return ''
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h > 0 ? `${h}h${m > 0 ? ' ' + m + 'min' : ''}` : `${m}min`
}

const duracaoEdicaoLote = computed(() => {
  if (!formEdicaoLote.data_inicio || !formEdicaoLote.data_fim) return 0
  const start = new Date(formEdicaoLote.data_inicio)
  const end = new Date(formEdicaoLote.data_fim)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
  return Math.max(0, Math.round((end - start) / 60000))
})

const gruposAbertos = ref({})

// ── Filtros e Busca ───────────────────────────────────────────
const { busca, listaFiltrada } = useListFilter(
  computed(() => s.producoes.map(p => ({
    ...p,
    nome: p.nome_receita || p.receita_nome
  }))),
  {},
  'Todas'
)

watch(busca, (val) => s.producaoBusca = val)

// ── Navegação mensal ──────────────────────────────────────────
const hoje = new Date()
const mesAtualBase = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
const mesAtivo = ref(new Date(mesAtualBase))

const mesesDisponiveis = computed(() => {
  const set = new Set()
  s.producoes.forEach(p => {
    if (!p.data_producao) return
    const d = new Date(p.data_producao)
    if (isNaN(d.getTime())) return
    set.add(d.getFullYear() + '-' + d.getMonth())
  })
  set.add(mesAtualBase.getFullYear() + '-' + mesAtualBase.getMonth())
  return [...set]
    .map(chave => {
      const [ano, mes] = chave.split('-').map(Number)
      return new Date(ano, mes, 1)
    })
    .sort((a, b) => a - b)
})

const mesMaisAntigo = computed(() => mesesDisponiveis.value[0] || mesAtualBase)

const podeVoltarMes = computed(() => mesAtivo.value > mesMaisAntigo.value)
const podeAvancarMes = computed(() => mesAtivo.value < mesAtualBase)

const labelMesAtivo = computed(() => {
  const txt = mesAtivo.value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
})

function mesAnterior() {
  if (!podeVoltarMes.value) return
  mesAtivo.value = new Date(mesAtivo.value.getFullYear(), mesAtivo.value.getMonth() - 1, 1)
}

function mesProximo() {
  if (!podeAvancarMes.value) return
  mesAtivo.value = new Date(mesAtivo.value.getFullYear(), mesAtivo.value.getMonth() + 1, 1)
}

// ── Computados ────────────────────────────────────────────────
const listaPeriodo = computed(() => {
  const ano = mesAtivo.value.getFullYear()
  const mes = mesAtivo.value.getMonth()
  return listaFiltrada.value
    .filter(p => {
      if (!p.data_producao) return false
      const d = new Date(p.data_producao)
      return d.getFullYear() === ano && d.getMonth() === mes
    })
    .sort((a, b) => (b.data_producao || '').localeCompare(a.data_producao || ''))
})

const gruposProducao = computed(() => {
  const mapa = new Map()

  for (const item of listaPeriodo.value) {
    const key = item.data_producao || 'sem-data'
    if (!mapa.has(key)) {
      mapa.set(key, {
        id: key,
        data: item.data_producao,
        itens: [],
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        duracaoMinutos: 0, // Será calculado abaixo
        custoTotal: 0,
        vendaTotal: 0,
        quantidadeTotalNum: 0,
        unidadeResumo: item.unidade_rendimento || 'un',
        temBase: false,
        temFinal: false
      })
    }

    const grupo = mapa.get(key)
    grupo.itens.push(item)
    grupo.custoTotal += getCustoProducao(item)
    grupo.vendaTotal += getVendaProducao(item) // Isso pode ser ajustado para usar o preço de venda do snapshot se houver
    grupo.quantidadeTotalNum += Number(item.quantidade_produzida || item.quantidade || 0)
    if (item.eh_intermediaria) grupo.temBase = true
    else grupo.temFinal = true
  }

  // Calcular duração para cada grupo
  mapa.forEach(grupo => {
    if (grupo.data_inicio && grupo.data_fim) {
      const start = new Date(grupo.data_inicio)
      const end = new Date(grupo.data_fim)
      grupo.duracaoMinutos = Math.max(0, Math.round((end - start) / 60000))
    } else {
      grupo.duracaoMinutos = 0
    }
  })

  return Array.from(mapa.values()).map(grupo => ({
    ...grupo,
    lucroTotal: grupo.vendaTotal - grupo.custoTotal,
    quantidadeTotal: `${fmtQ(grupo.quantidadeTotalNum, grupo.unidadeResumo)} total`
  }))
})

const tempoEstimadoGrupo = computed(() => {
  const mapa = {}
  for (const grupo of gruposProducao.value) {
    let total = 0
    for (const item of grupo.itens) {
      const r = s.receitas.find(rec => rec.uuid === item.receita_id)
      if (!r) continue
      const qtd = item.quantidade_produzida || item.quantidade || 0
      const media = s.getMediaTempoReceita(item.receita_id)
      const base = media > 0 ? media : (r.tempo_preparo_min || 0)
      total += (qtd / (r.rendimento || 1)) * base
    }
    mapa[grupo.id] = Math.round(total)
  }
  return mapa
})

// ── Métodos ───────────────────────────────────────────────────
function toggleGrupo(id) {
  gruposAbertos.value[id] = !gruposAbertos.value[id]
}

function isGrupoAberto(id) {
  if (busca.value.trim().length > 1) return true
  return gruposAbertos.value[id] ?? false
}

/**
 * Custo de uma produção histórica.
 * Usa snapshot salvo no registro (imune a reajustes futuros de preços).
 * Fallback dinâmico para registros antigos sem snapshot.
 */
function getCustoProducao(p) {
  const qtd = p.quantidade_produzida || p.quantidade || 0
  if (p.custo_snapshot_version >= 2 && p.custo_unitario_snapshot != null) return p.custo_unitario_snapshot * qtd

  // Fallback para registros antigos sem snapshot confiável.
  const tempoManual = p.tempo_real_min || null

  const r = s.receitas.find(rec => rec.uuid === p.receita_id)
  return r ? s.getCustoProducaoReceita(r, qtd, tempoManual) : 0
}

function getVendaProducao(p) {
  const qtd = p.quantidade_produzida || p.quantidade || 0
  if (p.preco_unitario_snapshot != null) return p.preco_unitario_snapshot * qtd

  const r = s.receitas.find(rec => rec.uuid === p.receita_id)
  return r ? (r.preco_sugerido || 0) * qtd : 0
}

function limpar(n) {
  return String(n || '').replace(/\s*[-–]\s*(base|final|intermediária|intermediaria)\s*$/i, '').replace(/\s*\(.*?\)\s*$/i, '').trim()
}

function getTextoEtiqueta(p) {
  const receita = s.receitas.find(rec => rec.uuid === p.receita_id)
  if (receita) return textoEtiquetaReceita(receita)
  // Fallback quando a receita original foi excluída: usa o nome salvo na produção
  return limparApenasSabor(p.nome_receita || p.receita_nome)
}

function agruparPorSabor(itens) {
  const mapa = new Map()
  for (const item of itens) {
    const texto = getTextoEtiqueta(item)
    const qtd = Number(item.quantidade_produzida || item.quantidade || 0)
    if (!texto || qtd <= 0) continue
    mapa.set(texto, (mapa.get(texto) || 0) + qtd)
  }
  return [...mapa.entries()].map(([texto, qtd]) => ({ texto, qtd }))
}

async function irParaEtiquetas(lista) {
  if (!lista.length) {
    s.notify('Nao ha etiquetas validas para gerar', 'error')
    return
  }
  const ok = await confirm.ask(
    `Ir para a tela de Etiquetas com ${lista.length} sabor${lista.length > 1 ? 'es' : ''} selecionado${lista.length > 1 ? 's' : ''}? Você sairá do Histórico de Produção.`,
    { title: 'Imprimir Etiquetas', icon: 'fas fa-tags', confirmLabel: 'Ir para Etiquetas' }
  )
  if (!ok) return
  s.etiquetasPreSelecao = lista
  s.tab = 'etiquetas'
}

async function imprimirEtiqueta(p) {
  await irParaEtiquetas(agruparPorSabor([p]))
}

async function estornar(p) {
  closeAll()
  const nome = limpar(p.nome_receita || p.receita_nome)
  const ok = await confirm.ask(
    `Deseja cancelar a produção de "${nome}"? O registro será removido do histórico.`,
    { title: 'Cancelar Produção', icon: 'fas fa-rotate-left', confirmLabel: 'Cancelar' }
  )
  if (!ok) return
  const id = p.uuid || p.id
  if (!id) return s.notify('Erro: identificador não encontrado', 'error')
  await s.estornarProducao(id)
}

async function handleRetomar(grupo) {
  if (!grupo.agendado) {
    const ok = await confirm.ask(
      `Este lote foi finalizado em ${dataHoraBR(grupo.data)}. Deseja abri-lo na Cozinha para correções? O estoque será recomposto e re-calculado apenas quando você finalizar a nova versão.`,
      { title: 'Corrigir Lote Realizado', icon: 'fas fa-wrench', confirmLabel: 'Abrir para correção', type: 'warning' }
    )
    if (!ok) return
  }
  s.retomarLoteNaCozinha(grupo.id)
}

// Lote já está travado em edição: só volta pra Cozinha, sem perguntar de novo
function continuarEdicao() {
  s.setTab('cozinha')
}

async function cancelarEdicao() {
  const ok = await confirm.ask(
    'Cancelar a edição deste lote? As alterações feitas na Cozinha que ainda não foram salvas serão perdidas, e o lote volta ao estado original.',
    { title: 'Cancelar Edição', icon: 'fas fa-xmark', confirmLabel: 'Cancelar edição', type: 'warning' }
  )
  if (!ok) return
  s.cancelarEdicaoLote()
}

function abrirModalEdicaoLote(grupo) {
  formEdicaoLote.data_producao_original = grupo.data || ''
  formEdicaoLote.data_producao = isoParaLocal(grupo.data)
  formEdicaoLote.data_inicio = isoParaLocal(grupo.data_inicio)
  formEdicaoLote.data_fim = isoParaLocal(grupo.data_fim)
  abrirModal('edicao-lote')
}

function compartilharLote(grupo) {
  const itens = grupo.itens.map(p => {
    const nome = limpar(p.nome_receita || p.receita_nome)
    const qtd = `${p.quantidade_produzida || p.quantidade} ${p.unidade_rendimento || 'un'}`
    return `• ${nome}: ${qtd}`
  }).join('\n')

  const hasIntermediaria = grupo.itens.some(p => p.eh_intermediaria)
  let msg = ''

  if (!hasIntermediaria) {
    // FORMATO CLIENTE / ENCOMENDA (Oculta custos)
    msg = `🍫 *DETALHES DA ENCOMENDA - ${s.company.nome}*\n` +
          `--------------------------------\n` +
          `${itens}\n` +
          `--------------------------------\n` +
          `Data: ${dataHoraBR(grupo.data)}\n\n` +
          `Muito obrigado pela preferência! 😊`
  } else {
    // FORMATO INTERNO / PRODUÇÃO (Exibe custos e duração)
    const tempo = grupo.duracaoMinutos > 0 ? `\n⏱ *Duração:* ${fmtTime(grupo.duracaoMinutos)}` : ''
    msg = `🏭 *RESUMO DE PRODUÇÃO - ${dataHoraBR(grupo.data)}*\n` +
          `--------------------------------\n` +
          `${itens}\n` +
          `--------------------------------\n` +
          `💰 *Custo Total:* ${R$(grupo.custoTotal)}` +
          `${tempo}\n` +
          `\n_Gerado por chocobete_`
  }

  if (navigator.share) {
    navigator.share({ title: hasIntermediaria ? 'Resumo de Produção' : 'Resumo do Pedido', text: msg }).catch(() => {})
  } else {
    navigator.clipboard.writeText(msg)
    s.notify('Copiado para a área de transferência!')
  }
}

function gerarRelatorio() {
  const periodo = labelMesAtivo.value + (busca.value.trim() ? ' · Busca: ' + busca.value : '')
  
  const dadosGrupos = gruposProducao.value.map(g => ({
    data: dataHoraBR(g.data),
    duracao: g.duracaoMinutos > 0 ? fmtTime(g.duracaoMinutos) : '',
    itens: g.itens.map(p => ({
      nome: limpar(p.nome_receita || p.receita_nome),
      qtd: `${p.quantidade_produzida || p.quantidade} ${p.unidade_rendimento || 'un'}`,
      custo: getCustoProducao(p),
      venda: getVendaProducao(p)
    })),
    custoTotal: g.custoTotal,
    vendaTotal: g.vendaTotal
  }))

  gerarRelatorioProducao({
    empresa: s.company,
    grupos: dadosGrupos,
    periodo
  })
}

// ── Edição inline de item ──────────────────────────────────────────────────
const itemEditando = ref(null)
const editQtd = ref(0)

function iniciarEdicaoItem(p) {
  closeAll()
  itemEditando.value = p.uuid || p.id
  editQtd.value = p.quantidade_produzida || p.quantidade || 0
}

function cancelarEdicaoItem() {
  itemEditando.value = null
}

async function salvarEdicaoItem(p) {
  if (editQtd.value <= 0) return
  await s.editarItemProducao(p.uuid || p.id, { quantidade_produzida: editQtd.value })
  itemEditando.value = null
}

// ── Edição de datas (atualizada para aceitar salvar sem fim) ───────────────
async function salvarEdicaoLote() {
  saving.value = true
  try {
    const dados = { data_producao_nova: formEdicaoLote.data_producao ? localParaISO(formEdicaoLote.data_producao) : undefined }
    if (formEdicaoLote.data_inicio && formEdicaoLote.data_fim && duracaoEdicaoLote.value > 0) {
      dados.data_inicio = localParaISO(formEdicaoLote.data_inicio)
      dados.data_fim = localParaISO(formEdicaoLote.data_fim)
      dados.tempo_real_min = duracaoEdicaoLote.value
    } else if (formEdicaoLote.data_inicio) {
      dados.data_inicio = localParaISO(formEdicaoLote.data_inicio)
    }
    await s.atualizarLoteProducao(formEdicaoLote.data_producao_original, dados)
    fecharModal()
  } finally { saving.value = false }
}

onMounted(() => {
  busca.value = s.producaoBusca
  s.carregarProducoes(0)
})
</script>

<style scoped>
/* ── Navegação mensal (mesmo padrão do cal-header em TabPainel) ── */
.cal-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.cal-nav {
  width: 34px; height: 34px; border: none; background: transparent;
  color: var(--brown-mid); font-size: .9rem; border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.cal-nav:active { background: var(--gold-bg); }
.cal-nav:disabled { opacity: .35; pointer-events: none; }
.cal-titulo {
  font-size: .82rem; font-weight: 700; color: var(--brown-dark);
  text-transform: capitalize;
}
.mes-nav-producao { padding: 0 16px; margin-bottom: 0; }
.mes-nav-producao-titulo { font-size: .95rem; }

/* ── Cards de lote (nova UI) ── */
.production-groups { display:flex; flex-direction:column; gap:10px; padding:8px 0 }
.production-card {
  background:var(--surface); border:1px solid var(--border);
  border-radius:var(--r-lg); margin:0 12px; overflow:hidden;
}
.card-agendado { border-color:var(--gold); background:var(--gold-bg); }

/* Cabeçalho do lote */
.lote-hdr-row { display:flex; align-items:center; width:100%; }
.lote-hdr {
  flex:1; min-width:0;
  display:flex; align-items:center; gap:10px;
  padding:12px 4px 12px 14px; cursor:pointer; user-select:none;
}
.lote-hdr:active { background:var(--bg); }

/* SwipeRow do cabeçalho do lote: remove o "cartão dentro do cartão",
   já que .production-card já fornece a borda/sombra externas */
:deep(.lote-swipe.swipe-wrap) {
  margin:0 !important; border:none !important; border-radius:0 !important;
  box-shadow:none !important; background:transparent !important;
}
.lote-dot {
  width:9px; height:9px; border-radius:50%; flex-shrink:0; margin-top:1px;
}
.dot-done      { background:var(--green); }
.dot-running   { background:var(--blue); animation:pulse-dot 1s infinite; }
.dot-scheduled { background:var(--gold-dark); }
.dot-pending   { background:var(--border2); }
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }

.lote-info { flex:1; min-width:0; }
.lote-titulo { font-size:.88rem; font-weight:800; color:var(--brown-dark); }
.lote-meta { display:flex; align-items:center; gap:5px; margin-top:3px; flex-wrap:wrap; }
.lbadge {
  font-size:.65rem; font-weight:700; padding:2px 7px;
  border-radius:var(--r-full); border:1px solid transparent; display:inline-flex; align-items:center; gap:3px;
}
.lbadge-done      { background:var(--blue-bg); border-color:var(--blue-dim); color:var(--blue); }
.lbadge-running   { background:var(--blue-bg); border-color:var(--blue-dim); color:var(--blue); }
.lbadge-scheduled { background:var(--gold-bg); border-color:var(--gold); color:var(--gold-dark); }
.lbadge-est       { background:var(--cream); border-color:var(--border); color:var(--muted); }
.lbadge-sep       { color:var(--border2); font-size:.7rem; }
.lbadge-info      { font-size:.68rem; color:var(--muted); }

/* Ações do lote (fixas, fora do swipe: timer precisa de acesso imediato) */
.lote-acts { display:flex; align-items:center; gap:4px; flex-shrink:0; padding-right:14px; }
.lote-act-btn {
  width:32px; height:32px; border-radius:var(--r-md); border:1px solid var(--border);
  background:var(--surface); color:var(--muted); font-size:.8rem;
  display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;
  transition:all var(--t);
}
.lote-act-btn:active { transform:scale(.9); }
.act-play  { background:var(--green-bg); color:var(--green); border-color:var(--green-dim); }
.act-pause { background:var(--blue-bg); color:var(--blue); border-color:var(--blue-dim); }
.act-stop  { background:var(--orange-bg); color:var(--orange); border-color:var(--orange-dim); }
.act-retomar { background:var(--gold-bg); color:var(--gold-dark); border-color:var(--gold); }
.act-cancelar { background:var(--red-bg, #FCEBEB); color:var(--red, #A32D2D); border-color:var(--red, #A32D2D); }
.lote-toggle i { transition:transform var(--t); }
.lote-toggle i.open { transform:rotate(180deg); }

.card-locked { opacity: 0.8; border-style: dashed; }

/* Itens do lote */
.lote-body { border-top:1px solid var(--border); background:var(--bg); }
.item-linha {
  display:flex; align-items:center; gap:8px; padding:10px 14px;
}
.lote-body > .item-linha { border-bottom:1px solid var(--border); }
.lote-body > .item-linha:last-child { border-bottom:none; }
.item-icon {
  width:28px; height:28px; border-radius:var(--r-sm); flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:.78rem;
}
.ic-gold { background:var(--gold-bg); color:var(--gold-dark); }
.ic-blue { background:var(--blue-bg); color:var(--blue); }
.item-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.item-nome { font-size:.82rem; font-weight:700; color:var(--brown-dark); }
.item-qtd { font-size:.85rem; font-weight:800; font-family:var(--mono); color:var(--brown); flex-shrink:0; padding-right:14px; }
.item-qtd small { font-size:.65rem; font-weight:400; }
.item-edit-inline { display:flex; align-items:center; gap:4px; flex-shrink:0; padding-right:14px; }
.item-qty-input {
  width:58px; padding:4px 6px; border-radius:var(--r-sm); border:1.5px solid var(--blue);
  font-size:.85rem; font-weight:800; font-family:var(--mono); text-align:center; background:var(--surface);
}
.item-edit-ok {
  width:28px; height:28px; border-radius:var(--r-sm); background:var(--green);
  color:#fff; border:none; font-size:.78rem; display:flex; align-items:center; justify-content:center; cursor:pointer;
}

/* SwipeRow do item: mesmo raciocínio do cabeçalho, sem cartão duplicado */
:deep(.item-swipe.swipe-wrap) {
  margin:0 !important; border:none !important; border-radius:0 !important; box-shadow:none !important; background:transparent !important;
}
/* Divisória na largura total da linha (swipe-content), não no item-linha,
   que fica comprimido pelo indicador de swipe e deixaria a linha cortada */
:deep(.item-swipe .swipe-content) { border-bottom:1px solid var(--border); }
:deep(.item-swipe:last-child .swipe-content) { border-bottom:none; }

/* Tela fullscreen adicionar ao lote */
.add-lote-screen {
  position: fixed; inset: 0; z-index: var(--z-overlay);
  background: var(--bg); display: flex; flex-direction: column;
}
.add-lote-screen .view-header {
  height: 56px; background: var(--brown-dark);
  display: flex; align-items: center; padding: 0 8px; flex-shrink: 0;
}
.add-lote-screen .view-header .view-back-btn,
.add-lote-screen .view-header .view-action-btn {
  width: 40px; height: 40px; border-radius: var(--r-md);
  background: transparent; border: none; color: #fff;
  font-size: 1rem; display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.add-lote-screen .view-header .view-title {
  flex: 1; font-size: .95rem; font-weight: 800; color: #fff;
  display: flex; align-items: center; gap: 8px; padding: 0 4px;
}
.add-lote-screen .modal-filter-bar { flex-shrink: 0; }
.add-lote-screen .view-body { flex: 1; overflow-y: auto; padding-bottom: 40px; }

/* Edição de datas */
.duracao-pill {
  display:inline-flex; align-items:center; gap:6px; margin-top:8px;
  padding:5px 12px; background:var(--blue-bg); border:1px solid var(--blue-dim);
  border-radius:var(--r-full); font-size:.75rem; font-weight:700; color:var(--blue);
}

.row-cost { font-weight:700; color:var(--orange) }

/* ── Cabeçalho de pesagem ── */

.pesagem-stat          { font-size:.85rem; color:var(--muted) }
.pesagem-stat strong   { color:var(--brown); font-weight:800 }
.pesagem-stat.profit-highlight {
  margin-left: auto;
  background: var(--green-bg);
  padding: 4px 10px;
  border-radius: var(--r-md);
  border: 1px solid var(--green-dim);
  display: flex;
  align-items: center;
  gap: 5px;
}
.pesagem-stat.profit-highlight span { color: var(--green); font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
.pesagem-stat.profit-highlight strong { color: var(--green); font-size: 0.95rem; }

/* ── Card de preparo por receita ── */
.prep-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); overflow:hidden; margin-bottom:12px; box-shadow:var(--shadow-sm) }

.prep-card-head {
  width:100%; border:none; background:var(--surface); padding:16px 14px;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  text-align:left; transition:background var(--t);
}
.prep-card-head:active { background:var(--gold-bg) }

.prep-card-summary { flex:1; min-width:0 }
.prep-card-summary .group-title { font-size:.92rem; font-weight:800; display:flex; align-items:center; gap:8px; flex-wrap:wrap }

.prep-badge { background:var(--cream); color:var(--brown-mid); border:1px solid var(--border); border-radius:var(--r-full); padding:4px 10px; font-size:.72rem; font-weight:700 }

.prep-meta  { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; font-size:.78rem; color:var(--muted); align-items:center }
.prep-chip  { background:var(--cream); color:var(--muted); border:1px solid var(--border); border-radius:var(--r-full); padding:5px 10px; font-size:.74rem; font-weight:700 }

.prep-chevron      { font-size:.88rem; color:var(--muted); transition:transform var(--t) }
.prep-chevron.open { transform:rotate(180deg) }

.prep-card-body { background:var(--cream); padding:12px 14px 16px; border-top:1px solid var(--border) }

.prep-ingredient-row          { padding:12px 0; border-bottom:1px solid var(--border) }
.prep-ingredient-row:last-child { border-bottom:none }
.prep-ingredient-main         { display:flex; align-items:center; justify-content:space-between; gap:16px }
.prep-ingredient-name         { font-size:.88rem; font-weight:700; color:var(--brown-dark); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1 }
.prep-ingredient-qty          { font-size:.88rem; font-weight:700; font-family:var(--mono); color:var(--brown) }

.prep-sublist { margin-top:8px; padding-left:16px; display:grid; gap:6px }
.prep-subitem { display:flex; justify-content:space-between; gap:10px; font-size:.82rem; color:var(--muted) }
.prep-subitem strong { color:var(--brown); font-family:var(--mono) }

/* ── Resumo global de insumos ── */
.global-summary { display:flex; flex-direction:column; gap:6px; padding:10px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r-md); margin-top:4px }
.global-item    { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#fff; border-radius:var(--r-sm); border:1px solid var(--border) }
.global-item span   { font-size:.86rem; font-weight:700; color:var(--brown) }
.global-item strong { font-size:.95rem; font-weight:800; font-family:var(--mono); color:var(--gold-dark) }


</style>