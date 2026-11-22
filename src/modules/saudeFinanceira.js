// modules/saudeFinanceira.js
// Saúde do caixa do MEI a partir do EXTRATO (Financeiro) + Caderneta + produções.
//   1) custoRealVsReceitas → quanto você gasta de insumos de verdade × o que as produções registradas explicam
//   2) custosRecorrentes   → despesas que se repetem todo mês (viram a lista de custos fixos reais)
//   3) statusDas           → DAS do mês: pago, vence em breve ou atrasado
//   4) folegoDeCaixa       → o que deve entrar e sair nos próximos 30 dias
// Funções PURAS (sem banco, sem tela).

import { norm, diasEntre, somaDias } from './guiaNegocio.js'

const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const dia = (iso) => String(iso || '').slice(0, 10)
const mesRefDe = (iso) => `${dia(iso).slice(5, 7)}/${dia(iso).slice(0, 4)}` // 'MM/AAAA', igual ao Financeiro
const mesYm = (iso) => dia(iso).slice(0, 7)                                  // 'AAAA-MM'
const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
const CATEGORIAS_DAS = new Set(['DAS-MEI', 'Impostos e Contribuições'])

/** Meses fechados mais recentes do relatório (sem o mês corrente), até `n`. */
function mesesFechados(relatorio, hoje, n = 3, filtro = () => true) {
  const mesAtual = mesRefDe(hoje)
  const lista = (relatorio || []).filter(r => filtro(r))
  const fechados = lista.filter(r => r.mes_ref !== mesAtual).slice(0, n)
  return fechados.length ? fechados : lista.slice(0, 1)
}

// ── 1) Custo real × custo das receitas ───────────────────────
/** Compara o que saiu do banco em insumos com o custo de ingredientes das produções registradas. */
export function custoRealVsReceitas({ relatorio = [], producoes = [], receitas = [], hoje }) {
  const meses = mesesFechados(relatorio, hoje, 3, r => Number(r.saidas_insumos) > 0 || Number(r.receitas_mei) > 0)
  if (!meses.length) return null
  const refs = new Set(meses.map(m => m.mes_ref))
  const porUuid = new Map(receitas.map(r => [r.uuid, r]))
  let produzido = 0, valorProduzido = 0
  for (const p of producoes) {
    if (!p.data_producao || !refs.has(mesRefDe(p.data_producao))) continue
    const r = porUuid.get(p.receita_id)
    if (!r || r.intermediaria) continue
    const q = Number(p.quantidade_produzida || p.quantidade || 0)
    produzido += q * r.custoUnit
    valorProduzido += q * (Number(p.preco_unitario_snapshot) || r.preco || 0)
  }
  const n = meses.length
  const insumos = media(meses.map(m => Number(m.saidas_insumos || 0)))
  const receita = media(meses.map(m => Number(m.receitas_mei || 0)))
  const operacional = media(meses.map(m => Number(m.saidas_operacionais || 0)))
  const producaoMedia = produzido / n
  const cobertura = insumos > 0 ? producaoMedia / insumos : null
  let nivel = 'sem-dados', leitura = ''
  if (insumos > 0 && producaoMedia > 0) {
    if (cobertura >= 0.85) { nivel = 'ok'; leitura = 'As produções registradas explicam quase tudo o que você gasta com insumos. Seus custos de receita estão confiáveis.' }
    else if (cobertura >= 0.5) { nivel = 'atencao'; leitura = `Cerca de ${Math.round((1 - cobertura) * 100)}% do que você gasta com insumos não aparece nas produções registradas. Pode ser produção feita fora do sistema, estoque sobrando ou perdas.` }
    else { nivel = 'alerta'; leitura = `A maior parte do gasto com insumos (${Math.round((1 - Math.min(1, cobertura)) * 100)}%) não passa pelas produções registradas. Provavelmente muita produção acontece fora do sistema — então os custos e margens por receita mostram só uma parte do negócio.` }
  } else if (insumos > 0) {
    nivel = 'sem-producao'; leitura = 'Há gasto com insumos, mas nenhuma produção registrada nesses meses.'
  }
  return {
    meses: n, insumos: c2(insumos), producaoRegistrada: c2(producaoMedia), cobertura: cobertura === null ? null : Math.round(cobertura * 100),
    receita: c2(receita),
    insumosPct: receita > 0 ? Math.round((insumos / receita) * 100) : null,                 // custo REAL de ingredientes por R$ que entrou
    previstoPct: valorProduzido > 0 ? Math.round((produzido / valorProduzido) * 100) : null, // custo das receitas por R$ produzido
    sobraCaixa: c2(receita - operacional),  // o que sobrou no caixa depois de todas as despesas do negócio
    sobraCaixaPct: receita > 0 ? Math.round(((receita - operacional) / receita) * 100) : null,
    nivel, leitura,
  }
}

// ── 2) Custos recorrentes ────────────────────────────────────
const chaveDescricao = (d) => norm(d)
  .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ').replace(/\d+/g, ' ')
  .replace(/\b(pix|enviado|transf|transferencia|pagamento|pgto|compra|debito|cartao|ref|parcela|parc|de|da|do|em|no|na)\b/g, ' ')
  .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ')

// "PIX TRANSF NETFLIX 11/05" -> "Netflix"
function nomeLimpo(d) {
  const t = String(d || '').replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ').replace(/\b(PIX\s+(TRANSF|ENVIADO|QRS)|DEBITO|COMPRA|PAGTO|PGTO)\b/gi, ' ').replace(/\d{4,}/g, ' ')
    .replace(/\s+/g, ' ').trim()
  const lim = (t || String(d || '')).toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase())
  return lim.length > 38 ? lim.slice(0, 36).trim() + '…' : lim
}

/** Despesas do negócio que se repetem todo mês (assinaturas, gás, internet…), sem insumos e sem DAS. */
export function custosRecorrentes({ financeiro = [], hoje, janela = 6 }) {
  const desde = somaDias(hoje, -janela * 31)
  const mesAtual = mesYm(hoje)
  const saidas = financeiro.filter(e => e.natureza === 'operacional' && Number(e.valor) < 0 && dia(e.data) >= desde &&
    !String(e.categoria || '').includes('Insumos') && !CATEGORIAS_DAS.has(e.categoria) && e.categoria !== 'A classificar')
  const mesesNoPeriodo = new Set(financeiro.filter(e => dia(e.data) >= desde).map(e => mesYm(e.data)))
  const minMeses = mesesNoPeriodo.size >= 4 ? 3 : 2
  const grupos = new Map()
  for (const e of saidas) {
    const chave = chaveDescricao(e.descricao)
    if (!chave) continue
    const k = `${e.categoria}|${chave}`
    if (!grupos.has(k)) grupos.set(k, { categoria: e.categoria, nome: nomeLimpo(e.descricao), porMes: new Map(), ultima: '' })
    const g = grupos.get(k)
    const ym = mesYm(e.data)
    g.porMes.set(ym, (g.porMes.get(ym) || 0) + Math.abs(Number(e.valor)))
    if (dia(e.data) >= g.ultima) { g.ultima = dia(e.data); g.nome = nomeLimpo(e.descricao) }
  }
  const lista = []
  for (const g of grupos.values()) {
    const valores = [...g.porMes.entries()].filter(([ym]) => ym !== mesAtual || g.porMes.size < minMeses).map(([, v]) => v)
    const todos = [...g.porMes.values()]
    if (g.porMes.size < minMeses) continue
    const m = media(valores.length ? valores : todos)
    const dp = Math.sqrt(media((valores.length ? valores : todos).map(v => (v - m) ** 2)))
    if (m <= 0 || dp / m > 0.4) continue // valor varia demais: não é um custo fixo
    lista.push({
      nome: g.nome, categoria: g.categoria, mediaMensal: c2(m), meses: g.porMes.size,
      ultimaData: g.ultima, ultimoValor: c2(g.porMes.get(mesYm(g.ultima)) || m), pagoNoMes: g.porMes.has(mesAtual),
    })
  }
  lista.sort((a, b) => b.mediaMensal - a.mediaMensal)
  return { itens: lista, total: c2(lista.reduce((s, i) => s + i.mediaMensal, 0)) }
}

// ── 3) DAS ───────────────────────────────────────────────────
// O DAS é cobrado por COMPETÊNCIA (o mês a que se refere) e vence no dia 20 do mês seguinte —
// ou no próximo dia útil, se o dia 20 cair em fim de semana ou feriado bancário (ex.: 20/11).
// O extrato só mostra QUANDO o dinheiro saiu, não de qual mês é o DAS. Por isso cada pagamento é
// ligado a uma competência por (1) escolha da pessoa, (2) mês escrito na descrição, ou
// (3) "o mais antigo ainda em aberto". A pessoa pode corrigir qualquer ligação.

const pad2 = (n) => String(n).padStart(2, '0')
const addMes = (ym, n) => { // 'AAAA-MM' + n meses
  let [a, m] = ym.split('-').map(Number)
  m += n
  while (m <= 0) { m += 12; a-- }
  while (m > 12) { m -= 12; a++ }
  return `${a}-${pad2(m)}`
}
function pascoaUtc(ano) { // algoritmo de Meeus/Jones/Butcher
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  return Date.UTC(ano, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1)
}
const feriadosCache = new Map()
function feriadosDoAno(ano) { // sem expediente bancário
  if (feriadosCache.has(ano)) return feriadosCache.get(ano)
  const set = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map(d => `${ano}-${d}`))
  const p = pascoaUtc(ano)
  for (const dias of [-48, -47, -2, 60]) set.add(new Date(p + dias * 86400000).toISOString().slice(0, 10)) // carnaval, sexta santa, corpus christi
  feriadosCache.set(ano, set)
  return set
}
export function ehDiaUtil(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  const dow = d.getUTCDay()
  return dow !== 0 && dow !== 6 && !feriadosDoAno(d.getUTCFullYear()).has(iso)
}
/** Vencimento do DAS de uma competência 'AAAA-MM': dia 20 do mês seguinte, ajustado para dia útil. */
export function vencimentoDas(ym) {
  let iso = `${addMes(ym, 1)}-20`
  while (!ehDiaUtil(iso)) iso = somaDias(iso, 1)
  return iso
}

const chaveEntrada = (e) => e.hash_duplicidade || `id-${e.id}`
export const nomeCompetencia = (ym) => {
  const t = new Date(`${ym}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}/${ym.slice(2, 4)}`
}

/** `atribuicoes`: { [chaveDoPagamento]: 'AAAA-MM', ['mes:AAAA-MM']: 'fora' }  ('fora' = pago por outra conta). */
export function statusDas({ financeiro = [], hoje, dasValor = 0, atribuicoes = {}, janela = 6 }) {
  const mesHoje = mesYm(hoje)
  const ultimaEncerrada = addMes(mesHoje, -1) // só dá para pagar o DAS de meses já encerrados
  const datas = financeiro.map(e => dia(e.data)).filter(Boolean).sort()
  const inicioExtrato = datas[0] || null

  const pagamentos = financeiro
    .filter(e => Number(e.valor) < 0 && CATEGORIAS_DAS.has(e.categoria))
    .map(e => ({ chave: chaveEntrada(e), data: dia(e.data), valor: c2(Math.abs(Number(e.valor))), descricao: String(e.descricao || '') }))
    .sort((a, b) => a.data.localeCompare(b.data))

  // Competências que valem a pena acompanhar: já encerradas, recentes e dentro do que o extrato cobre
  const competencias = []
  for (let i = janela - 1; i >= 0; i--) {
    const ym = addMes(ultimaEncerrada, -i)
    const venc = vencimentoDas(ym)
    if (inicioExtrato && venc < inicioExtrato) continue // antes do extrato: não dá para saber
    competencias.push({ ym, venc })
  }
  const emJanela = new Set(competencias.map(c => c.ym))
  const fora = new Set(Object.keys(atribuicoes).filter(k => k.startsWith('mes:') && atribuicoes[k] === 'fora').map(k => k.slice(4)))

  // 1) Ligar cada pagamento a uma competência
  const ocupada = new Map() // ym -> pagamento
  const origem = new Map()  // chave -> 'manual' | 'descricao' | 'automatica'
  const alvo = new Map()    // chave -> ym
  const valida = (ym) => /^\d{4}-(0[1-9]|1[0-2])$/.test(ym)
  for (const p of pagamentos) { // escolha da pessoa
    const m = atribuicoes[p.chave]
    if (m && valida(m)) { alvo.set(p.chave, m); origem.set(p.chave, 'manual'); if (!ocupada.has(m)) ocupada.set(m, p) }
  }
  for (const p of pagamentos) { // mês escrito na descrição (ex.: "DAS 09/2026")
    if (alvo.has(p.chave)) continue
    const m = p.descricao.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/)
    if (!m) continue
    const ym = `${m[2]}-${m[1]}`
    if (ym <= mesYm(p.data) && ym >= addMes(mesYm(p.data), -24) && !ocupada.has(ym)) { alvo.set(p.chave, ym); origem.set(p.chave, 'descricao'); ocupada.set(ym, p) }
  }
  for (const p of pagamentos) { // o DAS cujo vencimento está mais perto da data do pagamento (e já encerrado quando pagou)
    if (alvo.has(p.chave)) continue
    const limite = addMes(mesYm(p.data), -1)
    const livres = competencias.filter(c => c.ym <= limite && !ocupada.has(c.ym) && !fora.has(c.ym))
    if (!livres.length) continue
    const melhor = livres.reduce((m, c) => (Math.abs(diasEntre(c.venc, p.data)) < Math.abs(diasEntre(m.venc, p.data)) ? c : m), livres[0])
    alvo.set(p.chave, melhor.ym); origem.set(p.chave, 'automatica'); ocupada.set(melhor.ym, p)
  }

  // 2) Situação de cada competência
  const lista = competencias.map(c => {
    const pag = ocupada.get(c.ym) || null
    const pagoFora = !pag && fora.has(c.ym)
    let estado, diasAtraso = 0, diasParaVencer = 0
    if (pag) { estado = 'pago'; diasAtraso = Math.max(0, diasEntre(c.venc, pag.data)) }
    else if (pagoFora) estado = 'fora'
    else if (c.venc < hoje) { estado = 'atrasado'; diasAtraso = diasEntre(c.venc, hoje) }
    else { estado = 'a-vencer'; diasParaVencer = diasEntre(hoje, c.venc) }
    return { ym: c.ym, venc: c.venc, estado, diasAtraso, diasParaVencer, pagoEm: pag?.data || null, valor: pag?.valor || 0, chavePagamento: pag?.chave || null }
  }).reverse() // mais recente primeiro

  const abertas = lista.filter(c => c.estado === 'atrasado').sort((a, b) => a.ym.localeCompare(b.ym))
  const proxima = lista.filter(c => c.estado === 'a-vencer').sort((a, b) => a.venc.localeCompare(b.venc))[0] || null
  const estado = abertas.length ? 'atrasado' : proxima ? 'a-vencer' : 'pago'

  const valores = pagamentos.map(p => p.valor).sort((a, b) => a - b)
  const mediana = valores.length ? valores[Math.floor(valores.length / 2)] : 0
  return {
    estado, temHistorico: pagamentos.length > 0 || competencias.length > 0, competencias: lista,
    atrasadas: abertas, proxima,
    diasAtraso: abertas.length ? abertas[0].diasAtraso : 0, diasParaVencer: proxima ? proxima.diasParaVencer : 0,
    valor: c2(dasValor > 0 ? dasValor : mediana),
    pagamentos: pagamentos.slice().reverse().map(p => {
      const comp = alvo.get(p.chave) || null
      return {
        ...p, competencia: comp, origem: origem.get(p.chave) || null,
        // automático e existe um DAS mais antigo em aberto: o app não tem como saber a qual mês a pessoa pagou
        duvidoso: origem.get(p.chave) === 'automatica' && abertas.some(c => c.ym < comp),
      }
    }),
    opcoesCompetencia: [...new Set([...competencias.map(c => c.ym), ...pagamentos.map(p => alvo.get(p.chave)).filter(Boolean)])].sort().reverse(),
  }
}

// ── 4) Fôlego de caixa (próximos 30 dias) ────────────────────
/** Projeção simples SEM considerar o saldo que já está na conta: só o que costuma entrar e sair.
 *  Entradas: média dos últimos meses fechados (esperado) e o pior desses meses menos uma folga (cauteloso).
 *  Os fiados a vencer e os atrasados aparecem só como informação — vendas novas também geram entrada. */
export function folegoDeCaixa({ fiados = [], relatorio = [], hoje, metaRetirada = 0, horizonte = 30 }) {
  const fim = somaDias(hoje, horizonte)
  const abertos = fiados.filter(f => f.status !== 'pago' && Number(f.saldo) > 0.01)
  const aVencer = abertos.filter(f => f.dataVenc && dia(f.dataVenc) >= hoje && dia(f.dataVenc) <= fim)
  const atrasados = abertos.filter(f => f.dataVenc && dia(f.dataVenc) < hoje)
  const somaSaldo = (l) => l.reduce((s, f) => s + Number(f.saldo || 0), 0)

  const fechados = mesesFechados(relatorio, hoje, 3, r => Number(r.receitas_mei) > 0 || Number(r.saidas_operacionais) > 0)
  const receitas = fechados.map(m => Number(m.receitas_mei || 0)).filter(v => v > 0)
  const insumos = media(fechados.map(m => Number(m.saidas_insumos || 0)))
  const fixos = media(fechados.map(m => Math.max(0, Number(m.saidas_operacionais || 0) - Number(m.saidas_insumos || 0)))) // inclui DAS e embalagens

  const entradaEsp = media(receitas)
  const entradaCau = receitas.length ? Math.min(...receitas) * (receitas.length >= 2 ? 0.9 : 0.8) : 0
  const saidas = insumos + fixos
  const liquidoEsp = entradaEsp - saidas, liquidoCau = entradaCau - saidas
  return {
    horizonte, mesesBase: fechados.length,
    aVencer: c2(somaSaldo(aVencer)), qtdAVencer: aVencer.length, atrasado: c2(somaSaldo(atrasados)), qtdAtrasados: atrasados.length,
    entradaEsperada: c2(entradaEsp), entradaCautelosa: c2(entradaCau),
    saidas: c2(saidas), insumos: c2(insumos), fixos: c2(fixos),
    liquidoEsperado: c2(liquidoEsp), liquidoCauteloso: c2(liquidoCau),
    retiradaSegura: c2(Math.max(0, liquidoCau)), metaRetirada,
    temBase: receitas.length > 0 && saidas > 0,
    proximos: aVencer.sort((a, b) => dia(a.dataVenc).localeCompare(dia(b.dataVenc))).slice(0, 5).map(f => ({ fiadoId: f.id, clienteId: f.clienteId, venc: dia(f.dataVenc), saldo: c2(f.saldo) })),
  }
}

// ── Tudo junto + passos para o Guia ──────────────────────────
const R = (n) => 'R$ ' + c2(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export function analisarSaude({ financeiro, fiados, relatorio, producoes, receitas, hoje, metaRetirada = 0, dasValor = 0, dasAtribuicoes = {} }) {
  const custoReal = custoRealVsReceitas({ relatorio, producoes, receitas, hoje })
  const recorrentes = custosRecorrentes({ financeiro, hoje })
  const das = statusDas({ financeiro, hoje, dasValor, atribuicoes: dasAtribuicoes })
  const folego = folegoDeCaixa({ fiados, relatorio, hoje, metaRetirada })

  const passos = []
  const dd = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  if (das.temHistorico && das.atrasadas.length) {
    const meses = das.atrasadas.map(c => nomeCompetencia(c.ym))
    passos.push({
      id: 'das', icone: 'fa-file-invoice-dollar', urgencia: 'alta', score: 120,
      titulo: das.atrasadas.length === 1 ? `DAS de ${meses[0]} está em aberto` : `${das.atrasadas.length} DAS em aberto (${meses.join(', ')})`,
      texto: `O mais antigo venceu em ${dd(das.atrasadas[0].venc)} (${das.atrasadas[0].diasAtraso} ${das.atrasadas[0].diasAtraso === 1 ? 'dia' : 'dias'} de atraso)${das.valor ? `; valor de referência ${R(das.valor)} cada, mais multa e juros` : ''}. Se algum já foi pago por outra conta, marque na tela Caixa e Custos.`,
      acao: { tipo: 'financeiro', rotulo: 'Abrir Financeiro' },
    })
  } else if (das.temHistorico && das.proxima && das.diasParaVencer <= 5) {
    passos.push({
      id: 'das', icone: 'fa-file-invoice-dollar', urgencia: 'media', score: 95,
      titulo: `DAS de ${nomeCompetencia(das.proxima.ym)} vence ${das.diasParaVencer === 0 ? 'hoje' : `em ${das.diasParaVencer} ${das.diasParaVencer === 1 ? 'dia' : 'dias'}`} (${dd(das.proxima.venc)})`,
      texto: `${das.valor ? `Separe cerca de ${R(das.valor)}. ` : ''}Pagar em dia mantém o MEI regular e evita multa.`,
      acao: { tipo: 'financeiro', rotulo: 'Abrir Financeiro' },
    })
  }
  if (folego.temBase && folego.liquidoCauteloso < 0) {
    passos.push({
      id: 'caixa', icone: 'fa-wallet', urgencia: 'alta', score: 88,
      titulo: 'O caixa dos próximos 30 dias pode ficar apertado',
      texto: `Num mês fraco (como o pior dos últimos) entrariam cerca de ${R(folego.entradaCautelosa)} e sairiam ${R(folego.saidas)} (insumos e custos fixos): faltariam ${R(Math.abs(folego.liquidoCauteloso))}.${folego.atrasado > 0 ? ` Cobrar os ${R(folego.atrasado)} em atraso ajuda.` : ''}`,
      acao: { tipo: 'financeiro', rotulo: 'Ver caixa' },
    })
  }
  if (custoReal && custoReal.nivel === 'alerta') {
    passos.push({
      id: 'custoreal', icone: 'fa-scale-unbalanced', urgencia: 'baixa', score: 42,
      titulo: 'Boa parte do gasto com insumos não aparece nas produções',
      texto: `Você gasta cerca de ${R(custoReal.insumos)}/mês em insumos, mas as produções registradas explicam só ${custoReal.cobertura}%. Registrar mais produções deixa custos e margens mais fiéis.`,
      acao: { tipo: 'financeiro', rotulo: 'Ver detalhes' },
    })
  }
  return { custoReal, recorrentes, das, folego, passos }
}
