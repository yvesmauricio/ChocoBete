import { toNumber, roundMoney, R$ } from '../utils.js'

const PRO_LABORE_MARGIN = 0.1

function clampQuantity(quantity) {
  return Math.max(1, Math.floor(toNumber(quantity) || 1))
}

function normalizeAnalysisOptions(quantityOrOptions = 1) {
  if (quantityOrOptions && typeof quantityOrOptions === 'object' && !Array.isArray(quantityOrOptions)) {
    return {
      quantidade: clampQuantity(quantityOrOptions.quantidade),
      valorCliente: Math.max(0, toNumber(quantityOrOptions.valorCliente)),
      intelligence: quantityOrOptions.intelligence || quantityOrOptions.inteligencia || null,
      overheadRate: toNumber(quantityOrOptions.overheadRate || 0)
    }
  }
  return {
    quantidade: clampQuantity(quantityOrOptions),
    valorCliente: 0,
    intelligence: null,
    overheadRate: 0
  }
}

function getDynamicMargin(quantity) {
  const qty = clampQuantity(quantity)
  if (qty === 1) return 0.3
  if (qty >= 2 && qty <= 4) return 0.2
  if (qty >= 10) return 0.1
  return 0.15
}

function getRequiredMargin(quantity, overheadRate = 0) {
  const totalMargin = getDynamicMargin(quantity) + toNumber(overheadRate)
  return Math.min(0.8, Math.max(totalMargin, PRO_LABORE_MARGIN + toNumber(overheadRate)))
}

function normalizeProduct(product = {}) {
  return {
    id: product.id,
    nome: product.nome || 'Produto',
    custo: Math.max(0, toNumber(product.custo)),
    preco: Math.max(0, toNumber(product.preco))
  }
}

function getUnitProfit(product) {
  const item = normalizeProduct(product)
  return item.preco - item.custo
}

function getUnitMargin(product) {
  const item = normalizeProduct(product)
  if (item.preco <= 0) return 0
  return getUnitProfit(item) / item.preco
}

function buildStatus(proposedPrice, minMaterial, minOverhead, minSalary) {
  if (proposedPrice < minMaterial) return 'prejuizo';
  if (proposedPrice < minOverhead) return 'abaixo_do_minimo'; // Não cobre nem os fixos
  if (proposedPrice < minSalary) return 'margem_baixa';      // Cobre fixos, mas não o salário ideal
  return 'ok';                                              // Saudável
}

function getSafeUnitPrice(product, basePrice) {
  const item = normalizeProduct(product)
  const standardPrice = toNumber(basePrice) || item.preco
  return roundMoney(Math.max(item.custo, standardPrice))
}

function getPopularityScore(productId, intelligence) {
  if (!intelligence) return 0
  if (intelligence.scorePopularidade && intelligence.scorePopularidade[productId] != null) {
    return toNumber(intelligence.scorePopularidade[productId])
  }
  const ranking = Array.isArray(intelligence.rankingProdutos) ? intelligence.rankingProdutos : []
  const found = ranking.find((item) => item.produtoId === productId || item.id === productId)
  return found ? toNumber(found.scorePopularidade) : 0
}

function compareByProfitMarginAndPopularity(a, b) {
  if (b.lucro !== a.lucro) return b.lucro - a.lucro
  if (b.margemPercentual !== a.margemPercentual) return b.margemPercentual - a.margemPercentual
  return (b.scorePopularidade || 0) - (a.scorePopularidade || 0)
}

function getHistoricalPriceReference(sales = []) {
  if (!sales.length) return 0
  const ordered = [...sales].sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
  const recent = ordered.slice(0, Math.min(5, ordered.length))
  const recentAverage = recent.reduce((sum, s) => sum + toNumber(s.precoVendido), 0) / recent.length
  const overallAverage = ordered.reduce((sum, s) => sum + toNumber(s.precoVendido), 0) / ordered.length
  return roundMoney((recentAverage * 0.6) + (overallAverage * 0.4))
}

export function snapToSmartPrice(value, preferRoundDown = false) {
  const n = toNumber(value)
  if (n <= 0) return 0
  if (n >= 5) {
    const m5 = Math.floor(n / 5) * 5
    const m10 = Math.floor(n / 10) * 10
    if (n - m10 < n * 0.12) return m10
    if (n - m5 < n * 0.10) return m5
  }
  let step = n < 10 ? 0.5 : n < 50 ? 1 : 5
  return preferRoundDown ? Math.floor(n / step) * step : Math.round(n / step) * step
}

function getBehaviorPrice(product, quantity, referencePrice, popularityScore) {
  const item = normalizeProduct(product)
  const minPrice = calcularPrecoMinimo(item.custo, quantity)
  const popularityFactor = popularityScore >= 80 ? 1.04 : popularityScore >= 50 ? 1.02 : 1
  const suggestedPrice = Math.max(minPrice, toNumber(referencePrice) * popularityFactor, item.preco)
  return roundMoney(Math.max(item.custo, suggestedPrice))
}

function getPriceAnchor(product, quantity, priceCandidate, valorCliente) {
  const item = normalizeProduct(product)
  const minPrice = calcularPrecoMinimo(item.custo, quantity)
  const fallbackPrice = item.preco > 0 ? item.preco : minPrice
  const budgetPrice = valorCliente > 0 ? roundMoney(valorCliente / quantity) : 0
  const desiredPrice = budgetPrice > 0 ? budgetPrice : (priceCandidate == null ? fallbackPrice : toNumber(priceCandidate))
  return roundMoney(Math.max(item.custo, desiredPrice))
}

function getMaxSuggestionQuantity(budget, product, quantityBase) {
  const item = normalizeProduct(product)
  if (budget <= 0) return Math.max(1, quantityBase)
  const minPrice = calcularPrecoMinimo(item.custo, 1)
  const unitReference = Math.max(item.custo, minPrice, item.preco || 0.01)
  return Math.max(quantityBase, Math.floor(budget / unitReference) || quantityBase)
}

function normalizeSaleQuantity(value) {
  const q = toNumber(value)
  return q > 0 ? q : 0
}

// ─────────────────────────────────────────────────────────────
// PREÇO MÍNIMO BASE
// ─────────────────────────────────────────────────────────────

export function calcularPrecoMinimo(custo, quantidade = 1, overheadRate = 0) {
  const unitCost = Math.max(0, toNumber(custo))
  const requiredMargin = getRequiredMargin(quantidade, overheadRate)
  const divisor = 1 - requiredMargin
  const minPrice = divisor <= 0 ? unitCost : unitCost / divisor
  return roundMoney(Math.max(unitCost, minPrice))
}

// ─────────────────────────────────────────────────────────────
// PREÇO MÍNIMO COM SALÁRIO
// Cobre: material + overhead + sua retirada mensal
// ─────────────────────────────────────────────────────────────

export function calcularPrecoMinimoComSalario(custo, options = {}) {
  const {
    quantidade = 1,
    overheadRate = 0,
    metaSalarioMensal = 0,
    unidadesPorMes = 0,
    faturamentoMedioMensal = 0
  } = options

  const unitCost = Math.max(0, toNumber(custo))
  const precoBaseMinimo = calcularPrecoMinimo(unitCost, quantidade, overheadRate)

  let salarioPorUnidade = 0
  if (metaSalarioMensal > 0) {
    if (unidadesPorMes > 0) {
      salarioPorUnidade = roundMoney(metaSalarioMensal / unidadesPorMes)
    } else if (faturamentoMedioMensal > 0) {
      const fracao = Math.min(0.4, metaSalarioMensal / faturamentoMedioMensal)
      salarioPorUnidade = roundMoney(precoBaseMinimo * fracao)
    } else {
      salarioPorUnidade = roundMoney(precoBaseMinimo * 0.15)
    }
  }

  return {
    precoMinimo: precoBaseMinimo,
    salarioPorUnidade,
    precoMinimoComSalario: roundMoney(precoBaseMinimo + salarioPorUnidade),
    custoMaterial: unitCost,
    overheadPorUnidade: roundMoney(precoBaseMinimo - unitCost),
    margemNecessariaPercent: roundMoney(getRequiredMargin(quantidade, overheadRate) * 100)
  }
}

// ─────────────────────────────────────────────────────────────
// QUANTIDADE MÍNIMA PARA COBRIR CUSTOS + SALÁRIO
// ─────────────────────────────────────────────────────────────

export function calcularQuantidadeMinima(custo, precoVenda, options = {}) {
  const { custoFixoMensal = 0, metaSalarioMensal = 0 } = options
  const unitCost = Math.max(0, toNumber(custo))
  const preco = Math.max(unitCost, toNumber(precoVenda))
  const lucroUnitario = preco - unitCost

  if (lucroUnitario <= 0) {
    return { possivel: false, quantidade: Infinity, mensagem: 'Preço abaixo do custo — impossível cobrir despesas.' }
  }

  const metaMensal = toNumber(custoFixoMensal) + toNumber(metaSalarioMensal)
  if (metaMensal <= 0) {
    return { possivel: true, quantidade: 1, mensagem: 'Defina sua meta salarial para calcular a quantidade mínima.', metaMensal: 0 }
  }

  const qtdMinima = Math.ceil(metaMensal / lucroUnitario)
  return {
    possivel: true,
    quantidade: qtdMinima,
    lucroUnitario: roundMoney(lucroUnitario),
    metaMensal: roundMoney(metaMensal),
    lucroMensal: roundMoney(lucroUnitario * qtdMinima),
    mensagem: `Para retirar ${R$(metaSalarioMensal)}/mês e cobrir ${R$(custoFixoMensal)} de fixos, venda ${qtdMinima} unidades/mês a ${R$(preco)}.`
  }
}

// ─────────────────────────────────────────────────────────────
// ESTOQUE PRODUZIDO DISPONÍVEL
// Agrupa produções por receita para saber o que já foi feito
// ─────────────────────────────────────────────────────────────
export function calcularEstoqueDisponivel(producoes = [], vendas = [], diasRelevantes = 90) {
  const cutoff = Date.now() - diasRelevantes * 86400000
  const estoque = new Map()

  producoes.forEach(p => {
    if (!p.receita_id) return
    const ts = p.data_producao ? new Date(p.data_producao).getTime() : 0
    if (ts > 0 && ts < cutoff) return

    const current = estoque.get(p.receita_id) || {
      receita_id: p.receita_id,
      quantidade: 0,
      ultimaProducao: null,
      diasDesdeUltimaProducao: 999
    }

    current.quantidade += Number(p.quantidade_produzida || p.quantidade || 0)

    const d = p.data_producao ? new Date(p.data_producao) : null
    if (!current.ultimaProducao || (d && d > current.ultimaProducao)) {
      current.ultimaProducao = d
      current.diasDesdeUltimaProducao = d
        ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
        : 999
    }

    estoque.set(p.receita_id, current)
  })

  // Deduct sold quantities
  const vendidos = new Map()
  vendas.forEach(v => {
    if (!v.produtoId) return
    const ts = v.data ? new Date(v.data).getTime() : 0
    if (ts > 0 && ts < cutoff) return // Only consider recent sales

    const current = vendidos.get(v.produtoId) || { produtoId: v.produtoId, quantidade: 0 }
    current.quantidade += Number(v.quantidade || 0)
    vendidos.set(v.produtoId, current)
  })

  const estoqueDisponivel = new Map()
  for (const [id, prodInfo] of estoque.entries()) {
    const soldInfo = vendidos.get(id)
    const availableQty = Math.max(0, prodInfo.quantidade - (soldInfo?.quantidade || 0))
    if (availableQty > 0) {
      estoqueDisponivel.set(id, { ...prodInfo, quantidade: availableQty })
    }
  }
  return estoqueDisponivel
}

// ─────────────────────────────────────────────────────────────
// PRIORIZAR PRODUTOS EM ESTOQUE (por urgência de venda)
// ─────────────────────────────────────────────────────────────

export function priorizarEstoque(produtos = [], estoque = new Map(), inteligencia = null) {
  return produtos
    .map(produto => {
      const item = normalizeProduct(produto)
      const info = estoque.get(item.id)
      if (!info || info.quantidade <= 0) return null

      const scorePopularidade = getPopularityScore(item.id, inteligencia)
      const lucroUnitario = roundMoney(getUnitProfit(item))
      const lucroEstoque = roundMoney(lucroUnitario * info.quantidade)
      const margemPercentual = roundMoney(getUnitMargin(item) * 100)
      const urgencia = info.diasDesdeUltimaProducao * (lucroUnitario > 0 ? 1 : 0.5)

      return {
        ...item,
        quantidadeEmEstoque: info.quantidade,
        ultimaProducao: info.ultimaProducao,
        diasDesdeUltimaProducao: info.diasDesdeUltimaProducao,
        lucroUnitario,
        lucroEstoque,
        margemPercentual,
        scorePopularidade,
        urgencia,
        nivelUrgencia: info.diasDesdeUltimaProducao > 7 ? 'alta' : info.diasDesdeUltimaProducao > 3 ? 'media' : 'baixa'
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.urgencia !== a.urgencia ? b.urgencia - a.urgencia : b.lucroEstoque - a.lucroEstoque)
}

// ─────────────────────────────────────────────────────────────
// FUNÇÕES EXISTENTES (mantidas)
// ─────────────────────────────────────────────────────────────

export function analisarProduto(produto, precoProposto = null, quantidade = 1) {
  const item = normalizeProduct(produto)
  // Extraímos as opções garantindo que existam
  const opts = typeof quantidade === 'object' ? quantidade : { quantidade }
  const qty = clampQuantity(opts.quantidade)
  const overheadRate = toNumber(opts.overheadRate || 0)
  const valorCliente = toNumber(opts.valorCliente || 0)

  // Preços de referência
  const proposedUnitPrice = getPriceAnchor(item, qty, precoProposto, valorCliente)
  const unitMinMaterial = item.custo
  const unitMinOverhead = calcularPrecoMinimo(item.custo, qty, overheadRate)
  
  // Para o diagnóstico, tentamos estimar o preço com salário (mesma lógica da view)
  const proLaboreRef = PRO_LABORE_MARGIN + overheadRate
  const unitMinSalary = unitMinOverhead / (1 - PRO_LABORE_MARGIN)

  const totalCost = roundMoney(unitMinMaterial * qty)
  const totalPrice = roundMoney(proposedUnitPrice * qty)
  const originalTotal = roundMoney(item.preco * qty)
  const lucro = roundMoney(totalPrice - totalCost)
  const overheadValor = roundMoney(totalPrice * overheadRate)
  const lucroLiquido = roundMoney(lucro - overheadValor)
  const margem = totalPrice > 0 ? roundMoney(lucro / totalPrice) : 0
  const status = buildStatus(proposedUnitPrice, unitMinMaterial, unitMinOverhead, unitMinSalary)

  return {
    ...item,
    quantidade: qty,
    precoProposto: roundMoney(proposedUnitPrice),
    precoPropostoTotal: totalPrice,
    precoOriginalTotal: originalTotal,
    precoMinimo: unitMinOverhead,
    precoMinimoTotal: roundMoney(unitMinOverhead * qty),
    custoTotal: totalCost,
    custoPorUnidade: unitMinMaterial,
    lucro,
    lucroTotal: lucro,
    lucroPorUnidade: roundMoney(lucro / qty),
    lucroLiquido,
    overheadTotal: overheadValor,
    margem,
    margemContribuicao: margem,
    margemPercentual: roundMoney(margem * 100),
    margemMinimaPercentual: roundMoney(getRequiredMargin(qty) * 100),
    status,
    valorCliente: opts.valorCliente,
    overheadRate: opts.overheadRate,
    podeNegociar: status === 'ok'
  }
}

export function priorizarProdutos(produtos = [], inteligencia = null) {
  return [...produtos]
    .map((produto) => {
      const item = normalizeProduct(produto)
      const scorePopularidade = getPopularityScore(item.id, inteligencia)
      return {
        ...item,
        lucroUnitario: roundMoney(getUnitProfit(item)),
        lucroTotal: roundMoney(getUnitProfit(item)),
        margemPercentual: roundMoney(getUnitMargin(item) * 100),
        scorePopularidade
      }
    })
    .sort((a, b) => {
      if (b.lucroTotal !== a.lucroTotal) return b.lucroTotal - a.lucroTotal
      if (b.margemPercentual !== a.margemPercentual) return b.margemPercentual - a.margemPercentual
      if (b.scorePopularidade !== a.scorePopularidade) return b.scorePopularidade - a.scorePopularidade
      return b.preco - a.preco
    })
}

export function gerarSugestoes(valorCliente, produtos = [], quantidade = 1) {
  const budget = Math.max(0, toNumber(valorCliente))
  const options = normalizeAnalysisOptions(quantidade)
  const baseQuantity = options.quantidade

  return priorizarProdutos(produtos, options.intelligence)
    .map((produto) => {
      let melhorOpcao = null
      const ceiling = getMaxSuggestionQuantity(budget, produto, baseQuantity)

      for (let qty = baseQuantity; qty <= ceiling; qty += 1) {
        const rawTarget = getBehaviorPrice(
          produto, qty,
          budget > 0 ? budget / qty : produto.preco,
          getPopularityScore(produto.id, options.intelligence)
        )
        const targetPrice = snapToSmartPrice(rawTarget, qty > 1)
        const analiseAtual = analisarProduto(produto, targetPrice, {
          quantidade: qty,
          valorCliente: budget,
          overheadRate: options.overheadRate || 0
        })
        if (budget > 0 && analiseAtual.precoPropostoTotal > budget) continue
        if (!melhorOpcao || analiseAtual.lucro > melhorOpcao.lucro || (
          analiseAtual.lucro === melhorOpcao.lucro && analiseAtual.margemPercentual > melhorOpcao.margemPercentual
        )) melhorOpcao = analiseAtual
      }

      return melhorOpcao
    })
    .filter(Boolean)
    .sort(compareByProfitMarginAndPopularity)
}

export function aprenderComVendas(historico = [], produtos = []) {
  const productMap = new Map(produtos.map(p => { const i = normalizeProduct(p); return [i.id, i] }))
  const grouped = new Map()

  historico.forEach((venda) => {
    const produtoId = venda?.produtoId
    if (produtoId == null) return
    const current = grouped.get(produtoId) || {
      produtoId, quantidadeTotal: 0, faturamentoTotal: 0, numeroVendas: 0, vendas: [], ultimaVenda: null
    }
    const quantidade = normalizeSaleQuantity(venda.quantidade)
    if (quantidade <= 0) return
    const precoVendido = Math.max(0, toNumber(venda.precoVendido))
    const date = venda?.data ? new Date(venda.data) : null
    current.quantidadeTotal += quantidade
    current.faturamentoTotal += precoVendido * quantidade
    current.numeroVendas += 1
    current.vendas.push({ ...venda, quantidade, precoVendido, data: date })
    if (!current.ultimaVenda || (date && date > current.ultimaVenda)) current.ultimaVenda = date
    grouped.set(produtoId, current)
  })

  const maxQtd = Math.max(1, ...[...grouped.values()].map(i => i.quantidadeTotal))
  const now = Date.now()

  const resumoPorProduto = [...grouped.values()]
    .map((item) => {
      const produto = productMap.get(item.produtoId) || { id: item.produtoId, nome: `Produto ${item.produtoId}`, custo: 0, preco: 0 }
      const precoMedio = item.quantidadeTotal > 0 ? roundMoney(item.faturamentoTotal / item.quantidadeTotal) : 0
      const quantidadeMediaPorVenda = item.numeroVendas > 0 ? Math.max(1, Math.round(item.quantidadeTotal / item.numeroVendas)) : 1
      const precoMinimo = calcularPrecoMinimo(produto.custo, quantidadeMediaPorVenda)
      const referenciaHistorica = getHistoricalPriceReference(item.vendas)
      const scoreBrutoRecencia = item.ultimaVenda ? Math.max(0, 30 - Math.floor((now - item.ultimaVenda.getTime()) / 86400000)) : 0
      const scorePopularidade = roundMoney((((item.quantidadeTotal / maxQtd) * 0.65) + ((item.numeroVendas / Math.max(1, historico.length)) * 0.2) + ((scoreBrutoRecencia / 30) * 0.15)) * 100)
      const precoIdeal = getBehaviorPrice(produto, quantidadeMediaPorVenda, referenciaHistorica || precoMedio || produto.preco, scorePopularidade)
      const diasSemVenda = item.ultimaVenda ? Math.max(0, Math.floor((now - item.ultimaVenda.getTime()) / 86400000)) : 999
      return {
        produtoId: item.produtoId, nome: produto.nome,
        quantidadeTotal: item.quantidadeTotal, faturamentoTotal: roundMoney(item.faturamentoTotal),
        precoMedio, precoIdeal, precoMinimo, scorePopularidade,
        ultimaVenda: item.ultimaVenda, diasSemVenda, numeroVendas: item.numeroVendas, vendas: item.numeroVendas
      }
    })
    .sort((a, b) => b.scorePopularidade !== a.scorePopularidade ? b.scorePopularidade - a.scorePopularidade : b.quantidadeTotal - a.quantidadeTotal)

  return {
    maisVendidos: resumoPorProduto.slice(0, 5),
    rankingProdutos: resumoPorProduto,
    scorePopularidade: resumoPorProduto.reduce((acc, i) => { acc[i.produtoId] = i.scorePopularidade; return acc }, {})
  }
}

export function otimizarVenda(produto, inteligencia = null, options = {}) {
  const item = normalizeProduct(produto)
  const { minQuantity = 1, valorCliente = 0, overheadRate = 0, todosProdutos = [], estoque = new Map() } = options
  const cenarios = []
  const scorePopularidade = getPopularityScore(item.id, inteligencia)
  const analysisCtx = { overheadRate, metaSalarioMensal: options.metaSalarioMensal, faturamentoMedioMensal: options.faturamentoMedioMensal }

  const analiseUnitPadrao = analisarProduto(item, item.preco, { ...analysisCtx, quantidade: 1 })
  cenarios.push({
    ...analiseUnitPadrao,
    titulo: `Venda unitária (preço padrão)`,
    recomendacao: `Vender 1 unidade pelo preço sugerido de ${R$(analiseUnitPadrao.precoProposto)}.`,
    tipoCenario: 'unitario_padrao'
  })

  const rawIdeal = getBehaviorPrice(item, 1, item.preco, scorePopularidade)
  const idealUnitPrice = snapToSmartPrice(rawIdeal, false)
  if (idealUnitPrice !== analiseUnitPadrao.precoProposto) {
    const analiseIdealUnit = analisarProduto(item, idealUnitPrice, { ...analysisCtx, quantidade: 1 })
    cenarios.push({
      ...analiseIdealUnit,
      titulo: `Venda unitária (preço ideal)`,
      recomendacao: `Vender 1 unidade pelo preço ideal de ${R$(analiseIdealUnit.precoProposto)} (baseado em histórico e popularidade).`,
      tipoCenario: 'unitario_ideal'
    })
  }

  if (valorCliente > 0) {
    const sugestoesParaCliente = gerarSugestoes(valorCliente, [item], analysisCtx)
    if (sugestoesParaCliente.length > 0) {
      const m = sugestoesParaCliente[0]
      cenarios.push({
        ...m,
        titulo: `Melhor opção para o orçamento de ${R$(valorCliente)}`,
        recomendacao: `Oferecer ${m.quantidade} unidades por ${R$(m.precoPropostoTotal)} para o cliente.`,
        tipoCenario: 'cliente_budget'
      })
    }
  }

  return cenarios.sort((a, b) => {
    if (valorCliente > 0) {
      if (a.tipoCenario === 'cliente_budget') return -1
      if (b.tipoCenario === 'cliente_budget') return 1
    }
    
    // Prioridade 1: Saúde Financeira (Ok > Margem Baixa > Crítica > Prejuízo)
    const statusRank = { ok: 0, margem_baixa: 1, abaixo_do_minimo: 2, prejuizo: 3 }
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status]

    // Prioridade 2: Maior lucro absoluto (Dinheiro no bolso)
    if (b.lucro !== a.lucro) return b.lucro - a.lucro
    return b.margemPercentual - a.margemPercentual
  })
}
