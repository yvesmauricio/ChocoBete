// modules/realidadeExtrato.js
// "Relação entre o provável e a realidade": usa o EXTRATO (o que de fato entrou e saiu em dinheiro)
// como verdade, e a Caderneta/produção como AMOSTRA para transformar esse dinheiro em unidades.
//
//   dinheiro real (extrato)  ÷  preço médio por unidade (Caderneta)  =  volume provável (un/semana)
//
// O dinheiro é fato. O volume é ESTIMATIVA: supõe que as vendas fora da Caderneta (à vista) têm a
// mesma mistura de produtos e os mesmos preços das que você registra. Por isso sempre vem com faixa
// (do pior ao melhor mês) e com avisos. Funções PURAS: sem banco, sem tela.

import { categoriaDoItem } from './guiaNegocio.js'

const SEMANAS_POR_MES = 4.33
const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)
const cap = (f) => (f ? f.charAt(0).toUpperCase() + f.slice(1) : 'Geral')
const isoMes = (mesRef) => { const [m, a] = String(mesRef).split('/'); return `${a}-${m}` } // "11/2026" → "2026-11"
const ultimoDia = (isoMesStr) => { const [a, m] = isoMesStr.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) }
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000)

export const ROTULO_NIVEL_REAL = { baixa: 'baixa', media: 'média', boa: 'boa', nenhum: '—' }

const VAZIO = { disponivel: false, meses: 0, nivel: 'nenhum', avisos: [] }

/**
 * @param relatorio  s.relatorioMensalMei (mais recente primeiro; mes_ref "MM/AAAA")
 * @param conc       resultado de conciliar() (usa conc.meses: fiado/provável/à vista por mês)
 * @param produtos   analisarProdutos() — preço médio e participação por categoria
 * @param producao   analisarProducao() — produção semanal registrada
 * @param fiados     vendas da Caderneta
 */
export function analisarRealidade({ relatorio = [], conc = null, produtos = [], producao = null, fiados = [], hoje }) {
  // ── Meses usados: mesmos da base financeira do app (até 3 fechados; senão o atual, parcial) ──
  const [a, m] = String(hoje).slice(0, 7).split('-')
  const mesAtual = `${m}/${a}`
  const comReceita = (relatorio || []).filter(r => Number(r.receitas_mei) > 0)
  const fechados = comReceita.filter(r => r.mes_ref !== mesAtual).slice(0, 3)
  const usados = fechados.length ? fechados : comReceita.slice(0, 1)
  if (!usados.length) return VAZIO
  const parcial = !fechados.length
  const n = usados.length

  const detalhe = usados.map(r => ({
    mesRef: r.mes_ref, mesIso: isoMes(r.mes_ref),
    receita: c2(r.receitas_mei), saidas: c2(r.saidas_operacionais), insumos: c2(r.saidas_insumos),
    resultado: c2(Number(r.receitas_mei || 0) - Number(r.saidas_operacionais || 0)),
    aClassificarQtd: Number(r.a_classificar_qtd || 0), aClassificarValor: c2(r.a_classificar_valor),
  })).reverse() // do mais antigo ao mais recente

  const soma = (k) => detalhe.reduce((s, d) => s + d[k], 0)
  const receitaMedia = c2(soma('receita') / n)
  const saidasMedia = c2(soma('saidas') / n)
  const insumosMedio = c2(soma('insumos') / n)
  const resultadoCaixaMedio = c2(receitaMedia - saidasMedia)
  const receitaMin = Math.min(...detalhe.map(d => d.receita))
  const receitaMax = Math.max(...detalhe.map(d => d.receita))
  const aClassificar = { qtd: soma('aClassificarQtd'), valor: c2(soma('aClassificarValor')) }

  // ── Composição do que entrou: fiado (Caderneta) × à vista (fora da Caderneta) ──
  let composicao = null
  const isos = new Set(detalhe.map(d => d.mesIso))
  const cm = (conc?.meses || []).filter(x => isos.has(x.mes))
  if (cm.length) {
    const t = cm.reduce((s, x) => s + x.total, 0)
    if (t > 0) {
      const f = cm.reduce((s, x) => s + x.fiado, 0), p = cm.reduce((s, x) => s + x.provavel, 0), v = cm.reduce((s, x) => s + x.avista, 0)
      composicao = { fiadoPct: pct(f, t), provavelPct: pct(p, t), avistaPct: pct(v, t), avistaMedia: c2(v / cm.length) }
    }
  }

  // ── Mistura e preço médio por categoria (da Caderneta) ──
  const porFam = new Map()
  for (const p of produtos || []) {
    if (!(p.qtd > 0) || !(p.faturamento > 0)) continue
    const fam = categoriaDoItem({ nome: p.nome }).fam
    if (!porFam.has(fam)) porFam.set(fam, { fam, qtd: 0, fat: 0 })
    const g = porFam.get(fam); g.qtd += p.qtd; g.fat += p.faturamento
  }
  const fatTotal = [...porFam.values()].reduce((s, g) => s + g.fat, 0)

  const prodPorFam = new Map((producao?.categorias || []).map(c => [c.fam, c.mediaSemana]))
  const receitaSem = receitaMedia / SEMANAS_POR_MES
  const fMin = receitaMin / receitaMedia, fMax = receitaMax / receitaMedia

  let volume = null, cobertura = null
  if (fatTotal > 0) {
    const categorias = [...porFam.values()].map(g => {
      const preco = g.fat / g.qtd
      const share = g.fat / fatTotal
      const unSem = (receitaSem * share) / preco
      const prod = prodPorFam.has(g.fam) ? prodPorFam.get(g.fam) : null
      return { fam: g.fam, rotulo: cap(g.fam), preco: c2(preco), sharePct: Math.round(share * 100), unSem: r1(unSem), producaoSem: prod, coberturaPct: prod !== null ? pct(prod, unSem) : null }
    }).sort((x, y) => y.sharePct - x.sharePct)
    const totalSem = categorias.reduce((s, c) => s + c.unSem, 0)
    volume = {
      totalSem: r1(totalSem), minSem: r1(totalSem * fMin), maxSem: r1(totalSem * fMax),
      precoMedio: c2(fatTotal / [...porFam.values()].reduce((s, g) => s + g.qtd, 0)),
      categorias,
    }

    // Cobertura: quanto do volume provável a Caderneta e a produção registrada "enxergam"
    const inicio = detalhe[0].mesIso + '-01'
    const fim = parcial ? String(hoje).slice(0, 10) : ultimoDia(detalhe[detalhe.length - 1].mesIso)
    const semanasJanela = Math.max(1, (diasEntre(inicio, fim) + 1) / 7)
    let vendidas = 0
    for (const f of fiados || []) {
      const d = String(f.dataVenda || '').slice(0, 10)
      if (d < inicio || d > fim) continue
      for (const it of f.itens || []) vendidas += Number(it.qty ?? it.qtd ?? 1) || 0
    }
    const vendasSem = r1(vendidas / semanasJanela)
    const comProducao = categorias.filter(c => c.producaoSem !== null)
    const provComProd = comProducao.reduce((s, c) => s + c.unSem, 0)
    const prodSem = comProducao.reduce((s, c) => s + c.producaoSem, 0)
    cobertura = {
      vendasRegistradasSem: vendasSem, vendasPct: pct(vendasSem, totalSem),
      producaoPct: provComProd > 0 ? pct(prodSem, provComProd) : null,
      producaoRegistradaSem: r1(prodSem),
      semProducao: categorias.filter(c => c.producaoSem === null).map(c => c.rotulo),
    }
  }

  // ── Confiança e avisos (sempre honestos) ──
  const avisos = []
  let nivel = n >= 3 ? 'boa' : n === 2 ? 'media' : 'baixa'
  if (parcial) avisos.push('Só existe o mês atual, que ainda não fechou: os números são provisórios.')
  if (n < 3 && !parcial) avisos.push(`Só ${n} mês${n > 1 ? 'es' : ''} fechado${n > 1 ? 's' : ''} no extrato: quanto mais meses, mais firme a média.`)
  if (receitaMedia > 0 && (receitaMax - receitaMin) / receitaMedia > 0.5) { avisos.push('As entradas variam muito de um mês para o outro; veja a faixa, não só a média.'); if (nivel === 'boa') nivel = 'media' }
  if (aClassificar.qtd > 0) avisos.push(`${aClassificar.qtd} lançamento${aClassificar.qtd > 1 ? 's' : ''} (R$ ${aClassificar.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) ainda "a classificar" contam como despesa: o resultado pode estar subestimado até você classificar.`)
  if (!volume) avisos.push('Sem vendas registradas na Caderneta não dá para converter o dinheiro em unidades.')
  else if (cobertura?.semProducao?.length) avisos.push(`Sem produção registrada de: ${cobertura.semProducao.join(', ')}. A comparação com a produção só vale para o que você registra.`)
  if (volume) avisos.push('Volume em unidades é estimativa: supõe que as vendas fora da Caderneta têm a mesma mistura e os mesmos preços das registradas. Entrada que não seja venda (reembolso, empréstimo) infla o número.')

  return {
    disponivel: true, parcial, meses: n, nivel, detalhe,
    receitaMedia, receitaMin: c2(receitaMin), receitaMax: c2(receitaMax),
    saidasMedia, insumosMedio, resultadoCaixaMedio,
    composicao, aClassificar, volume, cobertura, avisos,
  }
}

/** Quanto o aumento pretendido pesa sobre o volume provável (para a pessoa ver se é proporcional). */
export function pesoDoAumento(aumentoUnidSemana, real) {
  const a = Number(aumentoUnidSemana) || 0
  const base = real?.volume?.totalSem || 0
  if (!(a > 0) || !(base > 0)) return null
  return { pct: Math.round((a / base) * 100), base }
}

/** Linhas de texto para o prompt da IA. */
export function linhasRealidade(real) {
  if (!real?.disponivel) return ['REALIDADE PELO EXTRATO', '- Ainda não há receitas de vendas no extrato para servir de base.']
  const R = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const N = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const L = [`REALIDADE PELO EXTRATO (${real.meses} ${real.meses === 1 ? 'mês' : 'meses'}${real.parcial ? ', mês atual parcial' : ''}; confiança ${ROTULO_NIVEL_REAL[real.nivel]})`]
  L.push(`- Entradas de vendas: média ${R(real.receitaMedia)}/mês (de ${R(real.receitaMin)} a ${R(real.receitaMax)}). Saídas operacionais: média ${R(real.saidasMedia)}/mês. Resultado de caixa: ${R(real.resultadoCaixaMedio)}/mês.`)
  if (real.composicao) {
    const c = real.composicao
    L.push(`- O que entrou: ${c.fiadoPct}% pagamentos da Caderneta, ${c.provavelPct}% prováveis da Caderneta, ${c.avistaPct}% à vista fora da Caderneta.`)
  }
  if (real.volume) {
    L.push(`- Volume provável: ${N(real.volume.totalSem)} un/semana (faixa ${N(real.volume.minSem)} a ${N(real.volume.maxSem)}), pelo preço médio de ${R(real.volume.precoMedio)} da Caderneta. Por categoria: ` + real.volume.categorias.map(c => `${c.rotulo} ${N(c.unSem)}/sem`).join('; ') + '.')
    if (real.cobertura) {
      L.push(`- A Caderneta registra ≈ ${real.cobertura.vendasPct ?? '?'}% desse volume em vendas${real.cobertura.producaoPct !== null ? `; a produção registrada cobre ≈ ${real.cobertura.producaoPct}% do volume provável das categorias que registro` : ''}.`)
    }
  }
  L.push('- O dinheiro vem do extrato (fato); o volume em unidades é estimativa. Não trate como contagem exata.')
  return L
}
