<template>
  <div class="tab-caderneta kit-festa" :class="{ 'kf-print-mode': tela === 'apresentacao' }">

    <!-- ══ TELA: MONTAR CARDÁPIO ══════════════════════════ -->
    <div v-if="tela === 'selecao'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <button class="cad-btn-icon" @click="emit('voltar')">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h2 class="tab-title"><i class="fas fa-champagne-glasses"></i> Kit Festa</h2>
          <div class="spacer"></div>
          <button class="cad-btn-icon" @click="abrirHistorico" title="Cardápios salvos">
            <i class="fas fa-clock-rotate-left"></i>
          </button>
        </div>
        <p class="tab-subtitle">Monte o cardápio a partir das receitas no tamanho "Festa" e defina o preço por quantidade</p>
      </div>

      <div class="cad-body kf-body">

        <!-- PARÂMETROS DE CUSTO -->
        <div class="kf-card kf-card--destaque">
          <div class="kf-card-titulo"><i class="fas fa-hand-holding-dollar"></i> Como calculamos o preço mínimo</div>
          <div class="kf-param-grid">
            <div class="kf-param">
              <label class="kf-param-label">Horas fixas por lote</label>
              <input class="kf-param-input" type="number" step="0.5" min="0" v-model.number="parametros.horasFixasPorLote" @change="recalcularTodos">
              <span class="kf-param-hint">tempo de bancada/preparo, quase o mesmo pra 25 ou 100 un</span>
            </div>
            <div class="kf-param">
              <label class="kf-param-label">Margem de segurança</label>
              <input class="kf-param-input" type="number" step="1" min="0" max="90" :value="Math.round(parametros.margemSeguranca*100)" @change="e => { parametros.margemSeguranca = Number(e.target.value)/100; recalcularTodos() }">
              <span class="kf-param-hint">% acima do custo (ingrediente + mão de obra)</span>
            </div>
          </div>
          <p v-if="!custoHora" class="kf-hint kf-hint-aviso">
            <i class="fas fa-circle-info"></i> Você ainda não configurou o "custo da sua hora de trabalho" em Ajustes. Sem isso, a mão de obra não entra no cálculo — configure lá pra um preço mínimo realista.
          </p>
          <p v-else class="kf-hint">Sua hora vale {{ R$(custoHora) }} (configurado em Ajustes). Um pedido de 25un dilui esse tempo em menos peças — por isso custa mais por unidade que um de 100un, mesmo sem "desconto por volume".</p>
        </div>

        <!-- BUSCA -->
        <div class="cad-search-bar">
          <div class="cad-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input class="cad-search-input" placeholder="Buscar sabor..." v-model="busca">
          </div>
        </div>

        <!-- GRID DE SABORES (seleção rápida, toque pra marcar/desmarcar) -->
        <div v-if="!receitasFiltradas.length" class="cad-empty">
          <div class="cad-empty-ico">🍫</div>
          <p v-if="!receitasFesta.length">Nenhuma receita no tamanho "Festa" ainda. Vá em Receitas, abra uma trufa e toque em "Festa" (no menu de ações) pra criar a primeira.</p>
          <p v-else>Nenhum sabor encontrado.</p>
        </div>

        <div v-else class="kf-grid">
          <button
            v-for="r in receitasFiltradas"
            :key="r.uuid"
            class="kf-gbtn"
            :class="{ 'kf-gbtn--ativo': itens[r.uuid]?.ativo }"
            @click="alternarItem(r)"
          >
            <span v-if="s.verificarSincroniaFesta(r).dessincronizada" class="kf-gbtn-warn" title="Origem mudou">
              <i class="fas fa-triangle-exclamation"></i>
            </span>
            <span class="kf-gbtn-check" :class="{ marcado: itens[r.uuid]?.ativo }">
              <i v-if="itens[r.uuid]?.ativo" class="fas fa-check"></i>
            </span>
            <span class="kf-gbtn-nome">{{ r.nome }}</span>
            <span class="kf-gbtn-peso">{{ r.peso_unitario }}g</span>
            <span class="kf-gbtn-preco">a partir de {{ R$(precoReferencia(r)) }}</span>
          </button>
        </div>

        <!-- AJUSTAR PREÇOS DOS SELECIONADOS -->
        <template v-if="itensAtivosDetalhe.length">
          <div class="kf-faixas-titulo kf-ajuste-titulo">Ajustar preços dos sabores selecionados</div>
          <div class="kf-lista">
            <div v-for="r in itensAtivosDetalhe" :key="r.uuid" class="kf-item kf-item--ativo">
              <div class="kf-item-hdr kf-item-hdr--static">
                <div class="kf-item-info">
                  <span class="kf-item-nome">{{ r.nome }}</span>
                  <span class="kf-item-sub">{{ r.peso_unitario }}g/un · custo ingred. {{ R$(custoUnitario(r)) }}</span>
                </div>
                <button class="kf-btn-remover" @click="alternarItem(r)" title="Remover do cardápio">
                  <i class="fas fa-xmark"></i>
                </button>
              </div>

              <div class="kf-item-painel">
                <div class="kf-faixas">
                  <div v-for="f in itens[r.uuid].faixas" :key="f.minimo" class="kf-faixa">
                    <label class="kf-faixa-label">{{ f.minimo }}+ un</label>
                    <div class="kf-faixa-input-wrap">
                      <span class="kf-faixa-prefixo">R$</span>
                      <input
                        class="kf-faixa-input"
                        type="number"
                        step="0.01"
                        min="0"
                        v-model.number="f.preco"
                        @input="onEditarPreco(r)"
                      >
                    </div>
                    <span v-if="alertaFaixa(r, f).abaixoDoSeguro" class="kf-faixa-alerta">
                      <i class="fas fa-triangle-exclamation"></i>
                      Abaixo do mínimo seguro (mín. {{ R$(alertaFaixa(r, f).precoMinimoSeguro) }}, já com mão de obra)
                    </span>
                    <span v-else class="kf-faixa-ok">
                      Lucro/un: {{ R$(f.preco - custoUnitario(r)) }}
                    </span>
                  </div>
                </div>

                <button class="kf-btn-restaurar" @click="restaurarSugestao(r)">
                  <i class="fas fa-wand-magic-sparkles"></i> Usar sugestão automática
                </button>
              </div>
            </div>
          </div>
        </template>

      </div>

      <!-- BARRA INFERIOR DE AÇÃO -->
      <div class="kf-footer-bar" v-if="qtdItensAtivos > 0">
        <div class="kf-footer-info">{{ qtdItensAtivos }} produto{{ qtdItensAtivos > 1 ? 's' : '' }} no cardápio</div>
        <button class="btn btn-primary" @click="irParaApresentacao">
          <i class="fas fa-eye"></i> Ver cardápio para enviar
        </button>
      </div>
    </div>

    <!-- ══ TELA: APRESENTAÇÃO / CARDÁPIO PARA O CLIENTE ══════════════════════════ -->
    <div v-else-if="tela === 'apresentacao'" class="cad-tela kf-apresentacao">
      <div class="tab-hdr kf-no-print">
        <div class="tab-hdr-top">
          <button class="cad-btn-icon" @click="cardapioReaberto = null; tela = 'selecao'">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h2 class="tab-title"><i class="fas fa-envelope-open-text"></i> Cardápio</h2>
          <div class="spacer"></div>
        </div>
      </div>

      <div class="kf-menu-print">
        <div class="kf-menu-topo">
          <div class="kf-menu-selo">🍫</div>
          <h1 class="kf-menu-titulo">{{ nomeEmpresa }}</h1>
          <p class="kf-menu-subtitulo">Cardápio · Kit Festa</p>
        </div>

        <div class="kf-menu-lista">
          <div v-for="item in itensParaApresentar" :key="item.uuid" class="kf-menu-produto">
            <div class="kf-menu-produto-hdr">
              <span class="kf-menu-produto-nome">{{ item.nome }}</span>
              <span class="kf-menu-produto-peso">{{ item.peso }}g cada</span>
            </div>
            <div class="kf-menu-faixas">
              <div v-for="f in item.faixas" :key="f.minimo" class="kf-menu-faixa">
                <span class="kf-menu-faixa-qtd">a partir de {{ f.minimo }} un</span>
                <span class="kf-menu-faixa-preco">{{ R$(f.preco) }} <small>/un</small></span>
              </div>
            </div>
          </div>
        </div>

        <div class="kf-menu-rodape">
          <p>Valores válidos conforme quantidade mínima de cada faixa. Consulte disponibilidade e prazo de produção.</p>
        </div>
      </div>

      <div class="kf-salvar-hist kf-no-print">
        <input class="input" v-model="nomeCardapioAtual" placeholder="Nome deste cardápio (ex: Festa Julinha 20/07)">
        <button class="btn btn-secondary" @click="salvarNoHistorico" :disabled="salvandoHistorico">
          <i class="fas fa-bookmark"></i> {{ salvandoHistorico ? 'Salvando…' : 'Salvar no histórico' }}
        </button>
      </div>

      <div class="kf-acoes kf-no-print">
        <button class="btn btn-secondary" @click="imprimir">
          <i class="fas fa-file-pdf"></i> Salvar / Imprimir
        </button>
        <button class="btn btn-primary" @click="compartilhar">
          <i class="fas fa-share-nodes"></i> Compartilhar
        </button>
      </div>
    </div>

    <!-- ══ TELA: HISTÓRICO DE CARDÁPIOS ══════════════════════════ -->
    <div v-else-if="tela === 'historico'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <button class="cad-btn-icon" @click="tela = 'selecao'">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h2 class="tab-title"><i class="fas fa-clock-rotate-left"></i> Cardápios salvos</h2>
          <div class="spacer"></div>
        </div>
      </div>

      <div class="cad-body">
        <div v-if="!historico.length" class="cad-empty">
          <div class="cad-empty-ico">📖</div>
          <p>Nenhum cardápio salvo ainda. Monte um e salve na tela de apresentação.</p>
        </div>

        <div v-else class="kf-hist-lista">
          <div v-for="c in historico" :key="c.id" class="kf-hist-item">
            <button class="kf-hist-info" @click="reabrirCardapio(c)">
              <span class="kf-hist-nome">{{ c.nome }}</span>
              <span class="kf-hist-sub">{{ new Date(c.data).toLocaleDateString('pt-BR') }} · {{ c.itens.length }} sabor{{ c.itens.length > 1 ? 'es' : '' }}</span>
            </button>
            <button class="kf-btn-remover" @click="excluirDoHistorico(c)" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useStore } from '../store.js'
import { R$, normalizar } from '../utils.js'
import {
  FAIXAS_PADRAO, PARAMETROS_PADRAO,
  getCustoUnitarioFesta, sugerirFaixasPreco, verificarAlertaPreco,
  carregarConfigKitFesta, salvarConfigKitFesta,
  carregarHistoricoKitFesta, salvarCardapioNoHistorico, excluirCardapioDoHistorico,
} from '../composables/useKitFesta.js'

const emit = defineEmits(['voltar'])
const s = useStore()

const tela = ref('selecao')
const busca = ref('')
const historico = ref([])
const nomeCardapioAtual = ref('')
const cardapioAtualId = ref(null)
const salvandoHistorico = ref(false)
const cardapioReaberto = ref(null) // itens de um cardápio salvo, reaberto pra visualização

// Custo da hora de trabalho vem do que já está configurado em Ajustes —
// um só lugar pra esse número, sem duplicar configuração.
const custoHora = computed(() => Number(s.company?.custo_hora_trabalho || 0))

// Parâmetros do cálculo — editáveis aqui porque são específicos do Kit
// Festa (o tempo fixo de um pedido de festa não é o mesmo de outras vendas).
const parametros = reactive({ ...PARAMETROS_PADRAO })

// itens[receitaUuid] = { ativo, faixas: [{minimo, preco}] }
const itens = reactive({})

// Kit Festa agora consome as receitas já materializadas na categoria
// "Festa" (criadas em Receitas por importação vinculada a partir da receita
// tradicional) — ingredientes reais, custo sempre vivo, sem conversão no ar.
// Antes filtrava por r.categoria === 'Festa', mas nenhuma tela do app cria
// receitas com essa categoria — o botão "Festa" em Receitas só define
// r.tamanho = 'Festa' (mantendo a categoria original, ex: "Trufa"). Por isso
// o Kit Festa nunca encontrava as receitas criadas por lá.
const receitasFesta = computed(() => (s.receitas || []).filter(r => normalizar(r.tamanho) === 'festa'))

const receitasFiltradas = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  if (!termo) return receitasFesta.value
  return receitasFesta.value.filter(r => (r.nome || '').toLowerCase().includes(termo))
})

const qtdItensAtivos = computed(() =>
  receitasFesta.value.filter(r => itens[r.uuid]?.ativo).length
)

const nomeEmpresa = computed(() => s.company?.nome || 'Chocolates da Bete')

function custoUnitario(receita) {
  return getCustoUnitarioFesta(receita, { getCustoTotal: s.getCustoTotal })
}

// Preço mostrado no botão do grid — usa a maior faixa (100+) como referência
// de "a partir de", já que é o preço mais baixo que a receita atinge.
function precoReferencia(receita) {
  const item = itens[receita.uuid]
  if (item?.faixas?.length) {
    const menor = item.faixas.reduce((min, f) => (f.preco > 0 && f.preco < min ? f.preco : min), Infinity)
    if (Number.isFinite(menor)) return menor
  }
  const sugestao = sugerirFaixasPreco(custoUnitario(receita), {
    custoHora: custoHora.value,
    horasFixasPorLote: parametros.horasFixasPorLote,
    margemSeguranca: parametros.margemSeguranca,
  })
  return sugestao[sugestao.length - 1]?.preco || 0
}

// Receitas atualmente selecionadas, na ordem em que aparecem no grid —
// usado no painel de ajuste de preço abaixo do grid.
const itensAtivosDetalhe = computed(() => receitasFesta.value.filter(r => itens[r.uuid]?.ativo))

function garantirItem(receita) {
  if (!itens[receita.uuid]) {
    itens[receita.uuid] = { ativo: false, faixas: FAIXAS_PADRAO.map(f => ({ minimo: f.minimo, preco: 0 })) }
  }
  return itens[receita.uuid]
}

function aplicarSugestao(receita) {
  const item = garantirItem(receita)
  item.faixas = sugerirFaixasPreco(custoUnitario(receita), {
    custoHora: custoHora.value,
    horasFixasPorLote: parametros.horasFixasPorLote,
    margemSeguranca: parametros.margemSeguranca,
  })
}

function restaurarSugestao(receita) {
  aplicarSugestao(receita)
  persistir()
}

function alternarItem(receita) {
  const item = garantirItem(receita)
  item.ativo = !item.ativo
  if (item.ativo && !item.faixas.some(f => f.preco > 0)) {
    aplicarSugestao(receita)
  }
  persistir()
}

function alertaFaixa(receita, faixa) {
  return verificarAlertaPreco(faixa.preco, custoUnitario(receita), faixa.minimo, {
    custoHora: custoHora.value,
    horasFixasPorLote: parametros.horasFixasPorLote,
    margemSeguranca: parametros.margemSeguranca,
  })
}

function onEditarPreco(receita) {
  persistir()
}

// Se os parâmetros (horas fixas / margem) mudarem, reaplica sugestão nos
// itens ativos que ainda não tiveram o preço editado manualmente.
function recalcularTodos() {
  for (const r of receitasFesta.value) {
    if (itens[r.uuid]?.ativo) aplicarSugestao(r)
  }
  persistir()
}

let persistTimeout = null
function persistir() {
  clearTimeout(persistTimeout)
  persistTimeout = setTimeout(async () => {
    await salvarConfigKitFesta({
      parametros: JSON.parse(JSON.stringify(parametros)),
      itens: JSON.parse(JSON.stringify(itens)),
    })
  }, 400)
}

onMounted(async () => {
  const config = await carregarConfigKitFesta()
  Object.assign(parametros, config.parametros || {})
  Object.assign(itens, config.itens || {})
  historico.value = await carregarHistoricoKitFesta()
})

const itensParaApresentar = computed(() => {
  if (cardapioReaberto.value) return cardapioReaberto.value
  return receitasFesta.value
    .filter(r => itens[r.uuid]?.ativo)
    .map(r => ({ uuid: r.uuid, nome: r.nome, peso: r.peso_unitario, faixas: itens[r.uuid].faixas }))
})

async function abrirHistorico() {
  historico.value = await carregarHistoricoKitFesta()
  tela.value = 'historico'
}

function reabrirCardapio(cardapio) {
  // Reabre um retrato salvo direto na tela de apresentação — não mexe na
  // seleção "ao vivo" que está sendo montada, pra não perder o que já tinha.
  cardapioAtualId.value = cardapio.id
  nomeCardapioAtual.value = cardapio.nome
  cardapioReaberto.value = cardapio.itens
  tela.value = 'apresentacao'
}

async function excluirDoHistorico(cardapio) {
  historico.value = await excluirCardapioDoHistorico(cardapio.id)
}

async function salvarNoHistorico() {
  salvandoHistorico.value = true
  try {
    const nome = nomeCardapioAtual.value.trim() || `Kit Festa · ${new Date().toLocaleDateString('pt-BR')}`
    const cardapio = await salvarCardapioNoHistorico({
      id: cardapioAtualId.value,
      nome,
      itens: itensParaApresentar.value,
    })
    cardapioAtualId.value = cardapio.id
    nomeCardapioAtual.value = cardapio.nome
    historico.value = await carregarHistoricoKitFesta()
    s.notify('Cardápio salvo no histórico!')
  } finally {
    salvandoHistorico.value = false
  }
}

function irParaApresentacao() {
  cardapioReaberto.value = null
  cardapioAtualId.value = null
  nomeCardapioAtual.value = ''
  tela.value = 'apresentacao'
}

function imprimir() {
  window.print()
}

async function compartilhar() {
  const linhas = itensParaApresentar.value.map(item => {
    const faixasTxt = item.faixas.map(f => `  · ${f.minimo}+ un — ${R$(f.preco)}/un`).join('\n')
    return `🍫 ${item.nome} (${item.peso}g cada)\n${faixasTxt}`
  }).join('\n\n')
  const texto = `*Cardápio Kit Festa — ${nomeEmpresa.value}*\n\n${linhas}\n\n_Consulte disponibilidade e prazo de produção._`

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Cardápio Kit Festa', text: texto })
      return
    } catch { /* usuário cancelou ou share falhou — cai no fallback */ }
  }
  try {
    await navigator.clipboard.writeText(texto)
    s.notify('Cardápio copiado! Cole no WhatsApp para enviar.')
  } catch {
    s.notify('Não foi possível copiar automaticamente.')
  }
}
</script>

<style scoped>
/* ── Base de layout (este componente é isolado — não herda o <style scoped>
   do TabCaderneta.vue, então precisa das próprias regras de cad-tela/cad-body
   etc. Copiado do padrão já usado no resto do perfil Bete.) ── */
.kit-festa { height: 100%; display: flex; flex-direction: column; background: var(--bg); }
.cad-tela { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.cad-body { flex: 1; overflow-y: auto; padding: 20px 16px 120px; }
.cad-btn-icon {
  width: 40px; height: 40px; border: none; background: transparent;
  color: var(--brown); cursor: pointer; display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
}
.cad-btn-icon:active { background: var(--border); }
.cad-search-bar { padding: 10px 0; flex-shrink: 0; }
.cad-search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-full); padding: 0 14px; height: 44px;
  color: var(--muted);
}
.cad-search-input {
  flex: 1; border: none; background: transparent; font-size: 15px;
  color: var(--text); outline: none; font-family: var(--font);
}
.cad-empty { text-align: center; padding: 60px 20px; color: var(--muted); }
.cad-empty-ico { font-size: 40px; margin-bottom: 10px; }

.kf-body { padding-bottom: 90px; }

.kf-param-grid { display: flex; gap: 12px; }
.kf-param { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.kf-param-label { font-size: .74rem; font-weight: 700; color: var(--brown); }
.kf-param-input {
  border: 1.5px solid var(--border2); border-radius: var(--r-sm); background: var(--surface);
  padding: 10px 12px; font-weight: 700; font-size: .95rem; color: var(--text);
}
.kf-param-hint { font-size: .68rem; color: var(--muted); line-height: 1.3; }
.kf-hint-aviso { color: var(--orange); background: var(--orange-bg); padding: 8px 10px; border-radius: var(--r-md); display: flex; gap: 6px; align-items: flex-start; margin-top: 8px; }

.kf-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px;
  margin-bottom: 16px;
}
.kf-card--destaque { background: var(--gold-bg); border-color: var(--gold-light); }
.kf-card-titulo { font-weight: 700; color: var(--brown); display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.kf-hint { margin: 10px 0 0; font-size: .78rem; color: var(--muted); line-height: 1.4; }

.kf-lista { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.kf-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  transition: border-color var(--t);
}
.kf-item--ativo { border-color: var(--gold-light); }
.kf-item-hdr {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 14px; background: transparent; border: none; text-align: left;
}
.kf-item-check {
  width: 22px; height: 22px; border-radius: var(--r-sm); border: 2px solid var(--border2);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: .7rem;
  transition: all var(--t);
}
.kf-item-check.marcado { background: var(--gold); border-color: var(--gold); }
.kf-item-info { flex: 1; display: flex; flex-direction: column; text-align: left; }
.kf-item-nome { font-weight: 700; color: var(--text); font-size: .92rem; }
.kf-item-sub { font-size: .74rem; color: var(--muted); }
.kf-item-chevron { color: var(--text-faint); font-size: .8rem; }

.kf-item-painel { padding: 0 14px 16px; border-top: 1px solid var(--border); padding-top: 14px; }
.kf-item-hdr--static { cursor: default; }
.kf-btn-remover {
  width: 30px; height: 30px; border-radius: 50%; border: none; background: var(--surface2, #f3f4f6);
  color: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.kf-btn-remover:active { background: var(--red-bg); color: var(--red); }

/* ── Grid de sabores (estilo Cozinha) ─────────────────────────── */
.kf-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px; margin-top: 14px;
}
.kf-gbtn {
  position: relative; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-lg); padding: 14px 10px; display: flex; flex-direction: column;
  align-items: center; gap: 4px; text-align: center; cursor: pointer; transition: all var(--t);
}
.kf-gbtn:active { transform: scale(.97); }
.kf-gbtn--ativo { border-color: var(--gold); background: var(--gold-bg); }
.kf-gbtn-check {
  position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--border2); display: flex; align-items: center; justify-content: center;
  font-size: .6rem; color: #fff; background: var(--surface);
}
.kf-gbtn-check.marcado { background: var(--gold); border-color: var(--gold); }
.kf-gbtn-warn { position: absolute; top: 8px; left: 8px; color: #b45309; font-size: .8rem; }
.kf-gbtn-nome { font-weight: 700; font-size: .86rem; color: var(--text); margin-top: 10px; line-height: 1.2; }
.kf-gbtn-peso { font-size: .72rem; color: var(--muted); }
.kf-gbtn-preco { font-size: .7rem; font-weight: 700; color: var(--brown-dark); margin-top: 2px; }

.kf-ajuste-titulo { margin-top: 22px; }

/* ── Histórico ─────────────────────────────────────────────────── */
.kf-hist-lista { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.kf-hist-item {
  display: flex; align-items: center; gap: 10px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--r-lg); padding: 4px;
}
.kf-hist-info { flex: 1; display: flex; flex-direction: column; text-align: left; padding: 10px 12px; background: none; border: none; }
.kf-hist-nome { font-weight: 700; color: var(--text); font-size: .9rem; }
.kf-hist-sub { font-size: .74rem; color: var(--muted); margin-top: 2px; }

/* ── Salvar cardápio no histórico (tela de apresentação) ─────────── */
.kf-salvar-hist { display: flex; gap: 8px; padding: 0 16px 12px; }
.kf-salvar-hist .input { flex: 1; }
.kf-salvar-hist .btn { flex-shrink: 0; }

.kf-alerta-erro {
  background: var(--red-bg); color: var(--red); border-radius: var(--r-md);
  padding: 10px 12px; font-size: .82rem; font-weight: 600; display: flex; gap: 8px; align-items: center;
}

.kf-conv-grid { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.kf-conv-box { flex: 1; background: var(--cream); border-radius: var(--r-md); padding: 8px 10px; text-align: center; display: flex; flex-direction: column; gap: 2px; }
.kf-conv-box--destaque { background: var(--gold-bg); border: 1px solid var(--gold-light); }
.kf-conv-label { font-size: .68rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
.kf-conv-val { font-weight: 800; color: var(--brown); font-size: .95rem; }
.kf-conv-arrow { color: var(--text-faint); font-size: .8rem; }

.kf-faixas-titulo { font-size: .78rem; font-weight: 700; color: var(--muted); margin-bottom: 8px; }
.kf-faixas { display: flex; flex-direction: column; gap: 10px; }
.kf-faixa { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; background: var(--cream); border-radius: var(--r-md); padding: 10px; }
.kf-faixa-label { font-weight: 700; color: var(--brown); font-size: .82rem; width: 62px; }
.kf-faixa-input-wrap { display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r-sm); padding: 0 8px; }
.kf-faixa-prefixo { font-size: .78rem; color: var(--muted); margin-right: 4px; }
.kf-faixa-input { width: 70px; border: none; padding: 8px 0; font-weight: 700; font-size: .9rem; background: transparent; }
.kf-faixa-alerta { color: var(--red); font-size: .72rem; font-weight: 600; display: flex; align-items: center; gap: 4px; flex-basis: 100%; }
.kf-faixa-ok { color: var(--green); font-size: .72rem; font-weight: 600; }

.kf-btn-restaurar {
  margin-top: 14px; width: 100%; background: transparent; border: 1px dashed var(--border2);
  color: var(--brown-mid); font-weight: 600; font-size: .8rem; padding: 9px; border-radius: var(--r-md);
  display: flex; align-items: center; justify-content: center; gap: 6px;
}

.kf-footer-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-header);
  background: var(--surface); border-top: 1px solid var(--border);
  padding: 12px 16px max(12px, env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  box-shadow: 0 -8px 24px rgba(61,31,7,.08);
}
.kf-footer-info { font-size: .8rem; font-weight: 700; color: var(--muted); }

/* ── Apresentação / Cardápio para o cliente ── */
.kf-menu-print {
  background: var(--surface);
  margin: 16px;
  border-radius: var(--r-xl);
  padding: 28px 22px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--gold-light);
}
.kf-menu-topo { text-align: center; margin-bottom: 24px; }
.kf-menu-selo { font-size: 2.2rem; }
.kf-menu-titulo { font-family: var(--font); font-size: 1.4rem; color: var(--brown); margin: 4px 0 0; font-weight: 800; }
.kf-menu-subtitulo { color: var(--gold-dark); font-weight: 700; letter-spacing: .5px; text-transform: uppercase; font-size: .72rem; margin-top: 4px; }

.kf-menu-lista { display: flex; flex-direction: column; gap: 18px; }
.kf-menu-produto { border-bottom: 1px dashed var(--border2); padding-bottom: 16px; }
.kf-menu-produto:last-child { border-bottom: none; }
.kf-menu-produto-hdr { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.kf-menu-produto-nome { font-weight: 800; color: var(--brown-dark); font-size: 1.02rem; }
.kf-menu-produto-peso { font-size: .74rem; color: var(--muted); font-weight: 600; }
.kf-menu-faixas { display: flex; flex-direction: column; gap: 4px; }
.kf-menu-faixa { display: flex; justify-content: space-between; font-size: .86rem; }
.kf-menu-faixa-qtd { color: var(--muted); }
.kf-menu-faixa-preco { color: var(--gold-dark); font-weight: 800; }
.kf-menu-faixa-preco small { font-weight: 600; color: var(--muted); }

.kf-menu-rodape { margin-top: 20px; text-align: center; }
.kf-menu-rodape p { font-size: .7rem; color: var(--text-faint); }

.kf-acoes { display: flex; gap: 10px; padding: 0 16px 24px; }
.kf-acoes .btn { flex: 1; }

@media print {
  .kf-no-print { display: none !important; }
  .kf-menu-print { box-shadow: none; border: none; margin: 0; }
}
</style>
