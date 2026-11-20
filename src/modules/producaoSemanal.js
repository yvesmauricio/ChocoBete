// modules/producaoSemanal.js
// Lê a PRODUÇÃO REGISTRADA (tabela producoes) e responde: quanto eu produzo por semana,
// qual foi minha melhor semana e se o que produzo está saindo (vendas da Caderninho).
// Funções PURAS: recebem os dados e devolvem números. Nada aqui lê banco nem mexe na tela.
//
// Limites honestos (a tela e os textos repetem isso):
//  - só conta o que foi REGISTRADO; categorias novas (ex.: bolos) entram sozinhas quando passarem a ser registradas;
//  - só conta receitas em UNIDADE (receitas em g/kg/ml ficam de fora e são avisadas);
//  - receitas intermediárias (massa, ganache, recheio) não contam: não são produto vendido;
//  - vendas à vista/dinheiro que não estão na Caderninho não aparecem na comparação.

import { familia, categoriaDoItem, norm } from './guiaNegocio.js'

const DIA = 86400000
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10
const ehIso = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))
const UNIDADES_OK = new Set(['un', 'unidade', 'unidades', 'und'])

/** Dia (AAAA-MM-DD) no fuso do aparelho. Datas guardadas em UTC (…Z) não "pulam" para o dia seguinte à noite. */
export function diaLocal(v) {
  const t = String(v || '')
  if (/T.*(Z|[+-]\d\d:?\d\d)$/.test(t)) {
    const d = new Date(t)
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }
  return t.slice(0, 10)
}

/** Segunda-feira da semana de uma data AAAA-MM-DD. */
export function inicioSemana(iso) {
  const d = new Date(iso + 'T12:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // segunda = 0
  return new Date(d.getTime() - dow * DIA).toISOString().slice(0, 10)
}
const somaSemanas = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 7 * DIA).toISOString().slice(0, 10)
const somaDias = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * DIA).toISOString().slice(0, 10)
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const rotuloFam = (f) => (f ? f.charAt(0).toUpperCase() + f.slice(1) : 'Geral')

const VAZIO = (extra = {}) => ({
  semanas: 0, parcial: false, nivel: 'nenhum', mediaSemana: 0, melhorSemana: null, semanasSemProducao: 0,
  categorias: [], tendencia: null, vendas: null, sugestao: null, periodo: null, ignoradasOutraUnidade: 0, ...extra,
})

/**
 * @param producoes  linhas de db.producoes
 * @param receitas   [{ uuid, nome, categoria, unidade_rendimento, eh_intermediaria }] (TODAS, inclusive intermediárias)
 * @param fiados     vendas da Caderninho (para comparar com o que foi vendido)
 * @param hoje       AAAA-MM-DD
 */
export function analisarProducao({ producoes = [], receitas = [], fiados = [], hoje, janelaSemanas = 12 }) {
  const porUuid = new Map((receitas || []).map(r => [r.uuid, r]))
  const linhas = []
  let ignoradasOutraUnidade = 0

  for (const p of producoes || []) {
    if (p.eh_intermediaria) continue
    const r = porUuid.get(p.receita_id)
    if (r?.eh_intermediaria) continue
    const data = diaLocal(p.data_producao)
    if (!ehIso(data) || data > hoje) continue
    const qtd = Number(p.quantidade_produzida || p.quantidade || 0)
    if (!(qtd > 0)) continue
    const un = norm(p.unidade_rendimento || r?.unidade_rendimento || 'un')
    if (!UNIDADES_OK.has(un)) { ignoradasOutraUnidade++; continue }
    const nome = p.nome_receita || p.receita_nome || r?.nome || ''
    const fam = categoriaDoItem({ nome, categoria: r?.categoria || '' }).fam
    linhas.push({ data, semana: inicioSemana(data), qtd, fam })
  }
  if (!linhas.length) return VAZIO({ ignoradasOutraUnidade })

  // Janela: da primeira semana com produção (no máx. `janelaSemanas` atrás) até a última semana COMPLETA.
  // Semanas paradas no meio contam como zero (senão a média ficaria otimista).
  const semAtual = inicioSemana(hoje)
  const primeira = linhas.reduce((m, l) => (l.semana < m ? l.semana : m), linhas[0].semana)
  let fim = somaSemanas(semAtual, -1)
  let parcial = false
  if (primeira > fim) { fim = semAtual; parcial = true } // só existe a semana atual (ainda incompleta)
  let inicio = somaSemanas(fim, -(janelaSemanas - 1))
  if (inicio < primeira) inicio = primeira

  const semanasLista = []
  for (let s = inicio; s <= fim; s = somaSemanas(s, 1)) semanasLista.push(s)
  const n = semanasLista.length
  const idx = new Map(semanasLista.map((s, i) => [s, i]))

  const totalSem = new Array(n).fill(0)
  const porFam = new Map()
  for (const l of linhas) {
    const i = idx.get(l.semana)
    if (i === undefined) continue
    totalSem[i] += l.qtd
    if (!porFam.has(l.fam)) porFam.set(l.fam, new Array(n).fill(0))
    porFam.get(l.fam)[i] += l.qtd
  }
  const total = totalSem.reduce((a, b) => a + b, 0)
  if (!(total > 0)) return VAZIO({ ignoradasOutraUnidade })

  const mediaSemana = total / n
  let iMelhor = 0
  totalSem.forEach((q, i) => { if (q > totalSem[iMelhor]) iMelhor = i })
  const melhorSemana = { semana: semanasLista[iMelhor], qtd: totalSem[iMelhor] }

  const categorias = [...porFam.entries()].map(([fam, arr]) => {
    const t = arr.reduce((a, b) => a + b, 0)
    return { fam, rotulo: rotuloFam(fam), total: t, mediaSemana: r1(t / n), melhorSemana: Math.max(...arr), semanasAtivas: arr.filter(q => q > 0).length }
  }).sort((a, b) => b.total - a.total)

  // Tendência: últimas 3 semanas × as anteriores (precisa de pelo menos 6 semanas)
  let tendencia = null
  if (n >= 6) {
    const ult = totalSem.slice(-3).reduce((a, b) => a + b, 0) / 3
    const ant = totalSem.slice(0, -3).reduce((a, b) => a + b, 0) / (n - 3)
    tendencia = { ultimas3: r1(ult), anteriores: r1(ant), variacaoPct: ant > 0 ? Math.round(((ult - ant) / ant) * 100) : null }
  }

  // Vendas registradas das MESMAS categorias nas MESMAS semanas
  const fams = new Set(porFam.keys())
  const limiteVenda = somaSemanas(fim, 1) // exclusivo
  let vendidas = 0
  for (const f of fiados || []) {
    const d = diaLocal(f.dataVenda)
    if (!ehIso(d) || d < inicio || d >= limiteVenda) continue
    for (const it of f.itens || []) {
      const q = Number(it.qty ?? it.qtd ?? 1) || 0
      if (q > 0 && fams.has(categoriaDoItem(it).fam)) vendidas += q
    }
  }
  const vendas = {
    mediaSemana: r1(vendidas / n),
    relacaoPct: mediaSemana > 0 ? Math.round((vendidas / n / mediaSemana) * 100) : null,
  }

  // Sugestão de ponto de partida: o que já foi feito numa semana forte, acima da média.
  // NÃO mede demanda — é só capacidade já provada.
  const folga = Math.round(melhorSemana.qtd - mediaSemana)
  const nivel = n < 3 ? 'baixa' : n < 8 ? 'media' : 'boa'
  const sugestao = n >= 3 && folga >= 1 ? folga : null

  return {
    semanas: n, parcial, nivel,
    mediaSemana: r1(mediaSemana), melhorSemana,
    semanasSemProducao: totalSem.filter(q => q === 0).length,
    categorias, tendencia, vendas, sugestao,
    periodo: { de: semanasLista[0], ate: somaDias(semanasLista[n - 1], 6) },
    ignoradasOutraUnidade,
  }
}

export const ROTULO_NIVEL = { baixa: 'baixa', media: 'média', boa: 'boa', nenhum: '—' }

/** Linhas de texto para o prompt da IA (e para qualquer relatório). */
export function linhasProducao(prod) {
  if (!prod || !prod.semanas) {
    return ['PRODUÇÃO REGISTRADA', '- Ainda não há produção registrada em unidades; não dá para estimar o aumento com base em dados.']
  }
  const L = []
  L.push(`PRODUÇÃO REGISTRADA (${prod.semanas} ${prod.semanas === 1 ? 'semana' : 'semanas'}${prod.parcial ? ', só a semana atual' : ''}; de ${ddmm(prod.periodo.de)} a ${ddmm(prod.periodo.ate)}; confiança ${ROTULO_NIVEL[prod.nivel]})`)
  L.push(`- Média: ${prod.mediaSemana} un/semana. Melhor semana: ${prod.melhorSemana.qtd} un (semana de ${ddmm(prod.melhorSemana.semana)}). Semanas sem produção: ${prod.semanasSemProducao}.`)
  if (prod.categorias.length) L.push('- Por categoria (média/semana): ' + prod.categorias.map(c => `${c.rotulo} ${c.mediaSemana}`).join('; '))
  if (prod.tendencia) {
    const v = prod.tendencia.variacaoPct
    L.push(`- Últimas 3 semanas: ${prod.tendencia.ultimas3} un/semana contra ${prod.tendencia.anteriores} antes${v !== null ? ` (${v >= 0 ? '+' : ''}${v}%)` : ''}.`)
  }
  if (prod.vendas && prod.vendas.mediaSemana >= 0) {
    L.push(`- Vendas registradas na Caderninho das mesmas categorias: ${prod.vendas.mediaSemana} un/semana${prod.vendas.relacaoPct !== null ? ` (${prod.vendas.relacaoPct}% do produzido)` : ''}. Venda à vista/dinheiro pode não estar registrada.`)
  }
  if (prod.sugestao) L.push(`- Na melhor semana produzi ${prod.sugestao} un a mais que a média (capacidade já provada; não mede demanda).`)
  L.push('- Só entram categorias já registradas (bolos e outras entram quando eu começar a registrar). Receitas em g/kg e receitas intermediárias ficam de fora.')
  if (prod.ignoradasOutraUnidade) L.push(`- ${prod.ignoradasOutraUnidade} registro(s) em outra unidade (g/kg/ml) foram ignorados.`)
  return L
}
