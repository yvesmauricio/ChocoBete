// composables/useKitFesta.js
// Módulo "Kit Festa" — monta cardápios a partir das receitas já materializadas
// na categoria "Festa" (criadas por importação vinculada em Receitas, com
// ingredientes reais e peso próprio — não é mais uma conversão virtual).
//
// O preço mínimo seguro considera dois custos reais:
//   1) Ingredientes — vem direto de s.getCustoTotal(receita) / rendimento,
//      sempre atualizado (não é estimativa).
//   2) Mão de obra — um tempo fixo por lote (ex: 3h, porque bancada/derreter
//      chocolate não encolhe muito com menos unidades) dividido pela
//      quantidade do pedido. Isso é o que faz pedidos pequenos custarem mais
//      por unidade — não é desconto por volume, é diluição de um custo fixo.

import { configGet, configSet } from '../db.js'
import { roundMoney, toNumber } from '../utils.js'
import { snapToSmartPrice } from '../modules/salesIntelligence.js'

export const CHAVE_CONFIG_KIT_FESTA = 'kit_festa_config'

// Faixas de quantidade mínima por pedido (o pedido de 25un não é mais
// "unidade x preço menor" — é diluição de um tempo de trabalho fixo).
export const FAIXAS_PADRAO = [
  { minimo: 25 },
  { minimo: 50 },
  { minimo: 100 },
]

// Parâmetros padrão do cálculo — ficam salvos junto do resto da config e são
// editáveis na própria tela do Kit Festa (não é um número fixo no código).
export const PARAMETROS_PADRAO = {
  horasFixasPorLote: 3,     // quanto tempo leva um pedido, pouco importando a quantidade
  margemSeguranca: 0.30,    // nunca vende abaixo de custo + 30% de folga
}

/** Custo real de 1 unidade de uma receita Festa (ingrediente puro, sem mão de obra) */
export function getCustoUnitarioFesta(receita, { getCustoTotal }) {
  const rendimento = Number(receita?.rendimento || 0) || 1
  return toNumber(getCustoTotal(receita)) / rendimento
}

/** Mão de obra por unidade nesta faixa: tempo fixo do lote / quantidade do pedido */
export function calcularMaoDeObraPorUnidade(horasFixasPorLote, custoHora, quantidade) {
  if (!quantidade) return 0
  return (toNumber(horasFixasPorLote) * toNumber(custoHora)) / quantidade
}

/**
 * Preço mínimo seguro de uma faixa = (custo ingrediente + mão de obra diluída)
 * dividido pela margem de segurança. Sempre o mesmo critério em toda faixa —
 * o preço final varia entre faixas só porque a mão de obra dilui diferente,
 * nunca porque a margem em si mudou (sem "desconto por volume" disfarçado).
 */
function precoMinimoDaFaixa(custoIngrediente, quantidade, { custoHora, horasFixasPorLote, margemSeguranca }) {
  const maoDeObra = calcularMaoDeObraPorUnidade(horasFixasPorLote, custoHora, quantidade)
  const custoTotal = custoIngrediente + maoDeObra
  const margem = margemSeguranca < 1 ? margemSeguranca : 0.99
  return { custoTotal, maoDeObra, precoMinimoSeguro: custoTotal / (1 - margem) }
}

/**
 * Sugere os preços por faixa (25/50/100 por padrão) a partir do custo de
 * ingrediente já real da receita Festa, somando a mão de obra diluída de
 * cada faixa e aplicando a margem de segurança configurada.
 */
export function sugerirFaixasPreco(custoIngredienteUnitario, { custoHora = 0, horasFixasPorLote = PARAMETROS_PADRAO.horasFixasPorLote, margemSeguranca = PARAMETROS_PADRAO.margemSeguranca, faixas = FAIXAS_PADRAO } = {}) {
  const custo = Math.max(0, toNumber(custoIngredienteUnitario))

  return faixas.map(f => {
    const { maoDeObra, precoMinimoSeguro } = precoMinimoDaFaixa(custo, f.minimo, { custoHora, horasFixasPorLote, margemSeguranca })
    const precoSeguroArredondado = roundMoney(precoMinimoSeguro)
    const precoSugerido = roundMoney(Math.max(precoSeguroArredondado, snapToSmartPrice(precoSeguroArredondado)))
    return {
      minimo: f.minimo,
      preco: precoSugerido,
      precoMinimoSeguro: precoSeguroArredondado,
      maoDeObraPorUnidade: roundMoney(maoDeObra),
    }
  })
}

/** Verifica se um preço digitado manualmente furou o mínimo seguro daquela faixa */
export function verificarAlertaPreco(precoDigitado, custoIngredienteUnitario, minimo, { custoHora = 0, horasFixasPorLote = PARAMETROS_PADRAO.horasFixasPorLote, margemSeguranca = PARAMETROS_PADRAO.margemSeguranca } = {}) {
  const custo = Math.max(0, toNumber(custoIngredienteUnitario))
  const { precoMinimoSeguro } = precoMinimoDaFaixa(custo, minimo, { custoHora, horasFixasPorLote, margemSeguranca })
  const precoMinimoSeguroArred = roundMoney(precoMinimoSeguro)
  const preco = toNumber(precoDigitado)
  return {
    abaixoDoSeguro: preco < precoMinimoSeguroArred,
    precoMinimoSeguro: precoMinimoSeguroArred,
    diferenca: roundMoney(precoMinimoSeguroArred - preco),
  }
}

// ── Persistência (config key-value já existente no db.js) ──────────

const CONFIG_DEFAULT = () => ({
  parametros: { ...PARAMETROS_PADRAO },
  itens: {}, // { [receitaUuid]: { ativo, faixas: [{minimo, preco}] } }
})

export async function carregarConfigKitFesta() {
  const salvo = await configGet(CHAVE_CONFIG_KIT_FESTA, null)
  const base = CONFIG_DEFAULT()
  if (!salvo) return base
  return {
    ...base,
    ...salvo,
    parametros: { ...base.parametros, ...(salvo.parametros || {}) },
    itens: { ...base.itens, ...(salvo.itens || {}) },
  }
}

export async function salvarConfigKitFesta(config) {
  await configSet(CHAVE_CONFIG_KIT_FESTA, config)
  return config
}

// ── Histórico de cardápios salvos ───────────────────────────────
// Cada cardápio é um "retrato" congelado (nome, preços e pesos no momento
// em que foi salvo) — reabrir um cardápio antigo não muda se as receitas
// mudarem depois; é intencional, é o histórico do que foi mostrado/enviado.
export const CHAVE_HISTORICO_KIT_FESTA = 'kit_festa_historico'

export async function carregarHistoricoKitFesta() {
  const salvo = await configGet(CHAVE_HISTORICO_KIT_FESTA, null)
  return Array.isArray(salvo) ? salvo : []
}

export async function salvarCardapioNoHistorico({ id, nome, itens }) {
  const historico = await carregarHistoricoKitFesta()
  const cardapio = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    nome: nome || 'Cardápio sem nome',
    data: new Date().toISOString(),
    itens: JSON.parse(JSON.stringify(itens)),
  }
  const i = historico.findIndex(c => c.id === cardapio.id)
  if (i >= 0) historico[i] = cardapio
  else historico.unshift(cardapio)
  await configSet(CHAVE_HISTORICO_KIT_FESTA, historico)
  return cardapio
}

export async function excluirCardapioDoHistorico(id) {
  const historico = await carregarHistoricoKitFesta()
  const restante = historico.filter(c => c.id !== id)
  await configSet(CHAVE_HISTORICO_KIT_FESTA, restante)
  return restante
}
