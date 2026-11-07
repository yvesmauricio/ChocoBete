// Fluxo único de importação de extrato, compartilhado pelos três importadores
// (PagBank, Itaú, Banco do Brasil):  arquivo → ANÁLISE → TELA DE CONFERÊNCIA → gravação.
// Nada é gravado antes de a pessoa ver a conferência e confirmar.
import { ref } from 'vue'
import { useStore } from '../store.js'
import { analisarExtrato } from '../services/extratoImport.js'

/** SHA-256 do arquivo (identifica "este mesmo arquivo"). Sem crypto.subtle, cai num hash simples do texto. */
async function hashDoArquivo(arquivo, texto) {
  try {
    const buf = await arquivo.arrayBuffer()
    const h = await crypto.subtle.digest('SHA-256', buf)
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let h = 2166136261
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) }
    return `fnv-${(h >>> 0).toString(16)}-${texto.length}`
  }
}

export function useImportacaoExtrato(banco) {
  const s = useStore()
  const previa = ref(null)        // conferência aberta (ou null)
  const resultado = ref(null)     // resumo da última importação concluída
  const confirmando = ref(false)

  /**
   * @param p.arquivo       File escolhido
   * @param p.formato       'csv' | 'pdf'
   * @param p.texto         texto bruto lido do arquivo
   * @param p.colunas       cabeçalhos do CSV (vazio no PDF)
   * @param p.lancamentos   lançamentos que o leitor extraiu (já com banco/conta_id)
   * @param p.contaId       conta de destino escolhida
   */
  async function preparar({ arquivo, formato, texto, colunas = [], lancamentos, contaId }) {
    resultado.value = null
    const conta = s.getContaFinanceiraById(contaId)
    const hashArquivo = await hashDoArquivo(arquivo, texto)
    const analise = analisarExtrato({
      banco, formato, colunas, texto, lancamentos, conta, hashArquivo,
      importacoes: s.importacoesExtrato,
      assinaturaConta: s.assinaturasExtrato?.[contaId] || null,
      hoje: new Date()
    })
    const simulacao = analise.nivel === 'bloqueado' ? null : await s.simularImportacaoFinanceira(lancamentos)
    previa.value = {
      arquivo: arquivo.name, formato, conta, analise, simulacao,
      amostra: lancamentos.slice(0, 6),
      lancamentos,
      meta: { banco, conta_id: contaId, arquivo: arquivo.name, hashArquivo, formato, assinatura: analise.assinatura }
    }
  }

  function cancelar() { previa.value = null }

  async function confirmar() {
    const p = previa.value
    if (!p || p.analise.nivel === 'bloqueado' || confirmando.value) return
    confirmando.value = true
    try {
      const resumo = await s.importarLancamentosFinanceiros(p.lancamentos, p.meta)
      resultado.value = resumo
      previa.value = null
      if (!resumo.validos) s.notify('Nenhum lançamento válido foi encontrado nesse arquivo.', 'warning')
      else if (resumo.importadosCount === 0) s.notify('Os lançamentos desse extrato já estavam registrados.', 'warning')
      else s.notify(`${p.analise.rotulo}: ${resumo.importadosCount} lançamento(s) importado(s)!`)
    } catch (e) {
      console.error(e)
      s.notify(e?.message || 'Não foi possível importar o extrato.', 'error')
    } finally {
      confirmando.value = false
    }
  }

  return { previa, resultado, confirmando, preparar, cancelar, confirmar }
}
