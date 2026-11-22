<template>
  <div class="gn">
    <div v-if="carregando" class="loading-box"><div class="spinner spinner-sm"></div></div>

    <div v-else-if="!fiados.length" class="gn-vazio">
      <i class="fas fa-seedling"></i>
      <b>O guia começa quando as vendas aparecerem</b>
      <p>Ele aprende com as vendas lançadas na Caderneta: quem paga em dia, o que cada cliente leva e o que dá mais lucro. Assim que houver algumas vendas, as dicas aparecem aqui.</p>
    </div>

    <template v-else>
      <!-- ══ 1. COMO ESTÁ O MÊS ═════════════════════════════════════ -->
      <div v-if="mostra('resumo')" id="gn-mes" class="gn-bloco">
        <div class="gn-kpi">
          <div class="gn-kpi-topo">
            <div>
              <div class="gn-kpi-rot">Vendido em {{ nomeMes }}</div>
              <div class="gn-kpi-val">{{ R$(mes.vendido) }}</div>
            </div>
            <div class="gn-kpi-pilulas">
              <span class="gn-pilula"><b>{{ mes.qtdVendas }}</b> {{ mes.qtdVendas === 1 ? 'venda' : 'vendas' }}</span>
              <span class="gn-pilula"><b>{{ mes.clientesAtivos }}</b> {{ mes.clientesAtivos === 1 ? 'cliente' : 'clientes' }}</span>
            </div>
          </div>
          <div v-if="mes.variacao !== null" class="gn-kpi-comp" :class="mes.variacao >= 0 ? 'sobe' : 'desce'">
            <i class="fas" :class="mes.variacao >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'"></i>
            {{ mes.variacao >= 0 ? '+' : '' }}{{ mes.variacao }}% comparado ao mesmo período do mês passado
          </div>
          <div class="gn-kpi-trio">
            <div class="gn-kpi-sub"><span>Recebido</span><b>{{ R$(mes.recebido) }}</b></div>
            <div class="gn-kpi-sub"><span>A receber</span><b>{{ R$(mes.aReceber) }}</b></div>
            <div class="gn-kpi-sub" :class="{ alerta: mes.atrasado > 0 }"><span>Atrasado</span><b>{{ R$(mes.atrasado) }}</b></div>
          </div>
        </div>

        <div v-if="mes.lucro > 0 || mes.lucroMedio > 0" class="gn-lucro">
          <div class="gn-lucro-linha">
            <span><i class="fas fa-piggy-bank"></i> Sobra estimada no mês</span>
            <b>{{ R$(mes.lucro) }}</b>
          </div>
          <template v-if="metaRetirada > 0">
            <div class="gn-barra"><div class="gn-barra-fill" :style="{ width: Math.min(100, Math.round((mes.lucro / metaRetirada) * 100)) + '%' }"></div></div>
            <div class="gn-lucro-meta">Sua meta de retirada: {{ R$(metaRetirada) }}/mês · média recente: {{ R$(mes.lucroMedio) }}</div>
          </template>
          <div v-else class="gn-lucro-meta">Defina sua meta de retirada em Ajustes para ver quanto falta.</div>
          <div v-if="mes.coberturaCusto !== null && mes.coberturaCusto < 90" class="gn-aviso">
            <i class="fas fa-circle-info"></i> Cálculo aproximado: {{ mes.coberturaCusto }}% do vendido tem custo conhecido nas receitas.
          </div>
        </div>
      </div>

      <!-- ══ 2. PRÓXIMOS PASSOS ═════════════════════════════════════ -->
      <div v-if="mostra('resumo') && passos.length" class="gn-bloco">
        <div class="gn-titulo"><i class="fas fa-route"></i> Próximos passos</div>
        <div class="gn-passos">
          <div v-for="(p, i) in passos" :key="p.id" class="gn-passo" :class="'u-' + p.urgencia">
            <div class="gn-passo-num">{{ i + 1 }}</div>
            <div class="gn-passo-corpo">
              <div class="gn-passo-titulo">{{ p.titulo }}</div>
              <div class="gn-passo-texto">{{ p.texto }}</div>
              <button v-if="p.acao" type="button" class="gn-passo-btn" @click="executarAcao(p.acao)">
                {{ p.acao.rotulo }} <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ 3. CLIENTES ════════════════════════════════════════════ -->
      <div v-if="mostra('clientes')" id="gn-clientes" class="gn-bloco">
        <div class="gn-titulo"><i class="fas fa-users"></i> Meus clientes de fiado</div>
        <div class="gn-chips" role="group" aria-label="Filtrar clientes">
          <button v-for="f in filtrosClientes" :key="f.id" type="button" class="chip" :class="{ ativo: filtroCliente === f.id }" @click="filtroCliente = f.id">
            {{ f.nome }}<span v-if="f.n" class="gn-chip-n">{{ f.n }}</span>
          </button>
        </div>
        <div v-if="!clientesFiltrados.length" class="gn-nada">{{ textoNenhumCliente }}</div>
        <div v-else class="gn-lista">
          <button v-for="c in clientesVisiveis" :key="c.id" type="button" class="gn-cli" @click="abrirCliente(c)">
            <span class="gn-avatar" :class="'st-' + c.status">{{ iniciais(c.nome) }}</span>
            <span class="gn-cli-info">
              <span class="gn-cli-nome">{{ c.nome }}<small v-if="c.loja"> · {{ c.loja }}</small></span>
              <span class="gn-cli-linha">{{ linhaCliente(c) }}</span>
              <span v-if="c.obs" class="gn-cli-obs"><i class="fas fa-note-sticky"></i> {{ c.obs }}</span>
            </span>
            <span class="gn-cli-dir">
              <span class="gn-badge" :class="'st-' + c.status">{{ ROTULO_STATUS[c.status] }}</span>
              <b v-if="c.saldoAberto > 0" :class="{ red: c.saldoAtrasado > 0 }">{{ R$(c.saldoAberto) }}</b>
            </span>
          </button>
        </div>
        <button v-if="clientesFiltrados.length > LIMITE_LISTA" type="button" class="gn-mais" @click="verTodosClientes = !verTodosClientes">
          {{ verTodosClientes ? 'Mostrar menos' : `Ver mais ${clientesFiltrados.length - LIMITE_LISTA}` }}
          <i class="fas" :class="verTodosClientes ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
        </button>
      </div>

      <!-- ══ 3b. QUEM PAGA À VISTA (do extrato) ═════════════════════ -->
      <div v-if="mostra('clientes') && pagadoresAvista.length" class="gn-bloco">
        <div class="gn-titulo"><i class="fas fa-user-check"></i> Quem paga à vista (pelo extrato)</div>
        <div class="gn-lista">
          <div v-for="p in pagadoresAvista" :key="p.chave" class="gn-loja">
            <div class="gn-loja-nome">{{ p.nome }}<small v-if="p.tambemClienteFiado" class="mudo"> · também é cliente de fiado</small></div>
            <div class="gn-loja-nums">
              <span><b>{{ R$(p.total) }}</b> · {{ p.vezes }} {{ p.vezes === 1 ? 'pagamento' : 'pagamentos' }}</span>
              <span class="mudo">ticket {{ R$(p.ticket) }}</span>
              <span v-if="p.intervaloMedio" class="mudo">a cada ~{{ p.intervaloMedio }} dias</span>
            </div>
          </div>
        </div>
        <p class="gn-dica">Veja a lista completa e a separação fiado × à vista em Financeiro › Fiado × À vista.</p>
      </div>

      <!-- ══ 4. PRODUTOS ════════════════════════════════════════════ -->
      <div v-if="mostra('produtos')" id="gn-produtos" class="gn-bloco">
        <div class="gn-titulo"><i class="fas fa-cookie-bite"></i> O que vende e o que sobra</div>
        <p class="gn-dica">Baseado nas vendas dos últimos 90 dias. "Sobra" é o preço menos o custo da receita.</p>

        <!-- Matriz: quanto vende × quanto sobra (cada bolinha é um produto; maior = fatura mais) -->
        <div v-if="matriz" class="gn-matriz">
          <svg :viewBox="`0 0 ${matriz.w} ${matriz.h}`" class="gn-matriz-svg" role="img" aria-label="Matriz de produtos: quanto vende por quanto sobra">
            <rect class="q q-divulgar" :x="matriz.L" :y="matriz.T" :width="matriz.xThr - matriz.L" :height="matriz.yThr - matriz.T" />
            <rect class="q q-chefe" :x="matriz.xThr" :y="matriz.T" :width="matriz.L + matriz.W - matriz.xThr" :height="matriz.yThr - matriz.T" />
            <rect class="q q-repensar" :x="matriz.L" :y="matriz.yThr" :width="matriz.xThr - matriz.L" :height="matriz.T + matriz.H - matriz.yThr" />
            <rect class="q q-reajustar" :x="matriz.xThr" :y="matriz.yThr" :width="matriz.L + matriz.W - matriz.xThr" :height="matriz.T + matriz.H - matriz.yThr" />
            <text class="qt" :x="matriz.L + 5" :y="matriz.T + 12">Divulgar mais</text>
            <text class="qt" :x="matriz.L + matriz.W - 5" :y="matriz.T + 12" text-anchor="end">Carro-chefe</text>
            <text class="qt" :x="matriz.L + 5" :y="matriz.T + matriz.H - 6">Repensar</text>
            <text class="qt" :x="matriz.L + matriz.W - 5" :y="matriz.T + matriz.H - 6" text-anchor="end">Reajustar preço</text>
            <text class="ax" :x="matriz.L - 6" :y="matriz.yThr + 3" text-anchor="end">{{ matriz.limMargem }}%</text>
            <text class="ax" :x="matriz.L - 6" :y="matriz.T + 8" text-anchor="end">{{ matriz.yMax }}%</text>
            <text class="ax" :x="matriz.L - 6" :y="matriz.T + matriz.H" text-anchor="end">{{ matriz.yMin }}%</text>
            <text class="ax" :x="matriz.L + matriz.W / 2" :y="matriz.h - 4" text-anchor="middle">vende mais →</text>
            <text class="ax" :x="10" :y="matriz.T + matriz.H / 2" text-anchor="middle" :transform="`rotate(-90 10 ${matriz.T + matriz.H / 2})`">sobra mais →</text>
            <g v-for="pt in matriz.pontos" :key="pt.chave" class="pt" :class="'g-' + pt.grupo" @click="selecionarPonto(pt.chave)">
              <circle :cx="pt.x" :cy="pt.y" :r="pt.r + 9" class="hit" />
              <circle :cx="pt.x" :cy="pt.y" :r="pt.r" class="dot" :class="{ sel: pontoSel === pt.chave }" />
              <text v-if="pt.rotulo || pontoSel === pt.chave" :x="pt.x" :y="pt.y - pt.r - 3" class="lb" text-anchor="middle">{{ pt.curto }}</text>
            </g>
          </svg>
          <div v-if="pontoSelecionado" class="gn-matriz-det">
            <div class="gn-matriz-det-topo">
              <b>{{ pontoSelecionado.nome }}</b>
              <span class="gn-grupo" :class="'g-' + pontoSelecionado.grupo">{{ ROTULO_GRUPO[pontoSelecionado.grupo] }}</span>
            </div>
            <div class="gn-matriz-det-nums">
              <span><b>{{ pontoSelecionado.qtd }}</b> un · {{ R$(pontoSelecionado.faturamento) }}</span>
              <span>sobra <b :class="pontoSelecionado.margem >= 35 ? 'verde' : 'red'">{{ R$(pontoSelecionado.sobra) }}</b> ({{ pontoSelecionado.margem }}%)</span>
            </div>
          </div>
          <p v-else class="gn-dica gn-matriz-dica">Toque numa bolinha para ver o produto. Quanto maior a bolinha, mais ele fatura.</p>
        </div>

        <div class="gn-chips">
          <button v-for="g in filtrosProdutos" :key="g.id" type="button" class="chip" :class="{ ativo: filtroProduto === g.id }" @click="filtroProduto = g.id">
            {{ g.nome }}<span v-if="g.n" class="gn-chip-n">{{ g.n }}</span>
          </button>
        </div>
        <div v-if="!produtosFiltrados.length" class="gn-nada">Nenhum produto neste grupo.</div>
        <div v-else class="gn-lista">
          <div v-for="p in produtosVisiveis" :key="p.chave" class="gn-prod" :class="{ destaque: destaqueProduto === p.chave }">
            <div class="gn-prod-topo">
              <span class="gn-prod-nome">{{ p.nome }}</span>
              <span class="gn-grupo" :class="'g-' + p.grupo">{{ ROTULO_GRUPO[p.grupo] }}</span>
            </div>
            <div class="gn-prod-nums">
              <span><b>{{ p.qtd }}</b> un · {{ R$(p.faturamento) }}</span>
              <span v-if="p.sobra !== null">sobra <b :class="p.margem >= 35 ? 'verde' : 'red'">{{ R$(p.sobra) }}</b> ({{ p.margem }}%)<template v-if="p.custoEstimado"> ≈</template></span>
              <span v-else class="mudo">custo não encontrado</span>
            </div>
            <div v-if="p.reajuste" class="gn-prod-dica">
              <i class="fas fa-lightbulb"></i> Um passo suave: {{ R$(p.precoAtual) }} → <b>{{ R$(p.reajuste.passo) }}</b>
              <template v-if="p.reajuste.ganhoMes >= 3"> (≈ +{{ R$(p.reajuste.ganhoMes) }}/mês)</template>
            </div>
          </div>
        </div>

        <button v-if="produtosFiltrados.length > LIMITE_LISTA" type="button" class="gn-mais" @click="verTodosProdutos = !verTodosProdutos">
          {{ verTodosProdutos ? 'Mostrar menos' : `Ver mais ${produtosFiltrados.length - LIMITE_LISTA}` }}
          <i class="fas" :class="verTodosProdutos ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
        </button>

        <div v-if="combosJuntos.length" class="gn-combos">
          <div class="gn-sub">Costumam ser comprados juntos</div>
          <div v-for="c in combosJuntos" :key="c.a + c.b" class="gn-combo-par">
            <i class="fas fa-link"></i> {{ c.a }} + {{ c.b }} <small>{{ c.vezes }} {{ c.vezes === 1 ? 'venda' : 'vendas' }}</small>
          </div>
          <p class="gn-dica">Boa base para montar um combo fixo e oferecer a outros clientes.</p>
        </div>
      </div>

      <!-- ══ 5. PONTOS DE VENDA ═════════════════════════════════════ -->
      <div v-if="mostra('clientes') && lojasAnalise.length > 1" class="gn-bloco">
        <div class="gn-titulo"><i class="fas fa-store"></i> Pontos de venda (90 dias)</div>
        <div class="gn-lista">
          <div v-for="l in lojasAnalise" :key="l.id" class="gn-loja">
            <div class="gn-loja-nome">{{ l.nome }}</div>
            <div class="gn-loja-nums">
              <span><b>{{ R$(l.vendido) }}</b> · {{ l.clientes }} {{ l.clientes === 1 ? 'cliente' : 'clientes' }}</span>
              <span v-if="l.atrasado > 0" class="red">{{ R$(l.atrasado) }} atrasado</span>
              <span v-else-if="l.aReceber > 0" class="mudo">{{ R$(l.aReceber) }} a receber</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ FICHA DO CLIENTE ═══════════════════════════════════════ -->
    <BaseModal v-if="selecionado" :title="selecionado.nome" @close="selecionadoId = null">
      <div class="gn-ficha">
        <div class="gn-ficha-topo">
          <span class="gn-avatar grande" :class="'st-' + selecionado.status">{{ iniciais(selecionado.nome) }}</span>
          <div>
            <span class="gn-badge" :class="'st-' + selecionado.status">{{ ROTULO_STATUS[selecionado.status] }}</span>
            <div class="gn-ficha-sub">{{ selecionado.loja }}<template v-if="selecionado.funcao"> · {{ selecionado.funcao }}</template></div>
          </div>
        </div>

        <div class="gn-conselho" :class="'st-' + selecionado.status"><i class="fas fa-comment-dots"></i> {{ selecionado.conselho.texto }}</div>

        <div class="gn-ficha-num">
          <div><span>Já comprou</span><b>{{ R$(selecionado.totalComprado) }}</b></div>
          <div><span>Compras</span><b>{{ selecionado.compras }}</b></div>
          <div><span>Ticket médio</span><b>{{ R$(selecionado.ticket) }}</b></div>
          <div><span>Última compra</span><b>{{ selecionado.diasSemComprar === null ? '—' : selecionado.diasSemComprar === 0 ? 'hoje' : selecionado.diasSemComprar + 'd atrás' }}</b></div>
        </div>

        <div class="gn-sub">Como ela paga</div>
        <ul class="gn-fatos"><li v-for="f in selecionado.fatos" :key="f">{{ f }}</li></ul>
        <div v-if="selecionado.historico.length" class="gn-hist">
          <div v-for="h in selecionado.historico" :key="h.data + h.total" class="gn-hist-linha">
            <span>{{ fmtBR(h.data) }}</span>
            <span>{{ R$(h.total) }}</span>
            <span v-if="h.aberto" :class="h.atraso > 0 ? 'red' : 'mudo'">{{ h.atraso > 0 ? 'vencida há ' + h.atraso + 'd' : 'em aberto' }}</span>
            <span v-else :class="h.atraso > 2 ? 'amarelo' : 'verde'">{{ h.atraso > 2 ? 'pagou ' + h.atraso + 'd depois' : 'pagou no prazo' }}</span>
          </div>
        </div>

        <div class="gn-sub">O que mais leva</div>
        <div v-if="produtosSel.length" class="gn-levou">
          <div v-for="p in produtosSel.slice(0, 5)" :key="p.chave" class="gn-levou-linha">
            <span class="gn-levou-nome">{{ p.nome }}
              <small v-if="p.detalhes.length > 1 || p.detalhes[0]?.nome !== p.nome" class="gn-levou-det">{{ p.detalhes.slice(0, 3).map(d => d.nome + ' ×' + d.qtd).join(' · ') }}</small>
            </span>
            <span class="gn-levou-qtd">{{ p.qtd }} un <small>· costuma levar {{ p.qtdUsual }}</small></span>
          </div>
        </div>
        <div v-else class="gn-nada">Sem itens detalhados nas vendas dela.</div>

        <div v-if="comboSel" class="gn-combo-card">
          <div class="gn-combo-tit"><i class="fas fa-gift"></i> Combo sugerido</div>
          <div class="gn-combo-itens">
            <span v-for="i in comboSel.itens" :key="i.nome" class="gn-combo-item">{{ i.qty }} {{ i.nome }}<small v-if="i.detalhe"> · {{ i.detalhe }}</small></span>
          </div>
          <div class="gn-combo-preco">
            <b>{{ R$(comboSel.precoCombo) }}</b>
            <small v-if="comboSel.desconto > 0">de {{ R$(comboSel.precoCheio) }} · economia de {{ R$(comboSel.desconto) }}</small>
            <small v-else>o mesmo valor, já fechado</small>
          </div>
          <div v-if="comboSel.margem !== null" class="gn-combo-margem">Sobra ≈ {{ comboSel.margem }}% para você</div>
          <button type="button" class="gn-btn-wa" @click="abrirWhats(comboSel.texto)"><i class="fab fa-whatsapp"></i> Oferecer no WhatsApp</button>
        </div>

        <button v-if="selecionado.saldoAtrasado > 0" type="button" class="gn-btn-cobrar" @click="cobrarWhats(selecionado)">
          <i class="fab fa-whatsapp"></i> Lembrar de {{ R$(selecionado.saldoAtrasado) }} em atraso
        </button>

        <div class="gn-sub">Minhas anotações sobre ela</div>
        <div class="gn-tags">
          <button v-for="t in TAGS" :key="t.id" type="button" class="gn-tag" :class="[{ ativo: formPerfil === t.id }, 'st-' + t.cor]" @click="formPerfil = formPerfil === t.id ? '' : t.id">
            <i class="fas" :class="t.icone"></i> {{ t.nome }}
          </button>
        </div>
        <textarea v-model="formObs" class="input gn-obs" rows="4" maxlength="600"
          placeholder="Ex.: sempre promete pagar na sexta e some; só compra se tiver brinde; paga em dinheiro no dia 5…"></textarea>
        <p class="gn-dica">Só você vê isto. O app já classifica sozinho pelo histórico; sua marcação manual tem prioridade.</p>
        <button type="button" class="btn btn-primary btn-full" :disabled="salvando" @click="salvarAnotacao"><i class="fas fa-check"></i> Salvar anotações</button>
      </div>
    </BaseModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useStore } from '../store.js'
import { R$ as numeroBR } from '../utils.js'
import { db } from '../db.js'
import BaseModal from './BaseModal.vue'
import { fmtBR, hoje, iniciais, getLojas } from '../composables/useCaderneta.js'
import { urlWhatsapp } from '../services/contatoService.js'
import { conciliar } from '../modules/conciliacao.js'
import { analisarSaude } from '../modules/saudeFinanceira.js'
import { carregarAtribuicoesDas } from '../composables/useDasAtribuicoes.js'
import {
  criarCustoDoItem, analisarClientes, clientesQueSumiram, analisarProdutos, produtosDoCliente,
  comboParaCliente, combosFrequentes, resumoDoMes, analisarLojas, proximosPassos,
  ROTULO_STATUS, ROTULO_GRUPO,
} from '../modules/guiaNegocio.js'

// R$ do app devolve só o número formatado; aqui sempre queremos o símbolo
const R$ = (v) => 'R$ ' + numeroBR(v)

const props = defineProps({ secao: { type: String, default: 'tudo' } }) // 'resumo' | 'clientes' | 'produtos' | 'tudo'
const emit = defineEmits(['secao'])
const mostra = (nome) => props.secao === 'tudo' || props.secao === nome

const s = useStore()
const carregando = ref(true)
const fiados = ref([])
const clientesBase = ref([])
const lojasBase = ref([])
const entradasExtrato = ref([])
const financeiroTodos = ref([])
const dasAtribuicoes = ref({})

async function carregar() {
  try {
    const [f, c, l, fin] = await Promise.all([db.cad_fiados.toArray(), db.cad_clientes.toArray(), getLojas({ incluirArquivadas: true }), db.financeiro.toArray()])
    fiados.value = f; clientesBase.value = c; lojasBase.value = l
    financeiroTodos.value = fin
    dasAtribuicoes.value = await carregarAtribuicoesDas()
    entradasExtrato.value = fin.filter(e => e.categoria === 'Receita de Vendas' && Number(e.valor) > 0)
  } catch (e) { console.error('Guia: não deu para ler as vendas', e) }
  finally { carregando.value = false }
}
onMounted(carregar)
// A aba fica montada; recarrega sempre que a pessoa volta para ela (vendas novas, sync…)
watch(() => s.tab, (t) => { if (t === 'inteligencia') carregar() })

// ── Custos das receitas (para "quanto sobra") ────────────────
const custoDoItem = computed(() => criarCustoDoItem(
  s.receitas.filter(r => !r.eh_intermediaria).map(r => ({
    uuid: r.uuid, nome: r.nome, categoria: r.categoria, tamanho: r.tamanho,
    custoUnit: s.getCustoTotal(r) / (r.rendimento || 1),
  }))
))

const hojeIso = computed(() => hoje())
const metaRetirada = computed(() => Number(s.company?.meta_salario_mensal || 0))
const nomeMes = computed(() => new Date(hojeIso.value + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' }))

// ── Análises ─────────────────────────────────────────────────
const mes = computed(() => resumoDoMes({ fiados: fiados.value, custoDoItem: custoDoItem.value, hoje: hojeIso.value }))
const analise = computed(() => analisarClientes({ fiados: fiados.value, clientes: clientesBase.value, lojas: lojasBase.value, hoje: hojeIso.value }))
const sumiram = computed(() => clientesQueSumiram(analise.value))
const produtos = computed(() => analisarProdutos({ fiados: fiados.value, custoDoItem: custoDoItem.value, hoje: hojeIso.value }))
const combosJuntos = computed(() => combosFrequentes(fiados.value))
// Quem paga à vista (vem do extrato: Pix que não são pagamento de nenhum fiado)
const pagadoresAvista = computed(() => conciliar({ entradas: entradasExtrato.value, fiados: fiados.value, clientes: clientesBase.value, hoje: hojeIso.value }).pagadoresAvista.slice(0, 5))
const lojasAnalise = computed(() => analisarLojas({ fiados: fiados.value, lojas: lojasBase.value, hoje: hojeIso.value }))
// Alertas de caixa: DAS, fôlego dos próximos 30 dias e custo real (vêm do extrato)
const saude = computed(() => analisarSaude({
  financeiro: financeiroTodos.value, fiados: fiados.value, relatorio: s.relatorioMensalMei, producoes: s.producoes,
  receitas: s.receitas.map(r => ({ uuid: r.uuid, intermediaria: !!r.eh_intermediaria, custoUnit: s.getCustoTotal(r) / (r.rendimento || 1), preco: Number(r.preco_sugerido || 0) })),
  hoje: hojeIso.value, metaRetirada: metaRetirada.value, dasAtribuicoes: dasAtribuicoes.value,
}))
const passos = computed(() => proximosPassos({
  extras: saude.value.passos,
  resumo: mes.value, clientes: analise.value, produtos: produtos.value, sumiram: sumiram.value,
  metaRetirada: metaRetirada.value, comboDe: (c) => comboParaCliente(c, custoDoItem.value),
}))

// ── Clientes: filtros e lista ────────────────────────────────
const filtroCliente = ref('atencao')
const ativos = computed(() => analise.value.filter(c => !c.arquivado))
const idsSumiram = computed(() => new Set(sumiram.value.map(c => c.id)))
const ordemRisco = { problema: 0, atencao: 1, novo: 2, bom: 3 }
const filtrosClientes = computed(() => [
  { id: 'atrasados', nome: 'Devendo', n: ativos.value.filter(c => c.saldoAtrasado > 0).length },
  { id: 'atencao', nome: 'Atenção', n: ativos.value.filter(c => c.status === 'atencao' || c.status === 'problema').length },
  { id: 'bons', nome: 'Bons pagadores', n: ativos.value.filter(c => c.status === 'bom').length },
  { id: 'sumiram', nome: 'Sumiram', n: sumiram.value.length },
  { id: 'todos', nome: 'Todos', n: ativos.value.length },
])
const clientesFiltrados = computed(() => {
  const l = ativos.value
  switch (filtroCliente.value) {
    case 'atrasados': return l.filter(c => c.saldoAtrasado > 0).sort((a, b) => b.saldoAtrasado - a.saldoAtrasado)
    case 'atencao': return l.filter(c => c.status === 'atencao' || c.status === 'problema').sort((a, b) => ordemRisco[a.status] - ordemRisco[b.status] || b.saldoAberto - a.saldoAberto)
    case 'bons': return l.filter(c => c.status === 'bom').sort((a, b) => b.totalComprado - a.totalComprado)
    case 'sumiram': return sumiram.value
    default: return [...l].sort((a, b) => ordemRisco[a.status] - ordemRisco[b.status] || b.totalComprado - a.totalComprado)
  }
})
const textoNenhumCliente = computed(() => ({
  atrasados: 'Ninguém está devendo além do prazo. 🎉',
  atencao: 'Nenhum cliente com histórico preocupante por enquanto.',
  bons: 'Ainda não há clientes com histórico suficiente para chamar de bom pagador.',
  sumiram: 'Ninguém parou de comprar além do ritmo normal.',
  todos: 'Nenhum cliente com vendas ainda.',
}[filtroCliente.value]))

function linhaCliente(c) {
  if (filtroCliente.value === 'sumiram') return `Última compra há ${c.diasSemComprar} dias · já comprou ${R$(c.totalComprado)}`
  if (c.saldoAtrasado > 0) return `Vencido há ${c.diasAtrasoAtual} ${c.diasAtrasoAtual === 1 ? 'dia' : 'dias'}`
  if (c.pctEmDia !== null && c.status !== 'novo') return `${c.pctEmDia}% das compras pagas no prazo · ${c.compras} ${c.compras === 1 ? 'compra' : 'compras'}`
  return `${c.compras} ${c.compras === 1 ? 'compra' : 'compras'} · ${R$(c.totalComprado)}`
}

// ── Produtos: filtros ────────────────────────────────────────
const filtroProduto = ref('todos')
const destaqueProduto = ref('')
const GRUPOS = [
  { id: 'todos', nome: 'Todos' }, { id: 'chefe', nome: 'Carro-chefe' }, { id: 'divulgar', nome: 'Divulgar mais' },
  { id: 'reajustar', nome: 'Reajustar preço' }, { id: 'repensar', nome: 'Repensar' },
]
const filtrosProdutos = computed(() => GRUPOS.map(g => ({ ...g, n: g.id === 'todos' ? 0 : produtos.value.filter(p => p.grupo === g.id).length })))
const produtosFiltrados = computed(() => filtroProduto.value === 'todos' ? produtos.value : produtos.value.filter(p => p.grupo === filtroProduto.value))

// ── Listas curtas: mostra as primeiras e deixa "ver mais" ─────
const LIMITE_LISTA = 6
const verTodosClientes = ref(false)
const verTodosProdutos = ref(false)
watch(filtroCliente, () => { verTodosClientes.value = false })
watch(filtroProduto, () => { verTodosProdutos.value = false })
const clientesVisiveis = computed(() => verTodosClientes.value ? clientesFiltrados.value : clientesFiltrados.value.slice(0, LIMITE_LISTA))
const produtosVisiveis = computed(() => verTodosProdutos.value ? produtosFiltrados.value : produtosFiltrados.value.slice(0, LIMITE_LISTA))

// ── Matriz de produtos: quanto vende × quanto sobra ──────────
const pontoSel = ref('')
const matriz = computed(() => {
  const itens = produtos.value.filter(p => p.margem !== null && p.qtd > 0)
  if (itens.length < 3) return null
  const w = 340, h = 232, L = 36, T = 8, W = 296, H = 190
  const maxQ = Math.max(...itens.map(p => p.qtd)) * 1.12
  const qs = itens.map(p => p.qtd).sort((a, b) => a - b)
  const med = qs.length % 2 ? qs[(qs.length - 1) / 2] : (qs[qs.length / 2 - 1] + qs[qs.length / 2]) / 2
  const limQtd = Math.max(3, med)
  const limMargem = 35
  const yMax = Math.max(70, Math.ceil((Math.max(...itens.map(p => p.margem)) + 5) / 10) * 10)
  const yMin = Math.min(0, Math.floor((Math.min(...itens.map(p => p.margem)) - 5) / 10) * 10)
  const X = (q) => L + Math.min(1, q / maxQ) * W
  const Y = (m) => T + H - ((Math.min(yMax, Math.max(yMin, m)) - yMin) / (yMax - yMin)) * H
  const maxF = Math.max(...itens.map(p => p.faturamento)) || 1
  const topNomes = new Set([...itens].sort((a, b) => b.faturamento - a.faturamento).slice(0, 4).map(p => p.chave))
  const pontos = itens.map(p => ({
    chave: p.chave, grupo: p.grupo, x: X(p.qtd), y: Y(p.margem), r: 4 + 7 * Math.sqrt(p.faturamento / maxF),
    rotulo: topNomes.has(p.chave), curto: p.nome.length > 14 ? p.nome.slice(0, 13) + '…' : p.nome,
  }))
  return { w, h, L, T, W, H, xThr: X(limQtd), yThr: Y(limMargem), limMargem, yMax, yMin, pontos }
})
const pontoSelecionado = computed(() => produtos.value.find(p => p.chave === pontoSel.value) || null)
function selecionarPonto(chave) { pontoSel.value = pontoSel.value === chave ? '' : chave }

// ── Ficha do cliente ─────────────────────────────────────────
const selecionadoId = ref(null)
const formPerfil = ref('')
const formObs = ref('')
const salvando = ref(false)
const TAGS = [
  { id: 'confiavel', nome: 'Confiável', icone: 'fa-circle-check', cor: 'bom' },
  { id: 'enrola', nome: 'Enrola', icone: 'fa-hourglass-half', cor: 'atencao' },
  { id: 'evitar', nome: 'Evitar fiado', icone: 'fa-ban', cor: 'problema' },
]
const selecionado = computed(() => analise.value.find(c => c.id === selecionadoId.value) || null)
const produtosSel = computed(() => selecionado.value ? produtosDoCliente(selecionado.value) : [])
const comboSel = computed(() => selecionado.value ? comboParaCliente(selecionado.value, custoDoItem.value) : null)

function abrirCliente(c) {
  selecionadoId.value = c.id
  formPerfil.value = c.perfilManual || ''
  formObs.value = c.obs || ''
}
async function salvarAnotacao() {
  if (!selecionado.value || salvando.value) return
  salvando.value = true
  try {
    await db.cad_clientes.update(selecionado.value.id, { perfilManual: formPerfil.value || '', obs: formObs.value.trim() })
    s.syncImediato()
    s.notify('Anotações salvas!')
    await carregar()
  } catch (e) {
    console.error(e); s.notify('Não deu para salvar. Tenta de novo?', 'error')
  } finally { salvando.value = false }
}

function abrirWhats(texto, telefone = selecionado.value?.telefone) {
  window.open(urlWhatsapp(telefone, texto), '_blank')
}
function cobrarWhats(c) {
  const primeiro = c.nome.trim().split(/\s+/)[0]
  const valor = R$(c.saldoAtrasado)
  abrirWhats(`Oi ${primeiro}, tudo bem? Passando só para lembrar do valor de ${valor} que ficou combinado e já venceu. Consegue me acertar hoje? Obrigada! 😊`, c.telefone)
}

// ── Ações dos passos ─────────────────────────────────────────
function rolarPara(id) { nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
function executarAcao(a) {
  if (a.tipo === 'filtro') { filtroCliente.value = a.filtro; emit('secao', 'clientes'); rolarPara('gn-clientes') }
  else if (a.tipo === 'cliente') { const c = analise.value.find(x => x.id === a.clienteId); if (c) abrirCliente(c) }
  else if (a.tipo === 'produto') { filtroProduto.value = 'todos'; destaqueProduto.value = a.chave; pontoSel.value = a.chave; emit('secao', 'produtos'); rolarPara('gn-produtos'); setTimeout(() => { destaqueProduto.value = '' }, 2500) }
  else if (a.tipo === 'meta') { emit('secao', 'resumo'); rolarPara('gn-mes') }
  else if (a.tipo === 'receitas') s.setTab('receitas')
  else if (a.tipo === 'financeiro') s.setTab('financeiro')
}
</script>

<style scoped>
.gn-bloco { margin-bottom: 16px; }
.gn-titulo { display: flex; align-items: center; gap: 6px; padding: 0 2px; margin-bottom: 8px; font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.gn-dica { margin: 4px 2px 10px; font-size: .78rem; color: var(--muted); line-height: 1.45; }
.gn-nada { padding: 18px 14px; text-align: center; font-size: .85rem; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--r-md); }
.gn-vazio { text-align: center; padding: 36px 20px; color: var(--muted); }
.gn-vazio i { font-size: 34px; color: var(--gold-dark); margin-bottom: 10px; }
.gn-vazio b { display: block; color: var(--brown-dark); font-size: 1rem; margin-bottom: 6px; }
.gn-vazio p { font-size: .85rem; line-height: 1.5; margin: 0; }
.red { color: var(--red); } .verde { color: var(--green); } .amarelo { color: var(--orange); } .mudo { color: var(--muted); }

/* Mês */
.gn-kpi { padding: 14px; border-radius: var(--r-md); color: #fff; background: linear-gradient(135deg, var(--brown-dark), var(--brown)); box-shadow: var(--shadow); }
.gn-kpi-topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.gn-kpi-rot { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.7); }
.gn-kpi-val { margin-top: 2px; font-family: var(--mono); font-size: 28px; font-weight: 800; line-height: 1.1; }
.gn-kpi-pilulas { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.gn-pilula { padding: 2px 9px; border-radius: 999px; background: rgba(255,255,255,.14); font-size: 11.5px; color: rgba(255,255,255,.85); white-space: nowrap; }
.gn-pilula b { font-family: var(--mono); color: #fff; }
.gn-kpi-comp { margin-top: 8px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.gn-kpi-comp.sobe { color: #b9f0c4; } .gn-kpi-comp.desce { color: #ffd0c4; }
.gn-kpi-trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.gn-kpi-sub { padding: 7px 9px; border-radius: var(--r-sm); background: rgba(255,255,255,.1); min-width: 0; }
.gn-kpi-sub span { display: block; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.7); }
.gn-kpi-sub b { font-family: var(--mono); font-size: 14px; }
.gn-kpi-sub.alerta { background: var(--red); }
.gn-lucro { margin-top: 10px; padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.gn-lucro-linha { display: flex; justify-content: space-between; align-items: center; font-size: .88rem; font-weight: 700; color: var(--brown-dark); }
.gn-lucro-linha i { color: var(--gold-dark); margin-right: 6px; }
.gn-lucro-linha b { font-family: var(--mono); font-size: 1.05rem; color: var(--green); }
.gn-barra { height: 8px; background: var(--cream-deep); border-radius: 99px; margin: 8px 0 4px; overflow: hidden; }
.gn-barra-fill { height: 100%; background: var(--green); border-radius: 99px; transition: width .4s; }
.gn-lucro-meta { font-size: .76rem; color: var(--muted); }
.gn-aviso { margin-top: 8px; font-size: .76rem; color: var(--muted); display: flex; gap: 6px; align-items: flex-start; }

/* Passos */
.gn-passos { display: flex; flex-direction: column; gap: 10px; }
.gn-passo { display: flex; gap: 12px; padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); border-left-width: 4px; }
.gn-passo.u-alta { border-left-color: var(--red); } .gn-passo.u-media { border-left-color: var(--orange); } .gn-passo.u-baixa { border-left-color: var(--gold-dark); }
.gn-passo-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: var(--cream-deep); color: var(--brown-dark); display: grid; place-items: center; font-weight: 800; font-size: .8rem; }
.gn-passo-corpo { min-width: 0; flex: 1; }
.gn-passo-titulo { font-size: .95rem; font-weight: 800; color: var(--brown-dark); line-height: 1.3; }
.gn-passo-texto { margin-top: 3px; font-size: .82rem; color: var(--muted); line-height: 1.5; }
.gn-passo-btn { margin-top: 8px; padding: 7px 12px; border: 1.5px solid var(--border); border-radius: var(--r-full); background: var(--bg); color: var(--brown); font-family: var(--font); font-size: .78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.gn-passo-btn:active { background: var(--cream-deep); }

/* Chips e listas */
.gn-chips { display: flex; gap: 8px; overflow-x: auto; padding: 0 0 10px; scrollbar-width: none; -ms-overflow-style: none; }
.gn-chips::-webkit-scrollbar { display: none; }
.gn-chip-n { margin-left: 6px; padding: 0 6px; border-radius: 99px; background: rgba(0,0,0,.08); font-size: .7rem; }
.chip.ativo .gn-chip-n { background: rgba(255,255,255,.25); }
.gn-lista { display: flex; flex-direction: column; gap: 8px; }
.gn-cli { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 11px 12px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); cursor: pointer; font-family: var(--font); }
.gn-cli:active { background: var(--cream); }
.gn-avatar { flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: .85rem; background: var(--cream-deep); color: var(--brown-dark); }
.gn-avatar.grande { width: 52px; height: 52px; font-size: 1rem; }
.gn-avatar.st-bom { background: var(--green-bg); color: var(--green); }
.gn-avatar.st-atencao { background: var(--orange-bg); color: var(--orange); }
.gn-avatar.st-problema { background: #FCEBEB; color: var(--red); }
.gn-cli-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gn-cli-nome { font-size: .95rem; font-weight: 800; color: var(--brown-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gn-cli-nome small { font-weight: 600; color: var(--muted); }
.gn-cli-linha { font-size: .78rem; color: var(--muted); }
.gn-cli-obs { font-size: .74rem; color: var(--brown-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gn-cli-obs i { font-size: .65rem; margin-right: 3px; color: var(--gold-dark); }
.gn-cli-dir { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.gn-cli-dir b { font-family: var(--mono); font-size: .85rem; color: var(--brown-dark); }
.gn-badge { padding: 2px 9px; border-radius: 99px; font-size: .68rem; font-weight: 800; white-space: nowrap; background: var(--cream-deep); color: var(--brown-mid); }
.gn-badge.st-bom { background: var(--green-bg); color: var(--green); }
.gn-badge.st-atencao { background: var(--orange-bg); color: var(--orange); }
.gn-badge.st-problema { background: #FCEBEB; color: var(--red); }

/* Produtos */
.gn-prod { padding: 11px 13px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); transition: border-color .3s, background .3s; }
.gn-prod.destaque { border-color: var(--gold-dark); background: var(--cream); }
.gn-prod-topo { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.gn-prod-nome { font-weight: 800; font-size: .95rem; color: var(--brown-dark); }
.gn-grupo { padding: 2px 9px; border-radius: 99px; font-size: .66rem; font-weight: 800; white-space: nowrap; background: var(--cream-deep); color: var(--brown-mid); }
.gn-grupo.g-chefe { background: var(--green-bg); color: var(--green); }
.gn-grupo.g-divulgar { background: #E6F1FB; color: #185FA5; }
.gn-grupo.g-reajustar { background: var(--orange-bg); color: var(--orange); }
.gn-grupo.g-repensar { background: #FCEBEB; color: var(--red); }
.gn-prod-nums { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .8rem; color: var(--muted); }
.gn-prod-nums b { font-family: var(--mono); }
.gn-prod-dica { margin-top: 7px; padding: 7px 10px; border-radius: var(--r-sm); background: var(--cream); font-size: .78rem; color: var(--brown-dark); }
.gn-prod-dica i { color: var(--gold-dark); margin-right: 4px; }
.gn-combos { margin-top: 14px; }
.gn-sub { margin: 14px 2px 6px; font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.gn-combo-par { padding: 8px 12px; margin-bottom: 6px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); font-size: .85rem; font-weight: 700; color: var(--brown-dark); }
.gn-combo-par i { color: var(--gold-dark); margin-right: 6px; } .gn-combo-par small { color: var(--muted); font-weight: 600; margin-left: 6px; }

/* Pontos */
.gn-loja { padding: 10px 13px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); }
.gn-loja-nome { font-weight: 800; color: var(--brown-dark); font-size: .92rem; }
.gn-loja-nums { margin-top: 2px; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .8rem; color: var(--muted); }
.gn-loja-nums b { font-family: var(--mono); color: var(--brown-dark); }

/* Ficha */
.gn-ficha { padding: 16px 16px max(32px, calc(24px + env(safe-area-inset-bottom))); display: flex; flex-direction: column; gap: 4px; }
.gn-ficha-topo { display: flex; align-items: center; gap: 12px; }
.gn-ficha-sub { margin-top: 4px; font-size: .82rem; color: var(--muted); }
.gn-conselho { margin-top: 10px; padding: 10px 12px; border-radius: var(--r-md); font-size: .86rem; font-weight: 700; line-height: 1.4; background: var(--cream-deep); color: var(--brown-dark); }
.gn-conselho i { margin-right: 6px; }
.gn-conselho.st-bom { background: var(--green-bg); color: var(--green); }
.gn-conselho.st-atencao { background: var(--orange-bg); color: var(--orange); }
.gn-conselho.st-problema { background: #FCEBEB; color: var(--red); }
.gn-ficha-num { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; }
.gn-ficha-num div { padding: 8px 10px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-sm); }
.gn-ficha-num span { display: block; font-size: .68rem; font-weight: 800; text-transform: uppercase; color: var(--muted); }
.gn-ficha-num b { font-family: var(--mono); font-size: .95rem; color: var(--brown-dark); }
.gn-fatos { margin: 0 0 6px; padding-left: 18px; font-size: .84rem; color: var(--brown-dark); line-height: 1.55; }
.gn-hist { display: flex; flex-direction: column; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
.gn-hist-linha { display: grid; grid-template-columns: 78px 1fr auto; gap: 8px; padding: 8px 12px; font-size: .8rem; border-bottom: 1px solid var(--border); }
.gn-hist-linha:last-child { border-bottom: 0; }
.gn-hist-linha span:nth-child(2) { font-family: var(--mono); }
.gn-hist-linha span:last-child { font-weight: 700; text-align: right; }
.gn-levou { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
.gn-levou-linha { display: flex; justify-content: space-between; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border); font-size: .86rem; }
.gn-levou-linha:last-child { border-bottom: 0; }
.gn-levou-nome { font-weight: 700; color: var(--brown-dark); }
.gn-levou-nome small.gn-levou-det { display: block; font-weight: 500; font-size: .74rem; color: var(--muted); }
.gn-combo-item small { font-weight: 500; color: var(--muted); }
.gn-levou-qtd { font-family: var(--mono); font-weight: 700; white-space: nowrap; }
.gn-levou-qtd small { font-family: var(--font); font-weight: 500; color: var(--muted); }
.gn-combo-card { margin-top: 12px; padding: 12px 14px; background: var(--cream); border: 1.5px solid var(--gold); border-radius: var(--r-md); }
.gn-combo-tit { font-size: .74rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--gold-dark); }
.gn-combo-itens { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.gn-combo-item { padding: 4px 10px; background: #fff; border: 1px solid var(--border); border-radius: 99px; font-size: .82rem; font-weight: 700; color: var(--brown-dark); }
.gn-combo-preco b { font-family: var(--mono); font-size: 1.3rem; color: var(--brown-dark); }
.gn-combo-preco small { display: block; font-size: .76rem; color: var(--muted); }
.gn-combo-margem { margin-top: 4px; font-size: .76rem; color: var(--green); font-weight: 700; }
.gn-btn-wa, .gn-btn-cobrar { margin-top: 10px; width: 100%; min-height: 46px; border: 0; border-radius: var(--r-md); font-family: var(--font); font-weight: 800; font-size: .9rem; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; color: #fff; background: #25a244; }
.gn-btn-cobrar { margin-top: 12px; background: var(--brown); }
.gn-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.gn-tag { padding: 8px 14px; border-radius: 99px; border: 1.5px solid var(--border); background: var(--surface); font-family: var(--font); font-size: .8rem; font-weight: 700; color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.gn-tag.ativo.st-bom { background: var(--green); border-color: var(--green); color: #fff; }
.gn-tag.ativo.st-atencao { background: var(--orange); border-color: var(--orange); color: #fff; }
.gn-tag.ativo.st-problema { background: var(--red); border-color: var(--red); color: #fff; }
.gn-obs { width: 100%; resize: vertical; font-family: var(--font); }

/* Ver mais */
.gn-mais { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 10px; padding: 11px; border: 1.5px dashed var(--border); border-radius: var(--r-md); background: transparent; font-family: var(--font); font-size: .82rem; font-weight: 700; color: var(--brown); cursor: pointer; }
.gn-mais i { font-size: .7rem; }

/* Matriz de produtos */
.gn-matriz { margin-bottom: 12px; padding: 10px 10px 12px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.gn-matriz-svg { display: block; width: 100%; height: auto; font-family: var(--font); }
.gn-matriz-svg .q { opacity: .1; }
.gn-matriz-svg .q-chefe { fill: var(--green); } .gn-matriz-svg .q-divulgar { fill: #185FA5; }
.gn-matriz-svg .q-reajustar { fill: var(--orange); } .gn-matriz-svg .q-repensar { fill: var(--red); }
.gn-matriz-svg .qt { font-size: 9.5px; font-weight: 800; fill: var(--muted); }
.gn-matriz-svg .ax { font-size: 9px; fill: var(--muted); }
.gn-matriz-svg .pt { cursor: pointer; }
.gn-matriz-svg .hit { fill: transparent; }
.gn-matriz-svg .dot { fill: var(--muted); fill-opacity: .75; stroke: var(--surface); stroke-width: 1.5; }
.gn-matriz-svg .g-chefe .dot { fill: var(--green); } .gn-matriz-svg .g-divulgar .dot { fill: #185FA5; }
.gn-matriz-svg .g-reajustar .dot { fill: var(--orange); } .gn-matriz-svg .g-repensar .dot { fill: var(--red); }
.gn-matriz-svg .dot.sel { stroke: var(--brown-dark); stroke-width: 2.5; fill-opacity: 1; }
.gn-matriz-svg .lb { font-size: 9px; font-weight: 700; fill: var(--brown-dark); paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
.gn-matriz-dica { margin: 6px 2px 0; text-align: center; }
.gn-matriz-det { margin-top: 8px; padding: 9px 12px; background: var(--cream); border-radius: var(--r-sm); }
.gn-matriz-det-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.gn-matriz-det-topo b { font-size: .92rem; color: var(--brown-dark); }
.gn-matriz-det-nums { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 3px 14px; font-size: .8rem; color: var(--muted); }
.gn-matriz-det-nums b { font-family: var(--mono); }
</style>
