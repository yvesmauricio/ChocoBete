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

      <!-- COBRANÇAS · LOJAS · CLIENTES: mesmo formato do painel do vendedor (loja → clientes → compras) -->
      <template v-else-if="aba !== 'historico'">
        <div v-if="aba === 'cobrancas'" class="cad-resumo-seg-control">
          <button type="button" class="cad-resumo-seg-btn" :class="{ active: filtroSit === 'todos' }" @click="filtroSit = 'todos'">
            <span class="cad-resumo-seg-label">Todos</span>
            <span class="cad-resumo-seg-val">R$ {{ fmt(resumo.totalAberto) }}</span>
          </button>
          <button type="button" class="cad-resumo-seg-btn" :class="{ active: filtroSit === 'vencidos' }" @click="filtroSit = 'vencidos'">
            <span class="cad-resumo-seg-label">Vencidos</span>
            <span class="cad-resumo-seg-val" :class="{ 'cad-resumo-seg-val--red': resumo.totalVencido > 0.009 }">R$ {{ fmt(resumo.totalVencido) }}</span>
          </button>
        </div>

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
              <small v-if="aba === 'lojas'" class="cad-loja-local">{{ g.clientes.length }} {{ g.clientes.length === 1 ? 'cliente' : 'clientes' }}</small>
            </span>
            <span class="cad-loja-dir">
              <span v-if="g.total > 0.01" class="cad-loja-total">R$ {{ fmt(g.total) }}</span>
              <span v-else class="cad-chip cad-chip--ok"><i class="fas fa-check"></i> Em dia</span>
              <span v-if="g.vencidos && !(aba === 'cobrancas' && filtroSit === 'vencidos')" class="cad-chip cad-chip--red">{{ g.vencidos }} {{ g.vencidos > 1 ? 'vencidos' : 'vencido' }}</span>
            </span>
            <svg v-if="!grupoUnico" class="cad-loja-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>

          <div class="cad-grupo-clientes cad-grupo-clientes--indent" :class="{ colapsado: lojaColapsada(g) }">
            <template v-for="c in g.clientes" :key="c.clienteId">

              <!-- Lojas: clientes em linha simples; toque abre o cliente -->
              <button v-if="aba === 'lojas'" type="button" class="cad-cli-card vc-cli-linha" :class="{ atrasado: c.atrasado }" @click="abrirModal({ tipo: 'cliente', id: c.clienteId })">
                <div class="cad-cli-avatar" :class="{ atrasado: c.atrasado }">{{ iniciais(c.clienteNome) }}</div>
                <div class="cad-cli-info">
                  <div class="cad-cli-nome">{{ c.clienteNome }}</div>
                  <div v-if="c.clienteFuncao" class="cad-cli-sub"><span class="cad-funcao-tag cad-funcao-tag--linha">{{ c.clienteFuncao }}</span></div>
                </div>
                <div v-if="c.saldo > 0.01" class="cad-cli-valor" :class="{ 'cad-cli-valor--red': c.atrasado }">
                  <b>R$ {{ fmt(c.saldo) }}</b>
                  <span class="cad-cli-status" :class="statusCliente(c).cls">{{ statusCliente(c, true).txt }}</span>
                </div>
                <span v-else class="cad-chip cad-chip--ok"><i class="fas fa-check"></i> Em dia</span>
                <i class="fas fa-chevron-right vc-seta-dir"></i>
              </button>

              <!-- Cobranças / Clientes: cartão que abre e mostra as compras -->
              <div v-else class="cad-cli-card" :class="{ atrasado: c.atrasado }">
                <div class="cad-cli-header" :class="{ colapsado: clienteColapsado(g, c) }" @click="alternarCliente(g, c)">
                  <div class="cad-cli-avatar" :class="{ atrasado: c.atrasado }">{{ iniciais(c.clienteNome) }}</div>
                  <div class="cad-cli-info">
                    <div class="cad-cli-nome">{{ c.clienteNome }}</div>
                    <div v-if="c.clienteFuncao || aba === 'clientes'" class="cad-cli-sub">
                      <span v-if="c.clienteFuncao" class="cad-funcao-tag cad-funcao-tag--linha">{{ c.clienteFuncao }}</span>
                      <template v-if="aba === 'clientes'">{{ rotuloCompras(c.nCompras) }}<template v-if="c.ultima"> · última em {{ fmtBR(c.ultima).slice(0, 5) }}</template></template>
                    </div>
                  </div>
                  <div v-if="c.saldo > 0.01" class="cad-cli-valor" :class="{ 'cad-cli-valor--red': c.atrasado }">
                    <b>R$ {{ fmt(c.saldo) }}</b>
                    <span class="cad-cli-status" :class="statusCliente(c).cls">{{ statusCliente(c, true).txt }}</span>
                  </div>
                  <span v-else class="cad-chip cad-chip--ok"><i class="fas fa-check"></i> Em dia</span>
                  <svg class="cad-cli-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                </div>

                <div class="cad-compras-lista" :class="{ colapsado: clienteColapsado(g, c) }">
                  <button v-for="f in comprasVisiveis(g, c)" :key="f.id" type="button" class="vc-compra" :class="{ 'vc-compra--atrasada': f.atrasada }" @click="abrirModal({ tipo: 'fiado', id: f.id })">
                    <div class="cad-compra-esq">
                      <span class="cad-compra-data">{{ fmtDataHora(f) }}</span>
                      <span class="cad-compra-itens">{{ qtdItens(f) }}</span>
                      <div v-if="f.status !== 'pago' && f.pagamentos?.length" class="cad-compra-pgto">
                        <div class="cad-compra-pgto-linha">
                          <span class="cad-compra-pgto-recebido"><i class="fas fa-check-circle"></i> R$ {{ fmt(totalPago(f)) }}</span>
                          <span class="cad-compra-pgto-falta">falta R$ {{ fmt(f.saldo) }}</span>
                        </div>
                        <div class="cad-compra-pgto-bar"><div class="cad-compra-pgto-bar-fill" :style="{ width: pctPago(f) + '%' }"></div></div>
                      </div>
                    </div>
                    <div class="cad-compra-dir">
                      <template v-if="aba === 'cobrancas'">
                        <span class="cad-compra-valor" :class="{ 'cad-compra-valor--red': f.atrasada }">R$ {{ fmt(f.saldo) }}</span>
                        <span class="cad-chip" :class="f.atrasada ? 'cad-chip--red' : 'cad-chip--neutral'">
                          <template v-if="f.dataVenc"><i class="fas" :class="f.atrasada ? 'fa-calendar-xmark' : 'fa-calendar-days'"></i> {{ f.atrasada ? 'Venceu' : 'Vence' }} {{ fmtBR(f.dataVenc).slice(0, 5) }}</template>
                          <template v-else>Sem vencimento</template>
                        </span>
                      </template>
                      <template v-else>
                        <span class="cad-compra-valor">R$ {{ fmt(f.total) }}</span>
                        <span class="cad-chip" :class="`cad-chip--${chipCompra(f).cls}`">{{ chipCompra(f).txt }}</span>
                      </template>
                    </div>
                  </button>
                  <button v-if="aba === 'clientes' && c.fiados.length > comprasVisiveis(g, c).length" type="button" class="vc-mais-compras" @click="verTodasCompras(g, c)">
                    Ver compras mais antigas ({{ c.fiados.length - comprasVisiveis(g, c).length }})
                  </button>
                  <div v-if="!c.fiados.length" class="vc-sem-compras">Nenhuma compra registrada.</div>
                </div>
              </div>
            </template>
          </div>
        </div>
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

// ── Cobranças · Lojas · Clientes: loja → clientes → compras (igual ao painel do vendedor) ──
const filtroSit = ref('todos')            // Cobranças: 'todos' | 'vencidos'
const lojasEstado = ref(new Map())        // loja aberta/fechada (escolha da pessoa)
const clientesExpandidos = ref(new Set()) // clientes com a lista de compras aberta
const comprasTodas = ref(new Set())       // clientes com o histórico completo à mostra
const COMPRAS_INICIAIS = 6

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

function montarCliente(c, hj, modo) {
  const todos = (fiadosPorCliente.value.get(c.id) || [])
    .map(f => ({ ...f, atrasada: f.status === 'aberto' && f.saldo > 0.01 && !!f.dataVenc && f.dataVenc < hj }))
    .sort(maisRecentesPrimeiro)
  const abertos = todos.filter(f => f.status === 'aberto' && f.saldo > 0.01)
  const vencidos = abertos.filter(f => f.atrasada)
  const soma = (l) => centavos(l.reduce((t, f) => t + Number(f.saldo), 0))
  return {
    clienteId: c.id, clienteNome: c.nome, clienteFuncao: c.funcao || '', arquivado: !!c.arquivado,
    // Cobranças mostra só o que falta receber; Clientes mostra tudo.
    fiados: modo === 'cobrancas' ? (filtroSit.value === 'vencidos' ? vencidos : abertos) : todos,
    saldo: soma(abertos), atrasado: vencidos.length > 0, valorVencido: soma(vencidos),
    maxDiasAtraso: vencidos.reduce((m, f) => Math.max(m, diasEntre(f.dataVenc, hj)), 0),
    nCompras: todos.length, ultima: todos[0]?.dataVenda || ''
  }
}

const gruposAtivos = computed(() => {
  if (aba.value === 'historico') return []
  const modo = aba.value
  const hj = hoje()
  const porLoja = new Map()
  const garantirLoja = (id, nomeFallback) => {
    if (!porLoja.has(id)) {
      const l = lojaPorId.value[id]
      porLoja.set(id, { lojaId: id, lojaNome: l?.nome || nomeFallback || 'Sem loja', local: localLoja(l), clientes: [] })
    }
    return porLoja.get(id)
  }
  if (modo === 'lojas') lojas.value.filter(l => !l.arquivado).forEach(l => garantirLoja(l.id))

  // Clientes do cadastro + (raro) clientes que sumiram do cadastro mas ainda têm compras.
  const fonte = [...clientes.value]
  const cadastrados = new Set(clientes.value.map(c => c.id))
  for (const [id, lista] of fiadosPorCliente.value) {
    if (!cadastrados.has(id)) fonte.push({ id, nome: lista[0].clienteNome, funcao: '', lojaId: lista[0].lojaId, _lojaNome: lista[0].lojaNome })
  }
  for (const c of fonte) {
    const cli = montarCliente(c, hj, modo)
    if (modo === 'cobrancas' && !cli.fiados.length) continue
    if (modo !== 'cobrancas' && cli.arquivado && cli.saldo <= 0.01) continue
    garantirLoja(c.lojaId, c._lojaNome).clientes.push(cli)
  }

  const t = termo.value
  const grupos = [...porLoja.values()].map(g => {
    if (!t) return g
    const lojaCasa = casa(g.lojaNome, g.local)
    return { ...g, _lojaCasa: lojaCasa, clientes: lojaCasa ? g.clientes : g.clientes.filter(c => casa(c.clienteNome, c.clienteFuncao)) }
  }).filter(g => g.clientes.length || (modo === 'lojas' && (!t || g._lojaCasa)))

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
const grupoUnico = computed(() => gruposAtivos.value.length === 1)

const textoVazio = computed(() => {
  if (busca.value.trim()) return 'Nada encontrado.'
  if (aba.value === 'cobrancas') return filtroSit.value === 'vencidos' ? 'Nenhum fiado vencido.' : 'Nenhum fiado em aberto.'
  return aba.value === 'lojas' ? 'Nenhuma loja cadastrada.' : 'Nenhum cliente cadastrado.'
})

const chaveLoja = (g) => `${aba.value}|${g.lojaId}`
const chaveCliente = (g, c) => `${aba.value}|${g.lojaId}|${c.clienteId}`
// Só abre sozinha a loja com vencidos (como no painel do vendedor); a busca abre tudo.
function lojaColapsada(g) {
  if (grupoUnico.value || busca.value.trim()) return false
  const k = chaveLoja(g)
  if (lojasEstado.value.has(k)) return !lojasEstado.value.get(k)
  return !(g.vencidos > 0)
}
const clienteColapsado = (g, c) => !busca.value.trim() && !clientesExpandidos.value.has(chaveCliente(g, c))
function alternarLoja(g) {
  const m = new Map(lojasEstado.value)
  m.set(chaveLoja(g), lojaColapsada(g)) // estava fechada → abre (e vice-versa)
  lojasEstado.value = m
}
function alternarCliente(g, c) {
  const k = chaveCliente(g, c)
  const st = new Set(clientesExpandidos.value)
  st.has(k) ? st.delete(k) : st.add(k)
  clientesExpandidos.value = st
}
function comprasVisiveis(g, c) {
  if (aba.value === 'clientes' && !busca.value.trim() && !comprasTodas.value.has(chaveCliente(g, c))) return c.fiados.slice(0, COMPRAS_INICIAIS)
  return c.fiados
}
function verTodasCompras(g, c) { comprasTodas.value = new Set(comprasTodas.value).add(chaveCliente(g, c)) }

// Situação do cliente (coluna do valor): atrasado há N dias, vence hoje, vence dd/mm.
function statusCliente(c) {
  if (c.atrasado) return { txt: `${Math.max(1, c.maxDiasAtraso)}d em atraso`, cls: 'cad-cli-status--red' }
  const datas = c.fiados.filter(f => f.status === 'aberto' && f.saldo > 0.01 && f.dataVenc).map(f => f.dataVenc).sort()
  if (!datas.length) return { txt: 'Sem vencimento', cls: '' }
  return datas[0] === hoje()
    ? { txt: 'Vence hoje', cls: 'cad-cli-status--warn' }
    : { txt: `Vence ${fmtBR(datas[0]).slice(0, 5)}`, cls: '' }
}
const rotuloCompras = (n) => `${Number(n || 0).toLocaleString('pt-BR')} ${Number(n) === 1 ? 'compra' : 'compras'}`
function chipCompra(f) {
  if (f.status === 'pago' || f.saldo <= 0.01) return { txt: 'Paga', cls: 'ok' }
  if (f.atrasada) return { txt: `Venceu ${fmtBR(f.dataVenc).slice(0, 5)}`, cls: 'red' }
  return { txt: f.pagamentos?.length ? 'Pago em parte' : 'Em aberto', cls: 'warn' }
}
const fmtDataHora = (f) => fmtHora(f.horaVenda) ? `${fmtBR(f.dataVenda)} ${fmtHora(f.horaVenda)}` : fmtBR(f.dataVenda)
function pctPago(f) {
  const total = f.total || (totalPago(f) + f.saldo)
  return total ? Math.min(100, Math.max(0, (totalPago(f) / total) * 100)) : 0
}

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
.vc-compra {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; width: calc(100% - 24px);
  margin: 10px 12px 8px; padding: 10px 12px; text-align: left; cursor: pointer; font-family: var(--font);
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-sm);
  transition: transform .1s, border-color var(--t);
}
.vc-compra:active { transform: scale(.985); border-color: var(--brown-light); }
.vc-compra--atrasada { border-color: #fecaca; background: #fffafa; }
.cad-compras-lista > .vc-compra:last-child { margin-bottom: 12px; }
.vc-mais-compras {
  display: block; width: calc(100% - 24px); margin: 0 12px 12px; min-height: 40px; cursor: pointer;
  background: none; border: 1.5px dashed var(--border2); border-radius: var(--r-sm);
  font-family: var(--font); font-size: 12.5px; font-weight: 800; color: var(--brown-mid);
}
.vc-sem-compras { padding: 14px 12px; text-align: center; font-size: 12.5px; font-weight: 700; color: var(--muted); }

</style>
