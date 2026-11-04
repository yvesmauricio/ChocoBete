<template>
  <div class="tab-etiquetas">

    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-tags"></i> Etiquetas</h2>
      </div>
      <p class="tab-subtitle">Gere etiquetas Pimaco A5Q-1226 por sabor e quantidade</p>
    </div>

    <!-- ── Indicador de etapas ── -->
    <div class="etq-steps">
      <button
        v-for="(s2, idx) in passos"
        :key="s2.id"
        class="etq-step"
        :class="{ ativo: passoAtual === idx + 1, concluido: passoAtual > idx + 1 }"
        :disabled="idx + 1 > passoMaximoAlcancado || (folhaCheiaSelecionada && s2.id === 'posicao')"
        @click="irParaPasso(idx + 1)"
      >
        <span class="etq-step-bola">
          <i v-if="passoAtual > idx + 1" class="fas fa-check"></i>
          <template v-else>{{ idx + 1 }}</template>
        </span>
        <span class="etq-step-label">{{ s2.label }}</span>
      </button>
    </div>

    <div class="etq-content">
      <div class="sheet-card">
        <div class="sheet-body">

          <!-- ════════════════ PASSO 1 — SABORES ════════════════ -->
          <div v-if="passoAtual === 1" class="etq-passo">
            <p class="hint mb-12">Toque nos sabores para adicionar às etiquetas.</p>

            <div v-if="receitasParaEtiqueta.length" class="etq-sabores-list">
              <div
                v-for="r in receitasParaEtiqueta"
                :key="r._textoSabor"
                class="etq-sabor-row no-select sticky-touch"
                :class="{ 'etq-sabor-row--ativo': etqQtds[r._textoSabor] > 0 }"
                role="button"
                tabindex="0"
                @click="selecionarFolhaSabor(r._textoSabor)"
                @keydown.enter.prevent="selecionarFolhaSabor(r._textoSabor)"
              >
                <div class="etq-sabor-info">
                  <span class="etq-sabor-nome">{{ r._textoSabor }}</span>
                  <span class="badge-shortcut">Folha</span>
                </div>
                <div class="qty-ctrl-sm" @click.stop>
                  <button class="btn-qty-sm" :disabled="!etqQtds[r._textoSabor]" @click="ajustarQtdEtiqueta(r._textoSabor, -1)">-</button>
                  <input
                    type="number"
                    class="qty-input-cozinha"
                    min="0"
                    max="77"
                    :value="etqQtds[r._textoSabor] || 0"
                    inputmode="numeric"
                    @change="e => atualizarQtdEtiquetaManual(r._textoSabor, e.target.value)"
                  />
                  <button class="btn-qty-sm" :disabled="Number(etqQtds[r._textoSabor] || 0) >= 77" @click="ajustarQtdEtiqueta(r._textoSabor, 1)">+</button>
                </div>
              </div>
            </div>
            <p v-else class="hint">Nenhuma receita cadastrada ainda.</p>

            <p class="hint mt-12">Para mostrar ou esconder uma receita aqui, ajuste “Usar em etiquetas” no cadastro da receita.</p>
          </div>

          <!-- ════════════════ PASSO 2 — POSIÇÃO NA FOLHA ════════════════ -->
          <div v-if="passoAtual === 2 && !folhaCheiaSelecionada" class="etq-passo">
            <p class="hint mb-12">Diga ao sistema onde, na folha física, as próximas etiquetas devem ser impressas.</p>

            <!-- Seletor de modo: cartões grandes, fácil de tocar -->
            <div class="etq-modo-cards">
              <button class="etq-modo-card" :class="{ ativo: !modoManual }" @click="definirModo(false)">
                <i class="fas fa-list-ol"></i>
                <span class="etq-modo-card-titulo">Sequencial</span>
                <span class="etq-modo-card-desc">Continua de onde parou na folha</span>
              </button>
              <button class="etq-modo-card" :class="{ ativo: modoManual }" @click="definirModo(true)">
                <i class="fas fa-hand-pointer"></i>
                <span class="etq-modo-card-titulo">Manual</span>
                <span class="etq-modo-card-desc">Toque nas posições vazias da folha</span>
              </button>
            </div>

            <!-- Posição inicial — só no modo sequencial -->
            <div v-if="!modoManual" class="fg mb-12 mt-16">
              <label class="label">Próxima etiqueta livre na folha</label>
              <div class="input-with-icon">
                <i class="fas fa-tag"></i>
                <input v-model.number="company.posicao_etiqueta" type="number" class="input" min="1" max="77" />
              </div>
            </div>

            <p v-if="modoManual" class="hint mb-8 mt-16">Marque exatamente {{ totalEtiquetasSelecionadas }} posição{{ totalEtiquetasSelecionadas > 1 ? 'ões' : '' }} na folha. As etiquetas da sua lista são distribuídas na ordem em que você for marcando.</p>

            <!-- Preview da folha -->
            <div class="etq-preview-wrap">
              <div class="etq-preview-hdr">
                <span class="etq-preview-titulo"><i class="fas fa-eye"></i> Pimaco A5Q-1226</span>
                <button class="etq-help-btn" @click="mostrarLegenda = !mostrarLegenda" title="Legenda">
                  <i class="fas fa-circle-question"></i>
                </button>
                <div v-if="totalFolhasNav > 1" class="etq-preview-nav">
                  <button class="etq-nav-btn" :disabled="folhaPreviewAtual <= 1" @click="folhaPreviewAtual--">‹</button>
                  <span>{{ folhaPreviewAtual }} / {{ totalFolhasNav }}</span>
                  <button class="etq-nav-btn" :disabled="folhaPreviewAtual >= totalFolhasNav" @click="folhaPreviewAtual++">›</button>
                </div>
              </div>

              <div v-if="mostrarLegenda" class="etq-preview-legenda">
                <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-usada"></span>já usada</span>
                <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-vazio"></span>vazia</span>
                <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-selecionada"></span>{{ modoManual ? 'marcada' : 'será impressa' }}</span>
                <span v-if="!modoManual" class="etq-leg-item"><span class="etq-leg-dot etq-dot-inicio"></span>início</span>
              </div>

              <div class="etq-folha">
                <div
                  v-for="cel in celulasPreview" :key="cel.pos"
                  class="etq-celula"
                  :class="[`etq-cel-${cel.estado}`, { 'etq-cel-clicavel': modoManual }]"
                  :title="`Posição ${cel.pos}${cel.texto ? ': ' + cel.texto : ''}`"
                  @click="modoManual && toggleCelulaManual(cel)"
                >
                  <span v-if="cel.texto" class="etq-cel-txt">{{ cel.texto }}</span>
                </div>
              </div>

              <div v-if="modoManual" class="etq-resumo etq-resumo-manual">
                <i class="fas fa-circle-info"></i>
                {{ posicoesManualMarcadas.size }} / {{ totalEtiquetasSelecionadas }} posiç{{ totalEtiquetasSelecionadas > 1 ? 'ões marcadas' : 'ão marcada' }}
                <button v-if="posicoesManualMarcadas.size" class="etq-limpar-marcas" @click="posicoesManualMarcadas.clear()">Limpar</button>
              </div>
            </div>
          </div>

          <!-- ════════════════ PASSO 3 — CONFIRMAR E GERAR ════════════════ -->
          <div v-if="passoAtual === 3" class="etq-passo">
            <p class="hint mb-12">Confira o resumo antes de gerar o arquivo.</p>

            <!-- Texto de contato -->
            <div class="fg mb-16">
              <label class="label">Texto de contato na etiqueta</label>
              <input v-model="company.contato_etiqueta" class="input" placeholder="Ex: Bete (21) 9 9943-0023" />
              <p class="hint">Aparece embaixo do sabor em cada etiqueta. Se vazio, usa o contato da empresa.</p>
            </div>

            <!-- Resumo dos sabores escolhidos -->
            <div class="etq-resumo-card">
              <div class="etq-resumo-card-row" v-for="r in receitasComQtd" :key="r._textoSabor">
                <span class="etq-resumo-card-nome">{{ r._textoSabor }}</span>
                <span class="etq-resumo-card-qtd">{{ etqQtds[r._textoSabor] }}×</span>
              </div>
              <div class="etq-resumo-card-total">
                <span><i class="fas fa-tags"></i> {{ totalEtiquetasSelecionadas }} etiqueta{{ totalEtiquetasSelecionadas > 1 ? 's' : '' }}</span>
                <span>{{ folhaCheiaSelecionada ? '1 folha completa' : (modoManual ? `${posicoesManualMarcadas.size} posição marcada` : `${totalFolhasEtiqueta} folha${totalFolhasEtiqueta > 1 ? 's' : ''}`) }}</span>
              </div>
            </div>

            <button class="btn btn-primary btn-full mt-16" :disabled="!podeGerar" @click="gerarEtiquetasAvulsas">
              <i class="fas fa-file-word"></i> Gerar .docx
            </button>

          </div>

          <!-- ── Navegação entre passos ── -->
          <div class="etq-passo-nav">
            <button v-if="passoAtual > 1" class="btn btn-secondary" @click="passoAtual--">
              <i class="fas fa-arrow-left"></i> Voltar
            </button>
            <button v-if="passoAtual < 3" class="btn btn-primary" :disabled="!podeAvancar" @click="avancarPasso">
              Continuar <i class="fas fa-arrow-right"></i>
            </button>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useStore } from '../store.js'
import { textoEtiquetaReceita } from '../utils.js'
import { useConfirm as useAppConfirm } from '../composables/useConfirm.js'
import { gerarArquivoEtiquetas } from '../composables/useEtiquetas.js'

const s = useStore()
const confirmar = useAppConfirm()
const company = reactive({ ...s.company })

// Sincroniza com a store quando carregada
watch(() => s.company, (val) => {
  if (val) Object.assign(company, JSON.parse(JSON.stringify(val)))
}, { deep: true, immediate: true })

// ── Wizard: controle de passos ──────────────────────────────────
const passos = [
  { id: 'sabores', label: 'Sabores' },
  { id: 'posicao', label: 'Posição' },
  { id: 'gerar', label: 'Gerar' },
]
const passoAtual = ref(1)
const passoMaximoAlcancado = ref(1)

function irParaPasso(n) {
  if (folhaCheiaSelecionada.value && n === 2) return
  if (n <= passoMaximoAlcancado.value) passoAtual.value = n
}

function avancarPasso() {
  if (!podeAvancar.value) return
  if (passoAtual.value === 1 && folhaCheiaSelecionada.value) {
    modoManual.value = false
    posicoesManualMarcadas.clear()
    company.posicao_etiqueta = 1
    passoAtual.value = 3
    passoMaximoAlcancado.value = 3
    return
  }
  passoAtual.value = Math.min(3, passoAtual.value + 1)
  passoMaximoAlcancado.value = Math.max(passoMaximoAlcancado.value, passoAtual.value)
}

const podeAvancar = computed(() => {
  if (passoAtual.value === 1) return totalEtiquetasSelecionadas.value > 0
  if (passoAtual.value === 2) return modoManual.value ? posicoesManualMarcadas.size === totalEtiquetasSelecionadas.value : true
  return true
})

// ── Etiquetas ──────────────────────────────────────────────────
const etqQtds = reactive({})
const mostrarLegenda = ref(false)
const folhaPreviewAtual = ref(1)
const ETIQUETAS_POR_FOLHA = 77

function limitarQtdEtiqueta(valor) {
  return Math.min(ETIQUETAS_POR_FOLHA, Math.max(0, Number.parseInt(valor, 10) || 0))
}

function selecionarFolhaSabor(texto) {
  etqQtds[texto] = Number(etqQtds[texto] || 0) > 0 ? 0 : ETIQUETAS_POR_FOLHA
}

function ajustarQtdEtiqueta(texto, delta) {
  etqQtds[texto] = limitarQtdEtiqueta(Number(etqQtds[texto] || 0) + delta)
}

function atualizarQtdEtiquetaManual(texto, valor) {
  etqQtds[texto] = limitarQtdEtiqueta(valor)
}

// ── Modo manual: marcação individual de posições na folha ──
const modoManual = ref(false)
const posicoesManualMarcadas = reactive(new Map()) // posicaoGlobal0based -> true (ordem de inserção = ordem de impressão)

function definirModo(manual) {
  if (modoManual.value === manual) return
  modoManual.value = manual
  folhaPreviewAtual.value = 1
  posicoesManualMarcadas.clear()
}

function usaEtiqueta(r) {
  return r.usar_em_etiquetas ?? !Number(r.eh_intermediaria)
}

const receitasParaEtiqueta = computed(() => {
  const vistos = new Map()
  const ordenadas = [...s.receitas]
    .filter(usaEtiqueta)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  for (const r of ordenadas) {
    const texto = textoEtiquetaReceita(r)
    if (!texto || vistos.has(texto)) continue
    vistos.set(texto, r)
  }
  return [...vistos.entries()]
    .map(([texto, r]) => ({ ...r, _textoSabor: texto }))
    .sort((a, b) => a._textoSabor.localeCompare(b._textoSabor))
})

// ── Pré-seleção vinda de Produção (botão "Etiqueta" num lote/produção) ──
// As abas usam v-show (ficam sempre montadas), então onMounted só dispararia
// na primeira renderização do app. Por isso observamos a mudança do sinal.
function aplicarPreSelecao(preSelecao) {
  if (!preSelecao || !preSelecao.length) return

  let algumEncontrado = false
  for (const { texto, qtd } of preSelecao) {
    // Garante que o sabor exista na lista visível (pode estar filtrado/escondido)
    const existe = receitasParaEtiqueta.value.some(r => r._textoSabor === texto)
    if (!existe) continue
    etqQtds[texto] = limitarQtdEtiqueta(qtd || 1)
    algumEncontrado = true
  }

  s.etiquetasPreSelecao = null // consome o sinal — não reaplica em próximas visitas

  if (algumEncontrado) {
    // Se já ocupa uma folha inteira, não precisa escolher posição.
    passoMaximoAlcancado.value = folhaCheiaSelecionada.value ? 3 : 2
    passoAtual.value = folhaCheiaSelecionada.value ? 3 : 2
  } else {
    s.notify('Não foi possível localizar os sabores dessa produção na lista de etiquetas. Verifique o filtro de palavras bloqueadas.', 'error')
  }
}

watch(() => s.etiquetasPreSelecao, (val) => {
  if (val && val.length) aplicarPreSelecao(val)
}, { immediate: true })

const totalEtiquetasSelecionadas = computed(() =>
  Object.values(etqQtds).reduce((acc, q) => acc + (Number(q) || 0), 0)
)

const folhaCheiaSelecionada = computed(() =>
  totalEtiquetasSelecionadas.value === ETIQUETAS_POR_FOLHA
)

const receitasComQtd = computed(() =>
  receitasParaEtiqueta.value.filter(r => Number(etqQtds[r._textoSabor] || 0) > 0)
)

// Lista plana: um texto de sabor por etiqueta, repetido conforme a quantidade, na ordem da UI
const listaEtiquetasPlana = computed(() => {
  const etiquetas = []
  for (const r of receitasParaEtiqueta.value) {
    const qtd = Number(etqQtds[r._textoSabor] || 0)
    for (let i = 0; i < qtd; i++) etiquetas.push(r._textoSabor)
  }
  return etiquetas
})

const totalFolhasEtiqueta = computed(() => {
  if (folhaCheiaSelecionada.value) return 1
  const startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  return Math.max(1, Math.ceil((startPos + totalEtiquetasSelecionadas.value) / 77))
})

// Quantas folhas o preview manual precisa mostrar: cobre folhas já marcadas + 1 extra para continuar marcando
const folhasManual = computed(() => {
  if (!posicoesManualMarcadas.size) return 1
  const maiorPos = Math.max(...posicoesManualMarcadas.keys())
  const folhaDaMaior = Math.floor(maiorPos / 77) + 1
  return folhaDaMaior
})

const totalFolhasNav = computed(() => modoManual.value ? folhasManual.value : totalFolhasEtiqueta.value)

function toggleCelulaManual(cel) {
  const posGlobal = (folhaPreviewAtual.value - 1) * 77 + (cel.pos - 1)
  if (posicoesManualMarcadas.has(posGlobal)) {
    posicoesManualMarcadas.delete(posGlobal)
  } else {
    // Não permite marcar além do que a lista de sabores cobre
    if (posicoesManualMarcadas.size >= listaEtiquetasPlana.value.length) {
      s.notify('Todas as etiquetas da lista já foram posicionadas. Aumente a quantidade de algum sabor para marcar mais posições.', 'error')
      return
    }
    posicoesManualMarcadas.set(posGlobal, true)
  }
}

const podeGerar = computed(() =>
  modoManual.value ? posicoesManualMarcadas.size === totalEtiquetasSelecionadas.value : totalEtiquetasSelecionadas.value > 0
)

const celulasPreview = computed(() => {
  const folha = folhaPreviewAtual.value - 1

  if (modoManual.value) {
    // Ordem de marcação define a ordem de distribuição dos sabores
    const posicoesOrdenadas = [...posicoesManualMarcadas.keys()]
    const etiquetas = listaEtiquetasPlana.value
    const celulas = []
    for (let i = 0; i < 77; i++) {
      const posGlobal = folha * 77 + i
      let estado = 'vazio'
      let texto = ''
      if (posicoesManualMarcadas.has(posGlobal)) {
        estado = 'selecionada'
        const idxNaOrdem = posicoesOrdenadas.indexOf(posGlobal)
        texto = idxNaOrdem >= 0 && idxNaOrdem < etiquetas.length ? etiquetas[idxNaOrdem] : ''
      }
      celulas.push({ estado, texto, pos: i + 1 })
    }
    return celulas
  }

  const startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  const etiquetas = listaEtiquetasPlana.value
  const celulas = []
  for (let i = 0; i < 77; i++) {
    const posGlobal = folha * 77 + i
    const idxEtiqueta = posGlobal - startPos
    let estado = 'vazio'
    let texto = ''
    if (posGlobal < startPos) {
      estado = 'usada'
    } else if (idxEtiqueta >= 0 && idxEtiqueta < etiquetas.length) {
      estado = 'selecionada'
      texto = etiquetas[idxEtiqueta]
    } else if (posGlobal === startPos && etiquetas.length > 0) {
      estado = 'inicio'
    }
    if (i === startPos && folha === 0 && etiquetas.length === 0) {
      estado = 'inicio'
    }
    celulas.push({ estado, texto, pos: i + 1 })
  }
  return celulas
})

watch([() => company.posicao_etiqueta, totalEtiquetasSelecionadas], () => {
  if (!modoManual.value) folhaPreviewAtual.value = 1
})

function resetarWizard() {
  passoAtual.value = 1
  passoMaximoAlcancado.value = 1
}

async function gerarEtiquetasAvulsas() {
  const contato = company.contato_etiqueta?.trim() || 'Bete 9 9943-0023'

  // ── Modo manual: gera a partir das posições marcadas no preview ──
  if (modoManual.value) {
    if (posicoesManualMarcadas.size !== totalEtiquetasSelecionadas.value) return

    const posicoesOrdenadas = [...posicoesManualMarcadas.keys()]
    const etiquetas = listaEtiquetasPlana.value
    const mapaPosicoes = new Map()
    posicoesOrdenadas.forEach((posGlobal, idx) => {
      if (idx < etiquetas.length) mapaPosicoes.set(posGlobal, etiquetas[idx])
    })

    s.loading = true
    const resultado = await gerarArquivoEtiquetas([], contato, 0, 'etiquetas-avulsas', mapaPosicoes)
    s.loading = false

    if (resultado.ok) {
      s.notify(`Etiqueta gerada! ${mapaPosicoes.size} posição${mapaPosicoes.size > 1 ? 'ões' : ''} marcada${mapaPosicoes.size > 1 ? 's' : ''} impressa${mapaPosicoes.size > 1 ? 's' : ''}.`)
      Object.keys(etqQtds).forEach(k => delete etqQtds[k])
      posicoesManualMarcadas.clear()
      resetarWizard()
    } else {
      s.notify(resultado.erro, 'error')
    }
    return
  }

  // ── Modo sequencial (padrão) ──
  const etiquetas = listaEtiquetasPlana.value
  if (!etiquetas.length) return

  let startPos = folhaCheiaSelecionada.value ? 0 : Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  if (!folhaCheiaSelecionada.value && startPos > 0) {
    const continuar = await confirmar.ask(
      `A próxima etiqueta livre é a ${startPos + 1}. Toque em "Continuar" para reaproveitar a folha atual ou em "Nova folha" para recomeçar da primeira etiqueta.`,
      {
        title: 'Como deseja imprimir?',
        icon: 'fas fa-tags',
        type: 'primary',
        confirmLabel: 'Continuar',
        cancelLabel: 'Nova folha'
      }
    )
    startPos = continuar ? startPos : 0
  }

  s.loading = true
  const resultado = await gerarArquivoEtiquetas(etiquetas, contato, startPos, 'etiquetas-avulsas')
  s.loading = false

  if (resultado.ok) {
    company.posicao_etiqueta = resultado.novaPosicao
    s.saveCompany({ ...company })
    s.notify(`Etiqueta gerada! ${resultado.totalFolhas} folha${resultado.totalFolhas > 1 ? 's' : ''}. Próxima posição: ${resultado.novaPosicao}.`)
    Object.keys(etqQtds).forEach(k => delete etqQtds[k])
    resetarWizard()
  } else {
    s.notify(resultado.erro, 'error')
  }
}
</script>

<style scoped>
.tab-etiquetas { padding-bottom: 120px; background: var(--bg); }
.etq-content { padding: 16px; display: flex; flex-direction: column; gap: 16px; }

/* ── Indicador de etapas ── */
.etq-steps { display: flex; align-items: center; padding: 4px 16px 0; gap: 4px; }
.etq-step {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  flex: 1; border: none; background: transparent; padding: 6px 2px;
  opacity: .55; transition: opacity .15s;
}
.etq-step:disabled { cursor: default; }
.etq-step.ativo, .etq-step.concluido { opacity: 1; }
.etq-step-bola {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: .72rem; font-weight: 800;
  background: var(--cream); color: var(--brown-mid);
  border: 1.5px solid var(--border);
  transition: background .15s, border-color .15s, color .15s;
}
.etq-step.ativo .etq-step-bola { background: var(--brown-dark); border-color: var(--brown-dark); color: #fff; }
.etq-step.concluido .etq-step-bola { background: var(--gold-bg); border-color: var(--gold-dark); color: var(--gold-dark); }
.etq-step-label { font-size: .65rem; font-weight: 700; color: var(--muted); }
.etq-step.ativo .etq-step-label { color: var(--brown-dark); }

.etq-passo { display: flex; flex-direction: column; }
.etq-passo-nav { display: flex; justify-content: space-between; gap: 8px; margin-top: 20px; }
.etq-passo-nav .btn { flex: 1; }
.btn-full { width: 100%; }

/* ── Sabores: lista no mesmo ritmo dos itens planejados da Cozinha ── */
.etq-sabores-list {
  display:flex; flex-direction:column; gap:8px;
  max-height:50vh; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:2px;
}
.etq-sabor-row {
  background:#fff; border:1px solid var(--border); border-radius:var(--r-md);
  padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:10px;
  cursor:pointer; user-select:none; -webkit-touch-callout:none; transition:background var(--t), border-color var(--t);
}
.etq-sabor-row:active { background:var(--gold-bg); transform:scale(.99); }
.etq-sabor-row--ativo { border-color:var(--gold-dark); background:var(--gold-bg); }
.etq-sabor-info { flex:1; min-width:0; display:flex; flex-direction:column; align-items:flex-start; gap:4px; }
.etq-sabor-nome {
  font-weight:700; font-size:.9rem; color:var(--brown);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%;
}
.badge-shortcut {
  padding:2px 10px; border-radius:var(--r-full); background:var(--gold-bg); border:1px solid #e8d5a0;
  color:var(--gold-dark); font-size:.68rem; font-weight:700; white-space:nowrap;
}
.qty-ctrl-sm { display:flex; align-items:center; gap:12px; background:var(--bg); border-radius:20px; padding:4px; border:1px solid var(--border); flex-shrink:0; }
.btn-qty-sm { border:none; background:#fff; width:32px; height:32px; border-radius:50%; font-size:1.2rem; font-weight:bold; color:var(--gold-dark); box-shadow:var(--shadow-sm); cursor:pointer; }
.btn-qty-sm:disabled { opacity:.35; cursor:default; }
.qty-input-cozinha { width:60px; border:none; background:#fff; border-radius:4px; text-align:center; font-family:var(--mono); font-weight:800; font-size:1.1rem; color:var(--brown-dark); padding:0; appearance:none; -moz-appearance:textfield; }
.qty-input-cozinha::-webkit-outer-spin-button,
.qty-input-cozinha::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.qty-input-cozinha:focus { outline:none; }

/* ── Cartões de modo (passo 2) ── */
.etq-modo-cards { display: flex; gap: 10px; }
.etq-modo-card {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 10px; border: 1.5px solid var(--border); border-radius: var(--r-md);
  background: var(--surface); transition: border-color .15s, background .15s;
}
.etq-modo-card i { font-size: 1.3rem; color: var(--muted); }
.etq-modo-card-titulo { font-size: .82rem; font-weight: 700; color: var(--text); }
.etq-modo-card-desc { font-size: .68rem; color: var(--muted); text-align: center; line-height: 1.3; }
.etq-modo-card.ativo { border-color: var(--brown); background: var(--gold-bg); }
.etq-modo-card.ativo i { color: var(--brown); }

/* ── Resumo final (passo 3) ── */
.etq-resumo-card { border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
.etq-resumo-card-row {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 9px 12px; font-size: .83rem; color: var(--text);
  border-bottom: 1px solid var(--border);
}
.etq-resumo-card-row:last-of-type { border-bottom: none; }
.etq-resumo-card-nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.etq-resumo-card-qtd { font-weight: 800; color: var(--brown-dark); flex-shrink: 0; }
.etq-resumo-card-total {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 10px 12px; background: var(--cream);
  font-size: .78rem; font-weight: 700; color: var(--brown-dark);
}
.etq-resumo-card-total i { color: var(--gold-dark); margin-right: 4px; }

.etq-resumo {
  margin-top: 10px; padding: 10px 12px; border-radius: var(--r-md);
  background: var(--cream); border: 1px solid var(--border);
  font-size: .8rem; color: var(--brown-dark); font-weight: 600;
  display: flex; align-items: center; gap: 8px;
}
.etq-resumo i { color: var(--gold-dark); }

.etq-preview-wrap { margin-top: 12px; border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; }
.etq-preview-hdr { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--border); }
.etq-preview-titulo { font-size: .75rem; font-weight: 700; color: var(--brown-dark); display: flex; align-items: center; gap: 6px; }
.etq-help-btn { border: none; background: transparent; color: var(--muted); font-size: .82rem; padding: 2px 4px; }
.etq-preview-nav { display: flex; align-items: center; gap: 6px; font-size: .72rem; color: var(--muted); margin-left: auto; }
.etq-nav-btn { border: none; background: transparent; color: var(--brown-mid); font-size: 1rem; padding: 2px 6px; cursor: pointer; }
.etq-nav-btn:disabled { opacity: .3; cursor: default; }

.etq-preview-legenda { display: flex; gap: 10px; flex-wrap: wrap; padding: 6px 12px; background: var(--cream); border-bottom: 1px solid var(--border); }
.etq-leg-item { display: flex; align-items: center; gap: 4px; font-size: .65rem; color: var(--muted); }
.etq-leg-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.etq-dot-usada { background: #c8b8a8; border: 1px solid #b0a090; }
.etq-dot-vazio { background: var(--surface); border: 1px solid var(--border); }
.etq-dot-selecionada { background: var(--brown-dark); }
.etq-dot-inicio { background: var(--gold); border: 1px solid var(--gold-dark); }

.etq-folha { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1.5px; padding: 4px; background: var(--cream); aspect-ratio: 148.5 / 210; }
.etq-celula { border-radius: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden; transition: background .15s; min-height: 0; }
.etq-cel-vazio { background: var(--surface); border: .5px solid var(--border); }
.etq-cel-usada { background: #ddd5ca; border: .5px solid #c0b0a0; }
.etq-cel-selecionada { background: var(--brown-dark); border: .5px solid var(--brown-dark); }
.etq-cel-inicio { background: var(--gold); border: 1.5px solid var(--gold-dark); }
.etq-cel-txt { font-size: 5px; color: #fff; text-align: center; line-height: 1.1; padding: 1px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }

.input-with-icon { position: relative; }
.input-with-icon i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .85rem; }
.input-with-icon .input { padding-left: 34px; }

.etq-cel-clicavel { cursor: pointer; touch-action: manipulation; }
.etq-cel-clicavel.etq-cel-vazio:active { background: var(--gold-bg); }
.etq-cel-clicavel.etq-cel-selecionada:active { opacity: .8; }

.etq-resumo-manual { justify-content: space-between; }
.etq-limpar-marcas {
  margin-left: auto; border: none; background: transparent;
  color: var(--red, #b3261e); font-size: .72rem; font-weight: 700;
  text-decoration: underline; padding: 2px 4px;
}
</style>
