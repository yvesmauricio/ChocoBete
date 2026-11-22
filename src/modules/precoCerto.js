// modules/precoCerto.js
// "Preço certo": UMA fórmula, aberta, que mostra para onde vai cada real do preço.
//
//   preço = ingredientes + parte dos custos fixos + reserva para fiado + o que sobra para você
//
// Tudo que não é ingrediente é tratado como % do preço, calculado com os números REAIS do negócio:
//  • custos fixos  → despesas operacionais do Financeiro (sem a compra de insumos, que já está nas receitas)
//  • fiado         → quanto do vendido costuma ficar parado há muito tempo na Caderneta
//  • sua retirada  → meta de Ajustes ÷ faturamento médio
// Funções PURAS (sem banco, sem tela).

import { diasEntre, somaDias } from './guiaNegocio.js'

const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const ceilMeio = (v) => Math.ceil(v * 2 - 1e-9) / 2 // para cima, de R$ 0,50 em R$ 0,50

/** Parte financeira: faturamento médio, custos fixos reais e retirada desejada.
 *  relatorio: s.relatorioMensalMei (mais recente primeiro, mes_ref "MM/AAAA"). */
export function baseFinanceira({ relatorio = [], hoje, metaRetirada = 0 }) {
  const [a, m] = String(hoje).slice(0, 7).split('-')
  const mesAtual = `${m}/${a}`
  const comReceita = relatorio.filter(r => Number(r.receitas_mei) > 0)
  const fechados = comReceita.filter(r => r.mes_ref !== mesAtual).slice(0, 3)
  const usados = fechados.length ? fechados : comReceita.slice(0, 1) // sem mês fechado: usa o atual, mesmo parcial
  if (!usados.length) {
    return { fonte: 'padrao', meses: 0, faturamentoMedio: 0, fixosMensais: 0, fixosPct: 0.08, retiradaPct: 0, metaRetirada }
  }
  const n = usados.length
  const faturamentoMedio = usados.reduce((s, r) => s + Number(r.receitas_mei || 0), 0) / n
  // Fixos = tudo que o negócio gasta MENOS a compra de insumos (insumo já entra no custo da receita)
  const fixosMensais = usados.reduce((s, r) => s + Math.max(0, Number(r.saidas_operacionais || 0) - Number(r.saidas_insumos || 0)), 0) / n
  return {
    fonte: 'financeiro', meses: n, faturamentoMedio: c2(faturamentoMedio), fixosMensais: c2(fixosMensais),
    fixosPct: clamp(fixosMensais / faturamentoMedio, 0.02, 0.35),
    retiradaPct: metaRetirada > 0 ? clamp(metaRetirada / faturamentoMedio, 0, 0.6) : 0,
    metaRetirada,
  }
}

/** Reserva para fiado que demora ou não paga: saldo vencido há mais de 60 dias ÷ vendido em 12 meses. */
export function riscoFiado({ fiados = [], hoje }) {
  const desde = somaDias(hoje, -365)
  let vendido = 0, parado = 0
  for (const f of fiados) {
    if (String(f.dataVenda || '').slice(0, 10) >= desde) vendido += Number(f.total || 0)
    if (f.status !== 'pago' && Number(f.saldo || 0) > 0.01 && f.dataVenc && diasEntre(f.dataVenc, hoje) > 60) parado += Number(f.saldo)
  }
  if (vendido < 200) return { pct: 0.02, parado: c2(parado), vendido: c2(vendido), fonte: 'padrao' }
  return { pct: clamp(parado / vendido, 0.01, 0.10), parado: c2(parado), vendido: c2(vendido), fonte: 'fiados' }
}

export const ROTULO_PRECO = {
  prejuizo: 'Abaixo do custo', abaixo_piso: 'Não cobre os custos', abaixo_alvo: 'Cobre, mas sobra pouco', ok: 'Preço saudável',
}

/** Conta aberta de um preço (por unidade). */
export function contaDoPreco(preco, { custoUnit, base, riscoPct }) {
  const fixos = c2(preco * base.fixosPct)
  const risco = c2(preco * riscoPct)
  const sobra = c2(preco - custoUnit - fixos - risco)
  return {
    preco: c2(preco), ingredientes: c2(custoUnit), fixos, risco, sobra,
    sobraPct: preco > 0 ? Math.round((sobra / preco) * 100) : 0,
  }
}

/** Analisa um produto: piso, preço certo, passo de reajuste e conta aberta no preço atual. */
export function precoCertoProduto({ custoUnit, precoAtual, base, riscoPct, crescimentoPct = 0.05 }) {
  const piso = ceilMeio(custoUnit / Math.max(0.3, 1 - base.fixosPct - riscoPct))
  const alvoPct = clamp(base.retiradaPct + crescimentoPct, 0.15, 0.40) // fatia que deve sobrar para você crescer
  const certo = Math.max(piso, ceilMeio(custoUnit / Math.max(0.25, 1 - base.fixosPct - riscoPct - alvoPct)))
  let status
  if (precoAtual < custoUnit) status = 'prejuizo'
  else if (precoAtual < piso) status = 'abaixo_piso'
  else if (precoAtual < certo) status = 'abaixo_alvo'
  else status = 'ok'
  // Reajuste em passos de no máximo ~10% por vez (cliente de porta em porta sente aumento brusco)
  let passo = null
  if (precoAtual > 0 && precoAtual < certo) {
    passo = Math.min(certo, Math.max(ceilMeio(precoAtual * 1.10), precoAtual + 0.5))
    if (passo <= precoAtual) passo = null
  }
  // Quando o preço "ideal pela conta" é irreal (bem acima do que se cobra), o problema costuma ser o CUSTO
  // da receita (ingredientes, rendimento ou tamanho da porção) e não só o preço.
  const longe = precoAtual > 0 && certo > precoAtual * 1.5
  const custoPesa = precoAtual > 0 && custoUnit / precoAtual > 0.6
  return {
    piso, certo, passo, status, longe, custoPesa, alvoPct: Math.round(alvoPct * 100),
    conta: contaDoPreco(precoAtual, { custoUnit, base, riscoPct }),
  }
}

/** Lista todos os produtos com a análise, do que mais precisa de atenção para o que está ok. */
export function listaPrecoCerto({ receitas, base, risco, fiados = [], historicoPrecos = [], hoje }) {
  const ordem = { prejuizo: 0, abaixo_piso: 1, abaixo_alvo: 2, ok: 3 }
  return (receitas || [])
    .filter(r => r.custoUnit > 0 && r.preco > 0)
    .map(r => {
      const a = precoCertoProduto({ custoUnit: r.custoUnit, precoAtual: r.preco, base, riscoPct: risco.pct })
      return { uuid: r.uuid, nome: r.nome, categoria: r.categoria, custoUnit: r.custoUnit, preco: r.preco, ...a, efeitos: efeitoDosReajustes({ receitaUuid: r.uuid, historicoPrecos, fiados, hoje }) }
    })
    .sort((x, y) => ordem[x.status] - ordem[y.status] || (y.certo - y.preco) - (x.certo - x.preco))
}

/** O que aconteceu com as vendas quando você SUBIU o preço antes? Compara unidades por semana
 *  nas 8 semanas antes e depois de cada aumento (só quando há dados suficientes dos dois lados). */
export function efeitoDosReajustes({ receitaUuid, historicoPrecos = [], fiados = [], hoje }) {
  const hist = historicoPrecos.filter(h => h.receita_uuid === receitaUuid && Number(h.preco) > 0)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
  if (hist.length < 2) return []
  const vendas = []
  for (const f of fiados) for (const it of f.itens || []) {
    if (it.id === receitaUuid) vendas.push({ data: String(f.dataVenda || '').slice(0, 10), qtd: Number(it.qty ?? it.qtd ?? 0) })
  }
  if (vendas.length < 4) return []
  const somar = (de, ate) => vendas.filter(v => v.data >= de && v.data < ate).reduce((s, v) => s + v.qtd, 0)
  const efeitos = []
  for (let i = 1; i < hist.length; i++) {
    const de = Number(hist[i - 1].preco), para = Number(hist[i].preco)
    if (para <= de * 1.02) continue // só aumentos
    const dia = String(hist[i].data).slice(0, 10)
    if (diasEntre(dia, hoje) < 42) continue // pouco tempo depois para concluir algo
    const ini = somaDias(dia, -56), fim = somaDias(dia, 56)
    const antes = somar(ini, dia), depois = somar(dia, fim > hoje ? somaDias(hoje, 1) : fim)
    const semDepois = Math.min(8, diasEntre(dia, hoje) / 7)
    if (antes + depois < 6) continue
    const porSemanaAntes = antes / 8, porSemanaDepois = depois / semDepois
    efeitos.push({
      data: dia, de: c2(de), para: c2(para), aumentoPct: Math.round(((para - de) / de) * 100),
      porSemanaAntes: Math.round(porSemanaAntes * 10) / 10, porSemanaDepois: Math.round(porSemanaDepois * 10) / 10,
      variacaoPct: porSemanaAntes > 0 ? Math.round(((porSemanaDepois - porSemanaAntes) / porSemanaAntes) * 100) : null,
    })
  }
  return efeitos.slice(-2)
}
