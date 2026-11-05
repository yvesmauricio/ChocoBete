<template>
  <BaseModal title="Plano de investimento" @close="emit('close')">
    <div class="modal-inner plano">
      <div v-if="carregando" class="loading-box"><div class="spinner spinner-sm"></div></div>
      <template v-else>
        <p class="hint">
          Reúne faturamento, insumos, compras e margens do app. Complete só o que o app não sabe.
        </p>

        <label class="label" for="plano-notas">Equipamentos, necessidades e estoque</label>
        <textarea id="plano-notas" v-model="notas" class="input plano-notas" rows="12" @input="salvarNotas"></textarea>

        <div class="plano-resumo">
          <div v-if="dados.faturamento.mesesComDados">
            Média mensal: <strong>{{ R$(dados.faturamento.mediaMensal) }}</strong>
            <span v-if="dados.faturamento.dentroDoLimitePrioridade !== null">
              · {{ dados.faturamento.dentroDoLimitePrioridade ? 'dentro' : 'acima' }} do limite de prioridade anunciado (R$ 40.500/ano)
            </span>
          </div>
          <div v-else>Sem receitas lançadas no Financeiro ainda.</div>
          <div v-if="dados.insumos.economiaPotencialTotal > 0">
            Economia potencial em insumos: <strong>{{ R$(dados.insumos.economiaPotencialTotal) }}</strong>
          </div>
          <div v-if="!dados.empresa.cnpj" class="plano-aviso">CNPJ não preenchido em Ajustes.</div>
        </div>

        <div class="plano-acoes">
          <button class="btn btn-primary" @click="copiarRelatorio">
            <i class="fas fa-copy"></i> Copiar relatório básico
          </button>
          <button class="btn btn-secondary" @click="baixarRelatorio">
            <i class="fas fa-download"></i> Baixar relatório (.md)
          </button>
          <button class="btn btn-secondary" @click="baixarDados">
            <i class="fas fa-file-code"></i> Baixar dados (.json)
          </button>
        </div>

        <div class="label plano-ia-titulo">Pedir o plano completo para uma IA</div>
        <div class="plano-ias">
          <button v-for="ai in listaAIs" :key="ai.id" class="btn btn-secondary btn-sm" @click="abrirIA(ai)">
            {{ ai.nome }}
          </button>
        </div>
        <p class="hint">O texto é copiado antes de abrir. Se não aparecer no chat, é só colar.</p>
      </template>
    </div>
  </BaseModal>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useStore } from '../store.js'
import { R$ as formatarNumero } from '../utils.js'
import BaseModal from './BaseModal.vue'
import {
  NOTAS_KEY, NOTAS_PADRAO, coletarDados, gerarRelatorioBasico, gerarPromptIA, baixarArquivo
} from '../composables/usePlanoInvestimento.js'

const emit = defineEmits(['close'])
const s = useStore()
const R$ = v => 'R$ ' + formatarNumero(v)

const carregando = ref(true)
const dados = ref(null)
const notas = ref(NOTAS_PADRAO)

const listaAIs = [
  { id: 'claude', nome: 'Claude', url: p => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  { id: 'chatgpt', nome: 'ChatGPT', url: p => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  { id: 'gemini', nome: 'Gemini', url: p => `https://gemini.google.com/app?q=${encodeURIComponent(p)}` }
]

onMounted(async () => {
  try {
    const salvo = localStorage.getItem(NOTAS_KEY)
    if (salvo) notas.value = salvo
  } catch { /* sem localStorage */ }
  try {
    dados.value = await coletarDados(s)
  } finally {
    carregando.value = false
  }
})

function salvarNotas() {
  try { localStorage.setItem(NOTAS_KEY, notas.value) } catch { /* sem localStorage */ }
}

async function copiar(texto, msg) {
  try {
    await navigator.clipboard.writeText(texto)
    s.notify(msg)
    return true
  } catch {
    s.notify('Não consegui copiar. Use o botão de baixar.', 'warning')
    return false
  }
}

const relatorio = () => gerarRelatorioBasico(dados.value, notas.value)
const copiarRelatorio = () => copiar(relatorio(), 'Relatório copiado!')

function baixarRelatorio() {
  baixarArquivo('chocobete-relatorio.md', relatorio(), 'text/markdown;charset=utf-8')
}

function baixarDados() {
  const pacote = { ...dados.value, notas: notas.value }
  baixarArquivo('chocobete-dados.json', JSON.stringify(pacote, null, 2), 'application/json')
}

async function abrirIA(ai) {
  const prompt = gerarPromptIA(dados.value, notas.value)
  await copiar(prompt, 'Dados copiados! Abrindo a IA…')
  window.open(ai.url(prompt), '_blank')
}
</script>

<style scoped>
.plano { display: flex; flex-direction: column; gap: 12px; }
.plano-notas { width: 100%; min-height: 220px; resize: vertical; font-size: .85rem; line-height: 1.45; }
.plano-resumo { display: flex; flex-direction: column; gap: 4px; font-size: .85rem; color: var(--muted); }
.plano-aviso { color: var(--orange, #b26a00); }
.plano-acoes { display: flex; flex-direction: column; gap: 8px; }
.plano-ia-titulo { margin-top: 4px; }
.plano-ias { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
