// Identificação estável de registros entre aparelhos (usado por db.js e pelo
// merge). Sem dependências — pode ser importado em qualquer lugar.

// Tabelas com `++id` (número que cada aparelho gera sozinho e que, por isso,
// colide entre aparelhos) que passam a carregar um `uid` global.
export const TABELAS_COM_UID = [
  'financeiro', 'historico_precos', 'historico_precos_venda',
  'cad_lojas', 'cad_clientes', 'cad_fiados',
]

/** uid determinístico de um registro antigo (sem uid). Lançamentos financeiros
 *  com hash de duplicidade usam o próprio hash: a mesma transação bancária
 *  importada em dois aparelhos é o MESMO registro. */
export function uidLegado(tabela, row) {
  if (tabela === 'financeiro' && row?.hash_duplicidade) return `h:${row.hash_duplicidade}`
  return `lg:${tabela}:${row?.id}`
}
