// composables/useDasAtribuicoes.js
// Guarda as escolhas da pessoa sobre o DAS do MEI (usadas em Caixa e Custos, Guia e prompts):
//   { [chaveDoPagamento]: 'AAAA-MM' }  → "este pagamento é do mês tal"
//   { ['mes:AAAA-MM']: 'fora' }        → "este mês foi pago por outra conta / não se aplica"
import { configGet, configSet } from '../db.js'

const CHAVE = 'das_atribuicoes'

export async function carregarAtribuicoesDas() {
  try {
    const v = await configGet(CHAVE, {})
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

export async function salvarAtribuicoesDas(mapa) {
  await configSet(CHAVE, mapa)
}
