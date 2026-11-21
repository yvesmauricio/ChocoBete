<template>
  <div class="pc">
    <div v-if="!itens.length" class="pc-nada">Cadastre o preço e os ingredientes das receitas para ver aqui quanto cobrar.</div>

    <template v-else>
      <!-- ══ Resumo: quantos precisam de atenção ══ -->
      <div class="pc-resumo">
        <div class="pc-resumo-topo">
          <div class="pc-resumo-num" :class="{ ok: precisamAtencao === 0 }">{{ precisamAtencao }}<small>de {{ itens.length }}</small></div>
          <div class="pc-resumo-txt">
            <b v-if="precisamAtencao">{{ precisamAtencao === 1 ? 'produto com preço' : 'produtos com preço' }} abaixo do ideal</b>
            <b v-else>Todos os preços estão saudáveis</b>
            <span v-if="criticos">{{ criticos }} {{ criticos === 1 ? 'não cobre' : 'não cobrem' }} nem os custos.</span>
            <span v-else-if="precisamAtencao">Cobrem os custos, mas deixam pouca sobra para você.</span>
            <span v-else>Cada venda cobre custos, fiado e deixa sobra para você crescer.</span>
          </div>
        </div>
        <div class="pc-dist" role="img" :aria-label="`${criticos} críticos, ${aposApertado} apertados, ${saudaveis} saudáveis`">
          <span v-if="criticos" class="d-crit" :style="{ flexGrow: criticos }"></span>
          <span v-if="aposApertado" class="d-apert" :style="{ flexGrow: aposApertado }"></span>
          <span v-if="saudaveis" class="d-ok" :style="{ flexGrow: saudaveis }"></span>
        </div>
        <div class="pc-dist-leg">
          <span><i class="d-crit"></i> Não cobre os custos <b>{{ criticos }}</b></span>
          <span><i class="d-apert"></i> Sobra pouco <b>{{ aposApertado }}</b></span>
          <span><i class="d-ok"></i> Saudável <b>{{ saudaveis }}</b></span>
        </div>
      </div>

      <!-- ══ Como é calculado (recolhido por padrão) ══ -->
      <button type="button" class="pc-como-btn" :aria-expanded="comoAberto" @click="comoAberto = !comoAberto">
        <span><i class="fas fa-circle-question"></i> Como o preço é calculado</span>
        <i class="fas" :class="comoAberto ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
      </button>
      <div v-if="comoAberto" class="pc-base">
        <div class="pc-base-linhas">
          <div><i class="fas fa-bowl-food"></i> Ingredientes <small>custo de cada receita</small></div>
          <div>
            <i class="fas fa-house"></i> Custos fixos <b>{{ Math.round(base.fixosPct * 100) }}%</b>
            <small v-if="base.fonte === 'financeiro'">{{ R$(base.fixosMensais) }}/mês, do seu Financeiro</small>
            <small v-else>valor padrão — falta histórico no Financeiro</small>
          </div>
          <div>
            <i class="fas fa-user-clock"></i> Reserva para fiado <b>{{ Math.round(risco.pct * 100) }}%</b>
            <small>{{ risco.fonte === 'fiados' ? 'pelo que fica parado na caderneta' : 'valor padrão — pouco histórico' }}</small>
          </div>
          <div>
            <i class="fas fa-piggy-bank"></i> Para você e para crescer <b>{{ alvoPct }}%</b>
            <small>{{ base.metaRetirada > 0 ? 'sua meta de retirada ÷ faturamento' : 'defina a meta em Ajustes' }}</small>
          </div>
        </div>
        <div class="pc-leg-regua">
          <b>Régua de cada produto:</b>
          <span><i class="z-custo"></i> ingredientes</span>
          <span><i class="z-fora"></i> não cobre</span>
          <span><i class="z-meio"></i> sobra pouco</span>
          <span><i class="z-ok"></i> saudável</span>
          <span><i class="pin-leg"></i> seu preço</span>
        </div>
      </div>

      <!-- ══ Filtros + busca ══ -->
      <div class="pc-chips" role="group" aria-label="Filtrar produtos">
        <button v-for="f in filtros" :key="f.id" type="button" class="chip" :class="{ ativo: filtro === f.id }" @click="filtro = f.id">
          {{ f.nome }}<span class="pc-chip-n">{{ f.n }}</span>
        </button>
      </div>
      <label v-if="itens.length > 8" class="pc-busca">
        <i class="fas fa-magnifying-glass"></i>
        <input v-model="busca" type="search" placeholder="Buscar produto" autocomplete="off">
      </label>

      <div v-if="!visiveis.length" class="pc-nada">{{ busca ? 'Nenhum produto com esse nome.' : 'Nenhum produto neste grupo.' }}</div>

      <div v-else class="pc-lista">
        <div v-for="p in visiveis" :key="p.uuid" class="pc-item" :class="['s-' + p.status, { aberto: aberto === p.uuid }]">
          <button type="button" class="pc-item-topo" :aria-expanded="aberto === p.uuid" @click="alternar(p)">
            <span class="pc-item-info">
              <span class="pc-item-l1">
                <span class="pc-item-nome">{{ p.nome }}</span>
                <span class="pc-selo" :class="'s-' + p.status">{{ ROTULO_CURTO[p.status] }}</span>
              </span>
              <span class="pc-item-l2">
                Cobra <b>{{ R$(p.preco) }}</b>
                <template v-if="p.status !== 'ok' && !p.longe"> → certo <b class="certo">{{ R$(p.certo) }}</b></template>
                <template v-else-if="p.longe"> · custo pesa {{ Math.round((p.custoUnit / p.preco) * 100) }}%</template>
                <span class="sep">·</span> sobra <b :class="p.conta.sobra > 0 ? 'verde' : 'red'">{{ R$(p.conta.sobra) }}</b>
              </span>
              <!-- Régua: onde seu preço está entre o custo e o preço saudável -->
              <span class="pc-regua" aria-hidden="true">
                <i class="z-custo" :style="{ width: regua(p).c + '%' }"></i><i class="z-fora" :style="{ width: regua(p).f + '%' }"></i><i class="z-meio" :style="{ width: regua(p).m + '%' }"></i><i class="z-ok" :style="{ width: regua(p).o + '%' }"></i>
                <i class="pin" :style="{ left: regua(p).pin + '%' }"></i>
              </span>
            </span>
            <i class="fas pc-chev" :class="aberto === p.uuid ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>

          <div v-if="aberto === p.uuid" class="pc-det">
            <div class="pc-conta-tit">Para onde vai cada unidade vendida a {{ R$(contaAtual.preco) }}</div>
            <div class="pc-barra" aria-hidden="true">
              <span class="b-ingr" :style="{ width: parte(contaAtual.ingredientes) }"></span>
              <span class="b-fixo" :style="{ width: parte(contaAtual.fixos) }"></span>
              <span class="b-risco" :style="{ width: parte(contaAtual.risco) }"></span>
              <span class="b-sobra" :style="{ width: contaAtual.sobra > 0 ? parte(contaAtual.sobra) : '0%' }"></span>
            </div>
            <div class="pc-conta">
              <div><i class="d ingr"></i> Ingredientes <b>{{ R$(contaAtual.ingredientes) }}</b></div>
              <div><i class="d fixo"></i> Parte dos custos fixos <b>{{ R$(contaAtual.fixos) }}</b></div>
              <div><i class="d risco"></i> Reserva para fiado <b>{{ R$(contaAtual.risco) }}</b></div>
              <div class="sobra"><i class="d sobra"></i> Sobra para você e para crescer <b :class="contaAtual.sobra > 0 ? 'verde' : 'red'">{{ R$(contaAtual.sobra) }} ({{ contaAtual.sobraPct }}%)</b></div>
            </div>

            <div class="pc-teste">
              <label>E se eu cobrar</label>
              <div class="pc-teste-campo">
                <span>R$</span>
                <input type="text" inputmode="decimal" :value="testeTxt" @input="aoDigitar($event)" placeholder="0,00">
              </div>
            </div>

            <div v-if="p.longe" class="pc-alerta">
              <i class="fas fa-lightbulb"></i> Pela conta, o preço ideal seria {{ R$(p.certo) }} — alto demais para cobrar de uma vez.
              O custo da receita está pesando; vale olhar ingredientes, rendimento ou tamanho da porção, e subir o preço aos poucos.
            </div>

            <div v-if="p.efeitos.length" class="pc-efeitos">
              <div class="pc-efeitos-tit"><i class="fas fa-chart-line"></i> Quando você já subiu o preço</div>
              <div v-for="e in p.efeitos" :key="e.data" class="pc-efeito">
                De {{ R$(e.de) }} para {{ R$(e.para) }} (+{{ e.aumentoPct }}%): vendia {{ e.porSemanaAntes }} un/semana, passou a {{ e.porSemanaDepois }}
                <b v-if="e.variacaoPct !== null" :class="e.variacaoPct >= -10 ? 'verde' : 'red'">({{ e.variacaoPct >= 0 ? '+' : '' }}{{ e.variacaoPct }}%)</b>.
              </div>
              <p class="pc-dica">Se as vendas quase não mudaram, seus clientes aceitam bem ajustes.</p>
            </div>

            <div class="pc-acoes">
              <button v-if="p.passo" type="button" class="btn btn-primary btn-full" :disabled="salvando" @click="aplicar(p, p.passo)">
                <i class="fas fa-arrow-up"></i> Subir para {{ R$(p.passo) }} <small>(passo suave)</small>
              </button>
              <button v-if="p.passo && p.certo > p.passo && !p.longe" type="button" class="btn btn-secondary btn-full" :disabled="salvando" @click="aplicar(p, p.certo)">
                Ir direto ao preço certo ({{ R$(p.certo) }})
              </button>
              <button v-if="testePreco > 0 && Math.abs(testePreco - p.preco) > 0.001" type="button" class="btn btn-secondary btn-full" :disabled="salvando" @click="aplicar(p, testePreco)">
                Usar {{ R$(testePreco) }} na receita
              </button>
            </div>
            <p class="pc-dica">Preço mínimo para não perder dinheiro: <b>{{ R$(p.piso) }}</b>. Abaixo disso, cada venda fica no prejuízo depois dos custos fixos e do fiado.</p>
          </div>
        </div>
      </div>

      <button v-if="restantes > 0" type="button" class="pc-mais" @click="verTodos = true">
        Ver mais {{ restantes }} {{ restantes === 1 ? 'produto' : 'produtos' }} <i class="fas fa-chevron-down"></i>
      </button>
      <button v-else-if="verTodos && filtrados.length > LIMITE" type="button" class="pc-mais" @click="verTodos = false">
        Mostrar menos <i class="fas fa-chevron-up"></i>
      </button>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from '../store.js'
import { R$ as numeroBR } from '../utils.js'
import { db } from '../db.js'
import { hoje } from '../composables/useCaderneta.js'
import { useConfirm } from '../composables/useConfirm.js'
import { baseFinanceira, riscoFiado, listaPrecoCerto, contaDoPreco } from '../modules/precoCerto.js'

const R$ = (v) => 'R$ ' + numeroBR(v)
const s = useStore()
const confirm = useConfirm()
const LIMITE = 6
const ROTULO_CURTO = { prejuizo: 'Abaixo do custo', abaixo_piso: 'Não cobre custos', abaixo_alvo: 'Sobra pouco', ok: 'Saudável' }

const fiados = ref([])
const historicoPrecos = ref([])
async function carregar() {
  try {
    const [f, h] = await Promise.all([db.cad_fiados.toArray(), db.historico_precos_venda.toArray()])
    fiados.value = f; historicoPrecos.value = h
  } catch (e) { console.error('Preço certo: não deu para ler o histórico', e) }
}
onMounted(carregar)
watch(() => s.tab, (t) => { if (t === 'inteligencia') carregar() })

const metaRetirada = computed(() => Number(s.company?.meta_salario_mensal || 0))
const base = computed(() => baseFinanceira({ relatorio: s.relatorioMensalMei, hoje: hoje(), metaRetirada: metaRetirada.value }))
const risco = computed(() => riscoFiado({ fiados: fiados.value, hoje: hoje() }))
const receitasFinais = computed(() => s.receitas.filter(r => !r.eh_intermediaria).map(r => ({
  uuid: r.uuid, nome: r.nome, categoria: r.categoria,
  custoUnit: s.getCustoTotal(r) / (r.rendimento || 1), preco: Number(r.preco_sugerido || 0),
})))
const itens = computed(() => listaPrecoCerto({
  receitas: receitasFinais.value, base: base.value, risco: risco.value,
  fiados: fiados.value, historicoPrecos: historicoPrecos.value, hoje: hoje(),
}))
const criticos = computed(() => itens.value.filter(p => p.status === 'prejuizo' || p.status === 'abaixo_piso').length)
const aposApertado = computed(() => itens.value.filter(p => p.status === 'abaixo_alvo').length)
const saudaveis = computed(() => itens.value.filter(p => p.status === 'ok').length)
const precisamAtencao = computed(() => criticos.value + aposApertado.value)
const alvoPct = computed(() => itens.value[0]?.alvoPct ?? Math.round(Math.min(0.4, Math.max(0.15, base.value.retiradaPct + 0.05)) * 100))

// ── Filtros, busca e "ver mais" ──────────────────────────────
const comoAberto = ref(false)
const filtro = ref('atencao')
const busca = ref('')
const verTodos = ref(false)
const filtros = computed(() => [
  { id: 'atencao', nome: 'Atenção', n: precisamAtencao.value },
  { id: 'ok', nome: 'Saudáveis', n: saudaveis.value },
  { id: 'todos', nome: 'Todos', n: itens.value.length },
])
// Se não há nada com problema, abre direto em "Todos"
watch(precisamAtencao, (n) => { if (n === 0 && filtro.value === 'atencao') filtro.value = 'todos' }, { immediate: true })
watch([filtro, busca], () => { verTodos.value = false })
const filtrados = computed(() => {
  let l = itens.value
  if (filtro.value === 'atencao') l = l.filter(p => p.status !== 'ok')
  else if (filtro.value === 'ok') l = l.filter(p => p.status === 'ok')
  const q = busca.value.trim().toLowerCase()
  return q ? l.filter(p => p.nome.toLowerCase().includes(q)) : l
})
const visiveis = computed(() => verTodos.value || busca.value ? filtrados.value : filtrados.value.slice(0, LIMITE))
const restantes = computed(() => (verTodos.value || busca.value) ? 0 : Math.max(0, filtrados.value.length - LIMITE))

// ── Régua: custo | não cobre | sobra pouco | saudável, com o preço atual marcado ──
function regua(p) {
  const certo = p.longe ? Infinity : p.certo
  const fim = Math.max(p.preco * 1.45, p.piso * 1.25, p.longe ? 0 : p.certo * 1.1)
  const pct = (v) => Math.max(0, Math.min(100, (v / fim) * 100))
  const c = pct(Math.min(p.custoUnit, fim))
  const f = Math.max(0, pct(p.piso) - c)
  const fimMeio = Math.min(pct(certo), 100)
  const m = Math.max(0, fimMeio - pct(p.piso))
  const o = Math.max(0, 100 - c - f - m)
  return { c, f, m, o, pin: pct(p.preco) }
}

// ── Detalhe aberto + "e se eu cobrar" ───────────────────────
const aberto = ref(null)
const testePreco = ref(0)
const testeTxt = ref('')
const salvando = ref(false)
function alternar(p) {
  if (aberto.value === p.uuid) { aberto.value = null; return }
  aberto.value = p.uuid
  testePreco.value = p.preco
  testeTxt.value = String(p.preco).replace('.', ',')
}
function aoDigitar(e) {
  testeTxt.value = e.target.value.replace(/[^\d,.]/g, '')
  const n = Number(testeTxt.value.replace(/\./g, '').replace(',', '.'))
  testePreco.value = Number.isFinite(n) ? n : 0
}
const produtoAberto = computed(() => itens.value.find(p => p.uuid === aberto.value) || null)
const contaAtual = computed(() => {
  const p = produtoAberto.value
  if (!p) return { preco: 0, ingredientes: 0, fixos: 0, risco: 0, sobra: 0, sobraPct: 0 }
  return contaDoPreco(testePreco.value > 0 ? testePreco.value : p.preco, { custoUnit: p.custoUnit, base: base.value, riscoPct: risco.value.pct })
})
// largura de cada fatia da barra (nunca passa de 100%)
const parte = (v) => `${Math.max(0, Math.min(100, (v / (contaAtual.value.preco || 1)) * 100)).toFixed(1)}%`

async function aplicar(p, novoPreco) {
  const r = s.receitas.find(x => x.uuid === p.uuid)
  if (!r || salvando.value) return
  const ok = await confirm.ask(
    `Mudar o preço de "${r.nome}" de ${R$(p.preco)} para ${R$(novoPreco)}? O novo preço vale nos cálculos e no cardápio.`,
    { title: 'Atualizar preço', confirmLabel: 'Atualizar', type: 'primary' }
  )
  if (!ok) return
  salvando.value = true
  try {
    await s.salvarReceita({ ...r, preco_sugerido: Math.round(novoPreco * 100) / 100 })
    s.notify('Preço atualizado!')
    aberto.value = null
  } catch (e) {
    console.error(e); s.notify('Não deu para atualizar o preço.', 'error')
  } finally { salvando.value = false }
}
</script>

<style scoped>
.pc { margin-bottom: 16px; }
.pc-nada { padding: 18px 14px; text-align: center; font-size: .85rem; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--r-md); }
.verde { color: var(--green); } .red { color: var(--red); }

/* Resumo */
.pc-resumo { padding: 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.pc-resumo-topo { display: flex; align-items: center; gap: 14px; }
.pc-resumo-num { flex-shrink: 0; min-width: 62px; text-align: center; font-family: var(--mono); font-size: 2rem; font-weight: 800; line-height: 1; color: var(--orange); }
.pc-resumo-num.ok { color: var(--green); }
.pc-resumo-num small { display: block; margin-top: 3px; font-family: var(--font); font-size: .66rem; font-weight: 700; color: var(--muted); }
.pc-resumo-txt { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pc-resumo-txt b { font-size: .95rem; color: var(--brown-dark); line-height: 1.3; }
.pc-resumo-txt span { font-size: .78rem; color: var(--muted); line-height: 1.4; }
.pc-dist { display: flex; gap: 3px; height: 10px; margin-top: 12px; }
.pc-dist span { display: block; height: 100%; border-radius: 99px; min-width: 8px; }
.pc-dist-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: .72rem; color: var(--muted); }
.pc-dist-leg span { display: inline-flex; align-items: center; gap: 5px; }
.pc-dist-leg b { font-family: var(--mono); color: var(--brown-dark); }
.pc-dist-leg i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.d-crit { background: var(--red); } .d-apert { background: var(--orange); } .d-ok { background: var(--green); }

/* Como é calculado */
.pc-como-btn { width: 100%; margin-top: 10px; padding: 11px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); font-family: var(--font); font-size: .82rem; font-weight: 700; color: var(--brown); cursor: pointer; }
.pc-como-btn i { color: var(--gold-dark); } .pc-como-btn > i { color: var(--muted); font-size: .7rem; }
.pc-base { margin-top: 8px; padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); }
.pc-base-linhas { display: flex; flex-direction: column; gap: 6px; font-size: .84rem; color: var(--brown-dark); line-height: 1.35; }
.pc-base-linhas i { width: 18px; color: var(--gold-dark); text-align: center; }
.pc-base-linhas b { font-family: var(--mono); margin-left: 4px; }
.pc-base-linhas small { display: block; margin-left: 22px; font-size: .74rem; color: var(--muted); }
.pc-leg-regua { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: .72rem; color: var(--muted); align-items: center; }
.pc-leg-regua b { color: var(--brown-dark); }
.pc-leg-regua span { display: inline-flex; align-items: center; gap: 5px; }
.pc-leg-regua i { width: 14px; height: 6px; border-radius: 3px; display: inline-block; }
.pc-leg-regua i.pin-leg { width: 3px; height: 12px; background: var(--brown-dark); border-radius: 2px; }

/* Filtros */
.pc-chips { display: flex; gap: 8px; margin: 14px 0 10px; overflow-x: auto; scrollbar-width: none; }
.pc-chips::-webkit-scrollbar { display: none; }
.pc-chip-n { margin-left: 6px; padding: 0 6px; border-radius: 99px; background: rgba(0,0,0,.08); font-size: .7rem; }
.chip.ativo .pc-chip-n { background: rgba(255,255,255,.25); }
.pc-busca { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 0 12px; height: 42px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); }
.pc-busca i { color: var(--muted); font-size: .8rem; }
.pc-busca input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font-family: var(--font); font-size: .9rem; color: var(--brown-dark); }

/* Lista */
.pc-lista { display: flex; flex-direction: column; gap: 8px; }
.pc-item { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); border-left-width: 4px; overflow: hidden; }
.pc-item.s-prejuizo, .pc-item.s-abaixo_piso { border-left-color: var(--red); }
.pc-item.s-abaixo_alvo { border-left-color: var(--orange); }
.pc-item.s-ok { border-left-color: var(--green); }
.pc-item.aberto { border-color: var(--gold-dark); }
.pc-item-topo { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px; border: 0; background: none; text-align: left; font-family: var(--font); color: inherit; cursor: pointer; }
.pc-chev { font-size: .7rem; color: var(--muted); }
.pc-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.pc-item-l1 { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.pc-item-nome { font-weight: 800; font-size: .95rem; color: var(--brown-dark); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-selo { flex-shrink: 0; padding: 2px 9px; border-radius: 99px; font-size: .64rem; font-weight: 800; white-space: nowrap; background: var(--cream-deep); color: var(--brown-mid); }
.pc-selo.s-ok { background: var(--green-bg); color: var(--green); }
.pc-selo.s-abaixo_alvo { background: var(--orange-bg); color: var(--orange); }
.pc-selo.s-abaixo_piso, .pc-selo.s-prejuizo { background: #FCEBEB; color: var(--red); }
.pc-item-l2 { font-size: .78rem; color: var(--muted); }
.pc-item-l2 b { font-family: var(--mono); color: var(--brown-dark); }
.pc-item-l2 b.certo { color: var(--green); } .pc-item-l2 b.verde { color: var(--green); } .pc-item-l2 b.red { color: var(--red); }
.pc-item-l2 .sep { margin: 0 4px; }

/* Régua de preço */
.pc-regua { position: relative; display: flex; height: 8px; margin-top: 2px; border-radius: 99px; overflow: visible; background: var(--cream-deep); }
.pc-regua i { display: block; height: 100%; }
.pc-regua .z-custo, .pc-leg-regua .z-custo { background: var(--brown); }
.pc-regua .z-fora, .pc-leg-regua .z-fora { background: #e9a39b; }
.pc-regua .z-meio, .pc-leg-regua .z-meio { background: #f0cf8a; }
.pc-regua .z-ok, .pc-leg-regua .z-ok { background: #9fd4ab; }
.pc-regua i:first-child { border-radius: 99px 0 0 99px; } .pc-regua i:nth-child(4) { border-radius: 0 99px 99px 0; }
.pc-regua .pin { position: absolute; top: -3px; width: 3px; height: 14px; margin-left: -1.5px; border-radius: 2px; background: var(--brown-dark); box-shadow: 0 0 0 1.5px var(--surface); }

.pc-mais { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 10px; padding: 11px; border: 1.5px dashed var(--border); border-radius: var(--r-md); background: transparent; font-family: var(--font); font-size: .82rem; font-weight: 700; color: var(--brown); cursor: pointer; }
.pc-mais i { font-size: .7rem; }

/* Detalhe */
.pc-det { padding: 4px 14px 14px; border-top: 1px solid var(--border); }
.pc-conta-tit { margin: 10px 0 6px; font-size: .74rem; font-weight: 800; color: var(--muted); }
.pc-barra { display: flex; height: 12px; border-radius: 99px; overflow: hidden; background: var(--cream-deep); }
.pc-barra span { display: block; height: 100%; }
.b-ingr, i.d.ingr { background: var(--brown); } .b-fixo, i.d.fixo { background: var(--gold-dark); }
.b-risco, i.d.risco { background: var(--orange); } .b-sobra, i.d.sobra { background: var(--green); }
.pc-conta { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; font-size: .84rem; color: var(--brown-dark); }
.pc-conta > div { display: flex; align-items: center; gap: 8px; }
.pc-conta b { margin-left: auto; font-family: var(--mono); }
.pc-conta .sobra { padding-top: 5px; border-top: 1px dashed var(--border); font-weight: 800; }
i.d { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
.pc-teste { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.pc-teste label { font-size: .82rem; font-weight: 700; color: var(--brown-dark); }
.pc-teste-campo { display: flex; align-items: center; gap: 6px; padding: 0 12px; height: 44px; border: 1.5px solid var(--border); border-radius: var(--r-md); background: var(--bg); }
.pc-teste-campo span { font-weight: 800; color: var(--muted); }
.pc-teste-campo input { width: 90px; border: 0; background: transparent; outline: none; font-family: var(--mono); font-size: 1rem; font-weight: 800; color: var(--brown-dark); }
.pc-alerta { margin-top: 12px; padding: 10px 12px; background: var(--orange-bg); border-radius: var(--r-sm); font-size: .8rem; color: var(--brown-dark); line-height: 1.5; }
.pc-alerta i { color: var(--orange); margin-right: 4px; }
.pc-efeitos { margin-top: 12px; padding: 10px 12px; background: var(--cream); border-radius: var(--r-sm); font-size: .8rem; color: var(--brown-dark); line-height: 1.5; }
.pc-efeitos-tit { font-size: .7rem; font-weight: 800; text-transform: uppercase; color: var(--gold-dark); margin-bottom: 4px; }
.pc-efeito { margin-bottom: 4px; }
.pc-acoes { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.pc-acoes small { font-weight: 500; opacity: .8; }
.pc-dica { margin: 8px 0 0; font-size: .76rem; color: var(--muted); line-height: 1.45; }
</style>
VEEOF
cd /home/claude/merged && npx vite build 2>&1 | grep -iE "error|built in"