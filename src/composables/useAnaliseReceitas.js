// composables/useAnaliseReceitas.js
//
// Analisa TODAS as receitas cadastradas, agrupadas por categoria, e aponta
// discrepâncias — sem IA, só matemática em cima dos dados que já existem
// na store (getPesoTotal / getCustoTotal / rendimento / peso_unitario).
//
// Duas famílias de problema são detectadas, por categoria:
//
//   1) QUANTIDADE (peso)
//      a) Peso real dos ingredientes  x  peso declarado da própria receita
//         → ex: uma trufa que diz "30g" mas o recheio+casca somam 38g
//         (percentual FIXO — é uma checagem da receita contra ela mesma,
//         não depende de quão variada é a categoria)
//      b) Peso declarado da receita   x  peso "típico" da categoria
//         → ex: dentro de "Trufa", a maioria é de 30g, mas essa aqui
//           foi cadastrada com 22g (provável erro de digitação)
//         (limiar ADAPTATIVO — ver nota abaixo)
//
//   2) VALOR (custo)
//      Custo por grama da receita  x  custo por grama "típico" da categoria
//      (limiar ADAPTATIVO — ver nota abaixo)
//
// NOTA sobre o limiar adaptativo (1b e 2): usar um percentual FIXO de
// tolerância pra toda categoria é injusto — funciona bem pra categorias
// padronizadas (ex: Trufa, sempre do mesmo tamanho), mas gera falso alarme
// em categorias naturalmente variadas (ex: "Bolo" mistura bolo no pote,
// bolo simples e torta grande — tamanhos bem diferentes e igualmente
// corretos). Por isso, em vez de comparar contra um percentual fixo,
// comparamos contra o quanto aquele GRUPO ESPECÍFICO já varia entre si
// (desvio absoluto mediano, um "desvio padrão robusto"). Uma categoria
// bagunçada naturalmente tolera mais diferença; uma categoria uniforme
// tolera menos. Só alertamos quando a receita foge do padrão de VARIAÇÃO
// da própria categoria, não de um número fixo igual pra tudo.

const TOLERANCIA_PESO_PROPRIO = 0.12     // 12% de folga entre ingredientes e peso declarado (checagem própria da receita)
const MIN_RECEITAS_PARA_COMPARAR_GRUPO = 3 // abaixo disso, não dá pra falar em "padrão da categoria"
const Z_LIMIAR_MEDIA = 2.5  // "desvios robustos" de distância pra virar alerta leve
const Z_LIMIAR_ALTA  = 4    // "desvios robustos" de distância pra virar alerta forte
const PISO_VARIACAO_RELATIVA = 0.10 // mesmo em grupo muito homogêneo, tolera pelo menos 10% de variação natural

function mediana(valores) {
  if (!valores.length) return 0
  const ordenado = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenado.length / 2)
  return ordenado.length % 2 !== 0
    ? ordenado[meio]
    : (ordenado[meio - 1] + ordenado[meio]) / 2
}

// Desvio absoluto mediano, escalado para se comportar como um "desvio padrão"
// (constante 1.4826 é o fator padrão de escala do MAD para distribuição normal).
function desvioRobusto(valores, centro) {
  const desvios = valores.map(v => Math.abs(v - centro))
  return mediana(desvios) * 1.4826
}

function pct(diff) {
  return `${diff > 0 ? '+' : ''}${(diff * 100).toFixed(0)}%`
}

/**
 * @param {object} s - a store (useStore()), precisa expor: receitas, getPesoTotal, getCustoTotal
 * @returns {Array} lista de alertas, já ordenada (gravidade alta primeiro)
 */
export function analisarReceitas(s) {
  // Bases (eh_intermediaria) ficam de fora: são ingredientes internos de outras
  // receitas, não produtos finais — não faz sentido comparar "tamanho" ou
  // "custo por grama" entre bases de sabores diferentes (ex: recheio de ninho
  // vs. calda de chocolate), e o app preenche peso_unitario=1 automaticamente
  // para elas por motivo de cálculo interno, não porque tenham 1g de fato.
  const receitas = (s.receitas || []).filter(r => Number(r.rendimento) > 0 && !r.eh_intermediaria)

  const porCategoria = {}
  for (const r of receitas) {
    // Agrupa por categoria E por tamanho/variante (ex: "Trufa · Padrão" e "Trufa · Festa"
    // ficam em grupos separados) — receitas de tamanhos diferentes não são "irmãs"
    // para efeito de comparação de peso/custo, mesmo sendo da mesma categoria.
    const tamanho = (r.tamanho || '').trim() || 'Padrão'
    const cat = `${r.categoria || 'Sem categoria'} · ${tamanho}`
    ;(porCategoria[cat] ||= []).push(r)
  }

  const alertas = []

  for (const [categoria, lista] of Object.entries(porCategoria)) {
    // ── Pré-calcula os números de cada receita do grupo ──────────────
    const dados = lista.map(r => {
      const rendimento = Number(r.rendimento) || 1
      const pesoDeclarado = Number(r.peso_unitario) || 0
      const pesoReal = s.getPesoTotal(r) / rendimento
      const custoUnit = s.getCustoTotal(r) / rendimento
      const custoPorGrama = pesoDeclarado > 0 ? custoUnit / pesoDeclarado : null
      return { receita: r, rendimento, pesoDeclarado, pesoReal, custoUnit, custoPorGrama }
    })

    // ── 1a) Peso real dos ingredientes vs. peso que a própria receita declara ──
    for (const d of dados) {
      if (!d.pesoDeclarado) continue // receita sem peso_unitario cadastrado: não dá pra checar
      const diff = (d.pesoReal - d.pesoDeclarado) / d.pesoDeclarado
      if (Math.abs(diff) > TOLERANCIA_PESO_PROPRIO) {
        alertas.push({
          receitaId: d.receita.uuid,
          nome: d.receita.nome,
          categoria,
          tipo: 'peso_proprio',
          gravidade: Math.abs(diff) > TOLERANCIA_PESO_PROPRIO * 2 ? 'alta' : 'media',
          titulo: diff > 0 ? 'Ingredientes passam do tamanho declarado' : 'Ingredientes não preenchem o tamanho declarado',
          mensagem: `Peso somado dos ingredientes é ${d.pesoReal.toFixed(1)}g, mas a receita declara ${d.pesoDeclarado}g por unidade (${pct(diff)}). ` +
            (diff > 0
              ? 'Provável excesso de recheio/ingrediente para o tamanho da casca/embalagem.'
              : 'Provável falta de recheio/ingrediente para preencher o tamanho da unidade.')
        })
      }
    }

    // ── 1b) Peso declarado desta receita vs. peso "típico" da categoria ──────
    // (limiar adaptativo — ver nota no topo do arquivo)
    const pesosDeclarados = dados.filter(d => d.pesoDeclarado > 0).map(d => d.pesoDeclarado)
    if (pesosDeclarados.length >= MIN_RECEITAS_PARA_COMPARAR_GRUPO) {
      const pesoPadraoCategoria = mediana(pesosDeclarados)
      const variacaoNatural = Math.max(
        desvioRobusto(pesosDeclarados, pesoPadraoCategoria),
        pesoPadraoCategoria * PISO_VARIACAO_RELATIVA
      )
      for (const d of dados) {
        if (!d.pesoDeclarado || pesoPadraoCategoria <= 0 || variacaoNatural <= 0) continue
        const z = Math.abs(d.pesoDeclarado - pesoPadraoCategoria) / variacaoNatural
        if (z > Z_LIMIAR_MEDIA) {
          const diff = (d.pesoDeclarado - pesoPadraoCategoria) / pesoPadraoCategoria
          alertas.push({
            receitaId: d.receita.uuid,
            nome: d.receita.nome,
            categoria,
            tipo: 'peso_categoria',
            gravidade: z > Z_LIMIAR_ALTA ? 'alta' : 'media',
            titulo: 'Tamanho de unidade fora do padrão da categoria',
            mensagem: `Esta receita declara ${d.pesoDeclarado}g por unidade, enquanto o típico de "${categoria}" é ${pesoPadraoCategoria.toFixed(0)}g (${pct(diff)}, bem acima da variação natural desse grupo). Confira se o tamanho foi cadastrado certo.`
          })
        }
      }
    }

    // ── 2) Custo por grama vs. custo/g "típico" da categoria ─────────────────
    // (limiar adaptativo — ver nota no topo do arquivo)
    const custosValidos = dados.filter(d => d.custoPorGrama !== null).map(d => d.custoPorGrama)
    if (custosValidos.length >= MIN_RECEITAS_PARA_COMPARAR_GRUPO) {
      const medianaCusto = mediana(custosValidos)
      const variacaoNaturalCusto = Math.max(
        desvioRobusto(custosValidos, medianaCusto),
        medianaCusto * PISO_VARIACAO_RELATIVA
      )
      for (const d of dados) {
        if (d.custoPorGrama === null || medianaCusto <= 0 || variacaoNaturalCusto <= 0) continue
        const z = Math.abs(d.custoPorGrama - medianaCusto) / variacaoNaturalCusto
        if (z > Z_LIMIAR_MEDIA) {
          const diff = (d.custoPorGrama - medianaCusto) / medianaCusto
          alertas.push({
            receitaId: d.receita.uuid,
            nome: d.receita.nome,
            categoria,
            tipo: 'custo',
            gravidade: z > Z_LIMIAR_ALTA ? 'alta' : 'media',
            titulo: diff > 0 ? 'Custo acima do padrão da categoria' : 'Custo abaixo do padrão da categoria',
            mensagem: `Custo de R$ ${d.custoPorGrama.toFixed(3)}/g contra o típico de R$ ${medianaCusto.toFixed(3)}/g em "${categoria}" (${pct(diff)}, bem acima da variação natural desse grupo). ` +
              (diff > 0
                ? 'Pode ser preço de insumo desatualizado ou quantidade de ingrediente maior que o normal.'
                : 'Pode ser ingrediente faltando, preço desatualizado (mais barato do que devia) ou substituição não refletida no custo.')
          })
        }
      }
    }
  }

  const pesoGravidade = { alta: 0, media: 1 }
  return alertas.sort((a, b) => pesoGravidade[a.gravidade] - pesoGravidade[b.gravidade])
}
