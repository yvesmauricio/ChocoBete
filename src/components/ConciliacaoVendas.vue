<template>
  <div class="cv">
    <div v-if="carregando" class="loading-box"><div class="spinner spinner-sm"></div></div>

    <div v-else-if="!resultado.itens.length" class="cv-vazio">
      <i class="fas fa-file-import"></i>
      <b>Importe um extrato para ver suas vendas por aqui</b>
      <p>Quando houver Pix recebidos no Financeiro, o app separa o que é pagamento de fiado do que é venda à vista, mesmo você não lançando as vendas à vista.</p>
    </div>

    <template v-else>
      <!-- Mês -->
      <div class="cv-chips" role="group" aria-label="Mês">
        <button v-for="m in mesesDisponiveis" :key="m.mes" type="button" class="chip" :class="{ ativo: mesSel === m.mes }" @click="mesSel = m.mes">
          {{ nomeMes(m.mes) }}
        </button>
      </div>

      <!-- Resumo do mês -->
      <div v-if="resumo" class="cv-kpi">
        <div class="cv-kpi-rot">Entrou no extrato como venda</div>
        <div class="cv-kpi-val">{{ R$(resumo.total) }}</div>
        <div class="cv-barra" aria-hidden="true">
          <span class="b-fiado" :style="{ width: pctDe(resumo.fiado) }"></span>
          <span class="b-prov" :style="{ width: pctDe(resumo.provavel) }"></span>
          <span class="b-avista" :style="{ width: pctDe(resumo.avista) }"></span>
        </div>
        <div class="cv-kpi-trio">
          <div><i class="d fiado"></i><span>Fiado recebido</span><b>{{ R$(resumo.fiado) }}</b></div>
          <div><i class="d prov"></i><span>Pode ser fiado</span><b>{{ R$(resumo.provavel) }}</b></div>
          <div><i class="d avista"></i><span>À vista (estimado)</span><b>{{ R$(resumo.avista) }}</b></div>
        </div>
        <p class="cv-nota">À vista = o que entrou e não corresponde a nenhuma cobrança da Caderninho. Dinheiro vivo não passa pelo banco, então não aparece aqui.</p>
      </div>

      <!-- Sugestões de baixa -->
      <div v-if="resultado.sugestoes.length" class="cv-bloco">
        <div class="cv-titulo"><i class="fas fa-link"></i> Parecem pagamento de fiado <span class="cv-n">{{ resultado.sugestoes.length }}</span></div>
        <p class="cv-dica">Estes Pix batem com cobranças em aberto. Confirme para dar baixa na Caderninho com a data do Pix — o app nunca baixa sozinho.</p>
        <div class="cv-lista">
          <div v-for="sg in resultado.sugestoes" :key="sg.chave" class="cv-sug" :class="'c-' + sg.confianca">
            <div class="cv-sug-topo">
              <div class="cv-sug-valor">{{ R$(sg.valor) }}</div>
              <div class="cv-sug-meta">
                <div class="cv-sug-pagador">Pix de {{ sg.pagador.nome || 'nome não identificado' }}</div>
                <div class="cv-sug-data">{{ fmtBR(sg.dataIso) }}</div>
              </div>
              <span class="cv-conf" :class="'c-' + sg.confianca">{{ { alta: 'Alta', media: 'Média', baixa: 'Baixa' }[sg.confianca] }}</span>
            </div>
            <div class="cv-sug-corpo">
              <i class="fas fa-arrow-right"></i> Parece pagamento de <b>{{ sg.clienteNome }}</b>
              <small>deve {{ R$(sg.saldoCliente) }} · {{ sg.motivo }}</small>
            </div>
            <div v-if="!sg.quitaExato" class="cv-sug-resto">
              <label>Pagou só uma parte. Receber o restante em:</label>
              <input type="date" class="input" :value="datasResto[sg.chave] || padraoResto(sg)" :min="sg.dataIso" @input="datasResto[sg.chave] = $event.target.value">
            </div>
            <div class="cv-sug-acoes">
              <button type="button" class="btn btn-primary" :disabled="processando === sg.chave" @click="darBaixa(sg)"><i class="fas fa-check"></i> Dar baixa</button>
              <button type="button" class="btn btn-secondary" :disabled="processando === sg.chave" @click="ignorar(sg)">Não é fiado</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Quem paga à vista -->
      <div class="cv-bloco">
        <div class="cv-titulo"><i class="fas fa-user-check"></i> Quem paga à vista</div>
        <p class="cv-dica">Pessoas que pagaram por Pix e não estão ligadas a nenhum fiado. São clientes seus — vale conhecer e cuidar.</p>
        <div v-if="!resultado.pagadoresAvista.length" class="cv-nada">Ainda sem pagadores identificados.</div>
        <div v-else class="cv-lista">
          <div v-for="p in resultado.pagadoresAvista.slice(0, mostrarTodos ? 40 : 6)" :key="p.chave" class="cv-pag">
            <span class="cv-avatar">{{ iniciais(p.nome) }}</span>
            <div class="cv-pag-info">
              <div class="cv-pag-nome">{{ p.nome }} <span v-if="p.tambemClienteFiado" class="cv-tag">também é cliente de fiado</span></div>
              <div class="cv-pag-linha">
                {{ p.vezes }} {{ p.vezes === 1 ? 'pagamento' : 'pagamentos' }} · ticket {{ R$(p.ticket) }}
                <template v-if="p.intervaloMedio"> · a cada ~{{ p.intervaloMedio }} dias</template>
                · última {{ fmtBR(p.ultima) }}
              </div>
            </div>
            <b class="cv-pag-total">{{ R$(p.total) }}</b>
          </div>
        </div>
        <button v-if="resultado.pagadoresAvista.length > 6" type="button" class="cv-mais" @click="mostrarTodos = !mostrarTodos">
          {{ mostrarTodos ? 'Mostrar menos' : `Ver todos (${resultado.pagadoresAvista.length})` }}
        </button>
      </div>

      <button v-if="ignorados.length" type="button" class="cv-mais" @click="restaurarIgnorados">
        Restaurar {{ ignorados.length }} {{ ignorados.length === 1 ? 'Pix marcado' : 'Pix marcados' }} como "não é fiado"
      </button>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from '../store.js'
import { db, configGet, configSet } from '../db.js'
import { R$ as numeroBR } from '../utils.js'
import { useConfirm } from '../composables/useConfirm.js'
import { fmtBR, hoje, iniciais, receberParcialCliente } from '../composables/useCaderneta.js'
import { conciliar } from '../modules/conciliacao.js'
import { somaDias } from '../modules/guiaNegocio.js'

// R$ do app devolve só o número formatado; aqui sempre queremos o símbolo
const R$ = (v) => 'R$ ' + numeroBR(v)

const s = useStore()
const confirm = useConfirm()
const CHAVE_IGNORADOS = 'conciliacao_ignorados'

const carregando = ref(true)
const entradas = ref([])
const fiados = ref([])
const clientes = ref([])
const ignorados = ref([])
const processando = ref('')
const mostrarTodos = ref(false)
const datasResto = reactive({})
const mesSel = ref('')

async function carregar() {
  try {
    const [fin, f, c, ign] = await Promise.all([
      db.financeiro.toArray(), db.cad_fiados.toArray(), db.cad_clientes.toArray(), configGet(CHAVE_IGNORADOS, []),
    ])
    entradas.value = fin.filter(e => e.categoria === 'Receita de Vendas' && Number(e.valor) > 0)
    fiados.value = f; clientes.value = c; ignorados.value = Array.isArray(ign) ? ign : []
  } catch (e) { console.error('Conciliação: não deu para ler os dados', e) }
  finally { carregando.value = false }
}
onMounted(carregar)
watch(() => s.tab, (t) => { if (t === 'financeiro') carregar() })

const resultado = computed(() => conciliar({
  entradas: entradas.value, fiados: fiados.value, clientes: clientes.value, ignorados: ignorados.value, hoje: hoje(),
}))
const mesesDisponiveis = computed(() => resultado.value.meses.slice(0, 6))
watch(mesesDisponiveis, (m) => { if (m.length && !m.some(x => x.mes === mesSel.value)) mesSel.value = m[0].mes }, { immediate: true })
const resumo = computed(() => resultado.value.meses.find(m => m.mes === mesSel.value) || null)
const pctDe = (v) => `${resumo.value?.total ? Math.max(0, (v / resumo.value.total) * 100).toFixed(1) : 0}%`
const nomeMes = (ym) => {
  const d = new Date(`${ym}-01T12:00:00`)
  const t = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const padraoResto = (sg) => somaDias(hoje(), 15)

async function darBaixa(sg) {
  if (processando.value) return
  const parcial = !sg.quitaExato
  const novaData = parcial ? (datasResto[sg.chave] || padraoResto(sg)) : null
  const ok = await confirm.ask(
    `Dar baixa de ${R$(sg.valor)} para ${sg.clienteNome}, com a data do Pix (${fmtBR(sg.dataIso)})?` +
    (parcial ? ` O restante fica para ${fmtBR(novaData)}.` : ''),
    { title: 'Dar baixa no fiado', confirmLabel: 'Dar baixa', type: 'primary' }
  )
  if (!ok) return
  processando.value = sg.chave
  try {
    await receberParcialCliente(sg.fiadoIds, sg.valor, novaData, { data: sg.dataIso, financeiroHash: sg.chave })
    s.syncImediato?.()
    s.notify(`Baixa registrada para ${sg.clienteNome}!`)
    await carregar()
  } catch (e) {
    console.error(e); s.notify(e?.message || 'Não deu para dar baixa agora.', 'error')
  } finally { processando.value = '' }
}

async function ignorar(sg) {
  ignorados.value = [...new Set([...ignorados.value, sg.chave])]
  await configSet(CHAVE_IGNORADOS, ignorados.value)
  s.notify('Ok! Vai contar como venda à vista.')
}
async function restaurarIgnorados() {
  ignorados.value = []
  await configSet(CHAVE_IGNORADOS, [])
}
</script>

<style scoped>
.cv-vazio { text-align: center; padding: 36px 20px; color: var(--muted); }
.cv-vazio i { font-size: 34px; color: var(--gold-dark); margin-bottom: 10px; }
.cv-vazio b { display: block; color: var(--brown-dark); font-size: 1rem; margin-bottom: 6px; }
.cv-vazio p { font-size: .85rem; line-height: 1.5; margin: 0; }
.cv-chips { display: flex; gap: 8px; overflow-x: auto; padding: 0 0 10px; scrollbar-width: none; }
.cv-chips::-webkit-scrollbar { display: none; }
.cv-kpi { padding: 14px; border-radius: var(--r-md); color: #fff; background: linear-gradient(135deg, var(--brown-dark), var(--brown)); box-shadow: var(--shadow); margin-bottom: 16px; }
.cv-kpi-rot { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.7); }
.cv-kpi-val { margin: 2px 0 10px; font-family: var(--mono); font-size: 28px; font-weight: 800; }
.cv-barra { display: flex; height: 12px; border-radius: 99px; overflow: hidden; background: rgba(255,255,255,.15); }
.cv-barra span { display: block; height: 100%; }
.b-fiado, i.d.fiado { background: #8fd19e; } .b-prov, i.d.prov { background: #ffd27a; } .b-avista, i.d.avista { background: #8ec5ff; }
.cv-kpi-trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.cv-kpi-trio > div { padding: 7px 9px; border-radius: var(--r-sm); background: rgba(255,255,255,.1); min-width: 0; }
.cv-kpi-trio span { display: block; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: rgba(255,255,255,.7); }
.cv-kpi-trio b { font-family: var(--mono); font-size: 14px; }
i.d { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
.cv-nota { margin: 10px 0 0; font-size: .74rem; color: rgba(255,255,255,.7); line-height: 1.45; }
.cv-bloco { margin-bottom: 16px; }
.cv-titulo { display: flex; align-items: center; gap: 6px; padding: 0 2px; margin-bottom: 6px; font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.cv-n { padding: 0 7px; border-radius: 99px; background: var(--orange); color: #fff; font-size: .68rem; }
.cv-dica { margin: 2px 2px 10px; font-size: .78rem; color: var(--muted); line-height: 1.45; }
.cv-nada { padding: 16px; text-align: center; font-size: .85rem; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--r-md); }
.cv-lista { display: flex; flex-direction: column; gap: 8px; }
.cv-sug { padding: 12px; background: var(--surface); border: 1.5px solid var(--border); border-left-width: 4px; border-radius: var(--r-md); box-shadow: var(--shadow); }
.cv-sug.c-alta { border-left-color: var(--green); } .cv-sug.c-media { border-left-color: var(--gold-dark); } .cv-sug.c-baixa { border-left-color: var(--orange); }
.cv-sug-topo { display: flex; align-items: center; gap: 12px; }
.cv-sug-valor { font-family: var(--mono); font-weight: 800; font-size: 1.1rem; color: var(--green); }
.cv-sug-meta { flex: 1; min-width: 0; }
.cv-sug-pagador { font-weight: 800; font-size: .9rem; color: var(--brown-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cv-sug-data { font-size: .76rem; color: var(--muted); }
.cv-conf { padding: 2px 9px; border-radius: 99px; font-size: .66rem; font-weight: 800; background: var(--cream-deep); color: var(--brown-mid); }
.cv-conf.c-alta { background: var(--green-bg); color: var(--green); } .cv-conf.c-baixa { background: var(--orange-bg); color: var(--orange); }
.cv-sug-corpo { margin-top: 8px; font-size: .86rem; color: var(--brown-dark); }
.cv-sug-corpo i { color: var(--gold-dark); margin-right: 4px; }
.cv-sug-corpo small { display: block; margin-top: 2px; font-size: .75rem; color: var(--muted); }
.cv-sug-resto { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; font-size: .78rem; color: var(--muted); }
.cv-sug-acoes { margin-top: 10px; display: flex; gap: 8px; }
.cv-sug-acoes .btn { flex: 1; }
.cv-pag { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); }
.cv-avatar { flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: .8rem; background: var(--cream-deep); color: var(--brown-dark); }
.cv-pag-info { flex: 1; min-width: 0; }
.cv-pag-nome { font-weight: 800; font-size: .9rem; color: var(--brown-dark); }
.cv-tag { margin-left: 4px; padding: 1px 8px; border-radius: 99px; font-size: .62rem; font-weight: 700; background: var(--cream-deep); color: var(--brown-mid); white-space: nowrap; }
.cv-pag-linha { margin-top: 2px; font-size: .76rem; color: var(--muted); line-height: 1.4; }
.cv-pag-total { font-family: var(--mono); font-size: .9rem; color: var(--brown-dark); white-space: nowrap; }
.cv-mais { display: block; margin: 10px auto 0; padding: 8px 14px; border: 0; background: none; font-family: var(--font); font-size: .8rem; font-weight: 700; color: var(--brown); cursor: pointer; }
</style>
