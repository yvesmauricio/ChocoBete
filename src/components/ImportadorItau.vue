<template>
  <ImportadorBase
    bankKey="itau"
    bankLabel="Itaú"
    heroIcon="fa-file-pdf"
    heroTitle="Importar extrato do Itaú"
    heroDesc="Selecione o PDF do extrato conta corrente Itaú para importar PIX, compras e tarifas sem duplicidade."
    accept=".pdf,application/pdf"
    acceptLabel="PDF"
    :contas="contasItau"
    v-model:contaId="contaSelecionadaId"
    :loading="importando"
    :fileName="arquivoNome"
    :resultado="resultadoImportacao"
    @file-change="onFileChange"
  >
    <template #hint>
      <div class="hint-box">
        <i class="fas fa-circle-info"></i>
        <span>Gere o PDF no app Itaú. Movimentos são classificados automaticamente.</span>
      </div>
    </template>
  </ImportadorBase>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from '../store.js'
import { parseValorBr, parseDataBr } from '../utils.js'
import { extrairTextoPdf } from '../services/pdfService.js'
import ImportadorBase from './ImportadorBase.vue'

const s = useStore()
const importando = ref(false)
const arquivoNome = ref('')
const resultadoImportacao = ref(null)
const contaSelecionadaId = ref('')
const contasItau = computed(() => s.getContasFinanceirasPorBanco('itau'))

watch(contasItau, (contas) => {
  if (!contaSelecionadaId.value && contas.length === 1) {
    contaSelecionadaId.value = contas[0].id
  }
}, { immediate: true })

// ── Parser do extrato Itaú ─────────────────────────────────────
// Formato: DD/MM/YYYY DESCRIÇÃO VALOR
// Valor pode ser negativo. Separador decimal: vírgula. Ex: -1.400,00 ou 39,42
const RX_LINHA = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s*([-]?\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/g

// Mapeamento de prefixos Itaú → tipo compatível com o store
function mapearTipo(descricao, valor) {
  const d = descricao.toLowerCase()
  if (d.startsWith('pix transf') || d.startsWith('pix qrs')) {
    return valor >= 0 ? 'PIX recebido' : 'PIX enviado'
  }
  if (d.startsWith('rshop') || d.startsWith('debito')) return 'Cartão de Débito'
  if (d.startsWith('rend')) return 'Rendimento'
  if (d.startsWith('tar') || d.startsWith('tarifa')) return 'Tarifa bancária'
  if (d.startsWith('ted') || d.startsWith('doc')) return valor >= 0 ? 'PIX recebido' : 'PIX enviado'
  if (d.startsWith('cheque')) return 'Cheque'
  return valor >= 0 ? 'PIX recebido' : 'PIX enviado'
}

function parsearLinhasItau(texto) {
  // Normalizar texto: remover quebras desnecessárias, juntar texto extraído por página
  const normalizado = texto.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ')

  const lancamentos = []
  let match
  RX_LINHA.lastIndex = 0

  while ((match = RX_LINHA.exec(normalizado)) !== null) {
    const [, dataBr, descricao, valorStr] = match
    const descricaoLimpa = descricao.trim()

    // Ignorar linhas de saldo do dia e cabeçalho
    if (
      descricaoLimpa.toLowerCase().includes('saldo do dia') ||
      descricaoLimpa.toLowerCase().includes('saldo em conta') ||
      descricaoLimpa.toLowerCase().includes('limite da conta')
    ) continue

    const valor = parseValorBr(valorStr)
    if (!valor && valor !== 0) continue

    const data = parseDataBr(dataBr)
    const tipo = mapearTipo(descricaoLimpa, valor)

    lancamentos.push({
      data,
      descricao: descricaoLimpa.toUpperCase(),
      valor,
      tipo, // Use the mapped type
      banco: 'itau'
    })
  }

  return lancamentos
}

// ── Handler principal ───────────────────────────────────────────
async function onFileChange(event) {
  const arquivo = event.target.files?.[0]
  event.target.value = ''
  if (!arquivo) return
  if (!contaSelecionadaId.value) {
    s.notify('Selecione a conta Itaú antes de importar o extrato.', 'warning')
    return
  }

  arquivoNome.value = arquivo.name
  importando.value = true
  resultadoImportacao.value = null

  try {
    s.notify('Lendo PDF do Itaú...', 'success', 4000)
    const texto = await extrairTextoPdf(arquivo)
    const lancamentos = parsearLinhasItau(texto).map(item => ({
      ...item,
      conta_id: contaSelecionadaId.value
    }))

    if (!lancamentos.length) {
      s.notify('Nenhum lançamento encontrado no PDF. Verifique se é o extrato conta corrente.', 'error')
      return
    }

    const resumo = await s.importarLancamentosFinanceiros(lancamentos)
    resultadoImportacao.value = resumo

    if (!resumo.validos) {
      s.notify('Nenhum lançamento válido encontrado.', 'warning')
      return
    }
    if (resumo.importadosCount === 0) {
      s.notify('Todos os lançamentos já estavam registrados.', 'warning')
      return
    }
    s.notify(`Itaú: ${resumo.importadosCount} lançamento(s) importado(s)!`, 'success')
  } catch (error) {
    console.error(error)
    s.notify(error?.message || 'Erro ao ler o PDF do Itaú.', 'error')
  } finally {
    importando.value = false
  }
}
</script>
