// modules/conciliacao.js
// Cruza os Pix RECEBIDOS no extrato (Financeiro › "Receita de Vendas") com a Caderninho.
//
// Para cada entrada do extrato, descobre se ela é:
//   • "conciliada"  → já corresponde a um pagamento que você registrou na Caderninho
//   • "sugestao"    → parece pagamento de um fiado em aberto (você confirma a baixa)
//   • "avista"      → o resto: venda à vista (ou algo que o app não consegue ligar a nenhum fiado)
//
// Assim dá para saber quanto do faturamento é fiado × à vista SEM lançar as vendas à vista,
// e quem são as pessoas que pagam à vista. Funções PURAS (sem banco, sem tela).
// O app NUNCA dá baixa sozinho: sempre sugere e a pessoa confirma.

import { norm, diasEntre, somaDias } from './guiaNegocio.js'

const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const dia = (iso) => String(iso || '').slice(0, 10)
const PALAVRAS_IGNORADAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'ltda', 'me', 'mei', 'eireli', 'sa', 'epp'])

// ── Quem pagou? (nome extraído da descrição do extrato) ──────
/** Extrai o nome do pagador de descrições como:
 *   Itaú:   "PIX TRANSF ANA SOUZA12/11"      BB:  "12/11 14:23 12345678901 ANA SOUZA"
 *   Outros: "Pix recebido de ANA SOUZA SILVA" */
export function extrairPagador(descricao) {
  let t = ' ' + String(descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' '
  t = t.replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ')          // datas 12/11 ou 12/11/2026
       .replace(/\d{2}\/\d{2}(?=\s*$)/g, ' ')                   // data colada no fim: "SOUZA12/11"
       .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')            // horas
       .replace(/[*\d.\-/]{5,}/g, ' ')                          // CPF/CNPJ e ids (inclusive mascarados)
       .replace(/\d+/g, ' ')
  t = t.replace(/\b(pix|qrs|qr code|transf(erencia)?|recebid[oa]|recebimento|pagamento|pgto|remetente|rem|ted|doc|cpf|cnpj|de|via|ag|conta|cc|pf|pj)\b/gi, ' ')
  const nome = t.replace(/[^A-Za-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const tokens = nome.split(' ').filter(p => p.length >= 2)
  if (!tokens.length || nome.length < 3) return { nome: '', chave: '', tokens: [] }
  const bonito = tokens.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
  return { nome: bonito, chave: norm(tokens.join(' ')), tokens: tokens.map(norm).filter(p => p.length >= 3 && !PALAVRAS_IGNORADAS.has(p)) }
}

// ── Nome do pagador × nome do cliente ────────────────────────
// 3 = nome completo bate · 2 = bate o único nome do cliente · 1 = só um nome em comum · 0 = não bate
function tokensNome(nome) {
  return norm(nome).split(' ').filter(p => p.length >= 3 && !PALAVRAS_IGNORADAS.has(p))
}
const casa = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) // extrato trunca nomes
export function similaridadeNome(tokensPagador, nomeCliente) {
  const tc = tokensNome(nomeCliente)
  if (!tokensPagador.length || !tc.length) return 0
  const comuns = tc.filter(t => tokensPagador.some(p => casa(p, t))).length
  if (comuns === tc.length && tc.length >= 2) return 3
  if (comuns >= 2) return 3
  if (comuns === 1 && tc.length === 1) return 2
  if (comuns === 1 && casa(tokensPagador[0], tc[0])) return 2 // primeiro nome igual
  return comuns ? 1 : 0
}

const chaveEntrada = (e) => e.hash_duplicidade || `id-${e.id}`

/** Concilia as entradas do extrato com a Caderninho. */
export function conciliar({ entradas = [], fiados = [], clientes = [], ignorados = [], hoje }) {
  const ign = new Set(ignorados)
  const nomeCliente = new Map(clientes.map(c => [c.id, c]))

  // Pagamentos já registrados na Caderninho
  const pagamentos = []
  for (const f of fiados) for (const p of f.pagamentos || []) {
    if (Number(p.valor) > 0 && /^\d{4}-\d{2}-\d{2}/.test(String(p.data || ''))) {
      pagamentos.push({ fiadoId: f.id, clienteId: f.clienteId, valor: c2(p.valor), data: dia(p.data), hash: p.financeiroHash || null, usado: false })
    }
  }

  const lista = entradas
    .filter(e => Number(e.valor) > 0)
    .map(e => ({ ...e, chave: chaveEntrada(e), valor: c2(e.valor), dataIso: dia(e.data), pagador: extrairPagador(e.descricao) }))
    .sort((a, b) => a.dataIso.localeCompare(b.dataIso))

  const resultado = new Map() // chave -> { status, ... }

  // 1) Já registrado na Caderninho (ligação explícita pelo hash, ou mesmo valor em data próxima)
  for (const e of lista) {
    const exato = pagamentos.find(p => !p.usado && p.hash && p.hash === e.chave)
    if (exato) { exato.usado = true; resultado.set(e.chave, { status: 'conciliada', clienteId: exato.clienteId, fiadoId: exato.fiadoId }); }
  }
  for (const e of lista) {
    if (resultado.has(e.chave)) continue
    const cand = pagamentos
      .filter(p => !p.usado && !p.hash && Math.abs(p.valor - e.valor) < 0.01 && Math.abs(diasEntre(p.data, e.dataIso)) <= 3)
      .sort((a, b) => Math.abs(diasEntre(a.data, e.dataIso)) - Math.abs(diasEntre(b.data, e.dataIso)))[0]
    if (cand) { cand.usado = true; resultado.set(e.chave, { status: 'conciliada', clienteId: cand.clienteId, fiadoId: cand.fiadoId }) }
  }

  // 2) Sugestões de baixa em fiados ainda em aberto
  const abertos = fiados.filter(f => f.status !== 'pago' && Number(f.saldo) > 0.01)
  const porCliente = new Map()
  for (const f of abertos) {
    if (!porCliente.has(f.clienteId)) porCliente.set(f.clienteId, [])
    porCliente.get(f.clienteId).push(f)
  }
  for (const arr of porCliente.values()) arr.sort((a, b) => dia(a.dataVenda).localeCompare(dia(b.dataVenda)) || (a.id - b.id))
  const saldoReservado = new Map() // evita sugerir o mesmo fiado duas vezes

  for (const e of lista) {
    if (resultado.has(e.chave)) continue
    if (ign.has(e.chave)) { resultado.set(e.chave, { status: 'avista', ignorada: true }); continue }
    let melhor = null
    for (const [clienteId, fs] of porCliente) {
      const cli = nomeCliente.get(clienteId)
      if (!cli) continue
      const disponiveis = fs.filter(f => dia(f.dataVenda) <= e.dataIso && diasEntre(f.dataVenda, e.dataIso) <= 120)
        .map(f => ({ f, saldo: c2(Number(f.saldo) - (saldoReservado.get(f.id) || 0)) })).filter(x => x.saldo > 0.01)
      if (!disponiveis.length) continue
      const totalSaldo = c2(disponiveis.reduce((s, x) => s + x.saldo, 0))
      if (e.valor > totalSaldo + 0.01) continue // pagou mais do que deve: não é este cliente
      const nome = similaridadeNome(e.pagador.tokens, cli.nome)
      // Quais compras o valor quita? (a mais antiga primeiro; ou uma única compra de mesmo valor)
      const unica = disponiveis.find(x => Math.abs(x.saldo - e.valor) < 0.01)
      let selecionadas = [], soma = 0
      if (unica) { selecionadas = [unica]; soma = unica.saldo }
      else for (const x of disponiveis) { if (soma >= e.valor - 0.01) break; selecionadas.push(x); soma = c2(soma + x.saldo) }
      const quitaExato = Math.abs(soma - e.valor) < 0.01
      const valorBate = !!unica || Math.abs(totalSaldo - e.valor) < 0.01 || quitaExato
      let pontos = 0
      if (nome === 3) pontos += 6; else if (nome === 2) pontos += 4; else if (nome === 1) pontos += 2
      if (valorBate) pontos += 3
      if (pontos < 3) continue // só o nome fraco, sem valor que ajude: ruído demais
      // Só pelo valor (nome não bate): aceita apenas se for coincidência única entre os clientes
      if (nome === 0 && !valorBate) continue
      if (!melhor || pontos > melhor.pontos) melhor = { clienteId, pontos, nome, valorBate, quitaExato, selecionadas, totalSaldo }
    }
    if (melhor) {
      // Só pelo valor: confere que mais ninguém tem exatamente esse valor em aberto (senão é ambíguo)
      if (melhor.nome === 0) {
        const outros = [...porCliente.entries()].filter(([id, fs]) => id !== melhor.clienteId && fs.some(f => Math.abs(Number(f.saldo) - e.valor) < 0.01))
        if (outros.length) melhor = null
      }
    }
    if (melhor) {
      for (const x of melhor.selecionadas) saldoReservado.set(x.f.id, (saldoReservado.get(x.f.id) || 0) + x.saldo)
      const cli = nomeCliente.get(melhor.clienteId)
      const confianca = melhor.nome >= 2 && melhor.valorBate ? 'alta' : melhor.nome >= 2 ? 'media' : 'baixa'
      resultado.set(e.chave, {
        status: 'sugestao', clienteId: melhor.clienteId, clienteNome: cli?.nome || '',
        fiadoIds: melhor.selecionadas.map(x => x.f.id), quitaExato: melhor.quitaExato,
        saldoCliente: melhor.totalSaldo, confianca,
        motivo: melhor.nome >= 2 && melhor.valorBate ? 'O nome e o valor batem'
          : melhor.nome >= 2 ? 'O nome bate com a cliente'
          : 'Só o valor bate com uma cobrança em aberto',
      })
    } else resultado.set(e.chave, { status: 'avista' })
  }

  const itens = lista.map(e => ({ ...e, ...resultado.get(e.chave) }))
  return {
    itens,
    sugestoes: itens.filter(i => i.status === 'sugestao').sort((a, b) => b.dataIso.localeCompare(a.dataIso)),
    meses: resumoPorMes(itens),
    pagadoresAvista: pagadoresAvista(itens, clientes),
  }
}

/** Fiado × à vista por mês (AAAA-MM). */
function resumoPorMes(itens) {
  const mapa = new Map()
  for (const i of itens) {
    const m = i.dataIso.slice(0, 7)
    if (!mapa.has(m)) mapa.set(m, { mes: m, total: 0, fiado: 0, provavel: 0, avista: 0, qtdAvista: 0 })
    const x = mapa.get(m)
    x.total += i.valor
    if (i.status === 'conciliada') x.fiado += i.valor
    else if (i.status === 'sugestao') x.provavel += i.valor
    else { x.avista += i.valor; x.qtdAvista++ }
  }
  return [...mapa.values()].map(x => ({ ...x, total: c2(x.total), fiado: c2(x.fiado), provavel: c2(x.provavel), avista: c2(x.avista) }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
}

/** Quem paga à vista: agrupa as entradas "à vista" pelo nome de quem pagou. */
function pagadoresAvista(itens, clientes) {
  const grupos = new Map()
  for (const i of itens) {
    if (i.status !== 'avista' || !i.pagador.chave) continue
    // O banco às vezes corta o nome ("MARIA FATIMA SILV"): trata como a mesma pessoa
    const existente = [...grupos.keys()].find(k => k === i.pagador.chave || (Math.min(k.length, i.pagador.chave.length) >= 6 && (k.startsWith(i.pagador.chave) || i.pagador.chave.startsWith(k))))
    const chave = existente || i.pagador.chave
    if (!grupos.has(chave)) grupos.set(chave, { chave, nome: i.pagador.nome, tokens: i.pagador.tokens, datas: [], total: 0 })
    const g = grupos.get(chave)
    if (i.pagador.nome.length > g.nome.length) { g.nome = i.pagador.nome; g.tokens = i.pagador.tokens } // guarda a versão mais completa
    g.total += i.valor; g.datas.push(i.dataIso)
  }
  return [...grupos.values()].map(g => {
    const datas = [...g.datas].sort()
    const intervalos = datas.slice(1).map((d, k) => diasEntre(datas[k], d)).filter(n => n > 0)
    const cli = clientes.find(c => similaridadeNome(g.tokens, c.nome) >= 2)
    return {
      chave: g.chave, nome: g.nome, vezes: datas.length, total: c2(g.total), ticket: c2(g.total / datas.length),
      primeira: datas[0], ultima: datas[datas.length - 1],
      intervaloMedio: intervalos.length ? Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length) : null,
      tambemClienteFiado: cli ? cli.nome : '',
    }
  }).sort((a, b) => b.total - a.total)
}
