<template>
  <div class="sf">
    <div v-if="carregando" class="loading-box"><div class="spinner spinner-sm"></div></div>

    <div v-else-if="!saude.folego.temBase && !saude.recorrentes.itens.length && !saude.das.temHistorico && !saude.custoReal" class="sf-vazio">
      <i class="fas fa-heart-pulse"></i>
      <b>Importe alguns meses de extrato</b>
      <p>Com o histórico do banco, o app mostra seu fôlego de caixa, o DAS, seus custos fixos reais e quanto você gasta de verdade com insumos.</p>
    </div>

    <template v-else>
      <!-- ══ 1. FÔLEGO DE CAIXA ═════════════════════════════════ -->
      <div v-if="saude.folego.temBase" class="sf-bloco">
        <div class="sf-titulo"><i class="fas fa-wallet"></i> Próximos 30 dias</div>
        <div class="sf-kpi">
          <div class="sf-kpi-rot">Deve sobrar (mês típico)</div>
          <div class="sf-kpi-val" :class="{ neg: saude.folego.liquidoEsperado < 0 }">{{ R$(saude.folego.liquidoEsperado) }}</div>
          <div class="sf-kpi-sub">
            Num mês fraco: <b :class="{ neg: saude.folego.liquidoCauteloso < 0 }">{{ R$(saude.folego.liquidoCauteloso) }}</b>
          </div>
          <div class="sf-duo">
            <div><span>Costuma entrar</span><b>{{ R$(saude.folego.entradaEsperada) }}</b></div>
            <div><span>Costuma sair</span><b>{{ R$(saude.folego.saidas) }}</b></div>
          </div>
          <div class="sf-duo menor">
            <div><span>Insumos</span><b>{{ R$(saude.folego.insumos) }}</b></div>
            <div><span>Custos fixos + DAS</span><b>{{ R$(saude.folego.fixos) }}</b></div>
          </div>
        </div>

        <div class="sf-retirada">
          <div class="sf-retirada-linha">
            <span><i class="fas fa-piggy-bank"></i> Retirada segura (mês fraco)</span>
            <b>{{ R$(saude.folego.retiradaSegura) }}</b>
          </div>
          <template v-if="metaRetirada > 0">
            <div class="sf-barra"><div class="sf-barra-fill" :class="{ baixo: saude.folego.retiradaSegura < metaRetirada }" :style="{ width: Math.min(100, Math.round((saude.folego.retiradaSegura / metaRetirada) * 100)) + '%' }"></div></div>
            <div class="sf-mudo">Sua meta: {{ R$(metaRetirada) }}/mês</div>
          </template>
        </div>

        <div v-if="saude.folego.aVencer > 0 || saude.folego.atrasado > 0" class="sf-receber">
          <i class="fas fa-circle-info"></i>
          Na Caderneta já há
          <b v-if="saude.folego.aVencer > 0">{{ R$(saude.folego.aVencer) }} a vencer</b>
          <template v-if="saude.folego.aVencer > 0 && saude.folego.atrasado > 0"> e </template>
          <b v-if="saude.folego.atrasado > 0" class="neg">{{ R$(saude.folego.atrasado) }} em atraso</b>
          para receber.
        </div>
        <p class="sf-nota">Baseado nos últimos {{ saude.folego.mesesBase }} {{ saude.folego.mesesBase === 1 ? 'mês fechado' : 'meses fechados' }} do extrato. Não considera o saldo que já está na conta.</p>
      </div>

      <!-- ══ 2. DAS (por competência) ═══════════════════════════ -->
      <div v-if="saude.das.temHistorico" class="sf-bloco">
        <div class="sf-titulo"><i class="fas fa-file-invoice-dollar"></i> DAS do MEI</div>

        <div class="sf-das" :class="'e-' + saude.das.estado">
          <i class="fas" :class="saude.das.estado === 'pago' ? 'fa-circle-check' : saude.das.estado === 'atrasado' ? 'fa-triangle-exclamation' : 'fa-clock'"></i>
          <div>
            <b v-if="saude.das.estado === 'atrasado'">
              {{ saude.das.atrasadas.length === 1 ? 'DAS de ' + nomeCompetencia(saude.das.atrasadas[0].ym) + ' em aberto' : saude.das.atrasadas.length + ' DAS em aberto' }}
            </b>
            <b v-else-if="saude.das.estado === 'a-vencer'">
              DAS de {{ nomeCompetencia(saude.das.proxima.ym) }} vence {{ dm(saude.das.proxima.venc) }}
              {{ saude.das.diasParaVencer === 0 ? '(hoje)' : `(faltam ${saude.das.diasParaVencer} ${saude.das.diasParaVencer === 1 ? 'dia' : 'dias'})` }}
            </b>
            <b v-else>Todos os DAS acompanhados estão pagos</b>
            <small v-if="saude.das.estado === 'atrasado'">O mais antigo venceu em {{ dm(saude.das.atrasadas[0].venc) }} · {{ saude.das.atrasadas[0].diasAtraso }} dias de atraso</small>
            <small v-else-if="saude.das.valor">Valor de referência: {{ R$(saude.das.valor) }}</small>
          </div>
        </div>

        <div v-if="saude.das.pagamentos.some(p => p.duvidoso)" class="sf-das-aviso">
          <i class="fas fa-circle-question"></i>
          O extrato mostra quando o dinheiro saiu, mas não de qual mês é o DAS. Há um DAS mais antigo em aberto, então confirme abaixo a que mês cada pagamento se refere.
        </div>

        <!-- Um DAS por mês de competência -->
        <div class="sf-das-lista">
          <div v-for="c in saude.das.competencias" :key="c.ym" class="sf-das-linha" :class="'e-' + c.estado">
            <span class="sf-das-mes">{{ nomeCompetencia(c.ym) }}</span>
            <span class="sf-das-info">
              <template v-if="c.estado === 'pago'">
                Pago em {{ dm(c.pagoEm) }}<template v-if="c.diasAtraso > 0"> · {{ c.diasAtraso }} {{ c.diasAtraso === 1 ? 'dia' : 'dias' }} depois do vencimento</template>
              </template>
              <template v-else-if="c.estado === 'fora'">Pago por outra conta</template>
              <template v-else-if="c.estado === 'atrasado'">Venceu {{ dm(c.venc) }} · {{ c.diasAtraso }} {{ c.diasAtraso === 1 ? 'dia' : 'dias' }} de atraso</template>
              <template v-else>Vence {{ dm(c.venc) }}{{ c.diasParaVencer ? ` · faltam ${c.diasParaVencer} ${c.diasParaVencer === 1 ? 'dia' : 'dias'}` : ' · hoje' }}</template>
            </span>
            <button v-if="c.estado === 'atrasado' || c.estado === 'a-vencer'" type="button" class="sf-das-acao" @click="marcarFora(c.ym, true)">Já paguei por outra conta</button>
            <button v-else-if="c.estado === 'fora'" type="button" class="sf-das-acao" @click="marcarFora(c.ym, false)">Desfazer</button>
          </div>
        </div>

        <!-- A que mês cada pagamento do extrato se refere -->
        <div v-if="saude.das.pagamentos.length" class="sf-das-pags">
          <div class="sf-sub">Pagamentos de DAS no extrato</div>
          <div v-for="p in saude.das.pagamentos.slice(0, 8)" :key="p.chave" class="sf-das-pag" :class="{ duvida: p.duvidoso }">
            <div class="sf-das-pag-info">
              <b>{{ R$(p.valor) }}</b>
              <small>em {{ dm(p.data) }}<template v-if="p.duvidoso"> · <span class="conf">confira</span></template></small>
            </div>
            <label class="sf-das-sel">
              <span>Referente a</span>
              <select :value="p.origem === 'manual' ? p.competencia : ''" @change="escolherCompetencia(p, $event.target.value)">
                <option value="">{{ p.competencia ? nomeCompetencia(p.competencia) + (p.origem === 'descricao' ? ' (da descrição)' : ' (automático)') : 'sem mês definido' }}</option>
                <option v-for="ym in saude.das.opcoesCompetencia" :key="ym" :value="ym">{{ nomeCompetencia(ym) }}</option>
              </select>
            </label>
          </div>
        </div>

        <p class="sf-nota">O vencimento é dia 20 do mês seguinte — ou o próximo dia útil quando cai em fim de semana ou feriado (como 20/11). Só entram meses que o seu extrato cobre. Sua escolha fica salva e vale também no Guia.</p>
      </div>

      <!-- ══ 3. CUSTOS FIXOS REAIS ══════════════════════════════ -->
      <div v-if="saude.recorrentes.itens.length" class="sf-bloco">
        <div class="sf-titulo"><i class="fas fa-repeat"></i> Custos que se repetem todo mês</div>
        <div class="sf-lista">
          <div v-for="i in saude.recorrentes.itens.slice(0, 10)" :key="i.categoria + i.nome" class="sf-fixo">
            <div class="sf-fixo-info">
              <div class="sf-fixo-nome">{{ i.nome }}</div>
              <div class="sf-fixo-sub">{{ i.categoria }} · {{ i.meses }} {{ i.meses === 1 ? 'mês' : 'meses' }} seguidos</div>
            </div>
            <div class="sf-fixo-dir">
              <b>{{ R$(i.mediaMensal) }}</b>
              <span :class="i.pagoNoMes ? 'ok' : 'mudo'">{{ i.pagoNoMes ? 'pago este mês' : 'ainda não veio' }}</span>
            </div>
          </div>
        </div>
        <div class="sf-total">
          <span>Soma dos que se repetem</span><b>{{ R$(saude.recorrentes.total) }}/mês</b>
        </div>
        <p v-if="base.fonte === 'financeiro'" class="sf-nota">
          Seus custos fixos médios (tudo que não é insumo) são {{ R$(base.fixosMensais) }}/mês — é esse valor que entra no <b>Preço certo</b>.
          Os que se repetem explicam {{ Math.min(100, Math.round((saude.recorrentes.total / Math.max(1, base.fixosMensais)) * 100)) }}% dele.
        </p>
      </div>

      <!-- ══ 4. CUSTO REAL × RECEITAS ═══════════════════════════ -->
      <div v-if="saude.custoReal" class="sf-bloco">
        <div class="sf-titulo"><i class="fas fa-scale-balanced"></i> Custo real × custo das receitas</div>
        <div class="sf-real">
          <div class="sf-real-linha"><span>Gasto real com insumos</span><b>{{ R$(saude.custoReal.insumos) }}/mês</b></div>
          <div class="sf-real-linha"><span>Ingredientes das produções registradas</span><b>{{ R$(saude.custoReal.producaoRegistrada) }}/mês</b></div>
          <div v-if="saude.custoReal.cobertura !== null" class="sf-barra"><div class="sf-barra-fill" :class="'n-' + saude.custoReal.nivel" :style="{ width: Math.min(100, saude.custoReal.cobertura) + '%' }"></div></div>
          <div v-if="saude.custoReal.cobertura !== null" class="sf-mudo">{{ saude.custoReal.cobertura }}% do gasto aparece nas produções</div>
        </div>
        <div v-if="saude.custoReal.leitura" class="sf-leitura" :class="'n-' + saude.custoReal.nivel"><i class="fas fa-lightbulb"></i> {{ saude.custoReal.leitura }}</div>
        <div class="sf-duo grande">
          <div v-if="saude.custoReal.insumosPct !== null"><span>Insumos por R$ que entrou</span><b>{{ saude.custoReal.insumosPct }}%</b></div>
          <div v-if="saude.custoReal.sobraCaixaPct !== null"><span>Sobra no caixa</span><b :class="{ neg: saude.custoReal.sobraCaixa < 0 }">{{ saude.custoReal.sobraCaixaPct }}%</b></div>
        </div>
        <p class="sf-nota">Sobra no caixa = o que entrou no mês menos todas as despesas do negócio (média de {{ saude.custoReal.meses }} {{ saude.custoReal.meses === 1 ? 'mês' : 'meses' }}): {{ R$(saude.custoReal.sobraCaixa) }}/mês. Esse é o número mais honesto sobre quanto o negócio rende — não depende de lançar tudo certinho.</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from '../store.js'
import { db } from '../db.js'
import { R$ as numeroBR } from '../utils.js'
import { hoje } from '../composables/useCaderneta.js'
import { carregarAtribuicoesDas, salvarAtribuicoesDas } from '../composables/useDasAtribuicoes.js'
import { analisarSaude, nomeCompetencia } from '../modules/saudeFinanceira.js'
import { baseFinanceira } from '../modules/precoCerto.js'

// R$ do app devolve só o número formatado; aqui sempre queremos o símbolo
const R$ = (v) => 'R$ ' + numeroBR(v)
const s = useStore()

const carregando = ref(true)
const financeiro = ref([])
const fiados = ref([])
const dasAtribuicoes = ref({})
async function carregar() {
  try {
    const [f, c, d] = await Promise.all([db.financeiro.toArray(), db.cad_fiados.toArray(), carregarAtribuicoesDas()])
    financeiro.value = f; fiados.value = c; dasAtribuicoes.value = d
  } catch (e) { console.error('Caixa e Custos: não deu para ler os dados', e) }
  finally { carregando.value = false }
}
onMounted(carregar)
watch(() => s.tab, (t) => { if (t === 'financeiro') carregar() })

const metaRetirada = computed(() => Number(s.company?.meta_salario_mensal || 0))
const receitasMotor = computed(() => s.receitas.map(r => ({
  uuid: r.uuid, intermediaria: !!r.eh_intermediaria,
  custoUnit: s.getCustoTotal(r) / (r.rendimento || 1), preco: Number(r.preco_sugerido || 0),
})))
const saude = computed(() => analisarSaude({
  financeiro: financeiro.value, fiados: fiados.value, relatorio: s.relatorioMensalMei, producoes: s.producoes,
  receitas: receitasMotor.value, hoje: hoje(), metaRetirada: metaRetirada.value, dasAtribuicoes: dasAtribuicoes.value,
}))
const base = computed(() => baseFinanceira({ relatorio: s.relatorioMensalMei, hoje: hoje(), metaRetirada: metaRetirada.value }))
// ── DAS: escolhas da pessoa ──────────────────────────────────
const dm = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`
async function gravarDas(mapa) {
  dasAtribuicoes.value = mapa
  try { await salvarAtribuicoesDas(mapa); s.syncImediato?.() }
  catch (e) { console.error(e); s.notify('Não deu para salvar a escolha.', 'error') }
}
function escolherCompetencia(p, ym) {
  const mapa = { ...dasAtribuicoes.value }
  if (ym) mapa[p.chave] = ym; else delete mapa[p.chave] // vazio = deixa o app decidir
  gravarDas(mapa)
}
function marcarFora(ym, fora) {
  const mapa = { ...dasAtribuicoes.value }
  if (fora) mapa[`mes:${ym}`] = 'fora'; else delete mapa[`mes:${ym}`]
  gravarDas(mapa)
}
const nomeMes = (ym) => {
  const t = new Date(`${ym}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
</script>

<style scoped>
.sf-vazio { text-align: center; padding: 36px 20px; color: var(--muted); }
.sf-vazio i { font-size: 34px; color: var(--gold-dark); margin-bottom: 10px; }
.sf-vazio b { display: block; color: var(--brown-dark); font-size: 1rem; margin-bottom: 6px; }
.sf-vazio p { font-size: .85rem; line-height: 1.5; margin: 0; }
.sf-bloco { margin-bottom: 16px; }
.sf-titulo { display: flex; align-items: center; gap: 6px; padding: 0 2px; margin-bottom: 8px; font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.sf-nota { margin: 8px 2px 0; font-size: .76rem; color: var(--muted); line-height: 1.45; }
.sf-mudo { font-size: .76rem; color: var(--muted); }
.neg { color: var(--red); } .ok { color: var(--green); } .mudo { color: var(--muted); }

.sf-kpi { padding: 14px; border-radius: var(--r-md); color: #fff; background: linear-gradient(135deg, var(--brown-dark), var(--brown)); box-shadow: var(--shadow); }
.sf-kpi-rot { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.7); }
.sf-kpi-val { margin-top: 2px; font-family: var(--mono); font-size: 28px; font-weight: 800; line-height: 1.1; }
.sf-kpi-val.neg { color: #ffd0c4; }
.sf-kpi-sub { margin-top: 4px; font-size: .8rem; color: rgba(255,255,255,.8); }
.sf-kpi-sub b { font-family: var(--mono); color: #fff; } .sf-kpi-sub b.neg { color: #ffd0c4; }
.sf-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.sf-duo > div { padding: 7px 9px; border-radius: var(--r-sm); background: rgba(255,255,255,.1); min-width: 0; }
.sf-duo span { display: block; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.7); }
.sf-duo b { font-family: var(--mono); font-size: 14px; }
.sf-duo.menor > div { background: rgba(255,255,255,.06); }
.sf-duo.menor b { font-size: 12.5px; font-weight: 700; }
.sf-duo.grande { margin-top: 10px; } 
.sf-bloco .sf-duo.grande > div { background: var(--surface); border: 1.5px solid var(--border); }
.sf-bloco .sf-duo.grande span { color: var(--muted); } .sf-bloco .sf-duo.grande b { color: var(--brown-dark); }
.sf-bloco .sf-duo.grande b.neg { color: var(--red); }

.sf-retirada { margin-top: 10px; padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.sf-retirada-linha { display: flex; justify-content: space-between; align-items: center; font-size: .88rem; font-weight: 700; color: var(--brown-dark); }
.sf-retirada-linha i { color: var(--gold-dark); margin-right: 6px; }
.sf-retirada-linha b { font-family: var(--mono); font-size: 1.05rem; color: var(--green); }
.sf-barra { height: 8px; background: var(--cream-deep); border-radius: 99px; margin: 8px 0 4px; overflow: hidden; }
.sf-barra-fill { height: 100%; background: var(--green); border-radius: 99px; transition: width .4s; }
.sf-barra-fill.baixo, .sf-barra-fill.n-atencao { background: var(--orange); }
.sf-barra-fill.n-alerta { background: var(--red); }
.sf-receber { margin-top: 10px; padding: 9px 12px; border-radius: var(--r-sm); background: var(--cream); font-size: .8rem; color: var(--brown-dark); line-height: 1.45; }
.sf-receber i { color: var(--gold-dark); margin-right: 4px; }

.sf-das { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--r-md); border: 1.5px solid var(--border); border-left-width: 4px; background: var(--surface); box-shadow: var(--shadow); }
.sf-das > i { font-size: 1.3rem; }
.sf-das b { display: block; font-size: .92rem; color: var(--brown-dark); }
.sf-das small { font-size: .78rem; color: var(--muted); }
.sf-das.e-pago { border-left-color: var(--green); } .sf-das.e-pago > i { color: var(--green); }
.sf-das.e-a-vencer { border-left-color: var(--gold-dark); } .sf-das.e-a-vencer > i { color: var(--gold-dark); }
.sf-das.e-atrasado { border-left-color: var(--red); background: #FCEBEB; } .sf-das.e-atrasado > i { color: var(--red); }
.sf-hist { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.sf-hist-pill { padding: 4px 10px; border-radius: 99px; font-size: .72rem; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; }
.sf-hist-pill.ok { background: var(--green-bg); color: var(--green); }
.sf-hist-pill.falta { background: var(--cream-deep); color: var(--muted); }
.sf-hist-pill i { font-size: .6rem; }

.sf-lista { display: flex; flex-direction: column; gap: 8px; }
.sf-fixo { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); }
.sf-fixo-info { flex: 1; min-width: 0; }
.sf-fixo-nome { font-weight: 800; font-size: .9rem; color: var(--brown-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sf-fixo-sub { font-size: .74rem; color: var(--muted); }
.sf-fixo-dir { text-align: right; display: flex; flex-direction: column; gap: 2px; }
.sf-fixo-dir b { font-family: var(--mono); font-size: .9rem; color: var(--brown-dark); }
.sf-fixo-dir span { font-size: .68rem; font-weight: 700; }
.sf-total { margin-top: 8px; padding: 10px 12px; display: flex; justify-content: space-between; border-top: 1px dashed var(--border); font-size: .86rem; font-weight: 800; color: var(--brown-dark); }
.sf-total b { font-family: var(--mono); }

.sf-real { padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.sf-real-linha { display: flex; justify-content: space-between; gap: 10px; font-size: .84rem; color: var(--brown-dark); padding: 2px 0; }
.sf-real-linha b { font-family: var(--mono); white-space: nowrap; }
.sf-leitura { margin-top: 10px; padding: 10px 12px; border-radius: var(--r-sm); font-size: .82rem; line-height: 1.5; background: var(--cream); color: var(--brown-dark); }
.sf-leitura i { margin-right: 5px; color: var(--gold-dark); }
.sf-leitura.n-ok { background: var(--green-bg); } .sf-leitura.n-ok i { color: var(--green); }
.sf-leitura.n-atencao { background: var(--orange-bg); } .sf-leitura.n-atencao i { color: var(--orange); }
.sf-leitura.n-alerta { background: #FCEBEB; } .sf-leitura.n-alerta i { color: var(--red); }

.sf-das-aviso { margin-top: 10px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--orange-bg); font-size: .8rem; line-height: 1.45; color: var(--brown-dark); }
.sf-das-aviso i { color: var(--orange); margin-right: 5px; }
.sf-das-lista { margin-top: 10px; display: flex; flex-direction: column; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
.sf-das-linha { display: grid; grid-template-columns: 58px 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border); border-left: 4px solid var(--border); font-size: .8rem; }
.sf-das-linha:last-child { border-bottom: 0; }
.sf-das-linha.e-pago { border-left-color: var(--green); } .sf-das-linha.e-fora { border-left-color: var(--gold-dark); }
.sf-das-linha.e-atrasado { border-left-color: var(--red); background: #FCEBEB; } .sf-das-linha.e-a-vencer { border-left-color: var(--orange); }
.sf-das-mes { font-weight: 800; color: var(--brown-dark); }
.sf-das-info { color: var(--muted); line-height: 1.35; }
.sf-das-linha.e-atrasado .sf-das-info { color: var(--red); font-weight: 700; }
.sf-das-acao { padding: 5px 10px; border: 1.5px solid var(--border); border-radius: 99px; background: var(--bg); font-family: var(--font); font-size: .68rem; font-weight: 800; color: var(--brown); cursor: pointer; white-space: nowrap; }
.sf-sub { margin: 14px 2px 6px; font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.sf-das-pags { display: flex; flex-direction: column; gap: 8px; }
.sf-das-pag { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); }
.sf-das-pag.duvida { border-color: var(--orange); }
.sf-das-pag-info b { display: block; font-family: var(--mono); font-size: .92rem; color: var(--brown-dark); }
.sf-das-pag-info small { font-size: .74rem; color: var(--muted); } .sf-das-pag-info .conf { color: var(--orange); font-weight: 800; }
.sf-das-sel { display: flex; flex-direction: column; gap: 2px; font-size: .66rem; font-weight: 800; text-transform: uppercase; color: var(--muted); }
.sf-das-sel select { min-width: 150px; height: 38px; padding: 0 8px; border: 1.5px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: var(--font); font-size: .82rem; font-weight: 700; color: var(--brown-dark); text-transform: none; }
</style>
