<template>
  <!--
    Vendas — SOMENTE CONSULTA (aparelho Admin).
    Esta tela só LÊ: importa apenas funções de leitura da Caderneta e não tem
    nenhum botão que lance, receba, edite, exclua ou importe. Quem controla
    lojas, clientes e cobranças é o aparelho do vendedor.
  -->
  <div class="vc">
    <header class="vc-hdr">
      <button class="vc-hdr-btn" title="Voltar ao Admin" aria-label="Voltar ao Admin" @click="emit('voltar')">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="vc-hdr-txt">
        <div class="vc-hdr-titulo">Vendas</div>
        <div class="vc-hdr-sub">
          <span class="vc-pill"><i class="fas fa-eye"></i> Somente leitura</span>
          <span class="vc-atualizado" :class="{ 'vc-atualizado--erro': estado === 'erro' }">{{ rotuloAtualizacao }}</span>
        </div>
      </div>
      <button class="vc-hdr-btn vc-hdr-btn--atualizar" :disabled="atualizando" title="Atualizar" aria-label="Atualizar dados" @click="atualizar()">
        <i class="fas fa-rotate" :class="{ 'fa-spin': atualizando }"></i>
      </button>
    </header>

    <div ref="corpoEl" class="vc-corpo" @scroll.passive="aoRolar">
      <div v-if="!s.googleDriveConfigured" class="vc-aviso">
        <i class="fas fa-cloud-slash"></i>
        <span>O Google Drive não está conectado neste aparelho. Você vê só os dados que já estão aqui.</span>
      </div>
      <div v-else-if="s.syncStatus === 'conflict'" class="vc-aviso vc-aviso--alerta">
        <i class="fas fa-triangle-exclamation"></i>
        <span>Dois aparelhos alteraram dados ao mesmo tempo. Toque em atualizar para escolher qual versão manter.</span>
      </div>

      <!-- Números do dia -->
      <div class="vc-kpis">
        <div class="vc-kpi vc-kpi--main">
          <div class="vc-kpi-topo">
            <div>
              <div class="vc-kpi-rot">Em aberto</div>
              <div class="vc-kpi-val">R$ {{ fmt(resumo.totalAberto) }}</div>
            </div>
            <div class="vc-kpi-pilulas">
              <span class="vc-kpi-pilula"><i class="fas fa-receipt"></i><b>{{ resumo.qtdAbertas }}</b> {{ resumo.qtdAbertas === 1 ? 'compra' : 'compras' }}</span>
              <span class="vc-kpi-pilula"><i class="fas fa-user"></i><b>{{ resumo.qtdClientesDevendo }}</b> {{ resumo.qtdClientesDevendo === 1 ? 'cliente' : 'clientes' }}</span>
              <span class="vc-kpi-pilula"><i class="fas fa-circle-check"></i>Recebido hoje <b>R$ {{ fmt(resumo.recebidoHoje) }}</b></span>
            </div>
          </div>

          <div class="vc-kpi-sub">
            <div class="vc-kpi-sub-item vc-kpi-sub-item--vencido" :class="{ ativo: resumo.totalVencido > 0 }">
              <div class="vc-kpi-sub-rot"><i class="fas fa-triangle-exclamation"></i> Vencido</div>
              <div class="vc-kpi-sub-linha">
                <b>R$ {{ fmt(resumo.totalVencido) }}</b>
                <small>{{ resumo.qtdVencidas }} {{ resumo.qtdVencidas === 1 ? 'atrasada' : 'atrasadas' }}</small>
              </div>
            </div>
            <div class="vc-kpi-sub-item vc-kpi-sub-item--hoje" :class="{ ativo: resumo.qtdHoje > 0 }">
              <div class="vc-kpi-sub-rot"><i class="fas fa-calendar-day"></i> Vence hoje</div>
              <div class="vc-kpi-sub-linha">
                <b>R$ {{ fmt(resumo.totalHoje) }}</b>
                <small>{{ resumo.qtdHoje }} {{ resumo.qtdHoje === 1 ? 'compra' : 'compras' }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="vc-abas" role="tablist">
        <button v-for="a in abas" :key="a.id" role="tab" :aria-selected="aba === a.id" class="vc-aba" :class="{ sel: aba === a.id }" @click="aba = a.id">
          {{ a.nome }}
        </button>
      </div>

      <div class="vc-barra">
        <label class="vc-busca">
          <i class="fas fa-magnifying-glass"></i>
          <input :value="busca" type="search" enterkeyhint="search" :placeholder="placeholderBusca" autocomplete="off" @input="busca = $event.target.value">
          <button v-if="busca" type="button" class="vc-busca-x" aria-label="Limpar busca" @click="busca = ''"><i class="fas fa-xmark"></i></button>
        </label>
        <button
          type="button" class="vc-filtro-btn" :class="{ aberto: filtrosAbertos, ativo: filtroAtivo }"
          :aria-expanded="filtrosAbertos" aria-controls="vc-filtros-painel"
          :aria-label="filtroAtivo ? 'Filtros (um filtro ativo)' : 'Filtros'" @click="filtrosAbertos = !filtrosAbertos"
        >
          <i class="fas fa-sliders"></i>
          <span v-if="filtroAtivo" class="vc-filtro-dot"></span>
        </button>
      </div>

      <div id="vc-filtros-painel" class="vc-painel" :class="{ aberto: filtrosAbertos }" :aria-hidden="!filtrosAbertos">
        <div class="vc-painel-inner">
          <div class="vc-painel-card">
            <div class="vc-painel-rot">{{ aba === 'lojas' ? 'Mostrar lojas' : 'Mostrar no histórico' }}</div>
            <div class="vc-seg" role="radiogroup">
              <button
                v-for="f in filtrosLista" :key="f.id" type="button" role="radio" class="vc-seg-btn"
                :aria-checked="filtroSelecionado === f.id" :class="{ sel: filtroSelecionado === f.id }"
                :tabindex="filtrosAbertos ? 0 : -1" @click="escolherFiltro(f.id)"
              >
                <span class="vc-seg-nome">{{ f.nome }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <button v-if="filtroAtivo && !filtrosAbertos" type="button" class="vc-filtro-ativo" @click="limparFiltro">
        <i class="fas fa-filter"></i> {{ rotuloFiltroAtivo }} <i class="fas fa-xmark vc-filtro-ativo-x"></i>
      </button>

      <div v-if="carregando" class="vc-vazio"><div class="vc-spin"></div> Carregando…</div>

      <!-- LOJAS: loja → clientes (cada cliente mostra se está em dia, vence ou está atrasado) -->
      <template v-else-if="aba === 'lojas'">
        <div v-if="!gruposAtivos.length" class="cad-empty">
          <div class="cad-empty-ico"><i class="fas fa-inbox"></i></div>
          <p>{{ textoVazio }}</p>
        </div>

        <div v-for="g in gruposAtivos" :key="g.lojaId" class="cad-grupo-loja">
          <div class="cad-loja-header" :class="{ colapsado: lojaColapsada(g) }" @click="!grupoUnico && alternarLoja(g)" :style="grupoUnico ? 'cursor: default' : null">
            <svg class="cad-loja-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span class="cad-loja-nome">
              {{ g.lojaNome }}
              <small v-if="g.local" class="cad-loja-local">{{ g.local }}</small>
              <small class="cad-loja-local">{{ g.clientes.length }} {{ g.clientes.length === 1 ? 'cliente' : 'clientes' }}</small>
            </span>
            <span class="cad-loja-dir">
              <span v-if="g.total > 0.01" class="cad-loja-total">R$ {{ fmt(g.total) }}</span>
              <span v-else class="cad-chip cad-chip--ok"><i class="fas fa-check"></i> Em dia</span>
              <span v-if="g.vencidos" class="cad-chip cad-chip--red">{{ g.vencidos }} {{ g.vencidos > 1 ? 'vencidos' : 'vencido' }}</span>
            </span>
            <svg v-if="!grupoUnico" class="cad-loja-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>

          <div class="cad-grupo-clientes cad-grupo-clientes--indent" :class="{ colapsado: lojaColapsada(g) }">
            <button v-for="c in g.clientes" :key="c.clienteId" type="button" class="cad-cli-card vc-cli-linha" :class="{ atrasado: c.atrasado }" @click="abrirModal({ tipo: 'cliente', id: c.clienteId })">
              <div class="cad-cli-avatar" :class="{ atrasado: c.atrasado }">{{ iniciais(c.clienteNome) }}</div>
              <div class="cad-cli-info">
                <div class="cad-cli-nome">{{ c.clienteNome }}</div>
                <div v-if="c.clienteFuncao" class="cad-cli-sub"><span class="cad-funcao-tag cad-funcao-tag--linha">{{ c.clienteFuncao }}</span></div>
              </div>
              <div v-if="c.saldo > 0.01" class="cad-cli-valor" :class="{ 'cad-cli-valor--red': c.atrasado }">
                <b>R$ {{ fmt(c.saldo) }}</b>
                <span class="cad-cli-status" :class="statusCliente(c).cls">{{ statusCliente(c).txt }}</span>
              </div>
              <span v-else class="cad-chip cad-chip--ok"><i class="fas fa-check"></i> Em dia</span>
              <i class="fas fa-chevron-right vc-seta-dir"></i>
            </button>
          </div>
        </div>
      </template>

      <!-- HISTÓRICO -->
      <template v-else>
        <div class="vc-lista">
          <button v-for="m in movimentosFiltrados" :key="m.chave" class="vc-linha" @click="abrirModal({ tipo: 'fiado', id: m.fiado.id })">
            <template v-if="m.tipo === 'pagamento'">
              <span class="vc-av vc-av--pago"><i class="fas fa-circle-check"></i></span>
              <span class="vc-linha-txt">
                <span class="vc-linha-nome">{{ m.fiado.clienteNome }}</span>
                <span class="vc-linha-sub">Pagamento · {{ fmtBR(m.data) }}<template v-if="fmtHora(m.hora)"> - {{ fmtHora(m.hora) }}</template> · {{ m.fiado.lojaNome }}</span>
                <span class="vc-linha-sub vc-linha-sub--pag">{{ m.quitou ? `Quitou a compra de R$ ${fmt(m.fiado.total)}` : `Pagou em parte · faltou R$ ${fmt(m.saldoDepois)}` }}</span>
              </span>
              <span class="vc-linha-val vc-linha-val--pago">+ R$ {{ fmt(m.valor) }}</span>
            </template>
            <template v-else>
              <span class="vc-av" :class="{ 'vc-av--pago': m.fiado.status === 'pago' }">
                <i v-if="m.fiado.status === 'pago'" class="fas fa-check"></i><template v-else>{{ iniciais(m.fiado.clienteNome) }}</template>
              </span>
              <span class="vc-linha-txt">
                <span class="vc-linha-nome">{{ m.fiado.clienteNome }}</span>
                <span class="vc-linha-sub">{{ fmtBR(m.fiado.dataVenda) }} · {{ m.fiado.lojaNome }} · {{ qtdItens(m.fiado) }}</span>
                <span v-if="totalPago(m.fiado) > 0 && m.fiado.status === 'aberto'" class="vc-linha-sub vc-linha-sub--pag">Já pagou R$ {{ fmt(totalPago(m.fiado)) }} · falta R$ {{ fmt(m.fiado.saldo) }}</span>
              </span>
              <span class="vc-linha-val" :class="{ 'vc-linha-val--pago': m.fiado.status === 'pago' }">R$ {{ fmt(m.fiado.total) }}</span>
            </template>
          </button>
        </div>
        <div v-if="!movimentosFiltrados.length" class="vc-vazio">{{ filtroHist === 'recebimentos' ? 'Nenhum pagamento encontrado.' : 'Nenhuma venda encontrada.' }}</div>
        <p v-else-if="movimentosOrdenados.length > LIMITE_HIST && !busca" class="vc-mais">Mostrando as {{ LIMITE_HIST }} mais recentes. Use a busca para achar as antigas.</p>
      </template>
    </div>

    <!-- Voltar ao topo da lista -->
    <Transition name="vc-topo">
      <button v-if="mostrarTopo" type="button" class="vc-topo" aria-label="Voltar ao topo" title="Voltar ao topo" @click="voltarAoTopo">
        <i class="fas fa-arrow-up"></i>
      </button>
    </Transition>

    <!-- Detalhes (somente leitura) -->
    <Teleport to="body">
      <div v-if="modal" class="vc-ov" @click.self="fecharModal()">
        <div class="vc-folha" role="dialog" aria-modal="true">
          <div class="vc-folha-topo">
            <div class="vc-folha-titulo">{{ tituloFolha }}</div>
            <button class="vc-folha-x" aria-label="Fechar" @click="fecharModal()"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="vc-folha-corpo">
            <!-- compra -->
            <template v-if="modal.tipo === 'fiado' && fiadoAberto">
              <div class="vc-det-quem">
                <b>{{ fiadoAberto.clienteNome }}</b>
                <span>{{ fiadoAberto.lojaNome }}</span>
              </div>
              <div class="vc-status" :class="statusClasse(fiadoAberto)">{{ statusTexto(fiadoAberto) }}</div>

              <div v-if="fiadoAberto.itens?.length" class="vc-itens">
                <div v-for="(i, idx) in fiadoAberto.itens" :key="`${i.id}-${i.preco}-${idx}`" class="vc-item">
                  <span class="vc-item-emoji">{{ i.emoji || '📦' }}</span>
                  <span class="vc-item-nome">{{ i.qty ?? i.qtd }}× {{ i.nome }}<small>R$ {{ fmt(i.preco) }} cada</small></span>
                  <span class="vc-item-sub">R$ {{ fmt(i.subtotal ?? (i.qty ?? i.qtd) * i.preco) }}</span>
                </div>
              </div>
              <p v-else-if="fiadoAberto.descricaoLivre" class="vc-livre">{{ fiadoAberto.descricaoLivre }}</p>

              <div v-if="desconto(fiadoAberto) > 0" class="vc-item vc-item--desc">
                <span class="vc-item-emoji">🏷️</span>
                <span class="vc-item-nome">Desconto<small v-if="fiadoAberto.descontoMotivo">{{ fiadoAberto.descontoMotivo }}</small></span>
                <span class="vc-item-sub">− R$ {{ fmt(desconto(fiadoAberto)) }}</span>
              </div>

              <div class="vc-totais">
                <div><span>Total da compra</span><b>R$ {{ fmt(fiadoAberto.total) }}</b></div>
                <div v-if="totalPago(fiadoAberto) > 0"><span>Já recebido</span><b class="vc-verde">R$ {{ fmt(totalPago(fiadoAberto)) }}</b></div>
                <div class="vc-totais-saldo"><span>Falta receber</span><b>R$ {{ fmt(fiadoAberto.saldo) }}</b></div>
              </div>

              <div class="vc-datas">
                <div><small>Data da compra</small><b>{{ fmtBR(fiadoAberto.dataVenda) }}<template v-if="fmtHora(fiadoAberto.horaVenda)"> {{ fmtHora(fiadoAberto.horaVenda) }}</template></b></div>
                <div><small>Combinado para</small><b>{{ fmtBR(fiadoAberto.dataVenc) }}</b></div>
              </div>

              <template v-if="fiadoAberto.pagamentos?.length">
                <div class="vc-sub-tit">Pagamentos</div>
                <div v-for="(p, idx) in fiadoAberto.pagamentos" :key="idx" class="vc-pag">
                  <span><i class="fas fa-circle-check"></i> {{ fmtBR(p.data) }}<template v-if="fmtHora(p.hora)"> {{ fmtHora(p.hora) }}</template></span>
                  <b>R$ {{ fmt(p.valor) }}</b>
                </div>
              </template>
            </template>

            <!-- cliente -->
            <template v-else-if="modal.tipo === 'cliente' && clienteAberto">
              <div class="vc-det-quem">
                <b>{{ clienteAberto.nome }}<small v-if="clienteAberto.funcao"> · {{ clienteAberto.funcao }}</small></b>
                <span>{{ nomeLoja(clienteAberto.lojaId) }}<template v-if="clienteAberto.telefone"> · {{ telefoneBonito(clienteAberto.telefone) }}</template></span>
              </div>
              <div class="vc-totais">
                <div class="vc-totais-saldo"><span>Em aberto</span><b>R$ {{ fmt(saldoCliente(clienteAberto.id)) }}</b></div>
                <div><span>Compras no total</span><b>{{ comprasDoCliente(clienteAberto.id).length }}</b></div>
              </div>
              <div class="vc-sub-tit">Compras</div>
              <button v-for="f in comprasDoCliente(clienteAberto.id)" :key="f.id" class="vc-linha vc-linha--folha" @click="abrirModal({ tipo: 'fiado', id: f.id })">
                <span class="vc-linha-txt">
                  <span class="vc-linha-nome">{{ fmtBR(f.dataVenda) }}</span>
                  <span class="vc-linha-sub">{{ qtdItens(f) }} · {{ statusTexto(f) }}</span>
                </span>
                <span class="vc-linha-val" :class="{ 'vc-linha-val--pago': f.status === 'pago' }">R$ {{ fmt(f.status === 'pago' ? f.total : f.saldo) }}</span>
              </button>
              <div v-if="!comprasDoCliente(clienteAberto.id).length" class="vc-vazio">Nenhuma compra registrada.</div>
            </template>

          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from '../store.js'
import { useModalStack } from '../composables/useModalStack.js'
// Só funções de LEITURA — nada que grave está importado aqui.
import {
  getLojas, getTodosClientes, getFiados,
  fmt, fmtBR, fmtHora, iniciais, normalizar, hoje, centavos
} from '../composables/useCaderneta.js'
import { telefoneBonito } from '../services/contatoService.js'

const emit = defineEmits(['voltar'])
const s = useStore()
const { modal, abrirModal, fecharModal } = useModalStack()

const lojas = ref([])
const clientes = ref([])
const fiados = ref([])
const carregando = ref(true)
const atualizando = ref(false)
const estado = ref('ok') // 'ok' | 'erro'
const agora = ref(Date.now())

// Botão "voltar ao topo": aparece depois de rolar um pouco a lista.
const corpoEl = ref(null)
const mostrarTopo = ref(false)
const LIMITE_TOPO = 320
function aoRolar() { mostrarTopo.value = (corpoEl.value?.scrollTop || 0) > LIMITE_TOPO }
function voltarAoTopo() {
  const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  corpoEl.value?.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' })
}

const aba = ref('lojas')
const busca = ref('')
const filtroHist = ref('todos')
const LIMITE_HIST = 200

const abas = [
  { id: 'lojas',     nome: 'Lojas' },
  { id: 'historico', nome: 'Histórico' }
]

// Filtros ficam escondidos atrás do botão ao lado da busca (painel recolhível).
const filtrosAbertos = ref(false)
const filtroLojas = ref('todas')   // 'todas' | 'abertas' (só lojas com valor em aberto)
const placeholderBusca = computed(() => ({
  lojas: 'Buscar loja ou cliente', historico: 'Buscar cliente, loja ou item'
}[aba.value]))

watch(aba, () => { busca.value = ''; filtrosAbertos.value = false })

// ── Carga ─────────────────────────────────────────────────
async function carregar() {
  try {
    const [l, c, f] = await Promise.all([getLojas({ incluirArquivadas: true }), getTodosClientes(), getFiados()])
    lojas.value = l
    clientes.value = c
    // O nome fica copiado em cada venda: usa sempre o do cadastro atual (cobre renomeações), como no painel do vendedor.
    const nomeCliente = Object.fromEntries(c.map(x => [x.id, x.nome]))
    const nomeDaLoja = Object.fromEntries(l.map(x => [x.id, x.nome]))
    fiados.value = f.map(x => ({ ...x, clienteNome: nomeCliente[x.clienteId] || x.clienteNome, lojaNome: nomeDaLoja[x.lojaId] || x.lojaNome }))
    estado.value = 'ok'
  } catch (e) {
    console.error('[consulta] falha ao ler dados', e)
    estado.value = 'erro'
  } finally {
    carregando.value = false
  }
}

// Busca no Drive o que o vendedor salvou e relê a tela. Não grava nada do lado das vendas.
async function atualizar({ silencioso = false } = {}) {
  if (atualizando.value) return
  atualizando.value = true
  try {
    if (s.googleDriveConfigured) {
      if (s.syncStatus === 'conflict') await s.resolverConflitoSync()
      else await s.iniciarSync()
    }
    await carregar()
    agora.value = Date.now()
  } catch (e) {
    console.error('[consulta] falha ao atualizar', e)
    estado.value = 'erro'
    if (!silencioso) s.notify('Não foi possível atualizar agora.', 'error')
  } finally {
    atualizando.value = false
  }
}

// Atualização automática enquanto a tela está aberta e visível.
const INTERVALO_MS = 2 * 60_000
let timerAuto = null
let timerRelogio = null
const aoVoltar = () => { if (document.visibilityState === 'visible') atualizar({ silencioso: true }) }

onMounted(async () => {
  await carregar()
  atualizar({ silencioso: true })
  timerAuto = setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) atualizar({ silencioso: true })
  }, INTERVALO_MS)
  timerRelogio = setInterval(() => { agora.value = Date.now() }, 30_000)
  document.addEventListener('visibilitychange', aoVoltar)
})
onBeforeUnmount(() => {
  clearInterval(timerAuto)
  clearInterval(timerRelogio)
  document.removeEventListener('visibilitychange', aoVoltar)
})
// Dados trocados por um sync (baixou/mesclou do Drive): relê.
watch(() => s.dadosVersao, carregar)

const rotuloAtualizacao = computed(() => {
  if (estado.value === 'erro') return 'Falha ao atualizar'
  if (atualizando.value) return 'Atualizando…'
  const ts = s.ultimoSyncTs ? Date.parse(s.ultimoSyncTs) : 0
  if (!ts) return s.googleDriveConfigured ? 'Ainda não atualizado' : 'Dados deste aparelho'
  const min = Math.floor((agora.value - ts) / 60000)
  if (min < 1) return 'Atualizado agora'
  if (min < 60) return `Atualizado há ${min} min`
  const h = new Date(ts)
  const hh = String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0')
  return new Date(ts).toDateString() === new Date().toDateString() ? `Atualizado às ${hh}` : `Atualizado em ${fmtBR(new Date(ts).toLocaleDateString('sv'))} ${hh}`
})

// ── Derivados ─────────────────────────────────────────────
const lojaPorId = computed(() => Object.fromEntries(lojas.value.map(l => [l.id, l])))
const nomeLoja = (id) => lojaPorId.value[id]?.nome || '—'
const abertas = computed(() => fiados.value.filter(f => f.status === 'aberto' && f.saldo > 0.01))

const saldoPorCliente = computed(() => {
  const m = {}
  for (const f of abertas.value) m[f.clienteId] = centavos((m[f.clienteId] || 0) + Number(f.saldo))
  return m
})
const saldoCliente = (id) => saldoPorCliente.value[id] || 0
const comprasDoCliente = (id) => fiados.value
  .filter(f => f.clienteId === id)
  .sort((a, b) => chaveRecente(b).localeCompare(chaveRecente(a)))

const chaveRecente = (f) => `${f.dataVenda || ''} ${f.horaVenda || ''} ${f.criadoEm || ''}`

// Cada pagamento (inclusive parcial) de cada compra, como um movimento próprio do histórico.
const todosPagamentos = computed(() => fiados.value.flatMap(f =>
  (f.pagamentos || []).map((p, idx) => ({
    tipo: 'pagamento', chave: `p-${f.id}-${idx}`, fiado: f,
    valor: Number(p.valor) || 0, data: p.data || '', hora: p.hora || '',
    saldoDepois: Number(p.saldoDepois) || 0, quitou: Number(p.saldoDepois) <= 0.01,
    ordem: `${p.data || ''} ${p.hora || ''} ${p.criadoEm || ''}`
  }))
))

const resumo = computed(() => {
  const hj = hoje()
  const soma = (lista) => centavos(lista.reduce((t, f) => t + Number(f.saldo), 0))
  const vencidas = abertas.value.filter(f => f.dataVenc && f.dataVenc < hj)
  const deHoje = abertas.value.filter(f => f.dataVenc === hj)
  return {
    totalAberto: soma(abertas.value), qtdAbertas: abertas.value.length,
    qtdClientesDevendo: Object.keys(saldoPorCliente.value).length,
    totalVencido: soma(vencidas), qtdVencidas: vencidas.length,
    totalHoje: soma(deHoje), qtdHoje: deHoje.length,
    recebidoHoje: centavos(todosPagamentos.value.filter(p => p.data === hj).reduce((t, p) => t + p.valor, 0))
  }
})

const termo = computed(() => normalizar(busca.value.trim()))
const casa = (...campos) => !termo.value || normalizar(campos.filter(Boolean).join(' ')).includes(termo.value)

// ── Lojas: loja → clientes (igual ao painel do vendedor, só que recolhido) ──
const lojasEstado = ref(new Map())        // loja aberta/fechada (escolha da pessoa)

const diasEntre = (a, b) => Math.max(0, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000))
const localLoja = (l) => [l?.bairro, l?.referencia].filter(Boolean).join(' · ')
const maisRecentesPrimeiro = (a, b) => chaveRecente(b).localeCompare(chaveRecente(a))

const fiadosPorCliente = computed(() => {
  const m = new Map()
  for (const f of fiados.value) {
    if (!m.has(f.clienteId)) m.set(f.clienteId, [])
    m.get(f.clienteId).push(f)
  }
  return m
})

function montarCliente(c, hj) {
  const todos = (fiadosPorCliente.value.get(c.id) || [])
    .map(f => ({ ...f, atrasada: f.status === 'aberto' && f.saldo > 0.01 && !!f.dataVenc && f.dataVenc < hj }))
    .sort(maisRecentesPrimeiro)
  const abertos = todos.filter(f => f.status === 'aberto' && f.saldo > 0.01)
  const vencidos = abertos.filter(f => f.atrasada)
  const soma = (l) => centavos(l.reduce((t, f) => t + Number(f.saldo), 0))
  return {
    clienteId: c.id, clienteNome: c.nome, clienteFuncao: c.funcao || '', arquivado: !!c.arquivado,
    fiados: todos,
    saldo: soma(abertos), atrasado: vencidos.length > 0, valorVencido: soma(vencidos),
    maxDiasAtraso: vencidos.reduce((m, f) => Math.max(m, diasEntre(f.dataVenc, hj)), 0),
    nCompras: todos.length, ultima: todos[0]?.dataVenda || ''
  }
}

const gruposBase = computed(() => {
  if (aba.value !== 'lojas') return []
  const hj = hoje()
  const porLoja = new Map()
  const garantirLoja = (id, nomeFallback) => {
    if (!porLoja.has(id)) {
      const l = lojaPorId.value[id]
      porLoja.set(id, { lojaId: id, lojaNome: l?.nome || nomeFallback || 'Sem loja', local: localLoja(l), clientes: [] })
    }
    return porLoja.get(id)
  }
  lojas.value.filter(l => !l.arquivado).forEach(l => garantirLoja(l.id))

  // Clientes do cadastro + (raro) clientes que sumiram do cadastro mas ainda têm compras.
  const fonte = [...clientes.value]
  const cadastrados = new Set(clientes.value.map(c => c.id))
  for (const [id, lista] of fiadosPorCliente.value) {
    if (!cadastrados.has(id)) fonte.push({ id, nome: lista[0].clienteNome, funcao: '', lojaId: lista[0].lojaId, _lojaNome: lista[0].lojaNome })
  }
  for (const c of fonte) {
    const cli = montarCliente(c, hj)
    if (cli.arquivado && cli.saldo <= 0.01) continue
    garantirLoja(c.lojaId, c._lojaNome).clientes.push(cli)
  }

  const t = termo.value
  const grupos = [...porLoja.values()].map(g => {
    if (!t) return g
    const lojaCasa = casa(g.lojaNome, g.local)
    return { ...g, _lojaCasa: lojaCasa, clientes: lojaCasa ? g.clientes : g.clientes.filter(c => casa(c.clienteNome, c.clienteFuncao)) }
  }).filter(g => g.clientes.length || !t || g._lojaCasa)

  return grupos.map(g => {
    const clientesOrd = [...g.clientes].sort((a, b) =>
      (b.maxDiasAtraso - a.maxDiasAtraso) || (b.saldo - a.saldo) || a.clienteNome.localeCompare(b.clienteNome, 'pt-BR'))
    return {
      ...g, clientes: clientesOrd,
      total: centavos(clientesOrd.reduce((n, c) => n + c.saldo, 0)),
      vencidos: clientesOrd.filter(c => c.atrasado).length,
      valorVencido: clientesOrd.reduce((n, c) => n + c.valorVencido, 0)
    }
  }).sort((a, b) => (b.valorVencido - a.valorVencido) || (b.total - a.total) || a.lojaNome.localeCompare(b.lojaNome, 'pt-BR'))
})
const gruposAtivos = computed(() =>
  filtroLojas.value === 'abertas' ? gruposBase.value.filter(g => g.total > 0.01) : gruposBase.value)
const grupoUnico = computed(() => gruposAtivos.value.length === 1)

// ── Filtros (conteúdo do painel, conforme a aba) ──
const filtrosLista = computed(() => aba.value === 'lojas'
  ? [
      { id: 'todas',   nome: 'Todas as lojas',     n: gruposBase.value.length },
      { id: 'abertas', nome: 'Com valor em aberto', n: gruposBase.value.filter(g => g.total > 0.01).length }
    ]
  : [
      { id: 'todos',   nome: 'Tudo',      n: fiados.value.length + todosPagamentos.value.length },
      { id: 'abertas', nome: 'Em aberto', n: fiados.value.filter(f => f.status === 'aberto').length },
      { id: 'pagas',   nome: 'Pagas',     n: fiados.value.filter(f => f.status === 'pago').length },
      { id: 'recebimentos', nome: 'Recebimentos', n: todosPagamentos.value.length }
    ])
const filtroSelecionado = computed(() => aba.value === 'lojas' ? filtroLojas.value : filtroHist.value)
const filtroAtivo = computed(() => filtroSelecionado.value !== (aba.value === 'lojas' ? 'todas' : 'todos'))
const rotuloFiltroAtivo = computed(() => filtrosLista.value.find(f => f.id === filtroSelecionado.value)?.nome || '')
function escolherFiltro(id) {
  if (aba.value === 'lojas') filtroLojas.value = id
  else filtroHist.value = id
}
function limparFiltro() { escolherFiltro(aba.value === 'lojas' ? 'todas' : 'todos') }

const textoVazio = computed(() => busca.value.trim() ? 'Nada encontrado.' : (filtroLojas.value === 'abertas' ? 'Nenhuma loja com valor em aberto.' : 'Nenhuma loja cadastrada.'))

const chaveLoja = (g) => `lojas|${g.lojaId}`
// Todas as lojas começam recolhidas: o cabeçalho já mostra o total e se há vencidos.
// Abre ao tocar; a busca abre tudo; com uma loja só, ela fica aberta.
function lojaColapsada(g) {
  if (grupoUnico.value || busca.value.trim()) return false
  const k = chaveLoja(g)
  return lojasEstado.value.has(k) ? !lojasEstado.value.get(k) : true
}
function alternarLoja(g) {
  const m = new Map(lojasEstado.value)
  m.set(chaveLoja(g), lojaColapsada(g)) // estava fechada → abre (e vice-versa)
  lojasEstado.value = m
}

// Situação do cliente (coluna do valor): atrasado há N dias, vence hoje, vence dd/mm.
function statusCliente(c) {
  if (c.atrasado) return { txt: `${Math.max(1, c.maxDiasAtraso)}d em atraso`, cls: 'cad-cli-status--red' }
  const datas = c.fiados.filter(f => f.status === 'aberto' && f.saldo > 0.01 && f.dataVenc).map(f => f.dataVenc).sort()
  if (!datas.length) return { txt: 'Sem vencimento', cls: '' }
  return datas[0] === hoje()
    ? { txt: 'Vence hoje', cls: 'cad-cli-status--warn' }
    : { txt: `Vence ${fmtBR(datas[0]).slice(0, 5)}`, cls: '' }
}

// Histórico = compras + pagamentos, do mais recente para o mais antigo.
// "Todas" mistura os dois; "Em aberto"/"Pagas" mostram só compras; "Recebimentos" só pagamentos.
const movimentosOrdenados = computed(() => {
  const f = filtroHist.value
  const compras = f === 'recebimentos' ? [] : fiados.value
    .filter(x => f === 'todos' || (f === 'abertas' ? x.status === 'aberto' : x.status === 'pago'))
    .map(x => ({ tipo: 'compra', chave: `c-${x.id}`, fiado: x, ordem: chaveRecente(x) }))
  const pagamentos = (f === 'todos' || f === 'recebimentos') ? todosPagamentos.value : []
  return [...compras, ...pagamentos].sort((a, b) => b.ordem.localeCompare(a.ordem))
})
const movimentosFiltrados = computed(() => {
  const lista = movimentosOrdenados.value.filter(m =>
    casa(m.fiado.clienteNome, m.fiado.lojaNome, (m.fiado.itens || []).map(i => i.nome).join(' '), m.fiado.descricaoLivre))
  return termo.value ? lista : lista.slice(0, LIMITE_HIST)
})

// ── Detalhes ──────────────────────────────────────────────
const fiadoAberto = computed(() => modal.value?.tipo === 'fiado' ? fiados.value.find(f => f.id === modal.value.id) : null)
const clienteAberto = computed(() => modal.value?.tipo === 'cliente' ? clientes.value.find(c => c.id === modal.value.id) : null)
const tituloFolha = computed(() => ({ fiado: 'Compra', cliente: 'Cliente' }[modal.value?.tipo] || ''))

const desconto = (f) => centavos(Number(f?.desconto) || 0)
const totalPago = (f) => centavos((f.pagamentos || []).reduce((t, p) => t + Number(p.valor || 0), 0))
function qtdItens(f) {
  if (f.itens?.length) {
    const t = f.itens.reduce((n, i) => n + (i.qty || i.qtd || 0), 0)
    return `${t} ${t === 1 ? 'item' : 'itens'}`
  }
  return f.descricaoLivre || 'Valor avulso'
}
function statusTexto(f) {
  if (f.status === 'pago') return 'Pago'
  const hj = hoje()
  if (f.dataVenc && f.dataVenc < hj) return `Atrasada desde ${fmtBR(f.dataVenc)}`
  if (f.dataVenc === hj) return 'Vence hoje'
  return f.saldo < f.total - 0.01 ? 'Pago em parte' : 'Em aberto'
}
function statusClasse(f) {
  if (f.status === 'pago') return 'vc-status--pago'
  return f.dataVenc && f.dataVenc < hoje() ? 'vc-status--atraso' : ''
}
</script>

<style scoped>
.vc { position: relative; height: 100%; display: flex; flex-direction: column; background: var(--bg); font-family: var(--font); }

/* Cabeçalho */
.vc-hdr {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0; min-height: 60px;
  padding: 10px 14px; padding-top: max(10px, env(safe-area-inset-top));
  background: linear-gradient(135deg, var(--brown-dark) 0%, var(--brown) 100%);
  box-shadow: 0 2px 12px rgba(30, 18, 8, .28); z-index: var(--z-header);
}
.vc-hdr-btn {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; cursor: pointer;
  border: 1px solid rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .1); color: #fff; font-size: 15px;
  display: flex; align-items: center; justify-content: center; transition: background var(--t), transform .1s;
}
.vc-hdr-btn:active { transform: scale(.94); background: rgba(255, 255, 255, .2); }
.vc-hdr-btn:disabled { opacity: .7; }
.vc-hdr-txt { flex: 1; min-width: 0; }
.vc-hdr-titulo { font-size: 18px; font-weight: 900; color: #fff; letter-spacing: -.01em; }
.vc-hdr-sub { display: flex; align-items: center; gap: 8px; margin-top: 2px; flex-wrap: wrap; }
.vc-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: var(--r-full);
  background: rgba(245, 200, 66, .22); color: var(--gold-light); font-size: 10.5px; font-weight: 800; letter-spacing: .02em;
}
.vc-atualizado { font-size: 11.5px; font-weight: 600; color: rgba(255, 255, 255, .72); }
.vc-atualizado--erro { color: #fca5a5; }

/* Corpo */
.vc-corpo { flex: 1; overflow-y: auto; padding: 14px 14px max(28px, env(safe-area-inset-bottom)); -webkit-overflow-scrolling: touch; }
.vc-aviso {
  display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; padding: 10px 12px; border-radius: var(--r-sm);
  background: var(--cream); color: var(--brown-mid); font-size: 12.5px; line-height: 1.4; font-weight: 600;
}
.vc-aviso i { margin-top: 2px; }
.vc-aviso--alerta { background: var(--orange-bg); color: var(--orange); }

/* KPIs */
.vc-kpis { margin-bottom: 12px; }
.vc-kpi {
  padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); box-shadow: var(--shadow);
}
.vc-kpi--main { padding: 10px 12px; background: linear-gradient(135deg, var(--brown-dark), var(--brown)); border-color: transparent; color: #fff; }
.vc-kpi-topo { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.vc-kpi-rot { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: rgba(255, 255, 255, .7); }
.vc-kpi-val { margin-top: 1px; font-family: var(--mono); font-size: 26px; line-height: 1.1; font-weight: 800; color: #fff; }
.vc-kpi-pilulas { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.vc-kpi-pilula {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px;
  background: rgba(255, 255, 255, .14); font-size: 11.5px; font-weight: 600; color: rgba(255, 255, 255, .85); white-space: nowrap;
}
.vc-kpi-pilula i { font-size: 10px; opacity: .75; }
.vc-kpi-pilula b { font-family: var(--mono); font-weight: 800; color: #fff; }

/* Vencido / Vence hoje: dois blocos lado a lado, com cor só quando há algo a cobrar */
.vc-kpi-sub { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.vc-kpi-sub-item { padding: 6px 10px; border-radius: var(--r-sm); background: rgba(255, 255, 255, .1); min-width: 0; }
.vc-kpi-sub-rot { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: rgba(255, 255, 255, .7); }
.vc-kpi-sub-rot i { font-size: 10px; }
.vc-kpi-sub-linha { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 6px; margin-top: 1px; }
.vc-kpi-sub-linha b { font-family: var(--mono); font-size: 15px; font-weight: 800; color: #fff; }
.vc-kpi-sub-linha small { font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, .75); }
.vc-kpi-sub-item--vencido.ativo { background: var(--red); }
.vc-kpi-sub-item--hoje.ativo { background: var(--orange); }
.vc-kpi-sub-item.ativo .vc-kpi-sub-rot, .vc-kpi-sub-item.ativo .vc-kpi-sub-linha small { color: rgba(255, 255, 255, .92); }

/* Abas e busca */
.vc-abas { display: flex; gap: 4px; padding: 4px; margin-bottom: 12px; background: var(--cream-deep); border-radius: var(--r-md); }
.vc-aba {
  flex: 1; min-height: 40px; border: 0; border-radius: var(--r-sm); cursor: pointer; background: transparent;
  font-family: var(--font); font-size: 12.5px; font-weight: 800; color: var(--brown-mid); transition: all var(--t);
}
.vc-aba.sel { background: var(--surface); color: var(--brown-dark); box-shadow: var(--shadow); }
.vc-busca {
  display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; margin-bottom: 14px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); color: var(--muted);
}
.vc-busca:focus-within { border-color: var(--brown); }
.vc-busca input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font-family: var(--font); font-size: 15px; font-weight: 600; color: var(--text); }
/* Esconde o "x" nativo do input type=search (já existe o nosso botão de limpar) */
.vc-busca input { -webkit-appearance: none; appearance: none; }
.vc-busca input::-webkit-search-cancel-button,
.vc-busca input::-webkit-search-decoration,
.vc-busca input::-webkit-search-results-button,
.vc-busca input::-webkit-search-results-decoration { -webkit-appearance: none; appearance: none; display: none; }
.vc-busca input::-ms-clear { display: none; }
.vc-busca-x { border: 0; background: none; color: var(--muted); font-size: 14px; cursor: pointer; padding: 6px; }
/* Barra de busca + botão de filtros */
.vc-barra { display: flex; gap: 8px; margin-bottom: 12px; }
.vc-barra .vc-busca { flex: 1; min-width: 0; margin-bottom: 0; }
.vc-filtro-btn {
  position: relative; flex-shrink: 0; width: 46px; height: 46px; display: grid; place-items: center; cursor: pointer;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); color: var(--brown-mid); font-size: 16px;
  transition: background var(--t), border-color var(--t), color var(--t), transform .1s;
}
.vc-filtro-btn:active { transform: scale(.94); }
.vc-filtro-btn.aberto { background: var(--cream-deep); border-color: var(--brown); color: var(--brown-dark); }
.vc-filtro-btn.ativo { color: var(--brown-dark); border-color: var(--brown-light); }
.vc-filtro-dot {
  position: absolute; top: 7px; right: 7px; width: 10px; height: 10px; border-radius: 50%;
  background: var(--orange); border: 2px solid var(--surface);
}

/* Painel recolhível (abre/fecha com transição suave) */
.vc-painel {
  display: grid; grid-template-rows: 0fr; opacity: 0; visibility: hidden; margin-bottom: 0;
  transition: grid-template-rows .22s ease, opacity .18s ease, margin-bottom .22s ease, visibility 0s linear .22s;
}
.vc-painel.aberto { grid-template-rows: 1fr; opacity: 1; visibility: visible; margin-bottom: 12px; transition-delay: 0s; }
.vc-painel-inner { overflow: hidden; min-height: 0; }
.vc-painel-card { padding: 10px 12px 12px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.vc-painel-rot { margin: 0 2px 8px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.vc-seg { display: flex; gap: 4px; padding: 4px; background: var(--cream-deep); border-radius: var(--r-md); }
.vc-seg-btn {
  flex: 1; min-width: 0; min-height: 40px; display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 0 8px; border: 0; border-radius: var(--r-sm); cursor: pointer; background: transparent;
  font-family: var(--font); font-size: 12.5px; font-weight: 800; color: var(--brown-mid); transition: all var(--t);
}
.vc-seg-btn.sel { background: var(--surface); color: var(--brown-dark); box-shadow: var(--shadow); }
.vc-seg-nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vc-seg-n {
  min-width: 20px; padding: 1px 6px; border-radius: var(--r-full); background: rgba(0, 0, 0, .06);
  font-family: var(--mono); font-size: 11px; font-weight: 800; text-align: center;
}
.vc-seg-btn.sel .vc-seg-n { background: var(--brown); color: #fff; }

/* Lembrete do filtro ativo quando o painel está fechado */
.vc-filtro-ativo {
  display: inline-flex; align-items: center; gap: 7px; margin: -2px 0 12px; min-height: 32px; padding: 0 12px; cursor: pointer;
  background: var(--cream-deep); border: 1.5px solid var(--border2); border-radius: var(--r-full);
  font-family: var(--font); font-size: 12px; font-weight: 800; color: var(--brown-dark);
}
.vc-filtro-ativo i { font-size: 10.5px; color: var(--brown-mid); }
.vc-filtro-ativo-x { opacity: .6; }
@media (prefers-reduced-motion: reduce) {
  .vc-painel, .vc-painel.aberto { transition: none; }
}

/* Listas */
.vc-grupo { margin-bottom: 16px; }
.vc-grupo-tit {
  display: flex; align-items: center; gap: 8px; margin: 0 2px 8px; font-size: 12.5px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .04em; color: var(--brown-mid);
}
.vc-grupo-tit--vencidas { color: var(--red); }
.vc-grupo-tit--hoje { color: var(--orange); }
.vc-grupo-qtd { padding: 1px 8px; border-radius: var(--r-full); background: var(--cream-deep); font-size: 11px; color: var(--brown-mid); }
.vc-grupo-soma { margin-left: auto; font-family: var(--mono); font-size: 13px; color: var(--brown-dark); letter-spacing: 0; }
.vc-lista { display: flex; flex-direction: column; gap: 8px; }
.vc-grupo .vc-linha + .vc-linha { margin-top: 8px; }
.vc-linha {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; text-align: left; cursor: pointer;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow);
  font-family: var(--font); transition: transform .1s, border-color var(--t);
}
.vc-linha:active { transform: scale(.985); border-color: var(--brown-light); }
.vc-linha--folha { box-shadow: none; margin-bottom: 8px; }
.vc-av {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; background: var(--cream); color: var(--brown);
  font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center;
}
.vc-av--loja { border-radius: 12px; font-size: 16px; color: var(--brown-mid); }
.vc-av--pago { background: var(--green-bg); color: var(--green); }
.vc-linha-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.vc-linha-nome { font-size: 15px; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vc-linha-nome small { font-size: 12px; font-weight: 600; color: var(--muted); }
.vc-linha-sub { font-size: 12px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vc-linha-val { font-family: var(--mono); font-size: 15px; font-weight: 800; color: var(--brown); white-space: nowrap; }
.vc-linha-val--pago { color: var(--green); }
.vc-linha-sub--pag { color: var(--green); font-weight: 700; }

/* Botão flutuante: voltar ao topo */
.vc-topo {
  position: absolute; right: 16px; bottom: max(20px, env(safe-area-inset-bottom));
  width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--border);
  background: var(--surface); color: var(--brown-dark); box-shadow: var(--shadow);
  display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; z-index: 5;
}
.vc-topo:active { background: var(--cream-deep); }
.vc-topo:focus-visible { outline: 2px solid var(--brown); outline-offset: 2px; }
.vc-topo-enter-active, .vc-topo-leave-active { transition: opacity .18s ease, transform .18s ease; }
.vc-topo-enter-from, .vc-topo-leave-to { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) { .vc-topo-enter-active, .vc-topo-leave-active { transition: none; } }
.vc-ok { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: var(--green); white-space: nowrap; }
.vc-vazio { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 36px 16px; font-size: 14px; font-weight: 700; color: var(--muted); text-align: center; }
.vc-mais { margin: 14px 0 0; text-align: center; font-size: 12px; color: var(--muted); }
.vc-spin { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--brown); border-radius: 50%; animation: vc-giro .7s linear infinite; }
@keyframes vc-giro { to { transform: rotate(360deg); } }

/* Folha de detalhes */
.vc-ov {
  position: fixed; inset: 0; z-index: var(--z-modal); display: flex; align-items: flex-end; justify-content: center;
  background: rgba(30, 18, 8, .5); animation: vc-fade .15s ease;
}
@keyframes vc-fade { from { opacity: 0 } to { opacity: 1 } }
.vc-folha {
  width: 100%; max-width: 560px; max-height: 88vh; display: flex; flex-direction: column;
  background: var(--bg); border-radius: 22px 22px 0 0; box-shadow: 0 -10px 40px rgba(30, 18, 8, .25);
  animation: vc-sobe .22s cubic-bezier(.34, 1.3, .64, 1);
}
@keyframes vc-sobe { from { transform: translateY(40px); opacity: .6 } to { transform: none; opacity: 1 } }
@media (min-width: 700px) { .vc-ov { align-items: center; } .vc-folha { border-radius: 20px; } }
.vc-folha-topo { display: flex; align-items: center; padding: 16px 16px 8px 20px; }
.vc-folha-titulo { flex: 1; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.vc-folha-x { width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--cream-deep); color: var(--brown-mid); font-size: 15px; cursor: pointer; }
.vc-folha-corpo { overflow-y: auto; padding: 4px 16px max(24px, env(safe-area-inset-bottom)); }
.vc-det-quem { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
.vc-det-quem b { font-size: 20px; font-weight: 900; color: var(--brown-dark); }
.vc-det-quem b small { font-size: 13px; font-weight: 600; color: var(--muted); }
.vc-det-quem span { font-size: 13px; font-weight: 600; color: var(--muted); }
.vc-status {
  display: inline-block; margin-bottom: 14px; padding: 4px 12px; border-radius: var(--r-full);
  background: var(--gold-bg); color: var(--gold-dark); font-size: 12.5px; font-weight: 800;
}
.vc-status--pago { background: var(--green-bg); color: var(--green); }
.vc-status--atraso { background: var(--red-bg); color: var(--red); }
.vc-itens { margin-bottom: 4px; }
.vc-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.vc-item-emoji { width: 34px; text-align: center; font-size: 22px; }
.vc-item-nome { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 15px; font-weight: 800; color: var(--text); }
.vc-item-nome small { font-size: 12px; font-weight: 600; font-family: var(--mono); color: var(--muted); }
.vc-item-sub { font-family: var(--mono); font-weight: 800; color: var(--brown); white-space: nowrap; }
.vc-livre { margin: 0 0 8px; padding: 10px 12px; background: var(--cream); border-radius: var(--r-sm); font-size: 14px; color: var(--brown-dark); }
.vc-totais { margin: 14px 0; padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); }
.vc-totais > div { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; font-size: 14px; font-weight: 600; color: var(--muted); }
.vc-totais b { font-family: var(--mono); font-weight: 800; color: var(--text); }
.vc-totais .vc-verde { color: var(--green); }
.vc-totais-saldo { margin-top: 4px; padding-top: 10px !important; border-top: 1px dashed var(--border2); }
.vc-totais-saldo span { color: var(--brown-dark); font-weight: 800; }
.vc-totais-saldo b { font-size: 20px; color: var(--brown); }
.vc-datas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.vc-datas > div { padding: 10px 12px; background: var(--cream); border-radius: var(--r-sm); display: flex; flex-direction: column; gap: 2px; }
.vc-datas small { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.vc-datas b { font-family: var(--mono); font-size: 15px; color: var(--brown-dark); }
.vc-sub-tit { margin: 6px 2px 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--brown-mid); }
.vc-pag { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; margin-bottom: 6px; background: var(--green-bg); border-radius: var(--r-sm); font-size: 13.5px; font-weight: 700; color: var(--green); }
.vc-pag b { font-family: var(--mono); }
.vc-pag i { margin-right: 6px; }

/* ══ Cobranças / Lojas / Clientes (copiado do painel do vendedor) ══ */
.cad-empty { text-align: center; padding: 60px 20px; color: var(--muted); }
.cad-empty-ico { font-size: 40px; margin-bottom: 10px; }
.cad-resumo-seg-control {
  flex-shrink: 0;
  display: flex; gap: 6px; margin-top: 10px;
}
.cad-resumo-seg-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 7px 6px 8px; border-radius: var(--r-lg);
  border: 1px solid var(--border); background: var(--surface);
  cursor: pointer; transition: all .18s; font-family: var(--font);
}
.cad-resumo-seg-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
}
.cad-resumo-seg-val {
  font-size: 14px; font-weight: 800; color: var(--brown); font-family: var(--mono);
}
.cad-resumo-seg-val--red { color: var(--red, #dc2626); }
.cad-resumo-seg-btn.active {
  background: var(--brown-dark); border-color: var(--brown-dark);
  box-shadow: 0 1px 4px rgba(61,31,7,.25);
}
.cad-resumo-seg-btn.active .cad-resumo-seg-label { color: var(--cream); opacity: .8; }
.cad-resumo-seg-btn.active .cad-resumo-seg-val { color: var(--cream); }
.cad-resumo-seg-btn.active .cad-resumo-seg-val--red { color: #ffb4b4; }
.cad-grupo-loja { display: flex; flex-direction: column; gap: 6px; }
.cad-loja-header {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; min-height: 48px;
  background: var(--surface); border-radius: 10px; border-left: 3px solid var(--brown);
  box-shadow: var(--shadow); cursor: pointer; user-select: none; z-index: 2;
}
.cad-loja-header:active { opacity: .8; }
.cad-loja-ico     { color: var(--brown); flex-shrink: 0; }
.cad-loja-nome    { font-size: 13px; font-weight: 800; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-loja-local   { display: block; font-size: 11px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.cad-loja-total   { font-size: 13px; font-weight: 800; color: var(--brown); font-family: var(--mono); white-space: nowrap; }
.cad-loja-chevron { color: var(--brown-light); flex-shrink: 0; transition: transform .22s cubic-bezier(.4,0,.2,1); margin-left: 4px; }
.cad-loja-header.colapsado .cad-loja-chevron { transform: rotate(-90deg); }
.cad-grupo-clientes {
  display: flex; flex-direction: column; gap: 4px;
  overflow: hidden; transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease;
  max-height: 9999px; opacity: 1;
  /* folga interna (compensada pela margem negativa) pra o overflow:hidden da
     animação de recolher não cortar a sombra e a borda de baixo dos cards */
  padding: 2px 4px 10px; margin: 0 -4px;
}
.cad-grupo-clientes--indent { margin-left: 10px; padding-left: 8px; }
.cad-grupo-clientes.colapsado { max-height: 0 !important; opacity: 0; padding-top: 0; padding-bottom: 0; }
.cad-cli-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); overflow: hidden; box-shadow: var(--shadow); }
.cad-cli-card.atrasado { border-color: #fecaca; background: #fff9f9; }
.cad-cli-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; min-height: 60px; cursor: pointer; user-select: none; }
.cad-cli-header:active { background: var(--cream); }
.cad-cli-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  background: var(--cream-deep); color: var(--brown-mid); font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--border2);
}
.cad-cli-avatar.atrasado { background: #fef2f2; color: var(--red, #dc2626); border-color: #fecaca; }
.cad-cli-info  { flex: 1; min-width: 0; }
.cad-cli-nome  { font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-cli-chevron { color: var(--brown-light); flex-shrink: 0; transition: transform .22s; }
.cad-cli-header.colapsado .cad-cli-chevron { transform: rotate(-90deg); }
.cad-compra-esq { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cad-compra-data { font-size: 10.5px; font-weight: 600; color: var(--muted); }
.cad-compra-itens {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  white-space: pre-line;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.cad-compra-pgto { margin-top: 3px; display: flex; flex-direction: column; gap: 3px; max-width: 220px; }
.cad-compra-pgto-linha { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.cad-compra-pgto-recebido {
  font-size: 11px; font-weight: 800; color: var(--green);
  white-space: nowrap; display: inline-flex; align-items: center; gap: 3px;
}
.cad-compra-pgto-recebido i { font-size: 9.5px; }
.cad-compra-pgto-falta { font-size: 10.5px; font-weight: 700; color: var(--orange); white-space: nowrap; }
.cad-compra-pgto-bar { height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
.cad-compra-pgto-bar-fill { height: 100%; border-radius: 999px; background: var(--green); transition: width .25s ease; }
.cad-compra-dir { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 96px; }
.cad-compra-valor { font-size: 14px; font-weight: 800; font-family: var(--mono); white-space: nowrap; }
.cad-compra-valor--red { color: var(--red, #dc2626); }
.cad-compra-meta  { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
.cad-funcao-tag {
  display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: var(--r-full);
  background: var(--cream); color: var(--brown-dark); border: 1px solid var(--border);
  font-size: 10.5px; font-weight: 800; letter-spacing: .02em; vertical-align: middle; white-space: nowrap;
}
.cad-resumo-seg-btn { min-width: 0; }
.cad-cli-card.atrasado { border-color: #fecaca; background: var(--surface); }
.cad-cli-sub { font-size: 12px; color: var(--muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-cli-valor { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; line-height: 1.15; }
.cad-cli-valor .cad-cli-status { font-size: 11.5px; white-space: nowrap; color: var(--muted); }
.cad-cli-valor .cad-cli-status--red { color: var(--red); }
.cad-cli-valor .cad-cli-status--warn { color: var(--orange); }
.cad-funcao-tag--linha { margin-left: 0; margin-right: 6px; }
.cad-cli-valor b { font-size: 16px; font-weight: 800; font-family: var(--mono); }
.cad-cli-valor small { font-size: 11px; color: var(--muted); font-weight: 600; }
.cad-cli-valor--red b { color: var(--red); }
.cad-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--r-full);
  font-size: 11px; font-weight: 800; white-space: nowrap; flex-shrink: 0;
}
.cad-chip i { font-size: 10px; }
.cad-chip--ok      { background: var(--green-bg);  color: var(--green); }
.cad-chip--warn    { background: var(--orange-bg); color: var(--orange); }
.cad-chip--red     { background: var(--red-bg);    color: var(--red); }
.cad-chip--neutral { background: var(--cream);     color: var(--muted); border: 1px solid var(--border); }
.cad-loja-nome small { margin-top: 1px; }
.cad-loja-dir { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.cad-resumo-seg-btn { overflow: hidden; }
.cad-resumo-seg-val {
  max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: clamp(11px, 3.7vw, 14px);
}
.cad-cli-nome { min-width: 0; }
/* ── Aparência igual ao painel do vendedor (regras acima copiadas de lá) ── */
.cad-grupo-loja { margin-bottom: 12px; }
.cad-empty p { margin: 0; font-size: 14px; font-weight: 700; }
.vc-cli-linha {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; min-height: 60px; text-align: left;
  cursor: pointer; font-family: var(--font); transition: transform .1s;
}
.vc-cli-linha:active { transform: scale(.985); }
.vc-seta-dir { color: var(--brown-light); font-size: 12px; flex-shrink: 0; }

</style>