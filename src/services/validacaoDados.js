// ─────────────────────────────────────────────────────────────────────────
// Conferências antes de enviar ou aplicar dados (puro: sem banco nem rede).
//
// 1) Queda brusca: o resultado teria muito menos registros do que o ponto de
//    comparação (Drive ou este aparelho)? Sinal típico de cache limpo, banco
//    recriado ou restauração de cópia velha.
// 2) Cobranças incoerentes NOVAS: saldo diferente de total − pagamentos,
//    status que não bate com o saldo, venda sem cliente/loja. Só conta o que
//    NÃO existia já no ponto de comparação — dado antigo e legítimo com
//    pequena diferença não pode travar a sincronização do negócio.
//
// Se algo for apontado, o app NÃO envia nem aplica sozinho: guarda uma cópia,
// mostra o motivo e pede confirmação.
// ─────────────────────────────────────────────────────────────────────────

const arr = (d, t) => (Array.isArray(d?.[t]) ? d[t] : [])
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const reais = (v) => Math.round(num(v) * 100) / 100

export const AREAS_CONTADAS = [
  ['cad_lojas', 'lojas'],
  ['cad_clientes', 'clientes'],
  ['cad_fiados', 'vendas fiadas'],
  ['cardapio_pedidos', 'pedidos do balcão'],
  ['receitas', 'receitas'],
  ['produtos', 'produtos'],
  ['producoes', 'produções'],
  ['financeiro', 'lançamentos financeiros'],
]

export function resumir(dados) {
  const fiados = arr(dados, 'cad_fiados')
  const abertos = fiados.filter(f => f?.status === 'aberto')
  const out = { saldoAberto: reais(abertos.reduce((s, f) => s + num(f.saldo), 0)), fiadosAbertos: abertos.length }
  for (const [tabela] of AREAS_CONTADAS) out[tabela] = arr(dados, tabela).length
  return out
}

/**
 * @returns lista de { tabela, rotulo, antes, depois } para cada área que encolheu demais.
 * Encolher "demais" = perder pelo menos `minimo` registros E pelo menos `fracao` do total,
 * ou perder `absoluto` ou mais de uma vez.
 */
export function verificarQueda(antes, depois, { minimo = 3, fracao = 0.2, absoluto = 10 } = {}) {
  const a = resumir(antes), d = resumir(depois)
  const alertas = []
  for (const [tabela, rotulo] of AREAS_CONTADAS) {
    const perdeu = a[tabela] - d[tabela]
    if (perdeu <= 0) continue
    if ((perdeu >= minimo && perdeu / a[tabela] >= fracao) || perdeu >= absoluto) {
      alertas.push({ tabela, rotulo, antes: a[tabela], depois: d[tabela] })
    }
  }
  return alertas
}

function chave(r, tabela) { return r?.uid != null ? String(r.uid) : `${tabela}:${r?.id}` }

/** Problemas de coerência nas cobranças, cada um com uma chave estável (para comparar entre versões). */
export function problemasDeCobranca(dados) {
  const lojas = new Set(arr(dados, 'cad_lojas').map(r => r?.id))
  const clientes = new Set(arr(dados, 'cad_clientes').map(r => r?.id))
  const probs = new Map()
  const add = (r, tabela, tipo, texto) => probs.set(`${tipo}|${chave(r, tabela)}`, texto)

  for (const c of arr(dados, 'cad_clientes')) {
    if (c?.lojaId != null && !lojas.has(c.lojaId)) add(c, 'cad_clientes', 'cliente_sem_loja', `Cliente "${c.nome ?? '?'}" sem loja`)
  }
  for (const f of arr(dados, 'cad_fiados')) {
    if (!f) continue
    const nome = `Venda de ${f.dataVenda ?? f.data ?? 's/ data'}`
    if (f.clienteId != null && !clientes.has(f.clienteId)) add(f, 'cad_fiados', 'venda_sem_cliente', `${nome} sem cliente`)
    if (f.lojaId != null && !lojas.has(f.lojaId)) add(f, 'cad_fiados', 'venda_sem_loja', `${nome} sem loja`)
    const total = num(f.total), saldo = num(f.saldo)
    if (saldo < -0.01) add(f, 'cad_fiados', 'saldo_negativo', `${nome}: saldo negativo`)
    if (saldo > total + 0.01 && Number.isFinite(Number(f.total))) add(f, 'cad_fiados', 'saldo_maior_que_total', `${nome}: saldo maior que o total`)
    if (Array.isArray(f.pagamentos) && Number.isFinite(Number(f.total))) {
      const pago = f.pagamentos.reduce((s, p) => s + num(p?.valor), 0)
      if (Math.abs(Math.max(0, reais(total - pago)) - Math.max(0, reais(saldo))) > 0.011) {
        add(f, 'cad_fiados', 'saldo_nao_fecha', `${nome}: saldo não bate com total − pagamentos`)
      }
    }
    const quitado = saldo <= 0.01
    if ((f.status === 'pago') !== quitado && (f.status === 'pago' || f.status === 'aberto')) {
      add(f, 'cad_fiados', 'status_incoerente', `${nome}: status "${f.status}" não bate com o saldo`)
    }
  }
  return probs
}

/** Problemas que existem em `depois` e NÃO existiam em `antes`. */
export function problemasNovos(antes, depois) {
  const a = problemasDeCobranca(antes)
  const novos = []
  for (const [k, texto] of problemasDeCobranca(depois)) if (!a.has(k)) novos.push(texto)
  return novos
}

/**
 * Conferência completa. `referencia` = ponto de comparação (o que existe hoje
 * no destino); `resultado` = o que passaria a existir.
 * @returns { ok, quedas, novos, linhas } — `linhas` são frases prontas para a tela.
 */
export function conferir(referencia, resultado, opcoes) {
  const quedas = verificarQueda(referencia, resultado, opcoes)
  const novos = problemasNovos(referencia, resultado)
  const linhas = [
    ...quedas.map(q => `${q.rotulo}: de ${q.antes} para ${q.depois}`),
    ...novos.slice(0, 5),
    ...(novos.length > 5 ? [`…e mais ${novos.length - 5} problema(s) nas cobranças`] : []),
  ]
  return { ok: !quedas.length && !novos.length, quedas, novos, linhas }
}
