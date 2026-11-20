<template>
  <div>
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-brain"></i> Inteligência</h2>
        <div class="tab-actions">
          <button class="btn btn-secondary btn-sm" @click="s.setTab('painel')">
            <i class="fas fa-arrow-left"></i>
          </button>
        </div>
      </div>
    </div>

    <section class="tab-content">
      <div v-if="s.loading" class="loading-box">
        <div class="spinner spinner-sm"></div>
      </div>
      <template v-else>

        <!-- ══ GUIA DO NEGÓCIO: vendas reais, clientes, produtos e próximos passos ══ -->
        <GuiaNegocio />

        <!-- ══ PREÇO CERTO: uma conta só, com os custos reais do negócio ══ -->
        <PrecoCerto />

        <!-- ══ PIX MEI: proposta de investimento com os números do negócio ══ -->
        <PropostaInvestimento :coletar="coletarDados" @prompt-ia="entregarPrompt" />

        <!-- ══ CONSULTAR IA ══ -->
        <div class="int-bloco">
          <div class="int-bloco-titulo"><i class="fas fa-robot"></i> Conversar com uma IA sobre o meu negócio</div>
          <div class="ia-grid-int">
            <button v-for="p in PROMPTS" :key="p.id" class="ia-btn-int" :disabled="preparandoIA" @click="dispararPrompt(p)">
              <div class="ia-btn-ico-int" :style="{ background: p.bg, color: p.cor }">
                <i :class="p.icon"></i>
              </div>
              <div class="ia-btn-body-int">
                <div class="ia-btn-titulo-int">{{ p.titulo }}</div>
                <div class="ia-btn-sub-int">{{ p.sub }}</div>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--muted);font-size:.72rem;flex-shrink:0"></i>
            </button>
          </div>
          <div class="ia-hint-int">
            <i class="fas fa-info-circle"></i>
            O texto sai com seus números (vendas, margens, custos). Clientes vão só com iniciais — nomes e telefones não são enviados.
          </div>
        </div>

      </template>

      <!-- ══ MODAL SELETOR DE IA ══ -->
      <BaseModal v-if="modalIA" title="Abrir na sua IA preferida" @close="modalIA = false">
        <div class="modal-inner">
          <p class="hint mb-16">O texto com seus dados foi copiado! Escolha onde deseja colar para analisar:</p>

          <div class="ia-selector-grid">
            <button v-for="ai in listaAIs" :key="ai.id" class="ia-choice-btn" @click="abrirIA(ai)">
              <div class="ia-choice-ico" :class="ai.id">
                <i :class="ai.icon"></i>
              </div>
              <span>{{ ai.nome }}</span>
            </button>
          </div>
          <div class="ia-hint-int mt-24">
            <i class="fas fa-info-circle"></i>
            Se o texto não aparecer sozinho, basta <strong>Colar</strong> no chat.
          </div>
        </div>
      </BaseModal>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useStore } from '../store.js'
import { db } from '../db.js'
import BaseModal from '../components/BaseModal.vue'
import GuiaNegocio from '../components/GuiaNegocio.vue'
import PrecoCerto from '../components/PrecoCerto.vue'
import PropostaInvestimento from '../components/PropostaInvestimento.vue'
import { hoje, getLojas } from '../composables/useCaderneta.js'
import {
  criarCustoDoItem, analisarClientes, clientesQueSumiram, analisarProdutos,
  combosFrequentes, resumoDoMes, analisarLojas,
} from '../modules/guiaNegocio.js'
import { baseFinanceira, riscoFiado, listaPrecoCerto } from '../modules/precoCerto.js'
import { conciliar } from '../modules/conciliacao.js'
import { analisarProducao } from '../modules/producaoSemanal.js'
import { PROMPTS, montarContexto, gerarPrompt } from '../modules/promptsIA.js'

const s = useStore()

// ── Seletor de IA ───────────────────────────────────────────
const modalIA = ref(false)
const preparandoIA = ref(false)
const promptGerado = ref('')
// URLs com o texto inteiro podem ser cortadas em textos longos: nesses casos abre só a IA e a pessoa cola.
const LIMITE_URL = 6000
const listaAIs = [
  { id: 'gemini',   nome: 'Gemini',   icon: 'fas fa-wand-magic-sparkles', base: 'https://gemini.google.com/app', url: p => `https://gemini.google.com/app?q=${encodeURIComponent(p)}` },
  { id: 'chatgpt',  nome: 'ChatGPT',  icon: 'fas fa-comment-dots',        base: 'https://chatgpt.com/',          url: p => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  { id: 'claude',   nome: 'Claude',   icon: 'fas fa-robot',               base: 'https://claude.ai/new',         url: p => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  { id: 'deepseek', nome: 'DeepSeek', icon: 'fas fa-brain',               base: 'https://chat.deepseek.com/',    url: () => 'https://chat.deepseek.com/' },
]

// Junta os mesmos números do Guia e do Preço certo (usado pelos prompts e pela proposta do Pix MEI)
async function coletarDados() {
  const [fiados, clientes, lojasBase, historicoPrecos, financeiro, producoes] = await Promise.all([
    db.cad_fiados.toArray(), db.cad_clientes.toArray(), getLojas({ incluirArquivadas: true }), db.historico_precos_venda.toArray(), db.financeiro.toArray(), db.producoes.toArray(),
  ])
  const entradas = financeiro.filter(e => e.categoria === 'Receita de Vendas' && Number(e.valor) > 0)
  const conc = conciliar({ entradas, fiados, clientes, hoje: hoje() })
  const hj = hoje()
  const receitas = s.receitas.filter(r => !r.eh_intermediaria).map(r => ({
    uuid: r.uuid, nome: r.nome, categoria: r.categoria, tamanho: r.tamanho,
    custoUnit: s.getCustoTotal(r) / (r.rendimento || 1), preco: Number(r.preco_sugerido || 0),
  }))
  const custoDoItem = criarCustoDoItem(receitas)
  // Produção semanal: usa TODAS as receitas (para reconhecer e descartar as intermediárias)
  const producao = analisarProducao({
    producoes, fiados, hoje: hj,
    receitas: s.receitas.map(r => ({ uuid: r.uuid, nome: r.nome, categoria: r.categoria, unidade_rendimento: r.unidade_rendimento, eh_intermediaria: !!r.eh_intermediaria })),
  })
  const metaRetirada = Number(s.company?.meta_salario_mensal || 0)
  const tetoMei = Number(s.company?.teto_mei_anual) || 0
  const faturadoAno = Number(s.totalRecebidoAnoAtual || 0)
  const base = baseFinanceira({ relatorio: s.relatorioMensalMei, hoje: hj, metaRetirada })
  const risco = riscoFiado({ fiados, hoje: hj })
  const analise = analisarClientes({ fiados, clientes, lojas: lojasBase, hoje: hj })
  const mes = resumoDoMes({ fiados, custoDoItem, hoje: hj })
  const produtos = analisarProdutos({ fiados, custoDoItem, hoje: hj })
  const contexto = montarContexto({
    empresa: s.company?.nome || '', hoje: hj,
    mes, base, risco,
    precos: listaPrecoCerto({ receitas, base, risco, fiados, historicoPrecos, hoje: hj }),
    produtos,
    clientes: analise, sumiram: clientesQueSumiram(analise),
    combosJuntos: combosFrequentes(fiados),
    lojas: analisarLojas({ fiados, lojas: lojasBase, hoje: hj }),
    canais: { meses: conc.meses, pagadores: conc.pagadoresAvista },
    metaRetirada, tetoMei, faturadoAno,
  })
  return { hj, base, mes, produtos, tetoMei, faturadoAno, contexto, producao }
}

async function montarPrompt(id) {
  const { contexto } = await coletarDados()
  return gerarPrompt(id, contexto)
}

// Copia o texto e abre o seletor de IA (usado pelos botões da aba e pela proposta do Pix MEI)
async function entregarPrompt(texto) {
  promptGerado.value = texto
  // Copia primeiro (essencial no celular)
  try {
    await navigator.clipboard.writeText(texto)
    s.notify('Texto copiado! Escolha a IA abaixo.')
  } catch {
    s.notify('Escolha a IA e cole o texto.', 'warning')
  }
  modalIA.value = true
}

async function dispararPrompt(p) {
  if (preparandoIA.value) return
  preparandoIA.value = true
  let texto
  try {
    texto = await montarPrompt(p.id)
  } catch (e) {
    console.error(e); s.notify('Não deu para montar o texto agora.', 'error'); preparandoIA.value = false; return
  }
  preparandoIA.value = false
  await entregarPrompt(texto)
}

function abrirIA(ai) {
  const comTexto = ai.url(promptGerado.value)
  window.open(comTexto.length > LIMITE_URL ? ai.base : comTexto, '_blank')
  modalIA.value = false
}
</script>

<style scoped>
/* ── Estrutura base ── */
.tab-content {
  padding: 14px 16px max(96px, calc(72px + env(safe-area-inset-bottom)));
  display: flex;
  flex-direction: column;
  gap: 0;
}

.int-bloco {
  margin-bottom: 16px;
}

.int-bloco-titulo {
  font-size: .68rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: .5px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 0 2px;
}

/* ── Alertas ── */
.alertas-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alerta-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alerta-alta {
  border-left: 3px solid var(--red, #c0392b);
}

.alerta-media {
  border-left: 3px solid var(--orange);
}

.alerta-baixa {
  border-left: 3px solid var(--blue);
}

.alerta-topo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alerta-ico-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--r-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
}

.ico-alta {
  background: #FCEBEB;
  color: var(--red, #c0392b);
}

.ico-media {
  background: var(--orange-bg);
  color: var(--orange);
}

.ico-baixa {
  background: var(--blue-bg);
  color: var(--blue);
}

.alerta-info {
  flex: 1;
  min-width: 0;
}

.alerta-titulo {
  font-size: .84rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.alerta-ganho {
  font-size: .68rem;
  color: var(--green);
  font-weight: 700;
  margin-top: 1px;
}

.alerta-badge {
  font-size: .6rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: var(--r-full);
  flex-shrink: 0;
  letter-spacing: .3px;
}

.badge-alta {
  background: #FCEBEB;
  color: var(--red, #c0392b);
}

.badge-media {
  background: var(--orange-bg);
  color: var(--orange);
}

.badge-baixa {
  background: var(--blue-bg);
  color: var(--blue);
}

.badge-tendencia-cima {
  background: var(--green-bg, #E7F6EC);
  color: var(--green, #1e8e4a);
}

.badge-tendencia-baixo {
  background: var(--border2);
  color: var(--muted);
}

.alerta-desc {
  font-size: .73rem;
  color: var(--muted);
  line-height: 1.45;
}

/* ── Eficiência mensal ── */
.ef-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.ef-row:last-child {
  border-bottom: none;
}

.ef-mes {
  font-size: .72rem;
  font-weight: 700;
  color: var(--muted);
  width: 44px;
  flex-shrink: 0;
}

.ef-recipe-info {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ef-sub {
  font-size: .62rem;
  color: var(--muted);
}

.ef-barras {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ef-bar-wrap {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.ef-bar {
  height: 100%;
  border-radius: 3px;
  transition: width .5s ease;
}

.ef-bar-esp {
  background: var(--border2);
}

.ef-bar-real {
  background: var(--green);
}

.ef-nums {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  width: 52px;
}

.ef-pct {
  font-size: .78rem;
  font-weight: 800;
}

.ef-lucro {
  font-size: .65rem;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--muted);
}

.ef-legenda {
  display: flex;
  gap: 12px;
  padding: 8px 14px;
  font-size: .62rem;
  color: var(--muted);
  border-top: 1px solid var(--border);
}

.ef-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.dot-esp {
  background: var(--border2);
}

.dot-real {
  background: var(--green);
}

/* ── Ranking ── */
.rank-row-int {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.rank-row-int:last-child {
  border-bottom: none;
}

.rank-pos-int {
  width: 18px;
  text-align: center;
  font-size: .78rem;
  font-weight: 800;
  flex-shrink: 0;
}

.rp-ouro {
  color: #c9920c;
}

.rp-prata {
  color: #9e9e9e;
}

.rp-bronze {
  color: #a0673a;
}

.rp-n {
  color: var(--muted);
}

.rank-body-int {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rank-nome-int {
  font-size: .83rem;
  font-weight: 700;
  color: var(--brown-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-bar-bg-int {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.rank-bar-fill-int {
  height: 100%;
  border-radius: 2px;
  transition: width .5s ease;
  max-width: 100%;
}

.rank-nums-int {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.rank-lucro-int {
  font-size: .65rem;
  color: var(--muted);
  font-family: var(--mono);
}

/* ── Analisar produto ── */
.form-inline-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.diagnostico-card {
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.diag-ok {
  background: var(--green-bg);
  border-color: var(--green-dim);
}

.diag-margem_baixa {
  background: var(--gold-bg);
  border-color: var(--gold);
}

.diag-abaixo_do_minimo {
  background: var(--orange-bg);
  border-color: var(--orange-dim);
}

.diag-prejuizo {
  background: #FCEBEB;
  border-color: #f5c6c6;
}

.diag-topo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: .84rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.diag-margem {
  margin-left: auto;
  font-size: .78rem;
  font-weight: 800;
  font-family: var(--mono);
}

.diag-metricas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.diag-m {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.diag-m-lbl {
  font-size: .6rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .3px;
}

.diag-m strong {
  font-size: .85rem;
  font-weight: 800;
  font-family: var(--mono);
}

.preco-min-card {
  padding: 10px 12px;
  background: var(--blue-bg);
  border: 1px solid #bfdbfe;
  border-radius: var(--r-md);
  margin-bottom: 8px;
}

.preco-min-hdr {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: .72rem;
  color: var(--blue);
  font-weight: 700;
  margin-bottom: 8px;
}

.preco-min-nums {
  display: flex;
  gap: 16px;
}

.preco-min-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preco-min-lbl {
  font-size: .6rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
}

.preco-min-item strong {
  font-size: .9rem;
  font-weight: 800;
  font-family: var(--mono);
  color: var(--brown-dark);
}

/* ── Combos ── */
.combos-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.combo-card-int {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.combo-produtos-int {
  font-size: .85rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.combo-mais {
  color: var(--gold-dark);
  font-weight: 400;
  padding: 0 3px;
}

.combo-nums-int {
  display: flex;
  align-items: center;
  gap: 10px;
}

.combo-preco-int {
  font-size: 1rem;
  font-weight: 800;
  font-family: var(--mono);
  color: var(--brown-dark);
}

.combo-margem-int {
  font-size: .72rem;
  font-weight: 700;
}

.combo-desc-int {
  font-size: .7rem;
  color: var(--muted);
  line-height: 1.4;
}

/* ── IA ── */
.ia-grid-int {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 8px;
}

.ia-btn-int {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  text-align: left;
  transition: background var(--t);
  width: 100%;
}

.ia-btn-int:active {
  background: var(--cream);
  transform: scale(0.98);
}

.ia-btn-ico-int {
  width: 34px;
  height: 34px;
  border-radius: var(--r-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
}

.ia-btn-body-int {
  flex: 1;
  min-width: 0;
}

.ia-btn-titulo-int {
  font-size: .82rem;
  font-weight: 800;
  color: var(--brown-dark);
}

.ia-btn-sub-int {
  font-size: .63rem;
  color: var(--muted);
  margin-top: 2px;
}

.ia-hint-int {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  background: var(--blue-bg);
  border: 1px solid #bfdbfe;
  border-radius: var(--r-sm);
  font-size: .65rem;
  color: var(--blue);
  line-height: 1.4;
}

/* utils */
.mb-10 {
  margin-bottom: 10px;
}

.mb-16 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 4px;
}

.mt-10 {
  margin-top: 10px;
}

.btn-full {
  width: 100%;
}

.p-0 {
  padding: 0;
}

/* Estilo para o toggle de Preço Total */
.incluir-pessoal-toggle-modern {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--cream);
  border: 1.5px dashed var(--border2);
  border-radius: var(--r-md);
  font-size: 0.78rem;
  color: var(--muted);
  cursor: pointer;
  transition: all var(--t);
  margin-top: -4px;
}
.incluir-pessoal-toggle-modern:active { transform: scale(0.98); background: var(--gold-bg); }
.incluir-pessoal-toggle-modern input {
  width: 18px; height: 18px; accent-color: var(--brown); cursor: pointer;
}
.incluir-pessoal-toggle-modern strong { color: var(--gold-dark); font-weight: 800; }

/* Seletor de IA */
.modal-inner {
  padding: 16px 16px 24px;
}

.ia-selector-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 8px 0;
}
.ia-choice-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 10px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--r-lg);
  transition: all var(--t);
  border-bottom: 3px solid var(--border);
}
.ia-choice-btn:active { transform: scale(0.96); background: var(--gold-bg); }
.ia-choice-ico {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem;
}
.ia-choice-ico.gemini   { background: #eff6ff; color: #1a73e8; }
.ia-choice-ico.chatgpt  { background: #f0fdf4; color: #10a37f; }
.ia-choice-ico.claude   { background: #fff7ed; color: #d97706; }
.ia-choice-ico.deepseek { background: #f5f3ff; color: #7c3aed; }
.ia-choice-btn span { font-size: 0.85rem; font-weight: 700; color: var(--brown-dark); }
</style>
