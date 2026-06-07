<template>
  <ImportadorBase
    bankKey="bb"
    bankLabel="Banco do Brasil"
    heroIcon="fa-file-csv"
    heroTitle="Importar extrato do Banco do Brasil"
    heroDesc="Selecione o CSV do BB para importar entradas, PIX e pagamentos sem duplicidades."
    :contas="contasBb"
    v-model:contaId="contaSelecionadaId"
    :loading="importando"
    :fileName="arquivoNome"
    :resultado="resultadoImportacao"
    @file-change="onFileChange"
  >
    <template #hint>
      <div class="hint-box">
        <i class="fas fa-circle-info"></i>
        <span>Use o CSV exportado do BB. Linhas de saldo são ignoradas.</span>
      </div>
    </template>
  </ImportadorBase>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from '../store.js'
import { R$, normalizar, parseValorBr, processarCsv, parseDataBr, detectarColunasExtrato, lerArquivoComoTexto } from '../utils.js'
import ImportadorBase from './ImportadorBase.vue'

const s = useStore()
const importando = ref(false)
const arquivoNome = ref('')
const resultadoImportacao = ref(null)
const contaSelecionadaId = ref('')
const contasBb = computed(() => s.getContasFinanceirasPorBanco('bb'))

watch(contasBb, (contas) => {
  if (!contaSelecionadaId.value && contas.length === 1) {
    contaSelecionadaId.value = contas[0].id
  }
}, { immediate: true })

function mapearTipoBb(lancamento, tipoLancamento, valor) {
  const base = normalizar(`${lancamento} ${tipoLancamento}`)
  if (base.includes('pix recebido') || base.includes('pix-recebido qr code')) return 'PIX recebido'
  if (base.includes('pix enviado')) return 'PIX enviado'
  if (base.includes('transferencia recebida')) return 'PIX recebido'
  if (base.includes('compra com cartao')) return 'Cartão de Débito'
  if (base.includes('pagto cartao credito')) return 'Pagamento Cartão de Crédito'
  if (base.includes('telefone pre pago')) return 'Recarga de Celular'
  return valor >= 0 ? 'PIX recebido' : 'PIX enviado'
}

function extrairLancamentos(linhas, colunas) {
  return linhas.flatMap((linha) => {
    const data = parseDataBr(linha[colunas.data])
    const lancamento = String(linha[colunas.lancamento] || '').trim()
    const detalhes = String(linha[colunas.detalhes] || '').trim()
    const valor = parseValorBr(linha[colunas.valor])
    const tipoLancamento = String(linha[colunas.tipoLancamento] || '').trim()

    if (!data || !lancamento) return []

    const lancamentoNorm = normalizar(lancamento)
    if (
      lancamentoNorm.includes('saldo do dia') ||
      lancamentoNorm.includes('saldo anterior') ||
      lancamentoNorm === 's a l d o'
    ) return []

    return [{
      data,
      tipo: mapearTipoBb(lancamento, tipoLancamento, valor),
      descricao: detalhes || lancamento,
      valor,
      banco: 'bb',
      conta_id: contaSelecionadaId.value
    }]
  })
}

async function onFileChange(event) {
  const arquivo = event.target.files?.[0]
  event.target.value = ''
  if (!arquivo) return
  if (!contaSelecionadaId.value) {
    s.notify('Selecione a conta do Banco do Brasil antes de importar o extrato.', 'warning')
    return
  }

  arquivoNome.value = arquivo.name
  importando.value = true
  resultadoImportacao.value = null

  try {
    const texto = await lerArquivoComoTexto(arquivo)
    const linhas = processarCsv(texto)
    const primeiraLinha = linhas.find(linha => Object.values(linha || {}).some(Boolean)) || {}
  const colunas = detectarColunasExtrato(primeiraLinha)

  if (!colunas.data || !colunas.valor) {
      throw new Error('Nao encontrei as colunas principais no CSV do Banco do Brasil.')
    }

    const lancamentos = extrairLancamentos(linhas, colunas)
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

    s.notify(`BB: ${resumo.importadosCount} lancamento(s) importado(s)!`)
  } catch (error) {
    console.error(error)
    resultadoImportacao.value = null
    s.notify(error?.message || 'Nao foi possivel importar o extrato do Banco do Brasil.', 'error')
  } finally {
    importando.value = false
  }
}
</script>
