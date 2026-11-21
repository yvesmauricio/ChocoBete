// modules/propostaInvestimento.js
// Proposta de investimento para o Pix MEI (programa Prospera MEI).
// Funções PURAS: recebem os números que o app já calcula (Guia do negócio / Preço certo)
// e devolvem o que a tela e o documento precisam. Nada aqui lê banco nem mexe na tela.
//
// ATENÇÃO: as regras do Pix MEI ainda não foram publicadas em edital (previsto para o fim de 2026,
// repasses a partir de 2027). O que está aqui segue o que a imprensa divulgou: repasse a fundo
// perdido de até R$ 5 mil para investimento produtivo, com proposta de investimento,
// acompanhamento técnico (Sebrae) e comprovação por nota fiscal. Quando o edital sair, ajuste
// LIMITE_PIX_MEI e os TIPOS_ITEM abaixo.

import { linhasProducao } from './producaoSemanal.js'
import { linhasRealidade } from './realidadeExtrato.js'

const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/** Valor máximo noticiado por MEI (única vez). Confirmar no edital. */
export const LIMITE_PIX_MEI = 5000
export const SEMANAS_POR_MES = 4.33
export const CHAVE_PROPOSTA = 'proposta_investimento_pix_mei'

// O programa fala em "investimento produtivo": máquinas, ferramentas, equipamentos, melhorias estruturais.
// Compra de ingredientes/embalagem (giro) provavelmente NÃO entra — por isso não há esse tipo aqui.
export const TIPOS_ITEM = [
  { id: 'equipamento', rotulo: 'Equipamento / máquina' },
  { id: 'ferramenta', rotulo: 'Ferramenta / utensílio' },
  { id: 'melhoria', rotulo: 'Melhoria estrutural' },
]
export const rotuloTipo = (id) => TIPOS_ITEM.find(t => t.id === id)?.rotulo || 'Outro'

let seq = 0
export const novoItem = () => ({
  id: `it_${Date.now().toString(36)}_${seq++}`,
  descricao: '', tipo: 'equipamento', valor: 0, motivo: '',
})

export const propostaVazia = () => ({
  itens: [novoItem()],
  oQueFaz: '',            // o que o negócio produz/vende e para quem
  problema: '',           // o gargalo de hoje, que o investimento resolve
  resultado: '',          // o que muda depois da compra
  aumentoUnidSemana: 0,   // estimativa: unidades a mais por semana
  atualizadoEm: '',
})

/** Aceita o que veio do banco (pode estar incompleto/antigo) e devolve uma proposta válida. */
export function normalizarProposta(raw) {
  const base = propostaVazia()
  if (!raw || typeof raw !== 'object') return base
  const itens = Array.isArray(raw.itens) && raw.itens.length
    ? raw.itens.map(i => ({
        id: String(i?.id || novoItem().id),
        descricao: String(i?.descricao || ''),
        tipo: TIPOS_ITEM.some(t => t.id === i?.tipo) ? i.tipo : 'equipamento',
        valor: Math.max(0, Number(i?.valor) || 0),
        motivo: String(i?.motivo || ''),
      }))
    : base.itens
  return {
    itens,
    oQueFaz: String(raw.oQueFaz || ''),
    problema: String(raw.problema || ''),
    resultado: String(raw.resultado || ''),
    aumentoUnidSemana: Math.max(0, Number(raw.aumentoUnidSemana) || 0),
    atualizadoEm: String(raw.atualizadoEm || ''),
  }
}

export const totalInvestimento = (itens) => c2((itens || []).reduce((s, i) => s + (Number(i.valor) || 0), 0))

/** Sobra média por unidade vendida (preço − custo da receita), ponderada pela quantidade.
 *  Só considera produtos com custo conhecido. Devolve 0 se não der para calcular. */
export function sobraMediaPorUnidade(produtos) {
  let qtd = 0, soma = 0
  for (const p of produtos || []) {
    if (p.sobra === null || p.sobra === undefined || !(p.qtd > 0)) continue
    qtd += p.qtd; soma += p.sobra * p.qtd
  }
  return qtd > 0 ? c2(soma / qtd) : 0
}

/** Retorno estimado do investimento: quanto a mais entra por mês e em quanto tempo se paga.
 *  É uma ESTIMATIVA: depende do aumento de unidades que a própria pessoa informou. */
export function retornoEstimado({ total, aumentoUnidSemana, sobraUnit }) {
  const t = Number(total) || 0, a = Number(aumentoUnidSemana) || 0, s = Number(sobraUnit) || 0
  if (!(t > 0) || !(a > 0) || !(s > 0)) return null
  const ganhoMes = c2(a * SEMANAS_POR_MES * s)
  return { ganhoMes, paybackMeses: Math.round((t / ganhoMes) * 10) / 10, aumentoUnidMes: Math.round(a * SEMANAS_POR_MES) }
}

/** Números do negócio que entram na proposta (só o que o app sabe de verdade). */
export function resumoParaProposta({ base, mes, produtos, tetoMei, faturadoAno }) {
  const registrado = base?.fonte === 'financeiro'
  const top = (produtos || []).slice(0, 5).map(p => ({
    nome: p.nome, qtd: p.qtd, faturamento: p.faturamento, margem: p.margem,
  }))
  const teto = Number(tetoMei) || 0
  const fat = Number(faturadoAno) || 0
  return {
    registrado,
    meses: registrado ? base.meses : 0,
    faturamentoMedio: registrado ? c2(base.faturamentoMedio) : 0,
    fixosMensais: registrado ? c2(base.fixosMensais) : 0,
    lucroMedio: c2(mes?.lucroMedio),
    coberturaCusto: mes?.coberturaCusto ?? null,
    sobraUnit: sobraMediaPorUnidade(produtos),
    produtos: top,
    tetoMei: teto,
    faturadoAno: c2(fat),
    pctTeto: teto > 0 ? Math.round((fat / teto) * 100) : null,
  }
}

/** O que ainda falta preencher. Não bloqueia nada: só avisa. */
export function pendencias(proposta, resumo, limite = LIMITE_PIX_MEI) {
  const p = []
  const itens = proposta?.itens || []
  const preenchidos = itens.filter(i => i.descricao.trim() || i.valor > 0)
  if (!preenchidos.length) p.push('Adicione pelo menos um item que você pretende comprar.')
  for (const [n, i] of preenchidos.entries()) {
    const nome = i.descricao.trim() || `Item ${n + 1}`
    if (!i.descricao.trim()) p.push(`Item ${n + 1}: falta dizer o que é.`)
    else if (!(i.valor > 0)) p.push(`${nome}: falta o valor.`)
    if (!i.motivo.trim()) p.push(`${nome}: explique por que precisa dele.`)
  }
  const total = totalInvestimento(itens)
  if (total > limite) p.push(`O total passa do limite divulgado de R$ ${limite.toLocaleString('pt-BR')}. Reduza ou separe o que fica por sua conta.`)
  if (!proposta?.oQueFaz.trim()) p.push('Conte o que o seu negócio produz e vende.')
  if (!proposta?.problema.trim()) p.push('Diga qual o problema de hoje que o investimento resolve.')
  if (!proposta?.resultado.trim()) p.push('Descreva o que muda depois da compra.')
  if (!(proposta?.aumentoUnidSemana > 0)) p.push('Estime quantas unidades a mais você faria por semana.')
  else if (resumo && !(resumo.sobraUnit > 0)) p.push('O app ainda não tem custo das receitas suficiente para estimar o retorno.')
  return p
}

/** Texto para pedir a uma IA que REDIJA a proposta (os números vão junto; clientes anonimizados). */
export function montarPromptProposta({ contexto, proposta, total, producao = null, realidade = null }) {
  const R = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0).replace(/\s/g, ' ')
  const L = []
  L.push(contexto)
  L.push('')
  L.push(...linhasRealidade(realidade))
  L.push('')
  L.push(...linhasProducao(producao))
  L.push('')
  L.push('MEU RASCUNHO DE PROPOSTA DE INVESTIMENTO')
  const itens = (proposta.itens || []).filter(i => i.descricao.trim() || i.valor > 0)
  if (itens.length) {
    L.push(`- Total pretendido: ${R(total)}`)
    for (const i of itens) {
      L.push(`- Item: ${i.descricao.trim() || '(sem nome)'} (${rotuloTipo(i.tipo)}) — ${R(i.valor)}${i.motivo.trim() ? ` — motivo: ${i.motivo.trim()}` : ''}`)
    }
  } else {
    L.push('- Ainda não escolhi os itens.')
  }
  L.push(`- O que faço: ${proposta.oQueFaz.trim() || 'não preenchi'}`)
  L.push(`- Problema de hoje: ${proposta.problema.trim() || 'não preenchi'}`)
  L.push(`- O que espero depois: ${proposta.resultado.trim() || 'não preenchi'}`)
  L.push(`- Unidades a mais por semana (minha estimativa): ${proposta.aumentoUnidSemana > 0 ? proposta.aumentoUnidSemana : 'não estimei'}`)
  L.push('')
  L.push(`TAREFA: REDIGIR A PROPOSTA DE INVESTIMENTO PARA O PIX MEI
Contexto: o governo federal anunciou o Pix MEI (pacote Prospera MEI): repasse a fundo perdido de até R$ 5 mil, uma única vez, para investimento produtivo (máquinas, ferramentas, equipamentos, melhorias estruturais), com proposta de investimento, acompanhamento técnico do Sebrae e comprovação do gasto por nota fiscal. O edital com as regras definitivas AINDA NÃO saiu; não afirme regras que eu não citei.
1. Escreva o texto "Sobre o meu negócio" (5 a 7 linhas, primeira pessoa), usando só os números acima.
2. Para cada item, escreva a justificativa em 2 ou 3 frases: que gargalo resolve e o que muda na produção.
3. Escreva "Resultado esperado" com números honestos (use minha sobra por unidade e minha estimativa de unidades a mais; mostre a conta). Trate o dinheiro do EXTRATO como fato e o volume em unidades como estimativa. Compare minha estimativa com o VOLUME PROVÁVEL e com a PRODUÇÃO REGISTRADA acima: diga se o aumento é proporcional (quantos % sobre o volume atual) e se parece realista, e se as vendas registradas acompanham a produção (se vendo menos do que produzo, avise que o gargalo pode não ser a produção). Se faltar dado, diga qual.
4. Aponte o que um técnico do Sebrae provavelmente perguntaria e que eu ainda não respondi.
5. Avise se algum item parece NÃO ser investimento produtivo (ex.: ingredientes, embalagens, contas) ou se o total passa de R$ 5 mil.

COMO RESPONDER
- Português simples, sem jargão, em primeira pessoa.
- Use SOMENTE os números acima. Não invente faturamento, clientes ou prazos.
- Parte da produção e das vendas acontece fora do sistema: não trate os números registrados como o total do negócio; o extrato é a referência de dinheiro.
- Não prometa aprovação nem valor; é um rascunho para eu revisar.`)
  return L.join('\n')
}
