<template>
  <div>
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-brain"></i> Inteligência</h2>
        <div class="tab-actions">
          <button class="btn btn-secondary btn-sm" @click="s.setTab('painel')">
            <i class="fas fa-arrow-left"></i>
          </button>
        </div>
      </div>
    </div>

    <section class="tab-content">
      <div v-if="s.loading" class="loading-box">
        <div class="spinner spinner-sm"></div>
      </div>
      <template v-else>

        <!-- ══ 1. ALERTAS CRÍTICOS ════════════════════════════════════════ -->
        <div v-if="estrategiasAutomaticas.length" class="int-bloco">
          <div class="int-bloco-titulo"><i class="fas fa-triangle-exclamation"></i> Ações prioritárias</div>
          <div class="alertas-lista">
            <div v-for="e in estrategiasAutomaticas" :key="e.titulo" class="alerta-card"
              :class="'alerta-' + e.urgencia">
              <div class="alerta-topo">
                <div class="alerta-ico-wrap" :class="'ico-' + e.urgencia">
                  <i class="fas" :class="e.icone"></i>
                </div>
                <div class="alerta-info">
                  <div class="alerta-titulo">{{ e.titulo }}</div>
                  <div v-if="e.ganho > 0" class="alerta-ganho">+{{ R$(e.ganho) }} potencial</div>
                </div>
                <span class="alerta-badge" :class="'badge-' + e.urgencia">{{ e.urgencia }}</span>
              </div>
              <div class="alerta-desc">{{ e.descricao }}</div>
            </div>
          </div>
        </div>

        <!-- ══ 2. FATURAMENTO ESPERADO vs REAL ═══════════════════════════ -->
        <div v-if="comparativoPorMes.length" class="int-bloco">
          <div class="int-bloco-titulo"><i class="fas fa-chart-bar"></i> Eficiência mensal</div>
          <div class="sheet-card">
            <div class="sheet-body p-0">
              <div v-for="m in comparativoPorMes.slice(0, 4)" :key="m.mes" class="ef-row">
                <div class="ef-mes">{{ m.mes }}</div>
                <div class="ef-barras">
                  <div class="ef-bar-wrap">
                    <div class="ef-bar ef-bar-esp" :style="{ width: (m.esperado / maxEsperado * 100) + '%' }"></div>
                  </div>
                  <div class="ef-bar-wrap">
                    <div class="ef-bar ef-bar-real" :style="{ width: (m.real / maxEsperado * 100) + '%' }"></div>
                  </div>
                </div>
                <div class="ef-nums">
                  <span class="ef-pct"
                    :class="m.eficiencia >= 80 ? 'c-green' : m.eficiencia >= 60 ? 'c-orange' : 'c-red'">
                    {{ m.eficiencia }}%
                  </span>
                  <span class="ef-lucro" :class="m.lucroReal >= 0 ? 'c-green' : 'c-red'">{{ R$(m.lucroReal) }}</span>
                </div>
              </div>
              <div class="ef-legenda">
                <span><span class="ef-dot dot-esp"></span> Esperado</span>
                <span><span class="ef-dot dot-real"></span> Real no banco</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ══ 2.5 CALIBRAÇÃO DE TEMPO (ESTIMADO vs REAL) ══════════════ -->
        <div v-if="rankingTempo.length" class="int-bloco">
          <div class="int-bloco-titulo"><i class="fas fa-stopwatch"></i> Calibração de Tempo</div>
          <div class="sheet-card">
            <div class="sheet-body p-0">
              <div v-for="r in rankingTempo.slice(0, 5)" :key="r.id" class="ef-row">
                <div class="ef-recipe-info">
                  <div class="rank-nome-int" style="font-size: .75rem">{{ r.nome }}</div>
                  <div class="ef-sub">
                    Est: <strong>{{ r.estimado }}m</strong> · Real: <strong :class="r.status === 'atraso' ? 'c-red' : r.status === 'adianto' ? 'c-green' : ''">{{ r.real }}m</strong>
                  </div>
                </div>
                <div class="ef-barras">
                  <div class="ef-bar-wrap">
                    <div class="ef-bar ef-bar-esp" :style="{ width: (r.estimado / maxTempoRank * 100) + '%' }"></div>
                  </div>
                  <div class="ef-bar-wrap">
                    <div class="ef-bar ef-bar-real" 
                      :style="{ 
                        width: (r.real / maxTempoRank * 100) + '%',
                        background: r.status === 'atraso' ? 'var(--red)' : r.status === 'adianto' ? 'var(--green)' : 'var(--blue)' 
                      }">
                    </div>
                  </div>
                </div>
                <div class="ef-nums" style="width: 40px">
                  <span class="ef-pct" :class="r.status === 'atraso' ? 'c-red' : r.status === 'adianto' ? 'c-green' : ''" style="font-size: .7rem">
                    {{ Math.round(r.pct) }}%
                  </span>
                </div>
              </div>
              <div class="ef-legenda">
                <span><span class="ef-dot dot-esp"></span> Planejado</span>
                <span><span class="ef-dot dot-real" style="background: var(--blue)"></span> Real médio</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ══ 3. RANKING DE PRODUTOS ════════════════════════════════════ -->
        <div v-if="rankingRentabilidade.length" class="int-bloco">
          <div class="int-bloco-titulo"><i class="fas fa-medal"></i> Ranking por margem</div>
          <div class="sheet-card">
            <div class="sheet-body p-0">
              <div v-for="(p, idx) in rankingRentabilidade.slice(0, 6)" :key="p.id" class="rank-row-int">
                <span class="rank-pos-int"
                  :class="idx === 0 ? 'rp-ouro' : idx === 1 ? 'rp-prata' : idx === 2 ? 'rp-bronze' : 'rp-n'">{{ idx + 1
                  }}</span>
                <div class="rank-body-int">
                  <span class="rank-nome-int">{{ p.nome }}</span>
                  <div class="rank-bar-bg-int">
                    <div class="rank-bar-fill-int"
                      :style="{ width: p.margem + '%', background: p.margem >= 50 ? 'var(--green)' : p.margem >= 35 ? 'var(--gold)' : 'var(--orange)' }">
                    </div>
                  </div>
                </div>
                <div class="rank-nums-int">
                  <span :class="p.margem >= 35 ? 'c-green' : 'c-red'" style="font-weight:800;font-size:.82rem">{{
                    p.margem.toFixed(0) }}%</span>
                  <span class="rank-lucro-int">{{ R$(p.lucroTotal) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══ 4. ANALISAR PRODUTO ════════════════════════════════════════ -->
        <div class="int-bloco">
          <div class="int-bloco-titulo"><i class="fas fa-search"></i> Analisar produto</div>
          <div class="sheet-card">
            <div class="sheet-body">
              <!-- Picker -->
              <div class="fg mb-10">
                <label class="label">Produto</label>
                <select v-model="produtoSelecionadoId" class="input">
                  <optgroup v-if="produtosFinais.length" label="Produtos Finais">
                    <option v-for="p in produtosFinais" :key="p.id" :value="p.id">{{ p.nome }}</option>
                  </optgroup>
                  <optgroup v-if="produtosBases.length" label="Receitas Base">
                    <option v-for="p in produtosBases" :key="p.id" :value="p.id">{{ p.nome }}</option>
                  </optgroup>
                </select>
              </div>

              <!-- Preço + Quantidade -->
              <div class="form-inline-2">
                <div class="fg" style="flex: 1.5">
                  <label class="label">{{ isPrecoTotal ? 'Preço total do lote' : 'Preço de venda' }}</label>
                  <input class="input" type="text" inputmode="decimal"
                    :value="precoProposto ? maskMoney(precoProposto) : ''"
                    @change="e => precoProposto = parseMoney(e.target.value)" />
                  <div v-if="!isPrecoTotal && precoAutoCalculado" class="hint c-green">
                    Mín. sugerido: {{ R$(precoAutoCalculado) }}
                  </div>
                </div>
                <div class="fg">
                  <label class="label">Quantidade</label>
                  <input class="input" type="number" v-model.number="quantidade" min="1" />
                </div>
              </div>

              <div class="fg mb-16">
                <label class="incluir-pessoal-toggle-modern">
                  <input type="checkbox" v-model="isPrecoTotal" />
                  <span>O preço informado é o <strong>total</strong> para {{ quantidade === 1 ? 'a unidade' : 'as ' + quantidade + ' unidades' }}</span>
                </label>
              </div>

              <!-- Diagnóstico -->
              <div v-if="analiseProduto" class="diagnostico-card" :class="'diag-' + analiseProduto.status">
                <div class="diag-topo">
                  <i class="fas" :class="statusIcon"></i>
                  <span class="diag-titulo">{{ statusLabel }}</span>
                  <span class="diag-margem">{{ analiseProduto.margemPercentual }}% margem</span>
                </div>
                <div class="diag-metricas">
                  <div class="diag-m">
                    <span class="diag-m-lbl">Custo unit.</span>
                    <strong class="c-red">{{ R$(analiseProduto.custoPorUnidade) }}</strong>
                  </div>
                  <div class="diag-m">
                    <span class="diag-m-lbl">Lucro unit.</span>
                    <strong :class="analiseProduto.lucroPorUnidade >= 0 ? 'c-green' : 'c-red'">{{
                      R$(analiseProduto.lucroPorUnidade) }}</strong>
                  </div>
                  <div class="diag-m">
                    <span class="diag-m-lbl">Lucro total</span>
                    <strong :class="analiseProduto.lucroTotal >= 0 ? 'c-green' : 'c-red'">{{
                      R$(analiseProduto.lucroTotal) }}</strong>
                  </div>
                </div>
              </div>

              <!-- Preço mínimo com salário -->
              <div v-if="precoMinimoSalario" class="preco-min-card">
                <div class="preco-min-hdr">
                  <i class="fas fa-hand-holding-dollar"></i>
                  <span>Para pagar sua retirada ({{ R$(metaSalarioMensal) }}/mês)</span>
                </div>
                <div class="preco-min-nums">
                  <div class="preco-min-item">
                    <span class="preco-min-lbl">Preço mínimo</span>
                    <strong>{{ R$(precoMinimoSalario.precoMinimoComSalario) }}</strong>
                  </div>
                  <div v-if="qtdMinimaParaSalario" class="preco-min-item">
                    <span class="preco-min-lbl">Qtd mínima/mês</span>
                    <strong>{{ Math.ceil(qtdMinimaParaSalario.quantidade) }} un</strong>
                  </div>
                </div>
                <div v-if="precoProposto > 0 && precoMinimoSalario.precoMinimoComSalario > precoProposto"
                  class="hint c-red mt-4">
                  <i class="fas fa-circle-exclamation"></i> Preço atual abaixo do mínimo para pagar sua retirada.
                </div>
              </div>

              <!-- Botão atualizar preço -->
              <button v-if="produtoSelecionado && analiseProduto?.precoProposto !== produtoSelecionado.preco"
                class="btn btn-primary btn-full mt-10" @click="atualizarPreco(produtoSelecionado)">
                <i class="fas fa-save"></i> Atualizar preço na Receita
              </button>
            </div>
          </div>
        </div>

        <!-- ══ 6. CONSULTAR IA ════════════════════════════════════════════ -->
        <div class="int-bloco">
          <div class="int-bloco-titulo"><i class="fas fa-robot"></i> Consultar IA com seus dados</div>
          <div class="ia-grid-int">
            <button v-for="p in promptsIA" :key="p.id" class="ia-btn-int" @click="dispararPrompt(p)">
              <div class="ia-btn-ico-int" :style="{ background: p.bg, color: p.cor }">
                <i :class="p.icon"></i>
              </div>
              <div class="ia-btn-body-int">
                <div class="ia-btn-titulo-int">{{ p.titulo }}</div>
                <div class="ia-btn-sub-int">{{ p.sub }}</div>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--muted);font-size:.72rem;flex-shrink:0"></i>
            </button>
          </div>
          <div class="ia-hint-int">
            <i class="fas fa-info-circle"></i>
            Prompt copiado com seus dados — cole no Claude ou ChatGPT.
          </div>
        </div>

      </template>

      <!-- ══ MODAL SELETOR DE IA ══════════════════════════════════════ -->
      <BaseModal v-if="modalIA" title="Abrir na sua IA preferida" @close="modalIA = false">
        <div class="modal-inner">
          <p class="hint mb-16">O prompt com seus dados foi copiado! Escolha onde deseja colar para analisar:</p>
          
          <div class="ia-selector-grid">
            <button v-for="ai in listaAIs" :key="ai.id" class="ia-choice-btn" @click="abrirIA(ai)">
              <div class="ia-choice-ico" :class="ai.id">
                <i :class="ai.icon"></i>
              </div>
              <span>{{ ai.nome }}</span>
            </button>
          </div>
          <div class="ia-hint-int mt-24">
            <i class="fas fa-info-circle"></i>
            Se o texto não carregar sozinho, basta <strong>Colar (Paste)</strong> no chat.
          </div>
        </div>
      </BaseModal>
    </section>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from '../store.js'
import { R$, maskMoney, parseMoney, getMesRef } from '../utils.js'
import { useConfirm } from '../composables/useConfirm.js'
import BaseModal from '../components/BaseModal.vue'
import {
  analisarProduto,
  aprenderComVendas,
  gerarSugestoes,
  priorizarProdutos,
  otimizarVenda,
  calcularEstoqueDisponivel, // Renamed from calcularEstoqueProducoes
  priorizarEstoque,
  calcularPrecoMinimoComSalario,
  snapToSmartPrice,
  calcularQuantidadeMinima
} from '../modules/salesIntelligence.js'

const s = useStore()
const confirm = useConfirm()
const quantidade = ref(1)
const produtoSelecionadoId = ref('')
const precoProposto = ref(0)
const isPrecoTotal = ref(false)

// ─── Produtos disponíveis para análise ───────────────────────
const produtosInteligencia = computed(() =>
  s.receitas
    .filter(r => !r.eh_intermediaria)
    .map(r => ({
      id: r.uuid,
      nome: r.nome,
      custo: s.getCustoTotal(r) / (r.rendimento || 1),
      preco: r.preco_sugerido || 0
    }))
    .filter(p => p.custo > 0 && p.preco > 0)
)

const produtosOrdenados = computed(() =>
  [...produtosInteligencia.value].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
)

// Grupos separados para o picker
const produtosFinais = computed(() =>
  produtosOrdenados.value.filter(p => {
    const r = s.receitas.find(x => x.uuid === p.id)
    return !r?.eh_intermediaria
  })
)
const produtosBases = computed(() =>
  produtosOrdenados.value.filter(p => {
    const r = s.receitas.find(x => x.uuid === p.id)
    return !!r?.eh_intermediaria
  })
)

// ─── Available stock (produced minus sold) ─────────────────────
const estoqueDisponivel = computed(() =>
  calcularEstoqueDisponivel(s.producoes, historicoVendas.value, 90) // Pass sales data
)

const estoqueOrdenado = computed(() =>
  priorizarEstoque(produtosInteligencia.value, estoqueDisponivel.value, inteligencia.value)
)

const infoEstoqueProdutoSelecionado = computed(() => {
  if (!produtoSelecionadoId.value) return null
  const info = estoqueDisponivel.value.get(produtoSelecionadoId.value)
  return info && info.quantidade > 0 ? info : null
})

// ─── Meta de salário a partir do financeiro ──────────────────
const metaSalarioMensal = computed(() => {
  // Prefere a meta configurada em Ajustes; fallback: média das saídas pessoais
  if (s.company?.meta_salario_mensal > 0) return s.company.meta_salario_mensal
  const relatorio = s.relatorioMensalMei
  if (!relatorio.length) return 0
  const ultimos = relatorio.slice(0, 3)
  const total = ultimos.reduce((acc, m) => acc + (m.saidas_pessoais || 0), 0)
  return total > 0 ? Math.round(total / ultimos.length) : 0
})

// ─── Eficiência de tempo (Comparativo Estimado x Real) ───────
const rankingTempo = computed(() => {
  return s.receitas
    .map(r => {
      const real = s.getMediaTempoReceita(r.uuid)
      if (real <= 0) return null
      const estimado = r.tempo_preparo_min || 0
      const pct = estimado > 0 ? (real / estimado) * 100 : 100
      
      return {
        id: r.uuid,
        nome: r.nome,
        estimado,
        real: Math.round(real),
        diff: real - estimado,
        pct,
        status: pct > 115 ? 'atraso' : pct < 85 ? 'adianto' : 'ok'
      }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.pct - 100) - Math.abs(a.pct - 100))
})

const maxTempoRank = computed(() => {
  const list = rankingTempo.value.slice(0, 5)
  if (!list.length) return 1
  return Math.max(...list.flatMap(r => [r.estimado, r.real]))
})

// ─── Overhead calculado ──────────────────────────────────────
const overheadRate = computed(() => {
  const relatorio = s.relatorioMensalMei
  if (!relatorio.length) return 0.1
  const ultimos = relatorio.slice(0, 3)
  const totalReceita = ultimos.reduce((acc, m) => acc + (m.receitas_mei || 0), 0)
  if (totalReceita <= 0) return 0.1
  const custoFixoPeriodo = 350 * ultimos.length
  return Math.min(0.5, custoFixoPeriodo / totalReceita)
})

// ─── Faturamento médio mensal ─────────────────────────────────
const faturamentoMedioMensal = computed(() => {
  const relatorio = s.relatorioMensalMei
  if (!relatorio.length) return 0
  const ultimos = relatorio.slice(0, 3)
  const total = ultimos.reduce((acc, m) => acc + (m.receitas_mei || 0), 0)
  return ultimos.length > 0 ? total / ultimos.length : 0
})

// ═══════════════════════════════════════════════════════════════════
// MOTOR DE ESTRATÉGIAS — cruza producoes × financeiro × receitas
// ═══════════════════════════════════════════════════════════════════

// Faturamento esperado por mês: quanto você DEVERIA ter recebido
const faturamentoEsperadoPorMes = computed(() => {
  const meses = new Map()
  s.producoes.forEach(p => {
    if (!p.data_producao) return
    const mesRef = getMesRef(p.data_producao)
    if (!mesRef) return
    const receita = s.receitas.find(r => r.uuid === p.receita_id)
    if (!receita || receita.eh_intermediaria) return
    const qtd = Number(p.quantidade_produzida || 0)
    const preco = Number(p.preco_unitario_snapshot || receita.preco_sugerido || 0)
    const custoUnit = s.getCustoTotal(receita) / (receita.rendimento || 1)
    const prev = meses.get(mesRef) || { mes: mesRef, esperado: 0, custo: 0, qtd: 0, porProduto: {} }
    prev.esperado += qtd * preco
    prev.custo += qtd * custoUnit
    prev.qtd += qtd
    prev.porProduto[p.receita_id] = (prev.porProduto[p.receita_id] || 0) + qtd
    meses.set(mesRef, prev)
  })
  return [...meses.values()].sort((a, b) => {
    const [ma, ya] = a.mes.split('/'); const [mb, yb] = b.mes.split('/')
    return `${yb}${mb}`.localeCompare(`${ya}${ma}`)
  })
})

// Receita real de vendas registrada no financeiro por mês
const receitaRealPorMes = computed(() => {
  const meses = new Map()
  s.financeiro
    .filter(f => f.natureza === 'entrada' && Number(f.valor || 0) > 0)
    .forEach(f => {
      const mesRef = getMesRef(f.data)
      if (!mesRef) return
      meses.set(mesRef, (meses.get(mesRef) || 0) + Number(f.valor))
    })
  return meses
})

// Comparativo cruzado: esperado × real × lucro
const comparativoPorMes = computed(() =>
  faturamentoEsperadoPorMes.value.slice(0, 6).map(m => {
    const real = receitaRealPorMes.value.get(m.mes) || 0
    const lucroEstimado = m.esperado - m.custo
    const lucroReal = real - m.custo
    const eficiencia = m.esperado > 0 ? Math.round((real / m.esperado) * 100) : 0
    return { ...m, real, lucroEstimado, lucroReal, eficiencia }
  })
)

// Valor máximo para normalizar as barras do comparativo
const maxEsperado = computed(() =>
  Math.max(...comparativoPorMes.value.slice(0, 4).map(m => Math.max(m.esperado, m.real)), 1)
)

// Ranking de produtos por rentabilidade cruzando todas as produções
const rankingRentabilidade = computed(() => {
  const map = new Map()
  s.producoes.forEach(p => {
    const receita = s.receitas.find(r => r.uuid === p.receita_id)
    if (!receita || receita.eh_intermediaria) return
    const qtd = Number(p.quantidade_produzida || 0)
    const preco = Number(p.preco_unitario_snapshot || receita.preco_sugerido || 0)
    const custoUnit = s.getCustoTotal(receita) / (receita.rendimento || 1)
    const margem = preco > 0 ? ((preco - custoUnit) / preco) * 100 : 0
    const prev = map.get(p.receita_id) || {
      id: p.receita_id, nome: receita.nome,
      qtdTotal: 0, faturamento: 0, custo: 0,
      preco, custoUnit, margem
    }
    prev.qtdTotal += qtd
    prev.faturamento += qtd * preco
    prev.custo += qtd * custoUnit
    map.set(p.receita_id, prev)
  })
  return [...map.values()]
    .map(p => ({ ...p, lucroTotal: p.faturamento - p.custo }))
    .sort((a, b) => b.margem - a.margem)
})

// Motor de estratégias automáticas
const estrategiasAutomaticas = computed(() => {
  const estrategias = []
  const produtos = rankingRentabilidade.value
  if (!produtos.length) return estrategias

  const melhorMargem = produtos[0]
  const maiorVolume = [...produtos].sort((a, b) => b.qtdTotal - a.qtdTotal)[0]

  // E1: Produto mais rentável sendo pouco produzido
  if (melhorMargem && maiorVolume && melhorMargem.id !== maiorVolume.id
    && maiorVolume.qtdTotal > 0 && melhorMargem.qtdTotal < maiorVolume.qtdTotal * 0.6) {
    const ganho = Math.round(melhorMargem.qtdTotal * 0.3 * (melhorMargem.preco - melhorMargem.custoUnit))
    estrategias.push({
      tipo: 'aumentar_producao', urgencia: 'alta',
      titulo: `Produzir mais ${melhorMargem.nome}`,
      descricao: `Margem de ${melhorMargem.margem.toFixed(0)}% — a mais alta dos seus produtos — mas você produz bem menos que ${maiorVolume.nome}. Aumentar 30% a produção traria +${R$(ganho)}/ciclo sem nenhuma mudança de preço.`,
      ganho, icone: 'fa-arrow-trend-up'
    })
  }

  // E2: Gap entre esperado e real (produto perdido ou lançamento faltando)
  const ultimos = comparativoPorMes.value.slice(0, 3)
  if (ultimos.length) {
    const gapMedio = ultimos.reduce((acc, m) => acc + Math.max(0, m.esperado - m.real), 0) / ultimos.length
    if (gapMedio > 50) {
      estrategias.push({
        tipo: 'gap_receita', urgencia: 'alta',
        titulo: 'Receita esperada não chegou ao caixa',
        descricao: `Em média, ${R$(Math.round(gapMedio))}/mês da sua produção não aparece como receita no financeiro. Possíveis causas: venda abaixo do preço cadastrado, lançamento de entrada faltando ou produto sem saída. Investigar pode recuperar até ${R$(Math.round(gapMedio * 12))}/ano.`,
        ganho: Math.round(gapMedio * 12), icone: 'fa-triangle-exclamation'
      })
    }
  }

  // E3: Produtos com margem abaixo de 35% — reajuste de preço
  produtos.filter(p => p.margem < 35 && p.qtdTotal > 0).slice(0, 2).forEach(p => {
    const precoIdeal = Math.ceil((p.custoUnit / 0.65) * 100) / 100
    const diff = precoIdeal - p.preco
    if (diff > 0.3) {
      const ganho = Math.round(diff * p.qtdTotal)
      estrategias.push({
        tipo: 'ajuste_preco', urgencia: 'media',
        titulo: `Reajustar preço de ${p.nome}`,
        descricao: `Margem atual: ${p.margem.toFixed(0)}% — abaixo do mínimo saudável de 35%. Preço ideal: ${R$(precoIdeal)}/un (atual: ${R$(p.preco)}). Com ${p.qtdTotal} unidades já produzidas, o reajuste valerá +${R$(ganho)}/ciclo.`,
        ganho, icone: 'fa-coins'
      })
    }
  })

  // E5: Projeção: se reajustar o pior preço, qual seria o lucro mensal?
  const piorMargem = [...produtos].sort((a, b) => a.margem - b.margem)[0]
  if (piorMargem && piorMargem.margem < melhorMargem.margem - 20 && piorMargem.qtdTotal > 0) {
    const precoAlvo = Math.ceil((piorMargem.custoUnit / 0.6) * 100) / 100
    const ganhoMensal = Math.round((precoAlvo - piorMargem.preco) * piorMargem.qtdTotal)
    if (ganhoMensal > 20) {
      estrategias.push({
        tipo: 'projecao', urgencia: 'baixa',
        titulo: `Projeção: se ${piorMargem.nome} tivesse margem de 40%`,
        descricao: `Preço atual: ${R$(piorMargem.preco)}/un — preço para 40% de margem: ${R$(precoAlvo)}/un. Com o volume que você já produz (${piorMargem.qtdTotal} un/ciclo), esse ajuste valeria +${R$(ganhoMensal)}/ciclo sem produzir nada a mais.`,
        ganho: ganhoMensal, icone: 'fa-chart-line'
      })
    }
  }

  // E6: Desvio de tempo (identifica receitas que demoram mais que o planejado)
  rankingTempo.value.filter(r => r.status === 'atraso' && r.diff > 10).slice(0, 1).forEach(r => {
    estrategias.push({
      tipo: 'tempo_preparo', urgencia: 'media',
      titulo: `Calibrar tempo de ${r.nome}`,
      descricao: `Essa receita leva em média ${r.real} min, mas está estimada em ${r.estimado} min (${Math.round(r.pct)}% do esperado). Isso pode estar subestimando seu custo real de mão de obra.`,
      ganho: 0, icone: 'fa-stopwatch'
    })
  })

  return estrategias.sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.urgencia] - { alta: 0, media: 1, baixa: 2 }[b.urgencia]))
})

// ─── Produto selecionado ──────────────────────────────────────
watch(produtosOrdenados, (lista) => {
  if (!lista.length) { produtoSelecionadoId.value = ''; precoProposto.value = 0; return }
  const atual = lista.find(i => i.id === produtoSelecionadoId.value)
  const produtoBase = atual || lista[0]
  produtoSelecionadoId.value = produtoBase.id
  if (!precoProposto.value) precoProposto.value = produtoBase.preco
}, { immediate: true })

const produtoSelecionado = computed(() =>
  produtosInteligencia.value.find(i => i.id === produtoSelecionadoId.value) || null
)

watch(produtoSelecionado, (produto) => {
  if (!produto) return
  // Usa o preço sugerido da receita; se for 0, deixa o campo vazio para o usuário preencher
  precoProposto.value = produto.preco || 0
}, { immediate: true })

// Preço auto-calculado (mínimo viável com salário) quando campo está zerado
const precoAutoCalculado = computed(() => {
  if (precoProposto.value > 0) return null
  if (!precoMinimoSalario.value) return null
  return snapToSmartPrice(precoMinimoSalario.value.precoMinimoComSalario)
})

// ─── Análise do produto selecionado ──────────────────────────
const analiseProduto = computed(() => {
  if (!produtoSelecionado.value) return null

  const resultado = analisarProduto(produtoSelecionado.value, isPrecoTotal.value ? null : precoProposto.value, {
    quantidade: quantidade.value,
    overheadRate: overheadRate.value,
    valorCliente: isPrecoTotal.value ? precoProposto.value : 0
  })

  return resultado
})

// ─── Preço mínimo com salário ─────────────────────────────────
const precoMinimoSalario = computed(() => {
  if (!produtoSelecionado.value) return null
  return calcularPrecoMinimoComSalario(produtoSelecionado.value.custo, {
    quantidade: quantidade.value,
    overheadRate: overheadRate.value,
    metaSalarioMensal: metaSalarioMensal.value,
    faturamentoMedioMensal: faturamentoMedioMensal.value
  })
})

// ─── Quantidade mínima para cobrir tudo ──────────────────────
const qtdMinimaParaSalario = computed(() => {
  if (!produtoSelecionado.value || !precoMinimoSalario.value) return null
  const custoFixo = overheadRate.value * faturamentoMedioMensal.value
  return calcularQuantidadeMinima(
    produtoSelecionado.value.custo,
    precoMinimoSalario.value.precoMinimoComSalario,
    { custoFixoMensal: custoFixo, metaSalarioMensal: metaSalarioMensal.value }
  )
})

// ─── Histórico e aprendizado ──────────────────────────────────
const historicoVendas = computed(() =>
  s.producoes
    .filter(p => {
      const receita = s.receitas.find(r => r.uuid === p.receita_id)
      return receita && !receita.eh_intermediaria
    })
    .map(p => {
      const receita = s.receitas.find(r => r.uuid === p.receita_id)
      return {
        produtoId: p.receita_id,
        quantidade: p.quantidade_produzida || 0,
        precoVendido: p.preco_unitario_snapshot ?? (receita?.preco_sugerido || 0),
        data: p.data_producao
      }
    })
)

const inteligencia = computed(() =>
  aprenderComVendas(historicoVendas.value, produtosInteligencia.value)
)

// ─── Cenários de otimização ───────────────────────────────────
const cenariosOtimizados = computed(() => {
  if (!produtoSelecionado.value) return []
  return otimizarVenda(produtoSelecionado.value, inteligencia.value, {
    minQuantity: quantidade.value,
    overheadRate: overheadRate.value,
    todosProdutos: produtosInteligencia.value
  })
})

// ─── Labels e ícones ─────────────────────────────────────────
const statusLabel = computed(() => {
  if (!analiseProduto.value) return ''
  const labels = {
    ok: 'Saudável',
    margem_baixa: 'Margem no Limite',
    abaixo_do_minimo: 'Margem Crítica',
    prejuizo: 'Prejuízo'
  }
  return labels[analiseProduto.value.status] || 'Análise'
})

const statusIcon = computed(() => {
  if (!analiseProduto.value) return 'fa-circle-info'
  const icons = {
    ok: 'fa-check-circle',
    margem_baixa: 'fa-circle-exclamation',
    abaixo_do_minimo: 'fa-triangle-exclamation',
    prejuizo: 'fa-circle-xmark'
  }
  return icons[analiseProduto.value.status] || 'fa-circle-info'
})

function getCenarioIcon(tipo) {
  const icons = {
    unitario_padrao: 'fa-tag',
    unitario_ideal: 'fa-wand-magic-sparkles',
    cliente_budget: 'fa-hand-holding-dollar',
  }
  return icons[tipo] || 'fa-lightbulb'
}

// ─── Ações ────────────────────────────────────────────────────
function selecionarProdutoDoEstoque(itemEstoque) {
  produtoSelecionadoId.value = itemEstoque.id
  precoProposto.value = itemEstoque.preco
  s.notify(`${itemEstoque.nome} selecionado — ${itemEstoque.quantidadeEmEstoque} un em estoque`, 'success', 2000)
}

function aplicarSugestao(sugestao) {
  if (sugestao.id && sugestao.id !== produtoSelecionadoId.value) {
    produtoSelecionadoId.value = sugestao.id
  } else if (sugestao.produtoId && sugestao.produtoId !== produtoSelecionadoId.value) {
    produtoSelecionadoId.value = sugestao.produtoId
  }
  quantidade.value = sugestao.quantidade || 1
  precoProposto.value = sugestao.precoProposto || (sugestao.precoCombo ? sugestao.precoCombo / sugestao.quantidade : sugestao.preco) || 0
  s.notify('Sugestão aplicada!', 'success', 1500)

  // UX: Rola para o topo para mostrar o formulário preenchido
  const container = document.querySelector('.main')
  if (container) container.scrollTo({ top: 0, behavior: 'smooth' })
}

async function atualizarPreco() {
  const r = s.receitas.find(x => x.uuid === produtoSelecionadoId.value)
  if (!r) return

  const precoUnitarioCalculado = analiseProduto.value.precoProposto

  const ok = await confirm.ask(
    `Deseja atualizar o preço unitário de "${r.nome}" para ${R$(precoUnitarioCalculado)}? Isso afetará os cálculos de lucro no painel.`,
    { title: 'Atualizar Receita', confirmLabel: 'Atualizar', type: 'primary' }
  )

  if (ok) {
    await s.salvarReceita({ ...r, preco_sugerido: precoUnitarioCalculado })
  }
}

  // ── Seletor de IA ─────────────────────────────────────────────────────────
  const modalIA = ref(false)
  const promptGerado = ref('')
  const listaAIs = [
    { id: 'gemini',   nome: 'Gemini',   icon: 'fas fa-wand-magic-sparkles', url: p => `https://gemini.google.com/app?q=${encodeURIComponent(p)}` },
    { id: 'chatgpt',  nome: 'ChatGPT',  icon: 'fas fa-comment-dots', url: p => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
    { id: 'claude',   nome: 'Claude',   icon: 'fas fa-robot', url: p => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
    { id: 'deepseek', nome: 'DeepSeek', icon: 'fas fa-brain', url: p => `https://chat.deepseek.com/` }
  ]

  // ── IA Consultora ─────────────────────────────────────────────────────────

  const promptsIA = [
    {
      id: 'precificacao',
      titulo: 'Análise de Precificação',
      sub: 'Margem, preço mínimo e posicionamento',
      icon: 'fas fa-tag',
      bg: '#E6F1FB', cor: '#185FA5'
    },
    {
      id: 'lucro',
      titulo: 'Estratégia de Lucro',
      sub: 'O que produzir mais para bater a meta',
      icon: 'fas fa-chart-line',
      bg: '#EAF3DE', cor: '#3B6D11'
    },
    {
      id: 'geral',
      titulo: 'Diagnóstico Geral',
      sub: 'Análise completa do negócio',
      icon: 'fas fa-stethoscope',
      bg: '#EEEDFE', cor: '#3C3489'
    }
  ]

  function buildContexto() {
    const mes = comparativoPorMes.value[0]
    const meta = metaSalarioMensal.value

    // Resumo de Esforço vs Resultado (Todos os produtos com produção registrada)
    const resumoProducao = rankingRentabilidade.value
      .map(p => {
        const r = s.receitas.find(rec => rec.uuid === p.id)
        const cat = r?.categoria || 'Outros'
        return `  - [${cat}] ${p.nome}: ${p.qtdTotal} un produzidas | Lucro Total: R$${p.lucroTotal.toFixed(2)} | Margem: ${p.margem.toFixed(0)}%`
      }).join('\n')

    // Financeiro
    const finMes = mes
      ? `Mês atual: faturamento esperado R$${mes.esperado.toFixed(2)}, receita bancária R$${mes.real.toFixed(2)}, lucro estimado R$${mes.lucroReal.toFixed(2)}, eficiência ${mes.eficiencia}%`
      : 'Sem dados financeiros do mês'

    const dasInfo = s.company?.das_mei_mensal
      ? `DAS-MEI mensal: R$${Number(s.company.das_mei_mensal).toFixed(2)}`
      : ''

    return `CONTEXTO DO NEGÓCIO (chocobete):
Negócio: confeitaria artesanal MEI - Vendas Porta-a-porta e encomendas
Meta de retirada mensal: R$${meta.toFixed(2)}
${dasInfo}

HISTÓRICO DE PRODUÇÃO (Esforço vs Lucro):
${resumoProducao}

FINANCEIRO:
${finMes}
${comparativoPorMes.value.slice(1, 4).map(m => `  ${m.mes}: esperado R$${m.esperado.toFixed(2)}, real R$${m.real.toFixed(2)}, lucro R$${m.lucroReal.toFixed(2)}`).join('\n')}`
  }

  function gerarPrompt(id) {
    const ctx = buildContexto()

    const prompts = {
      precificacao: `${ctx}

TAREFA:
Analise a precificação focando na relação entre esforço de produção e lucro.
- Identifique quais produtos (especialmente trufas e cones) estão com margem baixa (< 35%)
- Avalie se o volume produzido justifica a margem atual ou se estou "trocando dinheiro"
- Sugira novos preços de venda para equilibrar o lucro pelo tempo gasto
- Considere que sou MEI com meta de retirada de R$${metaSalarioMensal.value.toFixed(2)}/mês
Seja direto e prático, com valores concretos.`,

      lucro: `${ctx}

TAREFA:
Analise minha produção e finanças e me diga como aumentar meu lucro para atingir a meta de R$${metaSalarioMensal.value.toFixed(2)}/mês.
- Quais produtos devo priorizar (menos esforço, mais lucro)?
- Identifique "vampiros de tempo": produtos que produzo muito mas que rendem pouco lucro total.
- Quanto preciso vender a mais dos meus produtos mais rentáveis para compensar os de baixa margem?
- Sugira uma meta de produção semanal baseada nos itens de melhor retorno.
Quero um plano de ação prático com números.`,

      geral: `${ctx}

TAREFA:
Faça um diagnóstico completo do meu negócio de confeitaria artesanal como consultora especializada em MEI.
- Pontos fortes e fracos da operação atual
- Análise de mix: Onde estou gastando muito esforço (quantidade) e tendo pouco retorno (lucro)?
- Avalie a rentabilidade real de Trufas e Cones vs. outros produtos.
- Como melhorar a eficiência bancária (atualmente ${comparativoPorMes.value[0]?.eficiencia ?? 0}%)?
Seja honesta e direta. Quero saber o que parar de fazer e o que começar a priorizar agora.`
    }

    return prompts[id] || ''
  }

  async function dispararPrompt(p) {
    const prompt = gerarPrompt(p.id)
    if (!prompt) return
    
    promptGerado.value = prompt

    // Copia para o clipboard primeiro (essencial para mobile)
    try {
      await navigator.clipboard.writeText(prompt)
      s.notify('Dados copiados! Escolha a IA abaixo.')
    } catch {
      s.notify('Escolha a IA para colar os dados.', 'warning')
    }

    modalIA.value = true
  }

  function abrirIA(ai) {
    const url = ai.url(promptGerado.value)
    window.open(url, '_blank')
    modalIA.value = false
  }
</script>

<style scoped>
/* ── Estrutura base ── */
.tab-content {
  padding: 12px 16px 100px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.int-bloco {
  margin-bottom: 16px;
}

.int-bloco-titulo {
  font-size: .68rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: .5px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 0 2px;
}

/* ── Alertas ── */
.alertas-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alerta-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alerta-alta {
  border-left: 3px solid var(--red, #c0392b);
}

.alerta-media {
  border-left: 3px solid var(--orange);
}

.alerta-baixa {
  border-left: 3px solid var(--blue);
}

.alerta-topo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alerta-ico-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--r-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
}

.ico-alta {
  background: #FCEBEB;
  color: var(--red, #c0392b);
}

.ico-media {
  background: var(--orange-bg);
  color: var(--orange);
}

.ico-baixa {
  background: var(--blue-bg);
  color: var(--blue);
}

.alerta-info {
  flex: 1;
  min-width: 0;
}

.alerta-titulo {
  font-size: .84rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.alerta-ganho {
  font-size: .68rem;
  color: var(--green);
  font-weight: 700;
  margin-top: 1px;
}

.alerta-badge {
  font-size: .6rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: var(--r-full);
  flex-shrink: 0;
  letter-spacing: .3px;
}

.badge-alta {
  background: #FCEBEB;
  color: var(--red, #c0392b);
}

.badge-media {
  background: var(--orange-bg);
  color: var(--orange);
}

.badge-baixa {
  background: var(--blue-bg);
  color: var(--blue);
}

.alerta-desc {
  font-size: .73rem;
  color: var(--muted);
  line-height: 1.45;
}

/* ── Eficiência mensal ── */
.ef-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.ef-row:last-child {
  border-bottom: none;
}

.ef-mes {
  font-size: .72rem;
  font-weight: 700;
  color: var(--muted);
  width: 44px;
  flex-shrink: 0;
}

.ef-recipe-info {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ef-sub {
  font-size: .62rem;
  color: var(--muted);
}

.ef-barras {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ef-bar-wrap {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.ef-bar {
  height: 100%;
  border-radius: 3px;
  transition: width .5s ease;
}

.ef-bar-esp {
  background: var(--border2);
}

.ef-bar-real {
  background: var(--green);
}

.ef-nums {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  width: 52px;
}

.ef-pct {
  font-size: .78rem;
  font-weight: 800;
}

.ef-lucro {
  font-size: .65rem;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--muted);
}

.ef-legenda {
  display: flex;
  gap: 12px;
  padding: 8px 14px;
  font-size: .62rem;
  color: var(--muted);
  border-top: 1px solid var(--border);
}

.ef-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.dot-esp {
  background: var(--border2);
}

.dot-real {
  background: var(--green);
}

/* ── Ranking ── */
.rank-row-int {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.rank-row-int:last-child {
  border-bottom: none;
}

.rank-pos-int {
  width: 18px;
  text-align: center;
  font-size: .78rem;
  font-weight: 800;
  flex-shrink: 0;
}

.rp-ouro {
  color: #c9920c;
}

.rp-prata {
  color: #9e9e9e;
}

.rp-bronze {
  color: #a0673a;
}

.rp-n {
  color: var(--muted);
}

.rank-body-int {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rank-nome-int {
  font-size: .83rem;
  font-weight: 700;
  color: var(--brown-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-bar-bg-int {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.rank-bar-fill-int {
  height: 100%;
  border-radius: 2px;
  transition: width .5s ease;
  max-width: 100%;
}

.rank-nums-int {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.rank-lucro-int {
  font-size: .65rem;
  color: var(--muted);
  font-family: var(--mono);
}

/* ── Analisar produto ── */
.form-inline-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.diagnostico-card {
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.diag-ok {
  background: var(--green-bg);
  border-color: var(--green-dim);
}

.diag-margem_baixa {
  background: var(--gold-bg);
  border-color: var(--gold);
}

.diag-abaixo_do_minimo {
  background: var(--orange-bg);
  border-color: var(--orange-dim);
}

.diag-prejuizo {
  background: #FCEBEB;
  border-color: #f5c6c6;
}

.diag-topo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: .84rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.diag-margem {
  margin-left: auto;
  font-size: .78rem;
  font-weight: 800;
  font-family: var(--mono);
}

.diag-metricas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.diag-m {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.diag-m-lbl {
  font-size: .6rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .3px;
}

.diag-m strong {
  font-size: .85rem;
  font-weight: 800;
  font-family: var(--mono);
}

.preco-min-card {
  padding: 10px 12px;
  background: var(--blue-bg);
  border: 1px solid #bfdbfe;
  border-radius: var(--r-md);
  margin-bottom: 8px;
}

.preco-min-hdr {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: .72rem;
  color: var(--blue);
  font-weight: 700;
  margin-bottom: 8px;
}

.preco-min-nums {
  display: flex;
  gap: 16px;
}

.preco-min-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preco-min-lbl {
  font-size: .6rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
}

.preco-min-item strong {
  font-size: .9rem;
  font-weight: 800;
  font-family: var(--mono);
  color: var(--brown-dark);
}

/* ── Combos ── */
.combos-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.combo-card-int {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.combo-produtos-int {
  font-size: .85rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.combo-mais {
  color: var(--gold-dark);
  font-weight: 400;
  padding: 0 3px;
}

.combo-nums-int {
  display: flex;
  align-items: center;
  gap: 10px;
}

.combo-preco-int {
  font-size: 1rem;
  font-weight: 800;
  font-family: var(--mono);
  color: var(--brown-dark);
}

.combo-margem-int {
  font-size: .72rem;
  font-weight: 700;
}

.combo-desc-int {
  font-size: .7rem;
  color: var(--muted);
  line-height: 1.4;
}

/* ── IA ── */
.ia-grid-int {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 8px;
}

.ia-btn-int {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  text-align: left;
  transition: background var(--t);
  width: 100%;
}

.ia-btn-int:active {
  background: var(--cream);
  transform: scale(0.98);
}

.ia-btn-ico-int {
  width: 34px;
  height: 34px;
  border-radius: var(--r-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
}

.ia-btn-body-int {
  flex: 1;
  min-width: 0;
}

.ia-btn-titulo-int {
  font-size: .82rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.ia-btn-sub-int {
  font-size: .63rem;
  color: var(--muted);
  margin-top: 2px;
}

.ia-hint-int {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  background: var(--blue-bg);
  border: 1px solid #bfdbfe;
  border-radius: var(--r-sm);
  font-size: .65rem;
  color: var(--blue);
  line-height: 1.4;
}

/* utils */
.mb-10 {
  margin-bottom: 10px;
}

.mb-16 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 4px;
}

.mt-10 {
  margin-top: 10px;
}

.btn-full {
  width: 100%;
}

.p-0 {
  padding: 0;
}

/* Estilo para o toggle de Preço Total */
.incluir-pessoal-toggle-modern {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--cream);
  border: 1.5px dashed var(--border2);
  border-radius: var(--r-md);
  font-size: 0.78rem;
  color: var(--muted);
  cursor: pointer;
  transition: all var(--t);
  margin-top: -4px;
}
.incluir-pessoal-toggle-modern:active { transform: scale(0.98); background: var(--gold-bg); }
.incluir-pessoal-toggle-modern input {
  width: 18px; height: 18px; accent-color: var(--brown); cursor: pointer;
}
.incluir-pessoal-toggle-modern strong { color: var(--gold-dark); font-weight: 800; }

/* Seletor de IA */
.modal-inner {
  padding: 16px 16px 24px;
}

.ia-selector-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 8px 0;
}
.ia-choice-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 10px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--r-lg);
  transition: all var(--t);
  border-bottom: 3px solid var(--border);
}
.ia-choice-btn:active { transform: scale(0.96); background: var(--gold-bg); }
.ia-choice-ico {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem;
}
.ia-choice-ico.gemini   { background: #eff6ff; color: #1a73e8; }
.ia-choice-ico.chatgpt  { background: #f0fdf4; color: #10a37f; }
.ia-choice-ico.claude   { background: #fff7ed; color: #d97706; }
.ia-choice-ico.deepseek { background: #f5f3ff; color: #7c3aed; }
.ia-choice-btn span { font-size: 0.85rem; font-weight: 700; color: var(--brown-dark); }
</style>