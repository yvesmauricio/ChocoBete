<template>
  <div class="pc">
    <div class="pc-titulo"><i class="fas fa-tag"></i> Preço certo</div>

    <div v-if="!itens.length" class="pc-nada">Cadastre o preço e os ingredientes das receitas para ver aqui quanto cobrar.</div>

    <template v-else>
      <!-- Como a conta é feita -->
      <div class="pc-base">
        <div class="pc-base-tit">Como o preço é calculado</div>
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
      </div>

      <p class="pc-resumo" :class="{ ok: precisamAtencao === 0 }">
        <i class="fas" :class="precisamAtencao ? 'fa-triangle-exclamation' : 'fa-circle-check'"></i>
        <template v-if="precisamAtencao">{{ precisamAtencao }} de {{ itens.length }} {{ itens.length === 1 ? 'produto está' : 'produtos estão' }} com preço abaixo do ideal.</template>
        <template v-else>Todos os preços cobrem os custos e deixam sobra para você.</template>
      </p>

      <div class="pc-lista">
        <div v-for="p in itens" :key="p.uuid" class="pc-item" :class="['s-' + p.status, { aberto: aberto === p.uuid }]">
          <button type="button" class="pc-item-topo" @click="alternar(p)">
            <span class="pc-item-info">
              <span class="pc-item-nome">{{ p.nome }}</span>
              <span class="pc-item-linha">
                Cobra <b>{{ R$(p.preco) }}</b>
                <template v-if="p.status !== 'ok' && !p.longe"> · preço certo <b>{{ R$(p.certo) }}</b></template>
                <template v-else-if="p.longe"> · o custo pesa {{ Math.round((p.custoUnit / p.preco) * 100) }}% do preço</template>
                · sobra <b :class="p.conta.sobra > 0 ? 'verde' : 'red'">{{ R$(p.conta.sobra) }}</b>
              </span>
            </span>
            <span class="pc-selo" :class="'s-' + p.status">{{ ROTULO_PRECO[p.status] }}</span>
            <i class="fas" :class="aberto === p.uuid ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>

          <div v-if="aberto === p.uuid" class="pc-det">
            <!-- Para onde vai cada real -->
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

            <!-- Testar outro preço -->
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
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from '../store.js'
import { R$ as numeroBR, parseMoney } from '../utils.js'
import { db } from '../db.js'
import { hoje } from '../composables/useCaderneta.js'
import { useConfirm } from '../composables/useConfirm.js'
import { baseFinanceira, riscoFiado, listaPrecoCerto, contaDoPreco, ROTULO_PRECO } from '../modules/precoCerto.js'

const R$ = (v) => 'R$ ' + numeroBR(v)
const s = useStore()
const confirm = useConfirm()

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
const precisamAtencao = computed(() => itens.value.filter(p => p.status !== 'ok').length)
const alvoPct = computed(() => itens.value[0]?.alvoPct ?? Math.round(Math.min(0.4, Math.max(0.15, base.value.retiradaPct + 0.05)) * 100))

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
.pc-titulo { display: flex; align-items: center; gap: 6px; padding: 0 2px; margin-bottom: 8px; font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.pc-nada { padding: 18px 14px; text-align: center; font-size: .85rem; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--r-md); }
.pc-base { padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.pc-base-tit { font-size: .74rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--gold-dark); margin-bottom: 6px; }
.pc-base-linhas { display: flex; flex-direction: column; gap: 6px; font-size: .84rem; color: var(--brown-dark); line-height: 1.35; }
.pc-base-linhas i { width: 18px; color: var(--gold-dark); text-align: center; }
.pc-base-linhas b { font-family: var(--mono); margin-left: 4px; }
.pc-base-linhas small { display: block; margin-left: 22px; font-size: .74rem; color: var(--muted); }
.pc-resumo { margin: 10px 2px; font-size: .84rem; font-weight: 700; color: var(--orange); display: flex; gap: 8px; align-items: flex-start; }
.pc-resumo.ok { color: var(--green); }
.pc-lista { display: flex; flex-direction: column; gap: 8px; }
.pc-item { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); border-left-width: 4px; overflow: hidden; }
.pc-item.s-prejuizo, .pc-item.s-abaixo_piso { border-left-color: var(--red); }
.pc-item.s-abaixo_alvo { border-left-color: var(--orange); }
.pc-item.s-ok { border-left-color: var(--green); }
.pc-item-topo { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px; border: 0; background: none; text-align: left; font-family: var(--font); color: inherit; cursor: pointer; }
.pc-item-topo > i { font-size: .7rem; color: var(--muted); }
.pc-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pc-item-nome { font-weight: 800; font-size: .95rem; color: var(--brown-dark); }
.pc-item-linha { font-size: .78rem; color: var(--muted); }
.pc-item-linha b { font-family: var(--mono); color: var(--brown-dark); }
.pc-item-linha b.verde { color: var(--green); } .pc-item-linha b.red { color: var(--red); }
.pc-selo { flex-shrink: 0; max-width: 112px; padding: 2px 9px; border-radius: 99px; font-size: .64rem; font-weight: 800; text-align: center; line-height: 1.25; background: var(--cream-deep); color: var(--brown-mid); }
.pc-selo.s-ok { background: var(--green-bg); color: var(--green); }
.pc-selo.s-abaixo_alvo { background: var(--orange-bg); color: var(--orange); }
.pc-selo.s-abaixo_piso, .pc-selo.s-prejuizo { background: #FCEBEB; color: var(--red); }
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
.verde { color: var(--green); } .red { color: var(--red); }
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
