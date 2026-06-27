<template>
  <div class="tab-etiquetas">

    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-tags"></i> Etiquetas</h2>
      </div>
      <p class="tab-subtitle">Gere etiquetas Pimaco A5Q-1226 por sabor e quantidade</p>
    </div>

    <div class="etq-content">
      <div class="sheet-card">
        <div class="sheet-body">
          <p class="hint mb-12">Escolha os sabores e quantidades para gerar uma folha de etiquetas Pimaco A5Q-1226 (77 por folha), sem precisar de uma produção registrada.</p>

          <!-- Contato exibido na etiqueta -->
          <div class="fg mb-12">
            <label class="label">Texto de contato na etiqueta</label>
            <input v-model="company.contato_etiqueta" class="input" placeholder="Ex: @chocobete · (11) 99999-9999" />
            <p class="hint">Aparece embaixo do sabor em cada etiqueta. Se vazio, usa o nome da empresa.</p>
          </div>

          <!-- Posição inicial -->
          <div class="fg mb-12">
            <label class="label">Próxima etiqueta livre na folha</label>
            <div class="input-with-icon">
              <i class="fas fa-tag"></i>
              <input v-model.number="company.posicao_etiqueta" type="number" class="input" min="1" max="77" />
            </div>
          </div>

          <div class="section-label mt-16"><i class="fas fa-list-check"></i> Sabores e quantidades</div>
          <div class="etq-receitas-list">
            <div v-for="r in receitasParaEtiqueta" :key="r._textoSabor" class="etq-receita-item" :class="{ ativa: etqQtds[r._textoSabor] > 0 }">
              <button class="etq-receita-nome" @click="etqQtds[r._textoSabor] = etqQtds[r._textoSabor] > 0 ? 0 : 1">
                <i class="fas" :class="etqQtds[r._textoSabor] > 0 ? 'fa-square-check' : 'fa-square'"></i>
                <span>{{ r._textoSabor }}</span>
              </button>
              <div v-if="etqQtds[r._textoSabor] > 0" class="etq-qtd-ctrl">
                <button class="qtd-e-btn" @click="etqQtds[r._textoSabor] = Math.max(1, etqQtds[r._textoSabor] - 1)">−</button>
                <input class="qtd-e-input" type="text" inputmode="numeric"
                  :value="String(etqQtds[r._textoSabor])"
                  @input="e => etqQtds[r._textoSabor] = parseInt(e.target.value.replace(/\D/g,'')) || 1" />
                <button class="qtd-e-btn" @click="etqQtds[r._textoSabor] = etqQtds[r._textoSabor] + 1">+</button>
              </div>
            </div>
            <p v-if="!receitasParaEtiqueta.length" class="hint">Nenhuma receita cadastrada ainda.</p>
          </div>

          <!-- ── Configurar filtro ── -->
          <button class="etq-config-toggle" @click="mostrarConfigFiltro = !mostrarConfigFiltro">
            <i class="fas fa-filter"></i>
            <span>Configurar o que aparece na lista</span>
            <i class="fas" :class="mostrarConfigFiltro ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>

          <div v-if="mostrarConfigFiltro" class="etq-config-painel">
            <div class="section-label"><i class="fas fa-ban"></i> Palavras que escondem uma receita</div>
            <p class="hint mb-8">Qualquer receita cujo nome contenha uma dessas palavras não aparece na lista de sabores (ex: "recheio" esconde "Recheio Doce de Leite").</p>
            <div class="etq-termos-chips">
              <span v-for="termo in (company.etiquetas_termos_excluidos || [])" :key="termo" class="etq-termo-chip">
                {{ termo }}
                <button @click="removerTermoExcluido(termo)"><i class="fas fa-xmark"></i></button>
              </span>
              <p v-if="!(company.etiquetas_termos_excluidos || []).length" class="hint">Nenhuma palavra bloqueada.</p>
            </div>
            <div class="etq-termo-add">
              <input v-model="novoTermoExcluido" class="input" placeholder="Ex: trufa, ovo, mini..." @keyup.enter="adicionarTermoExcluido" />
              <button class="btn btn-secondary btn-sm" @click="adicionarTermoExcluido"><i class="fas fa-plus"></i></button>
            </div>

            <div v-if="receitasExcluidasEtiqueta.length" class="section-label mt-16"><i class="fas fa-eye-slash"></i> Receitas escondidas pelo filtro</div>
            <p v-if="receitasExcluidasEtiqueta.length" class="hint mb-8">Marque para forçar a aparecer na lista mesmo batendo numa palavra bloqueada.</p>
            <div v-if="receitasExcluidasEtiqueta.length" class="etq-receitas-list">
              <div v-for="r in receitasExcluidasEtiqueta" :key="r.uuid" class="etq-receita-item etq-receita-oculta">
                <button class="etq-receita-nome" @click="alternarExcecaoReceita(r)">
                  <i class="fas" :class="(company.etiquetas_excecoes_incluir || []).includes(r.uuid) ? 'fa-square-check' : 'fa-square'"></i>
                  <span>{{ r.nome }}</span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="totalEtiquetasSelecionadas > 0" class="etq-resumo">
            <i class="fas fa-circle-info"></i>
            {{ totalEtiquetasSelecionadas }} etiqueta{{ totalEtiquetasSelecionadas > 1 ? 's' : '' }} ·
            {{ totalFolhasEtiqueta }} folha{{ totalFolhasEtiqueta > 1 ? 's' : '' }}
          </div>

          <div class="etq-botoes-gerar mt-12">
            <button class="btn btn-primary" :disabled="!totalEtiquetasSelecionadas" @click="gerarEtiquetasAvulsas">
              <i class="fas fa-file-word"></i> Gerar .docx
            </button>
          </div>

          <!-- ── Preview visual da folha ── -->
          <div class="etq-preview-wrap">
            <div class="etq-preview-hdr">
              <span class="etq-preview-titulo"><i class="fas fa-eye"></i> Preview — Pimaco A5Q-1226</span>
              <div v-if="totalFolhasEtiqueta > 1" class="etq-preview-nav">
                <button class="etq-nav-btn" :disabled="folhaPreviewAtual <= 1" @click="folhaPreviewAtual--">‹</button>
                <span>Folha {{ folhaPreviewAtual }} / {{ totalFolhasEtiqueta }}</span>
                <button class="etq-nav-btn" :disabled="folhaPreviewAtual >= totalFolhasEtiqueta" @click="folhaPreviewAtual++">›</button>
              </div>
            </div>

            <div class="etq-preview-legenda">
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-usada"></span>já usada</span>
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-vazio"></span>vazia</span>
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-selecionada"></span>será impressa</span>
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-inicio"></span>início</span>
            </div>

            <div class="etq-folha">
              <div
                v-for="cel in celulasPreview" :key="cel.pos"
                class="etq-celula"
                :class="`etq-cel-${cel.estado}`"
                :title="`Posição ${cel.pos}${cel.texto ? ': ' + cel.texto : ''}`"
              >
                <span v-if="cel.texto" class="etq-cel-txt">{{ cel.texto }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useStore } from '../store.js'
import { normalizar, textoEtiquetaReceita } from '../utils.js'
import { useConfirm as useAppConfirm } from '../composables/useConfirm.js'
import { gerarArquivoEtiquetas } from '../composables/useEtiquetas.js'

const s = useStore()
const confirmar = useAppConfirm()
const company = reactive({ ...s.company })

// Sincroniza com a store quando carregada
watch(() => s.company, (val) => {
  if (val) Object.assign(company, JSON.parse(JSON.stringify(val)))
}, { deep: true, immediate: true })

// ── Etiquetas ──────────────────────────────────────────────────
const etqQtds = reactive({})
const novoTermoExcluido = ref('')
const mostrarConfigFiltro = ref(false)
const folhaPreviewAtual = ref(1)

function ehComponenteInterno(r) {
  if ((company.etiquetas_excecoes_incluir || []).includes(r.uuid)) return false
  if (r.eh_intermediaria) return true
  const nome = normalizar(r.nome || '')
  const termos = company.etiquetas_termos_excluidos || []
  return termos.some(termo => termo.trim() && nome.includes(normalizar(termo)))
}

const receitasParaEtiqueta = computed(() => {
  const vistos = new Map()
  const ordenadas = [...s.receitas]
    .filter(r => !ehComponenteInterno(r))
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

const receitasExcluidasEtiqueta = computed(() => {
  const vistas = new Set(receitasParaEtiqueta.value.map(r => r.uuid))
  return [...s.receitas]
    .filter(r => !vistas.has(r.uuid) && !r.eh_intermediaria)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
})

const totalEtiquetasSelecionadas = computed(() =>
  Object.values(etqQtds).reduce((acc, q) => acc + (Number(q) || 0), 0)
)

const totalFolhasEtiqueta = computed(() => {
  const startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  return Math.max(1, Math.ceil((startPos + totalEtiquetasSelecionadas.value) / 77))
})

const celulasPreview = computed(() => {
  const startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  const folha = folhaPreviewAtual.value - 1
  const etiquetas = []
  for (const r of receitasParaEtiqueta.value) {
    const qtd = Number(etqQtds[r._textoSabor] || 0)
    for (let i = 0; i < qtd; i++) etiquetas.push(r._textoSabor)
  }
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
  folhaPreviewAtual.value = 1
})

function adicionarTermoExcluido() {
  const termo = novoTermoExcluido.value.trim().toLowerCase()
  if (!termo) return
  if (!company.etiquetas_termos_excluidos) company.etiquetas_termos_excluidos = []
  if (!company.etiquetas_termos_excluidos.includes(termo)) {
    company.etiquetas_termos_excluidos.push(termo)
    s.saveCompany({ ...company })
  }
  novoTermoExcluido.value = ''
}

function removerTermoExcluido(termo) {
  company.etiquetas_termos_excluidos = (company.etiquetas_termos_excluidos || []).filter(t => t !== termo)
  s.saveCompany({ ...company })
}

function alternarExcecaoReceita(r) {
  const lista = company.etiquetas_excecoes_incluir || []
  company.etiquetas_excecoes_incluir = lista.includes(r.uuid)
    ? lista.filter(id => id !== r.uuid)
    : [...lista, r.uuid]
  s.saveCompany({ ...company })
}

async function gerarEtiquetasAvulsas() {
  const etiquetas = []
  for (const r of receitasParaEtiqueta.value) {
    const qtd = Number(etqQtds[r._textoSabor] || 0)
    if (qtd <= 0) continue
    for (let i = 0; i < qtd; i++) etiquetas.push(r._textoSabor)
  }
  if (!etiquetas.length) return

  let startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  if (startPos > 0) {
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
  const contato = company.contato_etiqueta?.trim() || company.nome || ''
  const resultado = await gerarArquivoEtiquetas(etiquetas, contato, startPos, 'etiquetas-avulsas')
  s.loading = false

  if (resultado.ok) {
    company.posicao_etiqueta = resultado.novaPosicao
    s.saveCompany({ ...company })
    s.notify(`Etiqueta gerada! ${resultado.totalFolhas} folha${resultado.totalFolhas > 1 ? 's' : ''}. Próxima posição: ${resultado.novaPosicao}.`)
    Object.keys(etqQtds).forEach(k => delete etqQtds[k])
  } else {
    s.notify(resultado.erro, 'error')
  }
}
</script>

<style scoped>
.tab-etiquetas { padding-bottom: 120px; background: var(--bg); }
.etq-content { padding: 16px; display: flex; flex-direction: column; gap: 16px; }

.etq-receitas-list { display: flex; flex-direction: column; gap: 6px; max-height: 50vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.etq-receita-item {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--r-md);
  background: var(--surface); transition: border-color var(--t), background var(--t);
}
.etq-receita-item.ativa { border-color: var(--brown); background: var(--gold-bg); }
.etq-receita-nome { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; border: none; background: transparent; text-align: left; padding: 0; font-size: .85rem; font-weight: 500; color: var(--text); }
.etq-receita-nome i { color: var(--muted); font-size: 1rem; flex-shrink: 0; }
.etq-receita-item.ativa .etq-receita-nome i { color: var(--brown); }
.etq-receita-nome span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.etq-qtd-ctrl { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.etq-botoes-gerar { display: flex; gap: 8px; }
.etq-botoes-gerar .btn { flex: 1; }
.etq-resumo {
  margin-top: 12px; padding: 10px 12px; border-radius: var(--r-md);
  background: var(--cream); border: 1px solid var(--border);
  font-size: .8rem; color: var(--brown-dark); font-weight: 600;
  display: flex; align-items: center; gap: 8px;
}
.etq-resumo i { color: var(--gold-dark); }

.etq-preview-wrap { margin-top: 16px; border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; }
.etq-preview-hdr { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--border); }
.etq-preview-titulo { font-size: .75rem; font-weight: 700; color: var(--brown-dark); display: flex; align-items: center; gap: 6px; }
.etq-preview-nav { display: flex; align-items: center; gap: 6px; font-size: .72rem; color: var(--muted); }
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

.etq-config-toggle { display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--brown-dark); font-size: .8rem; font-weight: 600; }
.etq-config-toggle i:first-child { color: var(--brown-mid); }
.etq-config-toggle span { flex: 1; text-align: left; }
.etq-config-toggle i:last-child { color: var(--muted); font-size: .7rem; }

.etq-config-painel { margin-top: 10px; padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--cream); }
.etq-termos-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.etq-termo-chip { display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 10px; border-radius: var(--r-full); background: var(--surface); border: 1px solid var(--border); font-size: .76rem; font-weight: 600; color: var(--text); }
.etq-termo-chip button { color: var(--muted); font-size: .68rem; padding: 2px; }
.etq-termo-chip button:active { color: #a32d2d; }
.etq-termo-add { display: flex; gap: 6px; }
.etq-termo-add .input { flex: 1; }
.etq-receita-oculta { opacity: .85; }
.etq-receita-oculta .etq-receita-nome i { color: var(--muted); }

.input-with-icon { position: relative; }
.input-with-icon i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .85rem; }
.input-with-icon .input { padding-left: 34px; }
</style>