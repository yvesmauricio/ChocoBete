// scripts/test-trufa.js
const TAMANHO_FESTA_PESO = 19

function getPesoTotal(recipe) {
  if (!recipe || !recipe.ingredientes) return 0
  return recipe.ingredientes.reduce((acc, ing) => {
    const qtd = Number(ing.quantidade || 0)
    if (qtd <= 0) return acc
    // Simplified: assume produto quantities are grams
    if (ing.tipo === 'produto') return acc + qtd
    // receita sub-items: assume qtd in units and unit weight in peso_unitario
    const unit = String((ing.unidade || 'g')).toLowerCase()
    if (unit === 'g') return acc + qtd
    if (unit === 'kg') return acc + qtd * 1000
    if (unit === 'un') return acc + (Number(ing.peso_unitario || 0) > 0 ? qtd * Number(ing.peso_unitario) : qtd)
    return acc + qtd
  }, 0)
}

function duplicarComoTamanhoFesta(r) {
  const pesoAtual = Number(r.peso_unitario) || 0
  const rendimentoAtual = Number(r.rendimento) || 1
  const pesoTotalAtual = getPesoTotal(r)

  const clone = JSON.parse(JSON.stringify(r))
  clone.uuid = null
  clone.tamanho = 'Festa'
  clone.peso_unitario = TAMANHO_FESTA_PESO
  clone.nome = `${clone.nome} - Festa ${TAMANHO_FESTA_PESO}g`

  const ingredientesCasca = (r.ingredientes || []).filter(i => i.papel === 'casca')
  const ingredientesRecheio = (r.ingredientes || []).filter(i => i.papel !== 'casca')
  const temCascaMarcada = ingredientesCasca.length > 0

  if (pesoAtual > 0 && pesoTotalAtual > 0 && temCascaMarcada) {
    const pesoCascaAtualTotal = getPesoTotal({ ingredientes: ingredientesCasca })
    const pesoRecheioAtualTotal = getPesoTotal({ ingredientes: ingredientesRecheio })

    const cascaPorUnidadeAtual = pesoCascaAtualTotal / rendimentoAtual
    const cascaPorUnidadeNova = cascaPorUnidadeAtual * Math.pow(TAMANHO_FESTA_PESO / pesoAtual, 2 / 3)
    const recheioPorUnidadeNova = Math.max(TAMANHO_FESTA_PESO - cascaPorUnidadeNova, 0)

    const rendimentoNovo = rendimentoAtual === 1
      ? 1
      : Math.max(1, Math.round(pesoTotalAtual / TAMANHO_FESTA_PESO))
    clone.rendimento = rendimentoNovo

    const cascaTotalNova = cascaPorUnidadeNova * rendimentoNovo
    const recheioTotalNova = recheioPorUnidadeNova * rendimentoNovo

    const fatorCasca = pesoCascaAtualTotal > 0 ? cascaTotalNova / pesoCascaAtualTotal : 1
    const fatorRecheio = pesoRecheioAtualTotal > 0 ? recheioTotalNova / pesoRecheioAtualTotal : 1

    clone.ingredientes = clone.ingredientes.map(ing => {
      const fator = ing.papel === 'casca' ? fatorCasca : fatorRecheio
      return { ...ing, quantidade: Math.round(Number(ing.quantidade || 0) * fator * 100) / 100 }
    })
  } else if (pesoTotalAtual > 0) {
    if (rendimentoAtual === 1 && pesoAtual > 0) {
      const fator = TAMANHO_FESTA_PESO / pesoAtual
      clone.ingredientes = clone.ingredientes.map(ing => ({
        ...ing,
        quantidade: Math.round(Number(ing.quantidade || 0) * fator * 100) / 100
      }))
      clone.rendimento = 1
    } else {
      clone.rendimento = Math.max(1, Math.round(pesoTotalAtual / TAMANHO_FESTA_PESO))
    }
  }

  return clone
}

// Test case: Trufa 30g, casca 8g, recheio 22g, rendimento = 1
const receita = {
  uuid: 'r1',
  nome: 'Trufa Tradicional',
  tamanho: 'Padrão',
  rendimento: 1,
  peso_unitario: 30,
  preco_sugerido: 6.00,
  ingredientes: [
    { _key: 'i1', id: 'p_casca', tipo: 'produto', quantidade: 8, gera_peso: true, papel: 'casca' },
    { _key: 'i2', id: 'p_recheio', tipo: 'produto', quantidade: 22, gera_peso: true, papel: 'recheio' },
    // etiqueta por unidade (deve permanecer inteira)
    { _key: 'i3', id: 'p_etiqueta', tipo: 'produto', quantidade: 1, gera_peso: false, papel: '' }
  ]
}

console.log('Receita original:', JSON.stringify(receita, null, 2))
console.log('Peso total atual (g):', getPesoTotal(receita))

const festa = duplicarComoTamanhoFesta(receita)
console.log('\nReceita gerada (Festa):', JSON.stringify(festa, null, 2))

// Mostrar pesos por unidade
const perUnit = festa.ingredientes.map(ing => ({ papel: ing.papel, quantidade_unidade: Number(ing.quantidade || 0) / (festa.rendimento || 1) }))
console.log('\nPesos por unidade (casca / recheio):', JSON.stringify(perUnit, null, 2))
