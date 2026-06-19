<template>
  <ImportadorBase
    bankKey="pagbank"
    bankLabel="PagBank"
    heroIcon="fa-file-csv"
    heroTitle="Importar extrato do PagBank"
    heroDesc="Selecione o CSV para localizar recebimentos via PIX, evitar duplicidades e salvar tudo offline neste aparelho."
    :contas="contasPagbank"
    v-model:contaId="contaSelecionadaId"
    :loading="importando"
    :fileName="arquivoNome"
    :resultado="resultadoImportacao"
    @file-change="onFileChange"
  >
    <template #hint>
      <div class="hint-box">
        <i class="fas fa-circle-info"></i>
        <span>O extrato inteiro é importado e classificado para separar vendas, despesas, moradia e uso pessoal.</span>
      </div>
    </template>

    <template #extra>
      <section class="stats-grid">
        <article class="stat-card">
          <span class="stat-label">Lançamentos</span>
          <strong class="stat-value">{{ s.financeiro.length }}</strong>
        </article>
        <article class="stat-card highlight">
          <span class="stat-label">Receita MEI em {{ anoAtual }}</span>
          <strong class="stat-value c-green">{{ R$(s.totalRecebidoAnoAtual) }}</strong>
        </article>
      </section>
    </template>

  </ImportadorBase>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useStore } from '../store.js'
import { R$, normalizar, formatarData, labelNatureza, processarCsv, parseValorBr, parseDataBr, detectarColunasExtrato, lerArquivoComoTexto } from '../utils.js'
import ImportadorBase from './ImportadorBase.vue'

const s = useStore()
const importando = ref(false)
const arquivoNome = ref('')
const resultadoImportacao = ref(null)
const contaSelecionadaId = ref('')
const anoAtual = new Date().getFullYear()

const contasPagbank = computed(() => s.getContasFinanceirasPorBanco('pagbank'))

watch(contasPagbank, (contas) => {
  if (!contaSelecionadaId.value && contas.length === 1) {
    contaSelecionadaId.value = contas[0].id
  }
}, { immediate: true })

function extrairLancamentos(linhas, colunas) {
  return linhas.flatMap((linha) => {
    const data = parseDataBr(linha[colunas.data])
    const tipo = String(linha[colunas.tipo] || '').trim()
    const descricao = String(linha[colunas.descricao] || '').trim()
    const valor = parseValorBr(linha[colunas.valor])

    if (!data || !descricao || !tipo) return []
    return [{ data, tipo, descricao, valor }]
  })
}

async function onFileChange(event) {
  const arquivo = event.target.files?.[0]
  event.target.value = ''
  if (!arquivo) return
  if (!contaSelecionadaId.value) {
    s.notify('Selecione a conta PagBank antes de importar o extrato.', 'warning')
    return
  }

  arquivoNome.value = arquivo.name
  importando.value = true

  try {
    const texto = await lerArquivoComoTexto(arquivo)
    const linhas = processarCsv(texto)

    // Salvar conteúdo do CSV em cache para re-importação
    localStorage.setItem('pagbank_csv_cache', texto)
    localStorage.setItem('pagbank_csv_nome', arquivo.name)
    localStorage.setItem('pagbank_csv_data', new Date().toISOString())
    
    const primeiraLinha = linhas.find(linha => Object.values(linha || {}).some(Boolean)) || {}
    const colunas = detectarColunasExtrato(primeiraLinha)

    if (!colunas.data || !colunas.tipo || !colunas.descricao || !colunas.valor) {
      throw new Error('Nao encontrei as colunas DATA, TIPO, DESCRICAO e VALOR no CSV do PagBank.')
    }

    const lancamentos = extrairLancamentos(linhas, colunas).map(item => ({
      ...item,
      banco: 'pagbank',
      conta_id: contaSelecionadaId.value
    }))
    const resumo = await s.importarLancamentosFinanceiros(lancamentos)
    resultadoImportacao.value = resumo

    if (!resumo.validos) {
      s.notify('Nenhum lancamento valido foi encontrado nesse arquivo.', 'warning')
      return
    }

    if (resumo.importadosCount === 0) {
      s.notify('Os lancamentos desse extrato ja estavam registrados.', 'warning')
      return
    }

    s.notify(`Extrato importado com ${resumo.importadosCount} lancamento(s)!`)
  } catch (error) {
    console.error(error)
    resultadoImportacao.value = null
    s.notify(error?.message || 'Nao foi possivel importar o extrato.', 'error')
  } finally {
    importando.value = false
  }
}
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 4px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 14px 12px;
}

.stat-card.highlight {
  background: var(--green-bg);
  border-color: var(--green-dim);
}

.stat-label {
  display: block;
  font-size: .68rem;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 4px;
}

.stat-value {
  font-family: var(--mono);
  font-size: 1rem;
  color: var(--brown);
}

.c-green { color: var(--green); }
</style>
