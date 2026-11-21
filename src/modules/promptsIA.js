// modules/promptsIA.js
// Monta o texto que o app copia/abre na IA (Claude, ChatGPT, Gemini…).
// Usa os mesmos números do Guia: vendas reais da Caderninho, clientes, margem por produto,
// custos fixos reais e metas. Clientes vão ANONIMIZADOS (só iniciais) — nada de nome ou telefone.

import { ROTULO_STATUS, ROTULO_GRUPO, produtosDoCliente } from './guiaNegocio.js'
import { ROTULO_PRECO } from './precoCerto.js'

export const PROMPTS = [
  { id: 'precos', titulo: 'Revisão de preços', sub: 'Quais preços ajustar, em que ordem e quanto', icon: 'fas fa-tag', bg: '#E6F1FB', cor: '#185FA5' },
  { id: 'crescimento', titulo: 'Plano de crescimento', sub: 'Como aumentar a renda nos próximos 3 meses', icon: 'fas fa-seedling', bg: '#EAF3DE', cor: '#3B6D11' },
  { id: 'carteira', titulo: 'Clientes e cobrança', sub: 'Quem cobrar, quem limitar, quem reativar', icon: 'fas fa-users', bg: '#FAEEDA', cor: '#854F0B' },
  { id: 'diagnostico', titulo: 'Diagnóstico geral', sub: 'O que está bom, o que está ruim, o que fazer primeiro', icon: 'fas fa-stethoscope', bg: '#EEEDFE', cor: '#3C3489' },
]

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const R = (n) => moedaBR.format(Math.round((Number(n) || 0) * 100) / 100).replace(/\s/g, ' ')
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const pct = (n) => (n === null || n === undefined ? 'n/d' : `${n}%`)

const iniciaisAnon = (nome) => String(nome || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase() + '.').join('')

/** Texto de contexto com os números do negócio. */
export function montarContexto({ empresa, hoje, mes, base, risco, precos, produtos, clientes, sumiram, combosJuntos, lojas, metaRetirada, tetoMei, faturadoAno, canais = null, saude = null }) {
  const L = []
  L.push(`CONTEXTO DO NEGÓCIO${empresa ? ` (${empresa})` : ''} — dados de ${hoje}`)
  L.push('- Sou MEI, confeiteira(o) artesanal. Eu produzo; minha esposa vende de porta em porta. Vendemos principalmente FIADO, anotado numa caderneta digital.')
  L.push('- ATENÇÃO: parte da produção e das vendas acontece fora do sistema. Os números abaixo são o que está registrado — não trate como o total do negócio e não conclua que "faltou dinheiro" só por diferença entre produção e caixa.')
  L.push(`- Quero crescer e ter renda estável. Minha meta de retirada mensal: ${metaRetirada > 0 ? R(metaRetirada) : 'não definida'}.`)
  L.push('')

  L.push('MÊS ATUAL (vendas registradas na caderneta)')
  L.push(`- Vendido: ${R(mes.vendido)} em ${plural(mes.qtdVendas, 'venda', 'vendas')} para ${plural(mes.clientesAtivos, 'cliente', 'clientes')} (mês em andamento)${mes.variacao !== null && mes.qtdVendas > 0 ? ` (${mes.variacao >= 0 ? '+' : ''}${mes.variacao}% vs mesmo período do mês anterior)` : ''}`)
  L.push(`- Recebido no mês: ${R(mes.recebido)} | A receber: ${R(mes.aReceber)} | Atrasado: ${R(mes.atrasado)}`)
  L.push(`- Lucro estimado do mês (preço − custo das receitas): ${R(mes.lucro)}; média recente: ${R(mes.lucroMedio)}${mes.coberturaCusto !== null ? ` (custo conhecido em ${mes.coberturaCusto}% do vendido)` : ''}`)
  L.push('')

  L.push('FINANCEIRO REAL')
  if (base.fonte === 'financeiro') {
    L.push(`- Faturamento médio mensal (${base.meses} ${base.meses === 1 ? 'mês' : 'meses'}): ${R(base.faturamentoMedio)}`)
    L.push(`- Custos fixos médios (sem compra de insumos): ${R(base.fixosMensais)}/mês = ${Math.round(base.fixosPct * 100)}% do faturamento`)
  } else {
    L.push('- Sem histórico financeiro suficiente (custos fixos assumidos em ~8% do preço).')
  }
  L.push(`- Reserva para fiado que demora: ${Math.round(risco.pct * 100)}% do preço (${risco.fonte === 'fiados' ? `há ${R(risco.parado)} parados há mais de 60 dias` : 'valor padrão, pouco histórico'})`)
  if (tetoMei > 0) L.push(`- Faturado no ano: ${R(faturadoAno)} de um teto MEI de ${R(tetoMei)} (${Math.round((faturadoAno / tetoMei) * 100)}%)`)
  L.push('')

  if (canais && canais.meses.length) {
    L.push('VENDAS POR CANAL (pelo extrato bancário: Pix recebidos como venda)')
    for (const m of canais.meses.slice(0, 3)) {
      L.push(`- ${m.mes}: entrou ${R(m.total)} — fiado recebido ${R(m.fiado)}, possível fiado ${R(m.provavel)}, à vista estimado ${R(m.avista)}`)
    }
    L.push('- (À vista = Pix que não corresponde a nenhuma cobrança da caderneta; dinheiro vivo não aparece no extrato.)')
    if (canais.pagadores.length) {
      L.push('- Quem paga à vista (anonimizado): ' + canais.pagadores.slice(0, 5).map((p, i) => `Pagador ${i + 1} (${iniciaisAnon(p.nome)}): ${plural(p.vezes, 'pagamento', 'pagamentos')}, ticket ${R(p.ticket)}${p.intervaloMedio ? `, a cada ~${p.intervaloMedio}d` : ''}`).join('; '))
    }
    L.push('')
  }

  if (saude) {
    L.push('CAIXA E CUSTOS (pelo extrato bancário)')
    const f = saude.folego
    if (f.temBase) L.push(`- Mês típico: entram ~${R(f.entradaEsperada)} e saem ~${R(f.saidas)} (insumos ${R(f.insumos)} + custos fixos e DAS ${R(f.fixos)}); sobra ~${R(f.liquidoEsperado)}. Num mês fraco sobra ${R(f.liquidoCauteloso)}.`)
    if (saude.das.temHistorico) L.push(`- DAS (por competência, vence dia 20 ou próximo dia útil): ${saude.das.estado === 'atrasado' ? `${saude.das.atrasadas.length} em aberto (o mais antigo venceu há ${saude.das.diasAtraso} dias)` : saude.das.estado === 'a-vencer' ? `em dia; o próximo vence em ${saude.das.diasParaVencer} dias` : 'todos em dia'}.`)
    if (saude.recorrentes.itens.length) L.push(`- Custos que se repetem: ${saude.recorrentes.itens.slice(0, 5).map(i => `${i.nome} ${R(i.mediaMensal)}`).join('; ')} (total ${R(saude.recorrentes.total)}/mês).`)
    const cr = saude.custoReal
    if (cr) L.push(`- Insumos: gasto real ${R(cr.insumos)}/mês${cr.insumosPct !== null ? ` (${cr.insumosPct}% do que entra)` : ''}; as produções registradas explicam ${cr.cobertura ?? 'n/d'}% disso${cr.sobraCaixaPct !== null ? `; sobra de caixa de ${cr.sobraCaixaPct}% da receita` : ''}.`)
    L.push('')
  }

  const top = produtos.slice(0, 10)
  if (top.length) {
    L.push('PRODUTOS (vendas dos últimos 90 dias)')
    for (const p of top) {
      L.push(`- ${p.nome}: ${p.qtd} un, ${R(p.faturamento)} vendidos, preço médio ${R(p.precoMedio)}` +
        `${p.sobra !== null ? `, custo ${R(p.custoUnit)}, sobra bruta ${R(p.sobra)} (${p.margem}%)` : ', custo desconhecido'} — grupo: ${ROTULO_GRUPO[p.grupo]}`)
    }
    L.push('')
  }
  const precosFora = precos.filter(p => p.status !== 'ok').slice(0, 8)
  if (precosFora.length) {
    L.push('PREÇOS QUE O APP CONSIDERA FORA DO IDEAL (conta: ingredientes + fixos + reserva fiado + o que sobra para mim)')
    for (const p of precosFora) {
      L.push(`- ${p.nome}: preço ${R(p.preco)}, custo ${R(p.custoUnit)}, sobra ${R(p.conta.sobra)} (${p.conta.sobraPct}%) — ${ROTULO_PRECO[p.status]}; piso ${R(p.piso)}, preço certo ${R(p.certo)}${p.passo ? `, próximo passo ${R(p.passo)}` : ''}`)
      for (const e of p.efeitos || []) L.push(`    · Quando subi de ${R(e.de)} para ${R(e.para)} (${e.data}), as vendas foram de ${e.porSemanaAntes} para ${e.porSemanaDepois} un/semana${e.variacaoPct !== null ? ` (${e.variacaoPct >= 0 ? '+' : ''}${e.variacaoPct}%)` : ''}`)
    }
    L.push('')
  }

  if (clientes.length) {
    const ordem = { problema: 0, atencao: 1, novo: 3, bom: 2 }
    const sel = [...clientes].filter(c => !c.arquivado)
      .sort((a, b) => (ordem[a.status] - ordem[b.status]) || b.totalComprado - a.totalComprado).slice(0, 12)
    L.push('CLIENTES DE FIADO (anonimizados)')
    sel.forEach((c, i) => {
      const leva = produtosDoCliente(c).slice(0, 3).map(p => `${p.qtdUsual} ${p.nome}`).join(', ')
      L.push(`- Cliente ${i + 1} (${iniciaisAnon(c.nome)}${c.loja ? `, ${c.loja}` : ''}): ${ROTULO_STATUS[c.status]}; ${plural(c.compras, 'compra', 'compras')}, ${R(c.totalComprado)} no total; ` +
        `${c.pctEmDia !== null ? `${c.pctEmDia}% pagas no prazo, atraso médio ${c.atrasoMedio}d; ` : ''}` +
        `${c.saldoAtrasado > 0 ? `deve ${R(c.saldoAtrasado)} vencido há ${c.diasAtrasoAtual}d; ` : ''}` +
        `última compra há ${c.diasSemComprar ?? '?'}d${leva ? `; costuma levar: ${leva}` : ''}`)
    })
    const resumo = ['bom', 'atencao', 'problema', 'novo'].map(s => `${clientes.filter(c => c.status === s && !c.arquivado).length} ${ROTULO_STATUS[s].toLowerCase()}`).join(', ')
    L.push(`- Total de clientes por perfil: ${resumo}. Pararam de comprar: ${sumiram.length}.`)
    L.push('')
  }
  if (combosJuntos.length) {
    L.push('CATEGORIAS QUE COSTUMAM SER COMPRADAS JUNTAS')
    combosJuntos.forEach(c => L.push(`- ${c.a} + ${c.b}: ${plural(c.vezes, 'venda', 'vendas')}`))
    L.push('')
  }
  if (lojas.length > 1) {
    L.push('PONTOS DE VENDA (90 dias)')
    lojas.slice(0, 6).forEach(l => L.push(`- ${l.nome}: ${R(l.vendido)} vendidos, ${l.clientes} clientes, ${l.atrasado > 0 ? `${R(l.atrasado)} atrasado` : 'sem atraso'}`))
    L.push('')
  }
  return L.join('\n').trim()
}

const REGRAS = `COMO RESPONDER
- Português simples, sem jargão. Fale como uma consultora que entende de micro negócio de doces vendido de porta em porta.
- Use SOMENTE os números acima; se faltar dado, diga qual dado falta em vez de inventar.
- Dê no máximo 5 ações, em ordem de prioridade, cada uma com: o que fazer, por que, e quanto isso pode render em reais por mês (estimativa honesta).
- Respeite que são pequenas quantidades e que só duas pessoas trabalham. Nada que exija contratar, abrir loja ou investir pesado.
- Aumentos de preço devem ser em passos pequenos e com um jeito de comunicar ao cliente.`

const TAREFAS = {
  precos: `TAREFA: REVISÃO DE PREÇOS
1. Diga quais preços ajustar primeiro e em que ordem (priorize os que vendem mais e sobram menos).
2. Para cada um, sugira o novo preço (em passos), como avisar a cliente e o que fazer se ela reclamar.
3. Use o efeito de reajustes anteriores, se houver, para dizer se meus clientes reagem a aumento.
4. Aponte produtos de margem alta que eu deveria oferecer mais. Margem baixa pode ser proposital (para criar hábito) — diga quando vale manter.
5. Diga se faz sentido ter preço diferente por quantidade ou combo, e quanto de desconto cabe sem perder margem.`,

  crescimento: `TAREFA: PLANO DE CRESCIMENTO PARA OS PRÓXIMOS 3 MESES
1. Calcule quanto preciso vender (em R$ e em unidades por semana) para chegar à minha meta de retirada, dada a margem atual.
2. Liste as alavancas mais fáceis: preço, combos, reativar clientes que pararam, vender mais para os bons clientes, novos pontos de venda.
3. Monte um plano semanal simples (o que eu e minha esposa fazemos em cada semana).
4. Diga o que PARAR de fazer (produto, cliente ou hábito que consome esforço sem retorno).
5. Considere o teto do MEI: diga se estou perto e o que mudaria se eu crescesse acima dele.`,

  carteira: `TAREFA: CLIENTES E COBRANÇA
1. Diga quem devo cobrar primeiro e como (mensagem curta de WhatsApp para cada situação: lembrete amigável, segunda cobrança, última tentativa).
2. Defina uma regra simples de fiado para mim: limite por perfil de cliente, prazo e o que fazer quando atrasa.
3. Diga quais clientes merecem mais atenção (compram bastante e pagam bem) e como valorizá-los sem dar desconto à toa.
4. Sugira uma mensagem para reativar quem parou de comprar.
5. Sugira combos para os melhores clientes com base no que cada um costuma levar.`,

  diagnostico: `TAREFA: DIAGNÓSTICO GERAL
1. Pontos fortes e fracos do meu negócio hoje, com base nos números.
2. Onde estou deixando dinheiro na mesa (preço, fiado parado, clientes que sumiram, produtos de pouca margem).
3. O que fazer PRIMEIRO, SEGUNDO e TERCEIRO nas próximas 4 semanas.
4. Quais números eu deveria acompanhar toda semana (no máximo 4) e qual valor seria bom.
5. Quais dados estão faltando no sistema e que atrapalham essas conclusões.`,
}

export function gerarPrompt(id, contexto) {
  return `${contexto}\n\n${TAREFAS[id] || TAREFAS.diagnostico}\n\n${REGRAS}`
}
