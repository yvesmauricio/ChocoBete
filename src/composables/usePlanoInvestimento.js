// Plano de investimento (Pix MEI / Sebrae)
// Reúne os dados que o app já tem e gera: relatório básico, prompt para IA e JSON.
// Os números vêm do código (exatos); a IA só escreve a narrativa por cima.
import { db } from '../db.js'
import { R$ as formatarNumero } from '../utils.js'

const R$ = v => 'R$ ' + formatarNumero(v)

export const NOTAS_KEY = 'chocobete_plano_notas'
export const LIMITE_PRIORIDADE_PIX_MEI = 40500 // faturamento anual com prioridade anunciada (regras ainda não publicadas)

export const NOTAS_PADRAO = `EQUIPAMENTOS HOJE
- Fogão 4 bocas: forno com defeito na trava de segurança, mais de 17 anos
- Geladeira só das trufas: cerca de 20 anos
- Congelador antigo, usado para descongelar
- Micro-ondas mais novo, mas às vezes liga sozinho ao abrir a porta

PRECISO COMPRAR (item | valor orçado)
- Geladeira | 
- Fogão | 
- Micro-ondas | 
- Utensílios | 

ESTOQUE
- Hoje compro conforme a demanda, em pouca quantidade, e pago mais caro
- Quero formar estoque antes da Páscoa de 2027 com recursos próprios`

const num = v => Number(v || 0)

function mesRefParaNumero(mesRef) {
  const [m, a] = String(mesRef || '').split('/')
  return Number(a) * 100 + Number(m)
}

// Compras de insumos: quanto foi pago acima do menor preço unitário já pago pelo mesmo insumo
async function analisarCompras(produtos) {
  let historico = []
  try { historico = await db.historico_precos.toArray() } catch { return { itens: [], economiaTotal: 0 } }

  const porProduto = new Map()
  for (const h of historico) {
    const preco = num(h.preco_unitario)
    const pago = num(h.valor_pago)
    if (!h.produto_uuid || preco <= 0 || pago <= 0) continue
    if (!porProduto.has(h.produto_uuid)) porProduto.set(h.produto_uuid, [])
    porProduto.get(h.produto_uuid).push({ preco, pago })
  }

  const itens = []
  for (const [uuid, compras] of porProduto) {
    if (compras.length < 2) continue
    const menor = Math.min(...compras.map(c => c.preco))
    const maior = Math.max(...compras.map(c => c.preco))
    const totalPago = compras.reduce((a, c) => a + c.pago, 0)
    // valor_pago / preco = quantidade em unidade-base; custo no menor preço = qtd * menor
    const custoNoMenor = compras.reduce((a, c) => a + (c.pago / c.preco) * menor, 0)
    const economia = Math.max(0, totalPago - custoNoMenor)
    const nome = produtos.find(p => p.uuid === uuid)?.nome || 'Insumo'
    itens.push({
      nome,
      compras: compras.length,
      totalPago: Math.round(totalPago * 100) / 100,
      variacaoPct: menor > 0 ? Math.round(((maior - menor) / menor) * 100) : 0,
      economiaPotencial: Math.round(economia * 100) / 100
    })
  }
  itens.sort((a, b) => b.economiaPotencial - a.economiaPotencial)
  const top = itens.slice(0, 8)
  return { itens: top, economiaTotal: Math.round(itens.reduce((a, i) => a + i.economiaPotencial, 0) * 100) / 100 }
}

export async function coletarDados(s) {
  const meses = [...(s.relatorioMensalMei || [])]
    .sort((a, b) => mesRefParaNumero(b.mes_ref) - mesRefParaNumero(a.mes_ref))
    .slice(0, 12)
    .map(m => ({
      mes: m.mes_ref,
      receitas: Math.round(num(m.receitas_mei) * 100) / 100,
      insumos: Math.round(num(m.saidas_insumos) * 100) / 100,
      saidasOperacionais: Math.round(num(m.saidas_operacionais) * 100) / 100
    }))

  const totalUltimos12 = meses.reduce((a, m) => a + m.receitas, 0)
  const mediaMensal = meses.length ? totalUltimos12 / meses.length : 0
  const anoAtual = num(s.totalRecebidoAnoAtual)

  const produtosFinais = (s.receitas || [])
    .filter(r => !r.eh_intermediaria)
    .map(r => {
      const custo = num(s.getCustoTotal(r)) / (num(r.rendimento) || 1)
      const preco = num(r.preco_sugerido)
      return {
        nome: r.nome,
        categoria: r.categoria || 'Outros',
        custoUnit: Math.round(custo * 100) / 100,
        preco,
        margemPct: preco > 0 && custo > 0 ? Math.round(((preco - custo) / preco) * 100) : null
      }
    })
    .filter(p => p.preco > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const compras = await analisarCompras(s.produtos || [])

  return {
    geradoEm: new Date().toISOString(),
    empresa: {
      nome: s.company?.nome || '',
      razaoSocial: s.company?.razao_social || '',
      cnpj: s.company?.cnpj || '',
      cnae: s.company?.cnae || ''
    },
    faturamento: {
      meses,
      mesesComDados: meses.length,
      totalUltimos12Meses: Math.round(totalUltimos12 * 100) / 100,
      mediaMensal: Math.round(mediaMensal * 100) / 100,
      totalAnoAtual: Math.round(anoAtual * 100) / 100,
      projecaoAnual: Math.round(mediaMensal * 12 * 100) / 100,
      dentroDoLimitePrioridade: totalUltimos12 > 0 ? totalUltimos12 <= LIMITE_PRIORIDADE_PIX_MEI : null
    },
    insumos: {
      mediaMensal3Meses: Math.round(num(s.mediaInsumos3Meses) * 100) / 100,
      dasMensal3Meses: Math.round(num(s.mediaDasMei3Meses) * 100) / 100,
      compras: compras.itens,
      economiaPotencialTotal: compras.economiaTotal
    },
    produtos: produtosFinais
  }
}

export function gerarRelatorioBasico(d, notas) {
  const L = []
  const hoje = new Date(d.geradoEm).toLocaleDateString('pt-BR')
  L.push(`# ${d.empresa.nome || 'ChocoBete'}: relatório do negócio`)
  L.push(`Gerado em ${hoje}. Números calculados a partir dos dados do app.`, '')

  L.push('## Empresa')
  L.push(`- Razão social: ${d.empresa.razaoSocial || '[preencher em Ajustes]'}`)
  L.push(`- CNPJ: ${d.empresa.cnpj || '[preencher em Ajustes]'}`)
  L.push(`- CNAE: ${d.empresa.cnae || '[preencher em Ajustes]'}`, '')

  const f = d.faturamento
  L.push('## Faturamento')
  if (!f.mesesComDados) {
    L.push('Sem lançamentos de receita no Financeiro ainda.', '')
  } else {
    L.push(`- Total dos últimos ${f.mesesComDados} meses: ${R$(f.totalUltimos12Meses)}`)
    L.push(`- Média mensal: ${R$(f.mediaMensal)}`)
    L.push(`- Total no ano atual: ${R$(f.totalAnoAtual)}`)
    L.push(`- Projeção anual pela média: ${R$(f.projecaoAnual)}`)
    if (f.dentroDoLimitePrioridade !== null) {
      L.push(`- Faturamento de até ${R$(LIMITE_PRIORIDADE_PIX_MEI)} por ano (prioridade anunciada para o Pix MEI, regras ainda não publicadas): ${f.dentroDoLimitePrioridade ? 'sim' : 'não'}`)
    }
    L.push('', '| Mês | Receitas | Insumos | Saídas operacionais |', '|---|---|---|---|')
    f.meses.forEach(m => L.push(`| ${m.mes} | ${R$(m.receitas)} | ${R$(m.insumos)} | ${R$(m.saidasOperacionais)} |`))
    L.push('')
  }

  L.push('## Insumos e estoque')
  L.push(`- Gasto médio mensal com insumos (3 meses): ${R$(d.insumos.mediaMensal3Meses)}`)
  L.push(`- DAS-MEI médio mensal (3 meses): ${R$(d.insumos.dasMensal3Meses)}`)
  if (d.insumos.compras.length) {
    L.push(`- Economia potencial se cada insumo fosse sempre comprado ao menor preço já pago: ${R$(d.insumos.economiaPotencialTotal)}`, '')
    L.push('| Insumo | Compras | Total pago | Variação de preço | Economia potencial |', '|---|---|---|---|---|')
    d.insumos.compras.forEach(c => L.push(`| ${c.nome} | ${c.compras} | ${R$(c.totalPago)} | ${c.variacaoPct}% | ${R$(c.economiaPotencial)} |`))
  } else {
    L.push('- Ainda não há compras repetidas registradas para comparar preços.')
  }
  L.push('')

  if (d.produtos.length) {
    L.push('## Produtos (custo, preço e margem)', '', '| Produto | Categoria | Custo un. | Preço | Margem |', '|---|---|---|---|---|')
    d.produtos.forEach(p => L.push(`| ${p.nome} | ${p.categoria} | ${R$(p.custoUnit)} | ${R$(p.preco)} | ${p.margemPct === null ? '-' : p.margemPct + '%'} |`))
    L.push('')
  }

  L.push('## Equipamentos, necessidades e estoque (informado por mim)', '', (notas || '').trim() || '[não preenchido]', '')
  return L.join('\n')
}

export function gerarPromptIA(d, notas) {
  const dados = gerarRelatorioBasico(d, notas)
  return `Você é consultora de pequenos negócios. Monte o PLANO DE NEGÓCIOS E PLANO DE INVESTIMENTO da minha empresa, para eu levar ao Sebrae e para me preparar para o Pix MEI (programa Prospera MEI, até R$ 5.000 sem devolução, anunciado em outubro de 2026).

REGRAS
- Use somente os números abaixo. Não invente valores: o que faltar, deixe entre [colchetes].
- Pesquise antes se o edital do Pix MEI já saiu e confirme se estoque é gasto permitido. Se não estiver definido, trate equipamentos como o pedido ao programa e estoque como recurso próprio.
- Gastos precisam de nota fiscal no CNPJ.
- Equipamentos com defeito de segurança (trava do forno, micro-ondas que liga com a porta aberta) devem ser tratados como substituição por segurança.

ESTRUTURA: 1 resumo executivo; 2 o negócio; 3 situação atual x depois do investimento; 4 mercado e sazonalidade; 5 investimento (equipamentos com justificativa por item, estoque, origem dos recursos); 6 retorno esperado; 7 texto-base para justificar o pedido; 8 checklist; 9 riscos e plano B; 10 cronograma. Inclua o argumento da economia ao comprar insumos em volume.

DADOS DO MEU NEGÓCIO
${dados}`
}

export function baixarArquivo(nome, conteudo, mime) {
  const blob = new Blob([conteudo], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
