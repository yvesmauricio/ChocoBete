<template>
  <div class="pi">
    <button type="button" class="pi-cab" :aria-expanded="aberto" @click="alternar">
      <div class="pi-ico"><i class="fas fa-hand-holding-dollar"></i></div>
      <div class="pi-cab-txt">
        <div class="pi-titulo">Proposta de investimento · Pix MEI</div>
        <div class="pi-sub">{{ subtitulo }}</div>
      </div>
      <i :class="aberto ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" class="pi-seta"></i>
    </button>

    <div v-if="aberto" class="pi-corpo">
      <div class="pi-aviso">
        <i class="fas fa-circle-info"></i>
        <span>As regras do Pix MEI ainda não saíram em edital (previsto até o fim do ano; repasses em 2027). Esta proposta usa o que a imprensa divulgou — até R$ {{ fmt(LIMITE_PIX_MEI) }}, para investimento produtivo, com nota fiscal. Ajuste quando o edital sair.</span>
      </div>

      <div v-if="!carregada" class="pi-carregando"><div class="spinner spinner-sm"></div></div>
      <template v-else>

        <!-- ── Itens ── -->
        <div class="pi-secao">1. O que vou comprar</div>
        <div v-for="(it, i) in proposta.itens" :key="it.id" class="pi-item">
          <div class="pi-linha">
            <input v-model="it.descricao" class="input" type="text" maxlength="80"
                   placeholder="Ex: Batedeira planetária 5 L" :aria-label="`Item ${i + 1}`">
            <button v-if="proposta.itens.length > 1" type="button" class="pi-x" aria-label="Remover item" @click="removerItem(i)">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="pi-linha">
            <select v-model="it.tipo" class="input" :aria-label="`Tipo do item ${i + 1}`">
              <option v-for="t in TIPOS_ITEM" :key="t.id" :value="t.id">{{ t.rotulo }}</option>
            </select>
            <div class="pi-valor">
              <span>R$</span>
              <CampoMoeda v-model="it.valor" class="input" placeholder="0,00" :aria-label="`Valor do item ${i + 1}`" />
            </div>
          </div>
          <textarea v-model="it.motivo" class="input pi-area" rows="2" maxlength="300"
                    placeholder="Por que preciso dele? Ex: hoje bato tudo à mão e levo 3 horas; com a batedeira faço o triplo no mesmo tempo."></textarea>
        </div>
        <button type="button" class="btn btn-secondary btn-sm pi-add" @click="adicionarItem">
          <i class="fas fa-plus"></i> Adicionar item
        </button>

        <div class="pi-total" :class="{ 'pi-total--alerta': total > LIMITE_PIX_MEI }">
          <span>Total</span>
          <strong>{{ R(total) }}</strong>
          <small>de {{ R(LIMITE_PIX_MEI) }} divulgados</small>
        </div>

        <!-- ── Texto ── -->
        <div class="pi-secao">2. Meu negócio</div>
        <label class="pi-label" for="pi-faz">O que eu produzo e vendo, e para quem</label>
        <textarea id="pi-faz" v-model="proposta.oQueFaz" class="input pi-area" rows="3" maxlength="600"
                  placeholder="Ex: Faço bolos, trufas e brownies artesanais. Minha esposa vende de porta em porta para famílias e lojas do bairro."></textarea>

        <label class="pi-label" for="pi-prob">Qual problema de hoje o investimento resolve</label>
        <textarea id="pi-prob" v-model="proposta.problema" class="input pi-area" rows="3" maxlength="600"
                  placeholder="Ex: Não dou conta de atender todos os pedidos de fim de semana; perco venda por falta de tempo e equipamento."></textarea>

        <label class="pi-label" for="pi-res">O que muda depois da compra</label>
        <textarea id="pi-res" v-model="proposta.resultado" class="input pi-area" rows="3" maxlength="600"
                  placeholder="Ex: Passo a produzir mais por semana, atendo os pedidos que hoje recuso e reduzo o tempo de preparo."></textarea>

        <label class="pi-label" for="pi-unid">Quantas unidades a mais por semana você faria? <span class="pi-opt">(estimativa honesta)</span></label>
        <input id="pi-unid" v-model.number="proposta.aumentoUnidSemana" class="input pi-unid" type="number" min="0" step="1" inputmode="numeric" placeholder="Ex: 20">

        <!-- Base: o que o app lê da sua produção registrada -->
        <div v-if="carregandoDados" class="pi-carregando"><div class="spinner spinner-sm"></div></div>
        <div v-else-if="producao && producao.semanas > 0" class="pi-base">
          <div class="pi-base-tit">
            <span><i class="fas fa-chart-simple"></i> Base na sua produção registrada</span>
            <span class="pi-conf" :class="'pi-conf--' + producao.nivel">confiança {{ ROTULO_NIVEL[producao.nivel] }}</span>
          </div>
          <div class="pi-base-nums">
            <div><span>Média</span><strong>{{ num(producao.mediaSemana) }} un/sem</strong></div>
            <div><span>Melhor semana</span><strong>{{ producao.melhorSemana.qtd }} un</strong></div>
            <div><span>Semanas lidas</span><strong>{{ producao.semanas }}</strong></div>
          </div>
          <div class="pi-chips">
            <span v-for="c in producao.categorias" :key="c.fam" class="pi-chip">{{ c.rotulo }} · {{ num(c.mediaSemana) }}/sem</span>
          </div>
          <ul class="pi-base-lista">
            <li v-if="producao.sugestao">Na sua melhor semana você fez <strong>{{ producao.sugestao }} un a mais</strong> que a média. Isso é capacidade que você já provou, não é demanda.</li>
            <li v-if="producao.tendencia && producao.tendencia.variacaoPct !== null">Últimas 3 semanas: {{ num(producao.tendencia.ultimas3) }} un/sem, {{ producao.tendencia.variacaoPct >= 0 ? '+' : '' }}{{ producao.tendencia.variacaoPct }}% em relação às anteriores.</li>
            <li v-if="producao.vendas && producao.vendas.relacaoPct !== null" :class="{ 'pi-atencao': producao.vendas.relacaoPct < 85 }">
              Vendas registradas na Caderneta das mesmas categorias: {{ num(producao.vendas.mediaSemana) }} un/sem ({{ producao.vendas.relacaoPct }}% do que foi produzido).
              <template v-if="producao.vendas.relacaoPct < 85"> Parte das vendas (dinheiro, à vista) pode não estar registrada, mas um técnico pode perguntar se o gargalo é produzir ou vender.</template>
            </li>
            <li v-if="producao.parcial">Só existe a semana atual, que ainda não terminou: a média é provisória.</li>
            <li v-else-if="producao.nivel === 'baixa'">Poucas semanas registradas: use como ponto de partida e revise quando tiver mais histórico.</li>
            <li v-if="producao.semanasSemProducao > 0">{{ producao.semanasSemProducao }} {{ producao.semanasSemProducao === 1 ? 'semana' : 'semanas' }} sem produção entram na média como zero.</li>
            <li v-if="producao.ignoradasOutraUnidade">{{ producao.ignoradasOutraUnidade }} registro(s) em g/kg/ml ficaram de fora (só contamos unidades).</li>
            <li>Só aparecem as categorias que você já registra. Bolos e outras entram sozinhos quando você começar a registrar.</li>
          </ul>
          <button v-if="producao.sugestao" type="button" class="btn btn-secondary btn-sm pi-usar" @click="usarSugestao">
            <i class="fas fa-wand-magic-sparkles"></i> Usar {{ producao.sugestao }} un/semana como ponto de partida
          </button>
        </div>
        <div v-else-if="producao" class="pi-nota">
          Ainda não há produção registrada em unidades (receitas em g/kg e intermediárias não contam). Quando você registrar, o app calcula uma base aqui. Por enquanto, estime com sinceridade.
        </div>

        <!-- ── Números do app ── -->
        <div class="pi-secao">3. Seus números <span class="pi-opt">(vêm do app)</span></div>
        <div v-if="carregandoDados" class="pi-carregando"><div class="spinner spinner-sm"></div></div>
        <div v-else-if="resumo" class="pi-nums">
          <div class="pi-num">
            <span>Faturamento médio/mês</span>
            <strong>{{ resumo.registrado ? R(resumo.faturamentoMedio) : '—' }}</strong>
            <small v-if="resumo.registrado">{{ resumo.meses }} {{ resumo.meses === 1 ? 'mês' : 'meses' }} de histórico</small>
          </div>
          <div class="pi-num">
            <span>Lucro estimado/mês</span>
            <strong>{{ resumo.lucroMedio > 0 ? R(resumo.lucroMedio) : '—' }}</strong>
            <small>preço − custo das receitas</small>
          </div>
          <div class="pi-num">
            <span>Sobra média por unidade</span>
            <strong>{{ resumo.sobraUnit > 0 ? R(resumo.sobraUnit) : '—' }}</strong>
            <small>nos produtos com custo</small>
          </div>
          <div class="pi-num">
            <span>Faturado no ano</span>
            <strong>{{ R(resumo.faturadoAno) }}</strong>
            <small v-if="resumo.tetoMei > 0">{{ resumo.pctTeto }}% do teto MEI</small>
          </div>
        </div>
        <div v-else class="pi-nota">Não deu para carregar os números agora. Você ainda pode gerar o documento.</div>

        <div v-if="retorno" class="pi-retorno">
          <i class="fas fa-chart-line"></i>
          <span>
            Estimativa: {{ proposta.aumentoUnidSemana }} un/semana a mais ≈ <strong>{{ R(retorno.ganhoMes) }}/mês</strong> extra;
            o investimento se pagaria em cerca de <strong>{{ String(retorno.paybackMeses).replace('.', ',') }} {{ retorno.paybackMeses === 1 ? 'mês' : 'meses' }}</strong>.
          </span>
        </div>
        <div class="pi-nota">Parte da produção e das vendas acontece fora do sistema: estes números são o que está registrado, não o total do negócio.</div>

        <!-- ── Pendências ── -->
        <div v-if="faltas.length" class="pi-faltas">
          <div class="pi-faltas-tit"><i class="fas fa-list-check"></i> Ainda falta</div>
          <ul><li v-for="f in faltas" :key="f">{{ f }}</li></ul>
        </div>
        <div v-else class="pi-pronta"><i class="fas fa-circle-check"></i> Tudo preenchido. Confira e gere o documento.</div>

        <!-- ── Ações ── -->
        <div class="pi-acoes">
          <button type="button" class="btn btn-primary" :disabled="gerando" @click="gerarDocumento">
            <i class="fas fa-file-lines"></i> Gerar documento
          </button>
          <button type="button" class="btn btn-secondary" :disabled="gerando" @click="pedirIA">
            <i class="fas fa-robot"></i> Pedir à IA para redigir
          </button>
        </div>
        <div class="pi-nota">O rascunho é salvo sozinho neste aparelho e entra no backup. O documento abre em outra janela: use “Imprimir / Salvar PDF”.</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useStore } from '../store.js'
import { configGet, configSet } from '../db.js'
import CampoMoeda from './CampoMoeda.vue'
import { ROTULO_NIVEL } from '../modules/producaoSemanal.js'
import { gerarPropostaInvestimento } from '../composables/useGerarDocumento.js'
import {
  LIMITE_PIX_MEI, CHAVE_PROPOSTA, TIPOS_ITEM, novoItem, normalizarProposta, propostaVazia,
  totalInvestimento, retornoEstimado, resumoParaProposta, pendencias, montarPromptProposta,
} from '../modules/propostaInvestimento.js'

const props = defineProps({
  // async () => dados do negócio (a aba Inteligência já sabe montar: base, mes, produtos, contexto…)
  coletar: { type: Function, required: true },
})
const emit = defineEmits(['prompt-ia'])

const s = useStore()
const aberto = ref(false)
const carregada = ref(false)
const carregandoDados = ref(false)
const gerando = ref(false)
const dados = ref(null)
const proposta = reactive(propostaVazia())

const R = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0).replace(/\s/g, ' ')
const fmt = (n) => Number(n).toLocaleString('pt-BR')
const num = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

const total = computed(() => totalInvestimento(proposta.itens))
const resumo = computed(() => (dados.value ? resumoParaProposta(dados.value) : null))
const producao = computed(() => dados.value?.producao || null)
const retorno = computed(() => retornoEstimado({
  total: total.value, aumentoUnidSemana: proposta.aumentoUnidSemana, sobraUnit: resumo.value?.sobraUnit,
}))
const faltas = computed(() => pendencias(proposta, resumo.value))
const subtitulo = computed(() => {
  if (!carregada.value && !aberto.value) return 'Prepare o pedido dos até R$ 5 mil com os seus números'
  const n = proposta.itens.filter(i => i.descricao.trim() || i.valor > 0).length
  if (!n) return 'Rascunho vazio — comece pelos itens'
  return `${n} ${n === 1 ? 'item' : 'itens'} · ${R(total.value)}${faltas.value.length ? ` · faltam ${faltas.value.length} ajustes` : ' · pronta'}`
})

// ── Abrir: carrega o rascunho salvo e os números do app (uma vez) ──
async function alternar() {
  aberto.value = !aberto.value
  if (!aberto.value) return
  if (!carregada.value) {
    const salva = await configGet(CHAVE_PROPOSTA, null)
    ignorarProximaMudanca = true // carregar o rascunho não conta como edição
    Object.assign(proposta, normalizarProposta(salva))
    carregada.value = true
  }
  if (!dados.value) await carregarDados()
}
async function carregarDados() {
  carregandoDados.value = true
  try { dados.value = await props.coletar() }
  catch (e) { console.error(e); dados.value = null }
  finally { carregandoDados.value = false }
}

// ── Salvar sozinho (só depois de carregar, para não apagar o rascunho com o vazio) ──
let timer = null
let ignorarProximaMudanca = false
function salvar() {
  configSet(CHAVE_PROPOSTA, { ...JSON.parse(JSON.stringify(proposta)), atualizadoEm: new Date().toISOString() })
}
watch(proposta, () => {
  if (!carregada.value) return
  if (ignorarProximaMudanca) { ignorarProximaMudanca = false; return }
  clearTimeout(timer)
  timer = setTimeout(() => { timer = null; salvar() }, 600)
}, { deep: true })
onBeforeUnmount(() => { if (timer) { clearTimeout(timer); if (carregada.value) salvar() } })

// ── Base na produção ──
function usarSugestao() {
  if (producao.value?.sugestao) proposta.aumentoUnidSemana = producao.value.sugestao
}

// ── Itens ──
function adicionarItem() { proposta.itens.push(novoItem()) }
function removerItem(i) { proposta.itens.splice(i, 1); if (!proposta.itens.length) proposta.itens.push(novoItem()) }

// ── Documento e IA ──
function temItem() { return proposta.itens.some(i => i.descricao.trim() && i.valor > 0) }

async function gerarDocumento() {
  if (!temItem()) { s.notify('Informe pelo menos um item com nome e valor.', 'warning'); return }
  gerando.value = true
  try {
    if (!dados.value) await carregarDados()
    salvar()
    gerarPropostaInvestimento({
      empresa: s.company, proposta: JSON.parse(JSON.stringify(proposta)),
      resumo: resumo.value, retorno: retorno.value, total: total.value, limite: LIMITE_PIX_MEI,
      producao: producao.value,
    })
  } finally { gerando.value = false }
}

async function pedirIA() {
  if (!temItem()) { s.notify('Informe pelo menos um item com nome e valor.', 'warning'); return }
  gerando.value = true
  try {
    if (!dados.value) await carregarDados()
    if (!dados.value) { s.notify('Não deu para montar o texto agora.', 'error'); return }
    emit('prompt-ia', montarPromptProposta({
      contexto: dados.value.contexto, proposta: JSON.parse(JSON.stringify(proposta)), total: total.value,
      producao: producao.value,
    }))
  } finally { gerando.value = false }
}
</script>

<style scoped>
.pi { margin-bottom: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
.pi-cab { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: transparent; border: none; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.pi-ico { width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: #EAF3DE; color: #3B6D11; font-size: 1rem; }
.pi-cab-txt { flex: 1; min-width: 0; }
.pi-titulo { font-size: .9rem; font-weight: 800; color: var(--brown-dark); }
.pi-sub { font-size: .78rem; color: var(--muted); margin-top: 2px; }
.pi-seta { color: var(--muted); font-size: .72rem; flex-shrink: 0; }

.pi-corpo { padding: 4px 14px 16px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.pi-aviso { display: flex; gap: 8px; margin-top: 10px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--gold-bg); color: var(--brown-dark); font-size: .78rem; line-height: 1.4; }
.pi-aviso i { flex-shrink: 0; margin-top: 2px; }
.pi-carregando { display: flex; justify-content: center; padding: 14px; }

.pi-secao { margin-top: 10px; font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.pi-opt { font-weight: 600; text-transform: none; letter-spacing: 0; }
.pi-label { font-size: .82rem; font-weight: 700; color: var(--brown-dark); margin-top: 4px; }
.pi-area { height: auto; min-height: 64px; padding: 10px 12px; resize: vertical; line-height: 1.4; font-family: inherit; }
.pi-unid { max-width: 140px; }

.pi-item { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--border2); border-radius: var(--r-md); background: var(--cream); }
.pi-linha { display: flex; gap: 8px; align-items: stretch; }
.pi-linha .input { flex: 1; min-width: 0; }
.pi-x { flex-shrink: 0; width: 42px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); color: var(--red); cursor: pointer; }
.pi-valor { flex: 1; min-width: 0; display: flex; align-items: stretch; border: 1px solid var(--border); border-radius: var(--r-sm); overflow: hidden; background: var(--surface); }
.pi-valor span { display: flex; align-items: center; padding: 0 10px; background: var(--bg); border-right: 1px solid var(--border); color: var(--muted); font-size: .82rem; font-weight: 700; }
.pi-valor .input { border: none !important; border-radius: 0 !important; flex: 1; min-width: 0; text-align: right; }
.pi-add { align-self: flex-start; }

.pi-total { display: flex; align-items: baseline; gap: 8px; padding: 8px 12px; border-radius: var(--r-sm); background: var(--cream); border: 1px solid var(--border2); }
.pi-total span { font-size: .78rem; font-weight: 700; color: var(--muted); }
.pi-total strong { font-family: var(--mono); font-size: 1.05rem; color: var(--brown-dark); }
.pi-total small { margin-left: auto; font-size: .74rem; color: var(--muted); }
.pi-total--alerta { background: var(--red-bg); border-color: var(--red); }
.pi-total--alerta strong { color: var(--red); }

.pi-base { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--border2); border-radius: var(--r-md); background: var(--cream); }
.pi-base-tit { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: .8rem; font-weight: 800; color: var(--brown-dark); }
.pi-conf { font-size: .68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: var(--gold-bg); color: var(--orange); white-space: nowrap; }
.pi-conf--boa { background: #EAF3DE; color: #27500A; }
.pi-base-nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pi-base-nums div { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); }
.pi-base-nums span { font-size: .68rem; color: var(--muted); font-weight: 600; }
.pi-base-nums strong { font-family: var(--mono); font-size: .85rem; color: var(--brown-dark); }
.pi-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pi-chip { font-size: .72rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); color: var(--brown-dark); }
.pi-base-lista { margin: 0; padding-left: 18px; font-size: .76rem; line-height: 1.45; color: var(--brown-dark); display: flex; flex-direction: column; gap: 3px; }
.pi-atencao { color: var(--orange); }
.pi-usar { align-self: flex-start; }
.pi-nums { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pi-num { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); }
.pi-num span { font-size: .72rem; color: var(--muted); font-weight: 600; }
.pi-num strong { font-family: var(--mono); font-size: .95rem; color: var(--brown-dark); }
.pi-num small { font-size: .7rem; color: var(--muted); }
.pi-retorno { display: flex; gap: 8px; padding: 10px 12px; border-radius: var(--r-sm); background: #EAF3DE; color: #27500A; font-size: .8rem; line-height: 1.4; }
.pi-retorno i { margin-top: 2px; }
.pi-nota { font-size: .74rem; color: var(--muted); line-height: 1.4; }

.pi-faltas { padding: 10px 12px; border-radius: var(--r-sm); background: var(--gold-bg); }
.pi-faltas-tit { font-size: .78rem; font-weight: 800; color: var(--orange); margin-bottom: 4px; }
.pi-faltas ul { margin: 0; padding-left: 18px; font-size: .78rem; color: var(--brown-dark); line-height: 1.5; }
.pi-pronta { padding: 10px 12px; border-radius: var(--r-sm); background: #EAF3DE; color: #27500A; font-size: .8rem; font-weight: 700; }

.pi-acoes { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.pi-acoes .btn { width: 100%; justify-content: center; }
@media (min-width: 560px) {
  .pi-acoes { flex-direction: row; }
  .pi-acoes .btn { width: auto; flex: 1; }
}
</style>
