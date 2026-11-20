// modules/guiaNegocio.js
// Motor do "Guia do negócio" (aba Inteligência). Funções PURAS: recebem os dados
// (vendas da Caderninho, clientes, lojas, custos) e devolvem análises prontas.
// Nada aqui lê banco nem mexe na tela — por isso dá para testar em Node.
//
// Base de tudo: as VENDAS REAIS da Caderninho (cad_fiados), não a produção.

const DIA = 86400000
const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
const ehIso = (d) => /^\d{4}-\d{2}-\d{2}/.test(String(d || ''))
const dia = (iso) => String(iso || '').slice(0, 10)
export function diasEntre(a, b) { // b - a, em dias inteiros
  if (!ehIso(a) || !ehIso(b)) return 0
  return Math.round((new Date(dia(b) + 'T12:00:00Z') - new Date(dia(a) + 'T12:00:00Z')) / DIA)
}
export const somaDias = (iso, n) => new Date(new Date(dia(iso) + 'T12:00:00Z').getTime() + n * DIA).toISOString().slice(0, 10)
const mesDe = (iso) => dia(iso).slice(0, 7)
const mediana = (arr) => {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y)
  if (!a.length) return 0
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
const arredMeio = (v, modo = 'round') => Math[modo](v * 2) / 2 // para R$ 0,50

// "Família" da categoria (Barra = Barras = Barrinha; plural some)
export function familia(nome) {
  const k = norm(nome) || 'geral'
  if (/^barrinhas?$/.test(k)) return 'barra'
  if (/^tortas?$/.test(k)) return 'bolo' // Torta e Bolo são a mesma categoria
  return k.length > 3 ? k.replace(/s$/, '') : k
}
const ROTULO_FAMILIA = { bolo: 'Bolo', trufa: 'Trufa', barra: 'Barra', cone: 'Cone', brownie: 'Brownie', presente: 'Presentes', festa: 'Festa' }
const CATEGORIAS_GENERICAS = new Set(['categorias', 'itens anteriores', 'geral', ''])

/** Categoria real de um item vendido. Vendas em modo "resumido" não guardam a categoria:
 *  ela vem do nome ("Bolo", "Trufa — Meio Amargo"); vendas antigas "Torta ..." caem em Bolo. */
export function categoriaDoItem(it) {
  const guardada = String(it.categoria || '').trim()
  if (!CATEGORIAS_GENERICAS.has(norm(guardada))) return { fam: familia(guardada), nome: guardada }
  const base = baseNomeItem(it.nome)
  const { categoria } = partesNome(it.nome)
  const bruta = categoria || base.split(/\s+/)[0]
  const fam = familia(bruta)
  // "Torta Leite Ninho" sem categoria guardada: a 1ª palavra já indica a família
  return { fam, nome: ROTULO_FAMILIA[fam] || (categoria || base) }
}

// ── Itens da venda ───────────────────────────────────────────
// Nome do item sem o sufixo de preço avulso: "Trufa (R$ 8,00)" -> "Trufa"
export const baseNomeItem = (nome) => String(nome || '').replace(/\s*\(R\$\s*[\d.,]+\)\s*$/i, '').trim()
const qtdItem = (it) => Number(it.qty ?? it.qtd ?? 1) || 0
const subItem = (it) => c2(it.subtotal ?? qtdItem(it) * Number(it.preco || 0))
// Para "Trufa — Meio Amargo": categoria = Trufa, variante = Meio Amargo
function partesNome(nome) {
  const base = baseNomeItem(nome)
  const [cat, ...resto] = base.split(/\s+[—–-]\s+/)
  return resto.length ? { categoria: cat.trim(), variante: resto.join(' — ').trim() } : { categoria: '', variante: '' }
}

/** Monta o localizador de custo por item vendido.
 *  receitas: [{ uuid, nome, categoria, tamanho, custoUnit }] (só finais, custoUnit > 0) */
export function criarCustoDoItem(receitas) {
  const lista = (receitas || []).filter(r => r.custoUnit > 0).map(r => ({
    ...r, chaveNome: norm(r.nome), fam: familia(r.categoria),
  }))
  const porUuid = new Map(lista.map(r => [r.uuid, r]))
  const mediaCategoria = new Map()
  const tmp = new Map()
  for (const r of lista) {
    if (norm(r.tamanho) === 'festa') continue // trufa de festa é maior: não entra na média da categoria
    if (!tmp.has(r.fam)) tmp.set(r.fam, [])
    tmp.get(r.fam).push(r.custoUnit)
  }
  for (const [f, v] of tmp) mediaCategoria.set(f, c2(v.reduce((a, b) => a + b, 0) / v.length))

  return function custoDoItem(item) {
    const exato = porUuid.get(item.id)
    if (exato) return { custo: exato.custoUnit, tipo: 'receita' }
    const { categoria, variante } = partesNome(item.nome)
    const base = norm(baseNomeItem(item.nome))
    if (variante) {
      const v = norm(variante)
      const famCat = familia(categoria)
      const achou = lista.find(r => (r.chaveNome.includes(v) || v.includes(r.chaveNome)) && (r.fam === famCat || r.chaveNome.includes(norm(categoria))))
      if (achou) return { custo: achou.custoUnit, tipo: 'receita' }
    }
    const igual = lista.find(r => r.chaveNome === base)
    if (igual) return { custo: igual.custoUnit, tipo: 'receita' }
    const f = familia(categoria || baseNomeItem(item.nome))
    if (mediaCategoria.has(f)) return { custo: mediaCategoria.get(f), tipo: 'categoria' }
    return { custo: 0, tipo: 'sem' }
  }
}

// ── Pagamento de cada venda ──────────────────────────────────
function situacaoPagamento(f, hoje) {
  const aberto = f.status !== 'pago' && Number(f.saldo || 0) > 0.01
  const venc = f.dataVenc && ehIso(f.dataVenc) ? dia(f.dataVenc) : null
  if (aberto) {
    return { aberto: true, venc, diasVencido: venc ? Math.max(0, diasEntre(venc, hoje)) : 0 }
  }
  const pags = Array.isArray(f.pagamentos) ? f.pagamentos.filter(p => ehIso(p.data)) : []
  const ultimo = pags.length ? pags.map(p => dia(p.data)).sort().pop() : (f.pagoEm ? dia(f.pagoEm) : null)
  const diasAtraso = venc && ultimo ? Math.max(0, diasEntre(venc, ultimo)) : 0
  return { aberto: false, venc, quitadoEm: ultimo, diasAtraso, temData: !!(venc && ultimo) }
}

// ── Clientes ─────────────────────────────────────────────────
const MAPA_MANUAL = { confiavel: 'bom', enrola: 'atencao', evitar: 'problema' }
export const ROTULO_STATUS = { bom: 'Bom pagador', atencao: 'Atenção', problema: 'Problemático', novo: 'Novo' }

/** Análise de cada cliente com base no histórico de compras e pagamentos. */
export function analisarClientes({ fiados, clientes, lojas, hoje }) {
  const nomeLoja = new Map((lojas || []).map(l => [l.id, l.nome]))
  const porCliente = new Map()
  for (const f of fiados || []) {
    if (!(Number(f.total) > 0) && !(Number(f.saldo) > 0)) continue
    if (!porCliente.has(f.clienteId)) porCliente.set(f.clienteId, [])
    porCliente.get(f.clienteId).push(f)
  }
  const resultado = []
  for (const cli of clientes || []) {
    const vendas = (porCliente.get(cli.id) || []).sort((a, b) => dia(a.dataVenda).localeCompare(dia(b.dataVenda)))
    if (!vendas.length) continue
    const sit = vendas.map(f => ({ f, ...situacaoPagamento(f, hoje) }))
    const quitadas = sit.filter(x => !x.aberto && x.temData)
    const abertas = sit.filter(x => x.aberto)
    const vencidas = abertas.filter(x => x.diasVencido > 0)
    const emDia = quitadas.filter(x => x.diasAtraso <= 2).length
    const atrasoMedio = quitadas.length ? quitadas.reduce((s, x) => s + x.diasAtraso, 0) / quitadas.length : 0
    const maiorAtrasoPago = quitadas.reduce((m, x) => Math.max(m, x.diasAtraso), 0)
    const diasAtrasoAtual = vencidas.reduce((m, x) => Math.max(m, x.diasVencido), 0)
    const saldoAberto = c2(abertas.reduce((s, x) => s + Number(x.f.saldo || 0), 0))
    const saldoAtrasado = c2(vencidas.reduce((s, x) => s + Number(x.f.saldo || 0), 0))
    const totalComprado = c2(vendas.reduce((s, f) => s + Number(f.total || 0), 0))
    const ticket = c2(totalComprado / vendas.length)
    const maiorCompra = vendas.reduce((m, f) => Math.max(m, Number(f.total || 0)), 0)
    const datas = [...new Set(vendas.map(f => dia(f.dataVenda)).filter(ehIso))]
    const ultimaCompra = datas[datas.length - 1] || null
    const intervalos = datas.slice(1).map((d, i) => diasEntre(datas[i], d)).filter(n => n > 0)
    const freqDias = intervalos.length >= 2 ? Math.round(mediana(intervalos)) : null
    const pctEmDia = quitadas.length ? Math.round((emDia / quitadas.length) * 100) : null

    // Classificação automática
    let auto = 'novo'
    const base = quitadas.length + vencidas.length
    if (diasAtrasoAtual >= 45 || (quitadas.length >= 2 && atrasoMedio >= 25) || (quitadas.length >= 3 && pctEmDia < 40)) auto = 'problema'
    else if (diasAtrasoAtual >= 10 || (quitadas.length >= 2 && (atrasoMedio >= 10 || pctEmDia < 70))) auto = 'atencao'
    else if (quitadas.length >= 2 || (quitadas.length >= 1 && base >= 1 && pctEmDia === 100)) auto = 'bom'
    if (auto === 'novo' && quitadas.length >= 1 && pctEmDia === 100 && diasAtrasoAtual < 10) auto = 'bom'

    const manual = cli.perfilManual && MAPA_MANUAL[cli.perfilManual] ? cli.perfilManual : ''
    const status = manual ? MAPA_MANUAL[manual] : auto

    // Fatos que explicam a classificação (linguagem simples)
    const fatos = []
    if (quitadas.length) fatos.push(`Pagou ${emDia} de ${quitadas.length} ${quitadas.length === 1 ? 'compra' : 'compras'} no prazo`)
    if (quitadas.length && atrasoMedio >= 3) fatos.push(`Atrasa em média ${Math.round(atrasoMedio)} dias para pagar`)
    if (maiorAtrasoPago >= 15) fatos.push(`Já demorou ${maiorAtrasoPago} dias além do combinado`)
    if (diasAtrasoAtual > 0) fatos.push(`Deve R$ ${saldoAtrasado.toFixed(2).replace('.', ',')} vencido há ${diasAtrasoAtual} ${diasAtrasoAtual === 1 ? 'dia' : 'dias'}`)
    if (!fatos.length) fatos.push('Ainda sem histórico de pagamento suficiente')

    // Sugestão de limite de fiado
    let conselho
    if (status === 'bom') conselho = { texto: `Pode confiar: fiado até R$ ${Math.max(20, Math.round(Math.max(ticket * 2, maiorCompra) / 10) * 10)}.`, limite: Math.max(20, Math.round(Math.max(ticket * 2, maiorCompra) / 10) * 10) }
    else if (status === 'atencao') conselho = { texto: saldoAtrasado > 0 ? 'Cobre o que está vencido antes de vender mais fiado.' : `Mantenha o fiado pequeno (até R$ ${Math.max(20, Math.round(ticket / 10) * 10)}).`, limite: Math.max(20, Math.round(ticket / 10) * 10) }
    else if (status === 'problema') conselho = { texto: 'Venda só à vista, ou só depois de receber o que está atrasado.', limite: 0 }
    else conselho = { texto: 'Cliente novo: comece com compras pequenas e veja como ela paga.', limite: null }

    resultado.push({
      id: cli.id, nome: cli.nome, funcao: cli.funcao || '', telefone: cli.telefone || '',
      lojaId: cli.lojaId, loja: nomeLoja.get(cli.lojaId) || '', arquivado: !!cli.arquivado,
      obs: cli.obs || '', perfilManual: manual, statusAuto: auto, status,
      compras: vendas.length, totalComprado, ticket, ultimaCompra, freqDias,
      diasSemComprar: ultimaCompra ? diasEntre(ultimaCompra, hoje) : null,
      pctEmDia, atrasoMedio: Math.round(atrasoMedio), maiorAtrasoPago, diasAtrasoAtual,
      saldoAberto, saldoAtrasado, qtdVencidas: vencidas.length,
      fatos, conselho,
      historico: sit.slice(-8).reverse().map(x => ({
        data: dia(x.f.dataVenda), total: c2(x.f.total), saldo: c2(x.f.saldo),
        aberto: x.aberto, atraso: x.aberto ? x.diasVencido : x.diasAtraso,
      })),
      vendas, // usado por produtos/combos
    })
  }
  return resultado
}

/** Clientes que "sumiram": compravam e pararam além do ritmo normal deles. */
export function clientesQueSumiram(analise) {
  return analise
    .filter(c => !c.arquivado && c.compras >= 3 && c.ultimaCompra && c.status !== 'problema' && c.saldoAtrasado <= 0)
    .filter(c => c.diasSemComprar >= Math.max(45, (c.freqDias || 20) * 2))
    .sort((a, b) => b.totalComprado - a.totalComprado)
}

// ── Produtos ─────────────────────────────────────────────────
function linhasVendidas(fiados, { desde = null } = {}) {
  const linhas = []
  for (const f of fiados || []) {
    if (desde && dia(f.dataVenda) < desde) continue
    for (const it of f.itens || []) {
      const qtd = qtdItem(it)
      if (!(qtd > 0)) continue
      linhas.push({
        fiadoId: f.id, clienteId: f.clienteId, lojaId: f.lojaId, data: dia(f.dataVenda), item: it,
        chave: norm(baseNomeItem(it.nome)), nome: baseNomeItem(it.nome), qtd, sub: subItem(it),
        preco: qtd ? c2(subItem(it) / qtd) : Number(it.preco || 0),
      })
    }
  }
  return linhas
}

/** Quanto cada produto vende e quanto sobra por unidade. */
export function analisarProdutos({ fiados, custoDoItem, hoje, janela = 90 }) {
  let desde = somaDias(hoje, -janela)
  let linhas = linhasVendidas(fiados, { desde })
  let usouTudo = false
  if (linhas.length < 15) { linhas = linhasVendidas(fiados); usouTudo = true; desde = null }
  const mapa = new Map()
  for (const l of linhas) {
    if (!mapa.has(l.chave)) mapa.set(l.chave, { chave: l.chave, nome: l.nome, qtd: 0, faturamento: 0, clientes: new Set(), custoTotal: 0, qtdComCusto: 0, tipos: new Set(), ultimoPreco: l.preco, ultimaData: '' })
    const p = mapa.get(l.chave)
    p.qtd += l.qtd; p.faturamento += l.sub; p.clientes.add(l.clienteId)
    const { custo, tipo } = custoDoItem(l.item)
    if (custo > 0) { p.custoTotal += custo * l.qtd; p.qtdComCusto += l.qtd; p.tipos.add(tipo) }
    if (l.data >= p.ultimaData) { p.ultimaData = l.data; p.ultimoPreco = l.preco }
  }
  const lista = [...mapa.values()].map(p => {
    const precoMedio = p.qtd ? c2(p.faturamento / p.qtd) : 0
    const custoUnit = p.qtdComCusto ? c2(p.custoTotal / p.qtdComCusto) : 0
    const sobra = custoUnit > 0 ? c2(precoMedio - custoUnit) : null
    const margem = custoUnit > 0 && precoMedio > 0 ? Math.round(((precoMedio - custoUnit) / precoMedio) * 100) : null
    return {
      chave: p.chave, nome: p.nome, qtd: p.qtd, faturamento: c2(p.faturamento), clientes: p.clientes.size,
      precoMedio, precoAtual: p.ultimoPreco, custoUnit, sobra, margem,
      custoEstimado: p.tipos.has('categoria') && !p.tipos.has('receita'),
      porMes: Math.round((p.qtd / (usouTudo ? Math.max(1, mesesCobertos(fiados, hoje)) : janela / 30)) * 10) / 10,
    }
  }).sort((a, b) => b.faturamento - a.faturamento)

  const comMargem = lista.filter(p => p.margem !== null)
  const medQtd = mediana(comMargem.map(p => p.qtd))
  for (const p of lista) {
    if (p.margem === null) { p.grupo = 'semcusto'; continue }
    const vendeBem = p.qtd >= medQtd && p.qtd >= 3
    if (vendeBem && p.margem >= 35) p.grupo = 'chefe'
    else if (!vendeBem && p.margem >= 45) p.grupo = 'divulgar'
    else if (p.margem < 35 && vendeBem) p.grupo = 'reajustar'
    else if (p.margem < 35) p.grupo = 'repensar'
    else p.grupo = 'ok'
    if (p.grupo === 'reajustar' || p.grupo === 'repensar') {
      const alvo = arredMeio(p.custoUnit / 0.6, 'ceil') // preço para ~40% de margem
      const passo = Math.min(alvo, arredMeio(p.precoAtual + (alvo - p.precoAtual) * 0.5, 'ceil'))
      if (passo > p.precoAtual + 0.01) {
        p.reajuste = { alvo, passo, aumento: c2(passo - p.precoAtual), ganhoMes: Math.round((passo - p.precoAtual) * p.porMes) }
      }
    }
  }
  return lista
}
function mesesCobertos(fiados, hoje) {
  const datas = (fiados || []).map(f => dia(f.dataVenda)).filter(ehIso).sort()
  if (!datas.length) return 1
  return Math.max(1, diasEntre(datas[0], hoje) / 30)
}
export const ROTULO_GRUPO = {
  chefe: 'Carro-chefe', divulgar: 'Divulgar mais', reajustar: 'Reajustar preço', repensar: 'Repensar', ok: 'Ok', semcusto: 'Sem custo',
}

// ── O que cada cliente leva + combos ─────────────────────────
/** O que a cliente mais compra, AGRUPADO POR CATEGORIA (Torta e Bolo juntos), com o detalhe
 *  de quais produtos formam cada grupo. */
export function produtosDoCliente(cliente) {
  const mapa = new Map()
  const nCompras = cliente.vendas.length || 1
  for (const f of cliente.vendas) {
    const porCat = new Map() // nesta compra: família -> { qtd, sub }
    for (const it of f.itens || []) {
      const q = qtdItem(it)
      if (!(q > 0)) continue
      const cat = categoriaDoItem(it)
      if (!mapa.has(cat.fam)) mapa.set(cat.fam, { chave: cat.fam, nome: ROTULO_FAMILIA[cat.fam] || cat.nome, qtd: 0, compras: 0, porCompra: [], detalhes: new Map(), item: it, ultimaData: '', sub: 0 })
      const g = mapa.get(cat.fam)
      g.qtd += q; g.sub += subItem(it)
      const nome = baseNomeItem(it.nome)
      g.detalhes.set(nome, (g.detalhes.get(nome) || 0) + q)
      if (!porCat.has(cat.fam)) porCat.set(cat.fam, { qtd: 0, sub: 0 })
      const pc = porCat.get(cat.fam); pc.qtd += q; pc.sub += subItem(it)
      if (dia(f.dataVenda) >= g.ultimaData) { g.ultimaData = dia(f.dataVenda); g.item = it }
    }
    for (const [fam, pc] of porCat) { const g = mapa.get(fam); g.compras += 1; g.porCompra.push(pc) }
  }
  return [...mapa.values()].map(g => {
    const recentes = g.porCompra.slice(-3)
    const qtdRec = recentes.reduce((n, x) => n + x.qtd, 0)
    const maisLevado = [...g.detalhes.entries()].sort((a, b) => b[1] - a[1])
    return {
      chave: g.chave, nome: g.nome, qtd: g.qtd, compras: g.compras, item: g.item,
      qtdUsual: Math.max(1, Math.round(mediana(g.porCompra.map(x => x.qtd)))),
      precoAtual: qtdRec ? c2(recentes.reduce((n, x) => n + x.sub, 0) / qtdRec) : 0, // preço médio recente por unidade
      freq: Math.round((g.compras / nCompras) * 100),
      detalhes: maisLevado.map(([nome, qtd]) => ({ nome, qtd })),
      maisLevado: maisLevado[0]?.[0] || '',
    }
  }).sort((a, b) => b.qtd - a.qtd)
}

/** Combo sugerido para a cliente, por CATEGORIA (ex.: 1 Bolo + 1 Barra), a partir do que ela JÁ leva
 *  com frequência. Desconto pequeno, só se a margem continuar saudável. */
export function comboParaCliente(cliente, custoDoItem) {
  if (cliente.compras < 3) return null
  const top = produtosDoCliente(cliente).filter(p => p.compras >= 2).slice(0, 3)
  if (top.length < 2) return null
  const itens = top.map(p => ({ nome: p.nome, qty: p.qtdUsual, preco: p.precoAtual, item: p.item, detalhe: p.detalhes.length > 1 || norm(p.maisLevado) !== norm(p.nome) ? p.maisLevado : '' }))
  const precoCheio = c2(itens.reduce((s, i) => s + i.qty * i.preco, 0))
  const custos = itens.map(i => ({ ...custoDoItem(i.item), qty: i.qty }))
  const custoTotal = c2(custos.reduce((s, c) => s + c.custo * c.qty, 0))
  const sabeCusto = custos.every(c => c.custo > 0)
  let precoCombo = arredMeio(precoCheio * 0.95)
  if (precoCombo >= precoCheio) precoCombo = precoCheio
  let desconto = c2(precoCheio - precoCombo)
  if (sabeCusto && precoCombo > 0 && (precoCombo - custoTotal) / precoCombo < 0.35) { precoCombo = precoCheio; desconto = 0 }
  const margem = sabeCusto && precoCombo > 0 ? Math.round(((precoCombo - custoTotal) / precoCombo) * 100) : null
  const primeiro = String(cliente.nome).trim().split(/\s+/)[0]
  const lista = itens.map(i => `${i.qty} ${i.nome}`).join(' + ')
  const texto = desconto > 0
    ? `Oi ${primeiro}! Montei um combo pensando no que você mais leva: ${lista} por R$ ${precoCombo.toFixed(2).replace('.', ',')} (de R$ ${precoCheio.toFixed(2).replace('.', ',')}). Posso separar pra você?`
    : `Oi ${primeiro}! Posso separar o seu de sempre? ${lista} — R$ ${precoCombo.toFixed(2).replace('.', ',')}.`
  return { itens: itens.map(({ item, ...i }) => i), precoCheio, precoCombo, desconto, margem, texto }
}

/** Categorias que costumam ser compradas JUNTAS na mesma venda (Torta conta como Bolo). */
export function combosFrequentes(fiados, { minimo = 3, limite = 4 } = {}) {
  const pares = new Map()
  for (const f of fiados || []) {
    const cats = [...new Map((f.itens || []).filter(i => qtdItem(i) > 0).map(i => { const c = categoriaDoItem(i); return [c.fam, ROTULO_FAMILIA[c.fam] || c.nome] }))]
    if (cats.length < 2) continue
    for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) {
      const [a, b] = [cats[i], cats[j]].sort((x, y) => x[0].localeCompare(y[0]))
      const k = a[0] + '|' + b[0]
      if (!pares.has(k)) pares.set(k, { a: a[1], b: b[1], vezes: 0 })
      pares.get(k).vezes++
    }
  }
  return [...pares.values()].filter(p => p.vezes >= minimo).sort((x, y) => y.vezes - x.vezes).slice(0, limite)
}

// ── Mês ──────────────────────────────────────────────────────
const mesAnterior = (ym, n = 1) => { // 'AAAA-MM' menos n meses
  let [a, m] = ym.split('-').map(Number)
  m -= n
  while (m <= 0) { m += 12; a-- }
  return `${a}-${String(m).padStart(2, '0')}`
}
export function resumoDoMes({ fiados, custoDoItem, hoje }) {
  const mes = mesDe(hoje)
  const mesAnt = mesAnterior(mes)
  const diaHoje = Number(dia(hoje).slice(8, 10))
  let vendidoAntAteHoje = 0
  let vendido = 0, vendidoAnt = 0, recebido = 0, qtdVendas = 0, aReceber = 0, atrasado = 0
  let lucro = 0, fatComCusto = 0, fatTotalItens = 0
  const clientesMes = new Set()
  const lucroPorMes = new Map()
  for (const f of fiados || []) {
    const m = mesDe(f.dataVenda)
    const total = Number(f.total || 0)
    if (m === mes) { vendido += total; qtdVendas++; clientesMes.add(f.clienteId) }
    if (m === mesAnt) { vendidoAnt += total; if (Number(dia(f.dataVenda).slice(8, 10)) <= diaHoje) vendidoAntAteHoje += total }
    for (const p of f.pagamentos || []) if (mesDe(p.data) === mes) recebido += Number(p.valor || 0)
    if (f.status !== 'pago' && Number(f.saldo || 0) > 0.01) {
      aReceber += Number(f.saldo)
      if (f.dataVenc && dia(f.dataVenc) < hoje) atrasado += Number(f.saldo)
    }
    // lucro estimado desta venda
    let lucroVenda = 0, subs = 0, subsCusto = 0
    for (const it of f.itens || []) {
      const q = qtdItem(it); const sub = subItem(it); subs += sub
      const { custo } = custoDoItem(it)
      if (custo > 0) { lucroVenda += sub - custo * q; subsCusto += sub }
    }
    lucroVenda -= Number(f.desconto || 0) * (subsCusto && subs ? subsCusto / subs : 0)
    lucroPorMes.set(m, (lucroPorMes.get(m) || 0) + lucroVenda)
    if (m === mes) { lucro += lucroVenda; fatComCusto += subsCusto; fatTotalItens += subs }
  }
  // média de lucro dos 3 meses fechados anteriores (ignora meses sem venda)
  const anteriores = []
  for (let i = 1; i <= 3; i++) {
    const m = mesAnterior(mes, i)
    if (lucroPorMes.has(m) && lucroPorMes.get(m) > 0) anteriores.push(lucroPorMes.get(m))
  }
  const lucroMedio = anteriores.length ? anteriores.reduce((a, b) => a + b, 0) / anteriores.length : lucro
  return {
    mes, vendido: c2(vendido), vendidoAnt: c2(vendidoAnt),
    vendidoAntAteHoje: c2(vendidoAntAteHoje),
    variacao: vendidoAntAteHoje > 0 ? Math.round(((vendido - vendidoAntAteHoje) / vendidoAntAteHoje) * 100) : null,
    recebido: c2(recebido), aReceber: c2(aReceber), atrasado: c2(atrasado),
    qtdVendas, clientesAtivos: clientesMes.size, ticket: qtdVendas ? c2(vendido / qtdVendas) : 0,
    lucro: c2(lucro), lucroMedio: c2(lucroMedio),
    coberturaCusto: fatTotalItens > 0 ? Math.round((fatComCusto / fatTotalItens) * 100) : null,
  }
}

// ── Pontos de venda (lojas) ──────────────────────────────────
export function analisarLojas({ fiados, lojas, hoje, janela = 90 }) {
  const desde = somaDias(hoje, -janela)
  const mapa = new Map()
  for (const f of fiados || []) {
    if (!mapa.has(f.lojaId)) mapa.set(f.lojaId, { id: f.lojaId, nome: f.lojaNome || '', vendido: 0, vendas: 0, clientes: new Set(), aReceber: 0, atrasado: 0 })
    const l = mapa.get(f.lojaId)
    if (dia(f.dataVenda) >= desde) { l.vendido += Number(f.total || 0); l.vendas++; l.clientes.add(f.clienteId) }
    if (f.status !== 'pago' && Number(f.saldo || 0) > 0.01) {
      l.aReceber += Number(f.saldo)
      if (f.dataVenc && dia(f.dataVenc) < hoje) l.atrasado += Number(f.saldo)
    }
  }
  const nomes = new Map((lojas || []).map(l => [l.id, l.nome]))
  return [...mapa.values()]
    .map(l => ({ id: l.id, nome: nomes.get(l.id) || l.nome || 'Sem loja', vendido: c2(l.vendido), vendas: l.vendas, clientes: l.clientes.size, aReceber: c2(l.aReceber), atrasado: c2(l.atrasado) }))
    .filter(l => l.vendido > 0 || l.aReceber > 0)
    .sort((a, b) => b.vendido - a.vendido)
}

// ── Próximos passos ──────────────────────────────────────────
const R = (n) => 'R$ ' + c2(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const lista3 = (arr) => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1]

export function proximosPassos({ resumo, clientes, produtos, sumiram, metaRetirada, comboDe = () => null, maxPassos = 3 }) {
  const cand = []
  const vencidos = clientes.filter(c => c.saldoAtrasado > 0 && !c.arquivado).sort((a, b) => b.saldoAtrasado - a.saldoAtrasado)
  const totalVencido = c2(vencidos.reduce((s, c) => s + c.saldoAtrasado, 0))
  if (totalVencido > 0) {
    cand.push({
      id: 'cobrar', icone: 'fa-hand-holding-dollar', urgencia: 'alta', score: 100 + Math.min(40, totalVencido / 20),
      titulo: `Cobrar ${R(totalVencido)} em atraso`,
      texto: `${vencidos.length} ${vencidos.length === 1 ? 'cliente deve' : 'clientes devem'} além do combinado: ` +
        lista3(vencidos.slice(0, 3).map(c => `${c.nome.split(' ')[0]} (${R(c.saldoAtrasado)}, ${c.diasAtrasoAtual}d)`)) + '. Dinheiro que já é seu e está parado.',
      acao: { tipo: 'filtro', filtro: 'atrasados', rotulo: 'Ver quem deve' },
    })
  }
  const risco = clientes.filter(c => c.status === 'problema' && c.saldoAberto > 0 && !c.arquivado)
  if (risco.length) {
    cand.push({
      id: 'segurar', icone: 'fa-hand', urgencia: 'alta', score: 90,
      titulo: 'Segure o fiado de quem já atrasa muito',
      texto: `${lista3(risco.slice(0, 3).map(c => c.nome.split(' ')[0]))} ${risco.length === 1 ? 'tem' : 'têm'} atraso grande ou histórico de demora para pagar. Venda só à vista ou depois de receber o que está aberto.`,
      acao: { tipo: 'cliente', clienteId: risco[0].id, rotulo: 'Ver cliente' },
    })
  }
  const reaj = produtos.filter(p => p.reajuste && p.grupo === 'reajustar').sort((a, b) => b.reajuste.ganhoMes - a.reajuste.ganhoMes)[0]
  if (reaj && reaj.reajuste.ganhoMes >= 5) {
    cand.push({
      id: 'reajustar', icone: 'fa-coins', urgencia: 'media', score: 65 + Math.min(25, reaj.reajuste.ganhoMes / 4),
      titulo: `Ajustar o preço: ${reaj.nome}`,
      texto: `Vende bem, mas sobra só ${R(reaj.sobra)} por unidade (${reaj.margem}%). Subir para ${R(reaj.reajuste.passo)} é um passo suave e rende cerca de ${R(reaj.reajuste.ganhoMes)} por mês no ritmo atual.`,
      acao: { tipo: 'produto', chave: reaj.chave, rotulo: 'Ver produto' },
    })
  }
  if (sumiram.length) {
    cand.push({
      id: 'reativar', icone: 'fa-user-clock', urgencia: 'media', score: 70 + Math.min(15, sumiram.length * 3),
      titulo: `${sumiram.length} ${sumiram.length === 1 ? 'cliente parou' : 'clientes pararam'} de comprar`,
      texto: `${lista3(sumiram.slice(0, 3).map(c => `${c.nome.split(' ')[0]} (${c.diasSemComprar}d)`))} ${sumiram.length === 1 ? 'comprava' : 'compravam'} com frequência e sumiu. Uma mensagem simples costuma trazer de volta.`.replace('e sumiu', sumiram.length === 1 ? 'e sumiu' : 'e sumiram'),
      acao: { tipo: 'filtro', filtro: 'sumiram', rotulo: 'Ver quem sumiu' },
    })
  }
  const divul = produtos.filter(p => p.grupo === 'divulgar').sort((a, b) => b.margem - a.margem)[0]
  if (divul) {
    cand.push({
      id: 'divulgar', icone: 'fa-bullhorn', urgencia: 'baixa', score: 55,
      titulo: `Mostrar mais: ${divul.nome}`,
      texto: `Sobra ${R(divul.sobra)} por unidade (${divul.margem}%), das melhores margens, mas vende pouco. Ofereça junto com o que a cliente já leva.`,
      acao: { tipo: 'produto', chave: divul.chave, rotulo: 'Ver produto' },
    })
  }
  const comCombo = clientes.filter(c => c.status === 'bom' && !c.arquivado && c.compras >= 4)
    .sort((a, b) => b.totalComprado - a.totalComprado)
  for (const c of comCombo) {
    const combo = comboDe(c)
    if (combo) {
      cand.push({
        id: 'combo', icone: 'fa-gift', urgencia: 'baixa', score: 58,
        titulo: `Combo para ${c.nome.split(' ')[0]}`,
        texto: `Ela já leva ${lista3(combo.itens.map(i => `${i.qty} ${i.nome}`))}. Que tal oferecer fechado por ${R(combo.precoCombo)}? É venda maior e mais previsível.`,
        acao: { tipo: 'cliente', clienteId: c.id, rotulo: 'Ver combo' },
      })
      break
    }
  }
  if (metaRetirada > 0 && resumo.lucroMedio > 0 && resumo.lucroMedio < metaRetirada) {
    const falta = c2(metaRetirada - resumo.lucroMedio)
    cand.push({
      id: 'meta', icone: 'fa-bullseye', urgencia: 'media', score: 50,
      titulo: `Faltam ${R(falta)}/mês para sua retirada`,
      texto: `Pelas vendas da Caderninho, sobram cerca de ${R(resumo.lucroMedio)} por mês e sua meta é ${R(metaRetirada)}. Preço melhor, combos e clientes de volta são os caminhos mais rápidos.`,
      acao: { tipo: 'meta', rotulo: 'Ver meta' },
    })
  }
  if (resumo.coberturaCusto !== null && resumo.coberturaCusto < 60) {
    cand.push({
      id: 'custos', icone: 'fa-clipboard-check', urgencia: 'baixa', score: 30,
      titulo: 'Complete o custo das receitas',
      texto: `Só ${resumo.coberturaCusto}% do que você vendeu tem custo conhecido. Sem isso o lucro mostrado aqui é aproximado.`,
      acao: { tipo: 'receitas', rotulo: 'Abrir receitas' },
    })
  }
  return cand.sort((a, b) => b.score - a.score).slice(0, maxPassos)
}
