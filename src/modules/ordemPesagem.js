import { normalizar } from '../utils.js'

/**
 * Ordem do "Total para pesar":
 *   1) chocolates (insumos)
 *   2) recheios / preparos (sub-receitas), em ordem alfabética
 *   3) demais insumos, em ordem alfabética (Amendoim, Banana passa…)
 */
export function grupoPesagem(ing) {
  if (ing.tipo === 'receita') return 1
  return normalizar(ing.nome).includes('chocolate') ? 0 : 2
}

const comparaNome = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base', numeric: true })

export function ordenarParaPesagem(lista) {
  return [...lista].sort((a, b) => grupoPesagem(a) - grupoPesagem(b) || comparaNome(a.nome, b.nome))
}
