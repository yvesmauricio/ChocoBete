// Cálculos de custo, peso, lucro e tempo de produção das receitas.
import { isProdutoEmbalagem } from '../utils.js'

export function criarCustos({ produtos, receitas, producoes, company }) {
  // ── LÓGICA DE NEGÓCIO (Cálculos de Custos e Pesos) ───────────

  /** Custo por unidade de medida (ex: preço por grama) */
  function getPrecoUnitarioInsumo(prod) {
    if (!prod || !prod.fator_conversao) return 0
    return (prod.custo_por_unidade || 0) / prod.fator_conversao
  }

  /**
   * Calcula a média real de tempo gasto para uma receita baseada no histórico de produções.
   * Retorna o tempo em minutos para o rendimento padrão da receita.
   */
  function getMediaTempoReceita(receitaId) {
    const historico = producoes.value.filter(p =>
      p.receita_id === receitaId &&
      p.tempo_real_min > 0 &&
      (p.quantidade_produzida || p.quantidade) > 0
    )
    if (!historico.length) return 0

    const r = receitas.value.find(rec => rec.uuid === receitaId)
    if (!r) return 0

    const somaTempos = historico.reduce((acc, p) => acc + p.tempo_real_min, 0)
    const somaQtds = historico.reduce((acc, p) => acc + (p.quantidade_produzida || p.quantidade), 0) // Sum of produced quantities

    return (somaTempos / somaQtds) * (r.rendimento || 1)
  }

  /**
   * Expande a composição de uma sub-receita em lista plana, em profundidade
   * (pai logo seguido dos seus filhos), anotando o nível de cada linha.
   */
  function coletarSubIngredientes(receita, qtdPai, nivel, maxNivel, visitados, saida, chavePai) {
    if (!receita?.ingredientes || nivel > maxNivel) return
    if (receita.uuid && visitados.has(receita.uuid)) return // evita ciclo A -> B -> A
    const caminho = new Set(visitados)
    if (receita.uuid) caminho.add(receita.uuid)

    const subFator = qtdPai / (receita.rendimento || 1)
    for (const sub of receita.ingredientes) {
      const subAlvo = sub.tipo === 'receita'
        ? receitas.value.find(x => x.uuid === sub.id)
        : produtos.value.find(p => p.uuid === sub.id)
      if (!subAlvo) continue
      const subOculto = sub.gera_peso === false
        ? true
        : (sub.tipo !== 'receita' && isProdutoEmbalagem(subAlvo))
      if (subOculto) continue

      const qtd = (sub.quantidade || 0) * subFator
      const chave = `${chavePai}>${sub.tipo}-${sub.id}`
      const existente = saida.find(x => x.chave === chave)
      if (existente) {
        existente.total += qtd
      } else {
        saida.push({
          id: sub.id,
          tipo: sub.tipo,
          nome: subAlvo.nome,
          total: qtd,
          unidade: sub.tipo === 'receita' ? subAlvo.unidade_rendimento : subAlvo.unidade_base,
          nivel,
          chave,
          paiChave: chavePai
        })
      }
      if (sub.tipo === 'receita') {
        coletarSubIngredientes(subAlvo, qtd, nivel + 1, maxNivel, caminho, saida, chave)
      }
    }
  }

  /**
   * Retorna os ingredientes para produção, com explosão inteligente:
   * Se o item principal for FINAL e usar uma BASE, expande a base em 1 nível.
   * @param {Object} recipe - A receita sendo produzida
   * @param {number} factor - Fator de escala para as quantidades
   * @param {number} [profundidade=1] - Quantos níveis de sub-receita expandir em
   *   `subIngredientes` (1 = só a composição direta; 2+ abre sub-receitas dentro
   *   de sub-receitas). Cada sub-ingrediente traz `nivel`, `chave` e `paiChave`.
   * @returns {Object} Um mapa de ingredientes diretos agrupados.
   */
  function getProductionIngredients(recipe, factor, profundidade = 1) {
    const mapa = {}
    if (!recipe || !recipe.ingredientes) return mapa

    for (const ing of recipe.ingredientes) {
      const qtdEscalada = (ing.quantidade || 0) * factor
      if (qtdEscalada <= 0) continue

      const alvo = ing.tipo === 'receita'
        ? receitas.value.find(x => x.uuid === ing.id)
        : produtos.value.find(p => p.uuid === ing.id)
      if (!alvo) continue

      const key = `${ing.tipo}-${ing.id}`
      if (!mapa[key]) {
        // Prioridade: escolha manual (gera_peso) > tipo cadastrado do produto > heurística por nome (legado)
        const oculto = ing.gera_peso === false
          ? true
          : (ing.tipo === 'produto' ? isProdutoEmbalagem(alvo) : false)
        mapa[key] = {
          id: ing.id, tipo: ing.tipo, nome: alvo.nome, total: 0,
          unidade: ing.tipo === 'receita' ? alvo.unidade_rendimento : alvo.unidade_base,
          subIngredientes: [],
          oculto
        }
      }
      mapa[key].total += qtdEscalada

      // Se for uma sub-receita, carregamos sua composição (recursiva, respeitando o nível)
      if (ing.tipo === 'receita' && alvo.ingredientes) {
        coletarSubIngredientes(alvo, qtdEscalada, 1, profundidade, new Set(), mapa[key].subIngredientes, '')
      }
    }
    return mapa
  }

  function getCustoTotal(recipe, visitados = new Set(), cache = new Map(), tempoManual = null) {
    if (!recipe || !recipe.ingredientes) return 0
    const uuid = recipe.uuid || 'temp'
    if (cache.has(uuid)) return cache.get(uuid)
    if (uuid !== 'temp' && visitados.has(uuid)) return 0
    if (uuid !== 'temp') visitados.add(uuid)

    let totalIngredientes = 0
    for (const ing of recipe.ingredientes) {
      const qtd = Number(ing.quantidade || 0)
      if (qtd <= 0) continue

      if (ing.tipo === 'receita') {
        const sub = receitas.value.find(x => x.uuid === ing.id)
        if (!sub || !sub.rendimento) continue
        totalIngredientes += (getCustoTotal(sub, visitados, cache) / sub.rendimento) * qtd
      } else {
        const prod = produtos.value.find(p => p.uuid === ing.id)
        totalIngredientes += getPrecoUnitarioInsumo(prod) * qtd
      }
    }

    const totalGeral = totalIngredientes + getCustoMaoDeObra(recipe, tempoManual)
    if (uuid !== 'temp') cache.set(uuid, totalGeral)
    return totalGeral
  }

  function getCustoProducaoReceita(recipe, quantidade, tempoManual = null) {
    if (!recipe) return 0

    const qtd = Number(quantidade || 0)
    if (qtd <= 0) return 0

    const rendimento = Number(recipe.rendimento || 1) || 1
    const fator = qtd / rendimento
    const custoPadrao = getCustoTotal(recipe)

    if (tempoManual === null || tempoManual === undefined) {
      return custoPadrao * fator
    }

    const maoDeObraPadrao = getCustoMaoDeObra(recipe)
    const custoSemMaoDeObraDireta = custoPadrao - maoDeObraPadrao
    return (custoSemMaoDeObraDireta * fator) + getCustoMaoDeObra(recipe, tempoManual)
  }

  function getCustoMaoDeObra(recipe, tempoManual = null) {
    const tempo = tempoManual !== null ? tempoManual : (recipe?.tempo_preparo_min || 0)
    if (tempo > 0 && company.value.custo_hora_trabalho > 0) {
      return (tempo / 60) * company.value.custo_hora_trabalho
    }
    return 0
  }

  // ── Sanidade do cronômetro de produção ─────────────────────
  // Quanto o tempo cronometrado pode passar do tempo padrão da receita antes de
  // ser tratado como "fora do padrão" (cenário típico: cronômetro esquecido ligado).
  const LIMITE_TEMPO_MULTIPLICADOR = 2.5
  const LIMITE_TEMPO_MARGEM_MIN = 15 // tolerância mínima em minutos, para receitas curtas

  /**
   * Compara o tempo cronometrado de um lote com o tempo padrão esperado da receita
   * (para a quantidade produzida) e sinaliza quando o valor foge muito do esperado.
   * Quando sinalizado, o custo/relatórios usam o tempo padrão no lugar do tempo bruto,
   * para não inflar mão de obra por causa de um cronômetro esquecido ligado.
   * O valor bruto cronometrado nunca é descartado — fica preservado à parte para conferência.
   */
  function avaliarTempoProducao(recipe, tempoRealMin, quantidade) {
    const bruto = Number(tempoRealMin || 0)
    if (bruto <= 0) return { tempo: 0, tempoBruto: 0, tempoPadrao: 0, suspeito: false }

    const rendimento = Number(recipe?.rendimento || 1) || 1
    const qtd = Number(quantidade || rendimento)
    const tempoPadrao = Number(recipe?.tempo_preparo_min || 0) * (qtd / rendimento)

    // Sem tempo padrão cadastrado na receita não há referência para comparar.
    if (tempoPadrao <= 0) return { tempo: bruto, tempoBruto: bruto, tempoPadrao: 0, suspeito: false }

    const suspeito = bruto > (tempoPadrao * LIMITE_TEMPO_MULTIPLICADOR) &&
      (bruto - tempoPadrao) > LIMITE_TEMPO_MARGEM_MIN

    return {
      tempo: suspeito ? tempoPadrao : bruto,
      tempoBruto: bruto,
      tempoPadrao,
      suspeito
    }
  }

  /** 
   * Explode uma receita em seus insumos básicos de forma recursiva.
   * Útil para Dashboard e Cozinha.
   */
  function expandirIngredientes(ingredientes, fator, mapa = {}, visitados = new Set()) {
    for (const ing of ingredientes) {
      const qtdEscalada = (ing.quantidade || 0) * fator
      if (qtdEscalada <= 0) continue

      if (ing.tipo === 'receita') {
        const sub = receitas.value.find(x => x.uuid === ing.id)
        if (!sub || !sub.rendimento || visitados.has(sub.uuid)) continue

        const novosVisitados = new Set(visitados)
        novosVisitados.add(sub.uuid)

        expandirIngredientes(sub.ingredientes || [], qtdEscalada / sub.rendimento, mapa, novosVisitados)
      } else {
        const prod = produtos.value.find(p => p.uuid === ing.id)
        if (!prod) continue // Should not happen if data is clean

        if (!mapa[prod.uuid]) {
          mapa[prod.uuid] = { id: prod.uuid, nome: prod.nome, total: 0, unidade: prod.unidade_base }
        }
        mapa[prod.uuid].total += qtdEscalada
      }
    }
    return mapa
  }

  /** Informações de lucratividade de uma receita */
  function getLucroInfo(recipe) {
    const custoTotal = getCustoTotal(recipe)
    const rendimento = Number(recipe.rendimento || 1) || 1
    const custoUnit = custoTotal / rendimento
    const venda = Number(recipe.preco_sugerido || 0)
    const valor = venda - custoUnit
    const percentual = venda > 0 ? (valor / venda) * 100 : 0
    return { valor, percentual, custoUnit, custoTotal }
  }

  /** Soma o peso físico de todos os ingredientes de uma receita */
  function getPesoTotal(recipe) {
    if (!recipe || !recipe.ingredientes) return 0
    return recipe.ingredientes.reduce((acc, ing) => {
      const qtd = Number(ing.quantidade || 0)
      if (qtd <= 0) return acc

      const alvo = ing.tipo === 'receita'
        ? receitas.value.find(x => x.uuid === ing.id)
        : produtos.value.find(x => x.uuid === ing.id)

      // Prioridade total à escolha manual (gera_peso); senão, tipo cadastrado do produto;
      // heurística por nome só como último recurso (produtos legados sem `tipo` definido)
      let soma
      if (ing.gera_peso !== undefined && ing.gera_peso !== null) {
        soma = ing.gera_peso
      } else {
        soma = !isProdutoEmbalagem(alvo)
      }

      if (!soma) return acc

      if (ing.tipo === 'produto') {
        // Se unidade e tem peso definido, soma peso. Senão assume que a qtd é o peso (g/ml)
        if (alvo?.unidade_base === 'un' && (alvo.peso_unitario || 0) > 0) {
          return acc + (qtd * alvo.peso_unitario)
        }
        return acc + qtd
      } else {
        const unit = String(alvo?.unidade_rendimento || '').toLowerCase()
        if (unit === 'g') return acc + qtd
        if (unit === 'kg') return acc + (qtd * 1000)
        if (unit === 'un') {
          const pw = Number(alvo?.peso_unitario || 0)
          return acc + (pw > 0 ? (qtd * pw) : qtd)
        }
        return acc + qtd
      }
    }, 0)
  }

  return {
    getPrecoUnitarioInsumo,
    getMediaTempoReceita,
    coletarSubIngredientes,
    getProductionIngredients,
    getCustoTotal,
    getCustoProducaoReceita,
    getCustoMaoDeObra,
    LIMITE_TEMPO_MULTIPLICADOR,
    LIMITE_TEMPO_MARGEM_MIN,
    avaliarTempoProducao,
    expandirIngredientes,
    getLucroInfo,
    getPesoTotal
  }
}
