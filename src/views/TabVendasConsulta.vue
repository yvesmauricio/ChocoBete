<template>
  <!--
    Vendas — SOMENTE CONSULTA (aparelho Admin).
    Esta tela só LÊ: importa apenas funções de leitura da Caderneta e não tem
    nenhum botão que lance, receba, edite, exclua ou importe. Quem controla
    lojas, clientes e cobranças é o aparelho do vendedor.
  -->
  <div class="vc">
    <header class="vc-hdr">
      <button class="vc-hdr-btn" title="Trocar perfil" aria-label="Trocar perfil" @click="emit('trocar-perfil')">
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

    <div class="vc-corpo">
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
          <div class="vc-kpi-rot">Em aberto</div>
          <div class="vc-kpi-val">R$ {{ fmt(resumo.totalAberto) }}</div>
          <div class="vc-kpi-det">{{ resumo.qtdAbertas }} {{ resumo.qtdAbertas === 1 ? 'compra' : 'compras' }} · {{ resumo.qtdClientesDevendo }} {{ resumo.qtdClientesDevendo === 1 ? 'cliente' : 'clientes' }}</div>
        </div>
        <div class="vc-kpi" :class="{ 'vc-kpi--alerta': resumo.totalVencido > 0 }">
          <div class="vc-kpi-rot">Vencido</div>
          <div class="vc-kpi-val">R$ {{ fmt(resumo.totalVencido) }}</div>
          <div class="vc-kpi-det">{{ resumo.qtdVencidas }} {{ resumo.qtdVencidas === 1 ? 'atrasada' : 'atrasadas' }}</div>
        </div>
        <div class="vc-kpi">
          <div class="vc-kpi-rot">Vence hoje</div>
          <div class="vc-kpi-val">R$ {{ fmt(resumo.totalHoje) }}</div>
          <div class="vc-kpi-det">{{ resumo.qtdHoje }} {{ resumo.qtdHoje === 1 ? 'compra' : 'compras' }}</div>
        </div>
      </div>

      <div class="vc-abas" role="tablist">
        <button v-for="a in abas" :key="a.id" role="tab" :aria-selected="aba === a.id" class="vc-aba" :class="{ sel: aba === a.id }" @click="aba = a.id">
          {{ a.nome }}
        </button>
      </div>

      <label class="vc-busca">
        <i class="fas fa-magnifying-glass"></i>
        <input v-model="busca" type="search" :placeholder="placeholderBusca" autocomplete="off">
        <button v-if="busca" type="button" class="vc-busca-x" aria-label="Limpar busca" @click="busca = ''"><i class="fas fa-xmark"></i></button>
      </label>

      <div v-if="carregando" class="vc-vazio"><div class="vc-spin"></div> Carregando…</div>

      <!-- COBRANÇAS -->
      <template v-else-if="aba === 'cobrancas'">
        <section v-for="g in gruposCobranca" :key="g.id" class="vc-grupo">
          <div class="vc-grupo-tit" :class="`vc-grupo-tit--${g.id}`">
            {{ g.titulo }} <span class="vc-grupo-qtd">{{ g.itens.length }}</span>
            <span class="vc-grupo-soma">R$ {{ fmt(g.soma) }}</span>
          </div>
          <button v-for="f in g.itens" :key="f.id" class="vc-linha" @click="abrirModal({ tipo: 'fiado', id: f.id })">
            <span class="vc-av">{{ iniciais(f.clienteNome) }}</span>
            <span class="vc-linha-txt">
              <span class="vc-linha-nome">{{ f.clienteNome }}</span>
              <span class="vc-linha-sub">{{ f.lojaNome }} · vence {{ fmtBR(f.dataVenc) }}</span>
            </span>
            <span class="vc-linha-val">R$ {{ fmt(f.saldo) }}</span>
          </button>
        </section>
        <div v-if="!gruposCobranca.length" class="vc-vazio">{{ busca ? 'Nada encontrado.' : 'Nenhuma cobrança em aberto. 🎉' }}</div>
      </template>

      <!-- CLIENTES -->
      <template v-else-if="aba === 'clientes'">
        <div class="vc-lista">
          <button v-for="c in clientesFiltrados" :key="c.id" class="vc-linha" @click="abrirModal({ tipo: 'cliente', id: c.id })">
            <span class="vc-av">{{ iniciais(c.nome) }}</span>
            <span class="vc-linha-txt">
              <span class="vc-linha-nome">{{ c.nome }}<small v-if="c.funcao"> · {{ c.funcao }}</small></span>
              <span class="vc-linha-sub">{{ nomeLoja(c.lojaId) }}<template v-if="c.arquivado"> · arquivado</template></span>
            </span>
            <span v-if="saldoCliente(c.id) > 0.01" class="vc-linha-val">R$ {{ fmt(saldoCliente(c.id)) }}</span>
            <span v-else class="vc-ok"><i class="fas fa-check"></i> Em dia</span>
          </button>
        </div>
        <div v-if="!clientesFiltrados.length" class="vc-vazio">Nenhum cliente encontrado.</div>
      </template>

      <!-- LOJAS -->
      <template v-else-if="aba === 'lojas'">
        <div class="vc-lista">
          <button v-for="l in lojasFiltradas" :key="l.id" class="vc-linha" @click="abrirModal({ tipo: 'loja', id: l.id })">
            <span class="vc-av vc-av--loja"><i class="fas fa-store"></i></span>
            <span class="vc-linha-txt">
              <span class="vc-linha-nome">{{ l.nome }}</span>
              <span class="vc-linha-sub">
                {{ [l.bairro, l.referencia].filter(Boolean).join(' · ') || 'Sem local' }}
                · {{ qtdClientesLoja(l.id) }} {{ qtdClientesLoja(l.id) === 1 ? 'cliente' : 'clientes' }}<template v-if="l.arquivado"> · arquivada</template>
              </span>
            </span>
            <span v-if="saldoLoja(l.id) > 0.01" class="vc-linha-val">R$ {{ fmt(saldoLoja(l.id)) }}</span>
            <span v-else class="vc-ok"><i class="fas fa-check"></i> Em dia</span>
          </button>
        </div>
        <div v-if="!lojasFiltradas.length" class="vc-vazio">Nenhuma loja encontrada.</div>
      </template>

      <!-- HISTÓRICO -->
      <template v-else>
        <div class="vc-filtros">
          <button v-for="f in filtrosHist" :key="f.id" class="vc-chip" :class="{ sel: filtroHist === f.id }" @click="filtroHist = f.id">{{ f.nome }}</button>
        </div>
        <div class="vc-lista">
          <button v-for="f in historicoFiltrado" :key="f.id" class="vc-linha" @click="abrirModal({ tipo: 'fiado', id: f.id })">
            <span class="vc-av" :class="{ 'vc-av--pago': f.status === 'pago' }">
              <i v-if="f.status === 'pago'" class="fas fa-check"></i><template v-else>{{ iniciais(f.clienteNome) }}</template>
            </span>
            <span class="vc-linha-txt">
              <span class="vc-linha-nome">{{ f.clienteNome }}</span>
              <span class="vc-linha-sub">{{ fmtBR(f.dataVenda) }} · {{ f.lojaNome }} · {{ qtdItens(f) }}</span>
            </span>
            <span class="vc-linha-val" :class="{ 'vc-linha-val--pago': f.status === 'pago' }">R$ {{ fmt(f.total) }}</span>
          </button>
        </div>
        <div v-if="!historicoFiltrado.length" class="vc-vazio">Nenhuma venda encontrada.</div>
        <p v-else-if="historicoOrdenado.length > LIMITE_HIST && !busca" class="vc-mais">Mostrando as {{ LIMITE_HIST }} mais recentes. Use a busca para achar as antigas.</p>
      </template>
    </div>

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

            <!-- loja -->
            <template v-else-if="modal.tipo === 'loja' && lojaAberta">
              <div class="vc-det-quem">
                <b>{{ lojaAberta.nome }}</b>
                <span>{{ [lojaAberta.bairro, lojaAberta.referencia].filter(Boolean).join(' · ') || 'Sem local informado' }}</span>
              </div>
              <div class="vc-totais">
                <div class="vc-totais-saldo"><span>Em aberto</span><b>R$ {{ fmt(saldoLoja(lojaAberta.id)) }}</b></div>
                <div><span>Clientes</span><b>{{ qtdClientesLoja(lojaAberta.id) }}</b></div>
              </div>
              <div class="vc-sub-tit">Clientes</div>
              <button v-for="c in clientesDaLoja(lojaAberta.id)" :key="c.id" class="vc-linha vc-linha--folha" @click="abrirModal({ tipo: 'cliente', id: c.id })">
                <span class="vc-av">{{ iniciais(c.nome) }}</span>
                <span class="vc-linha-txt">
                  <span class="vc-linha-nome">{{ c.nome }}</span>
                  <span class="vc-linha-sub">{{ c.funcao || 'Cliente' }}</span>
                </span>
                <span v-if="saldoCliente(c.id) > 0.01" class="vc-linha-val">R$ {{ fmt(saldoCliente(c.id)) }}</span>
                <span v-else class="vc-ok"><i class="fas fa-check"></i></span>
              </button>
              <div v-if="!clientesDaLoja(lojaAberta.id).length" class="vc-vazio">Nenhum cliente nesta loja.</div>
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

const emit = defineEmits(['trocar-perfil'])
const s = useStore()
const { modal, abrirModal, fecharModal } = useModalStack()

const lojas = ref([])
const clientes = ref([])
const fiados = ref([])
const carregando = ref(true)
const atualizando = ref(false)
const estado = ref('ok') // 'ok' | 'erro'
const agora = ref(Date.now())

const aba = ref('cobrancas')
const busca = ref('')
const filtroHist = ref('todos')
const LIMITE_HIST = 200

const abas = [
  { id: 'cobrancas', nome: 'Cobranças' },
  { id: 'clientes',  nome: 'Clientes' },
  { id: 'lojas',     nome: 'Lojas' },
  { id: 'historico', nome: 'Histórico' }
]
const filtrosHist = [
  { id: 'todos', nome: 'Todas' },
  { id: 'abertas', nome: 'Em aberto' },
  { id: 'pagas', nome: 'Pagas' }
]
const placeholderBusca = computed(() => ({
  cobrancas: 'Buscar cliente ou loja', clientes: 'Buscar cliente', lojas: 'Buscar loja', historico: 'Buscar cliente, loja ou item'
}[aba.value]))

watch(aba, () => { busca.value = '' })

// ── Carga ─────────────────────────────────────────────────
async function carregar() {
  try {
    const [l, c, f] = await Promise.all([getLojas({ incluirArquivadas: true }), getTodosClientes(), getFiados()])
    lojas.value = l
    clientes.value = c
    fiados.value = f
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
const saldoPorLoja = computed(() => {
  const m = {}
  for (const f of abertas.value) m[f.lojaId] = centavos((m[f.lojaId] || 0) + Number(f.saldo))
  return m
})
const saldoLoja = (id) => saldoPorLoja.value[id] || 0
const clientesDaLoja = (id) => clientes.value.filter(c => c.lojaId === id && !c.arquivado).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
const qtdClientesLoja = (id) => clientes.value.filter(c => c.lojaId === id && !c.arquivado).length
const comprasDoCliente = (id) => fiados.value
  .filter(f => f.clienteId === id)
  .sort((a, b) => chaveRecente(b).localeCompare(chaveRecente(a)))

const chaveRecente = (f) => `${f.dataVenda || ''} ${f.horaVenda || ''} ${f.criadoEm || ''}`

const resumo = computed(() => {
  const hj = hoje()
  const soma = (lista) => centavos(lista.reduce((t, f) => t + Number(f.saldo), 0))
  const vencidas = abertas.value.filter(f => f.dataVenc && f.dataVenc < hj)
  const deHoje = abertas.value.filter(f => f.dataVenc === hj)
  return {
    totalAberto: soma(abertas.value), qtdAbertas: abertas.value.length,
    qtdClientesDevendo: Object.keys(saldoPorCliente.value).length,
    totalVencido: soma(vencidas), qtdVencidas: vencidas.length,
    totalHoje: soma(deHoje), qtdHoje: deHoje.length
  }
})

const termo = computed(() => normalizar(busca.value.trim()))
const casa = (...campos) => !termo.value || normalizar(campos.filter(Boolean).join(' ')).includes(termo.value)

const gruposCobranca = computed(() => {
  const hj = hoje()
  const em7 = new Date(hj + 'T12:00:00'); em7.setDate(em7.getDate() + 7)
  const lim7 = em7.toLocaleDateString('sv')
  const defs = [
    { id: 'vencidas', titulo: 'Atrasadas', ok: f => f.dataVenc && f.dataVenc < hj },
    { id: 'hoje', titulo: 'Vencem hoje', ok: f => f.dataVenc === hj },
    { id: 'semana', titulo: 'Próximos 7 dias', ok: f => f.dataVenc > hj && f.dataVenc <= lim7 },
    { id: 'depois', titulo: 'Mais adiante', ok: f => f.dataVenc > lim7 },
    { id: 'semdata', titulo: 'Sem data combinada', ok: f => !f.dataVenc }
  ]
  const lista = abertas.value.filter(f => casa(f.clienteNome, f.lojaNome))
  return defs.map(d => {
    const itens = lista.filter(d.ok).sort((a, b) => String(a.dataVenc || '').localeCompare(String(b.dataVenc || '')))
    return { id: d.id, titulo: d.titulo, itens, soma: centavos(itens.reduce((t, f) => t + Number(f.saldo), 0)) }
  }).filter(g => g.itens.length)
})

const clientesFiltrados = computed(() =>
  clientes.value
    .filter(c => casa(c.nome, c.funcao, nomeLoja(c.lojaId)))
    .sort((a, b) => (saldoCliente(b.id) - saldoCliente(a.id)) || a.nome.localeCompare(b.nome, 'pt-BR'))
)
const lojasFiltradas = computed(() =>
  lojas.value
    .filter(l => casa(l.nome, l.bairro, l.referencia))
    .sort((a, b) => (saldoLoja(b.id) - saldoLoja(a.id)) || a.nome.localeCompare(b.nome, 'pt-BR'))
)
const historicoOrdenado = computed(() => [...fiados.value].sort((a, b) => chaveRecente(b).localeCompare(chaveRecente(a))))
const historicoFiltrado = computed(() => {
  const lista = historicoOrdenado.value.filter(f =>
    (filtroHist.value === 'todos' || (filtroHist.value === 'abertas' ? f.status === 'aberto' : f.status === 'pago')) &&
    casa(f.clienteNome, f.lojaNome, (f.itens || []).map(i => i.nome).join(' '), f.descricaoLivre)
  )
  return termo.value ? lista : lista.slice(0, LIMITE_HIST)
})

// ── Detalhes ──────────────────────────────────────────────
const fiadoAberto = computed(() => modal.value?.tipo === 'fiado' ? fiados.value.find(f => f.id === modal.value.id) : null)
const clienteAberto = computed(() => modal.value?.tipo === 'cliente' ? clientes.value.find(c => c.id === modal.value.id) : null)
const lojaAberta = computed(() => modal.value?.tipo === 'loja' ? lojaPorId.value[modal.value.id] : null)
const tituloFolha = computed(() => ({ fiado: 'Compra', cliente: 'Cliente', loja: 'Loja' }[modal.value?.tipo] || ''))

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
.vc { height: 100%; display: flex; flex-direction: column; background: var(--bg); font-family: var(--font); }

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
.vc-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.vc-kpi {
  padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); box-shadow: var(--shadow);
}
.vc-kpi--main { grid-column: 1 / -1; background: linear-gradient(135deg, var(--brown-dark), var(--brown)); border-color: transparent; color: #fff; }
.vc-kpi-rot { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.vc-kpi--main .vc-kpi-rot { color: rgba(255, 255, 255, .7); }
.vc-kpi-val { margin-top: 2px; font-family: var(--mono); font-size: 20px; font-weight: 800; color: var(--brown-dark); }
.vc-kpi--main .vc-kpi-val { font-size: 28px; color: #fff; }
.vc-kpi-det { margin-top: 2px; font-size: 12px; font-weight: 600; color: var(--muted); }
.vc-kpi--main .vc-kpi-det { color: rgba(255, 255, 255, .75); }
.vc-kpi--alerta { background: var(--red-bg); border-color: var(--red-dim); }
.vc-kpi--alerta .vc-kpi-val { color: var(--red); }

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
.vc-busca-x { border: 0; background: none; color: var(--muted); font-size: 14px; cursor: pointer; padding: 6px; }
.vc-filtros { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.vc-chip {
  min-height: 36px; padding: 0 14px; border-radius: var(--r-full); cursor: pointer;
  background: var(--surface); border: 1.5px solid var(--border); color: var(--brown-mid);
  font-family: var(--font); font-size: 12.5px; font-weight: 800; transition: all var(--t);
}
.vc-chip.sel { background: var(--brown); border-color: var(--brown); color: #fff; }

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
</style>
