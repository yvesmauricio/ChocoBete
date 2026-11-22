// modules/historicoValores.js
// Meta de retirada e Giro de segurança são "versionados": mudar o valor hoje não pode alterar
// como os meses já passados aparecem no relatório. Guardamos um histórico de quando cada mudança
// aconteceu — assim o sistema sabe qual valor valia em cada mês. Só grava um novo registro
// quando o valor realmente muda.
//
// É a MESMA regra usada em Ajustes (proximoHistorico); fica aqui para a aba Meta de Retirada
// poder editar a meta sem duplicar a lógica de outro jeito.

/** @param {Array<{mes:string, valor:number}>} historicoAntigo
 *  @param {number} valorAntigo  valor que valia até agora
 *  @param {number} valorNovo    valor escolhido
 *  @param {string} mesAtual     'MM/AAAA' */
export function proximoHistorico(historicoAntigo, valorAntigo, valorNovo, mesAtual) {
  if (valorNovo === valorAntigo) return historicoAntigo || []
  const lista = Array.isArray(historicoAntigo) ? [...historicoAntigo] : []
  if (!lista.length) {
    // Primeira mudança registrada: preserva o valor que já valia antes de agora,
    // para não "reescrever" os meses já passados.
    lista.push({ mes: '01/2000', valor: valorAntigo })
  }
  const idx = lista.findIndex(h => h.mes === mesAtual)
  if (idx >= 0) lista[idx] = { mes: mesAtual, valor: valorNovo }
  else lista.push({ mes: mesAtual, valor: valorNovo })
  return lista
}
