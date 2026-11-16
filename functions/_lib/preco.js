// Cálculo de pedido NO SERVIDOR. Espelha as regras do HTML atual
// (subtotaisPorCategoria / pendenciasMinimo / taxa / sinal), mas com os preços do D1.
// Função pura: não toca em banco nem em rede, por isso é fácil de testar.

const MAX_LINHAS = 60
const MAX_QTD = 500

/**
 * @param {Array<{uuid,nome,categoria,preco_centavos}>} itens  itens ATIVOS do cardápio (vindos do D1)
 * @param {Array<{uuid,qtd}>} linhas    o que o cliente escolheu (só uuid e quantidade!)
 * @param {object} config               cardapios.config já em objeto
 * @param {'retirada'|'entrega'} recebimento
 * @param {string} cardapioId
 */
export function calcularPedido({ itens, linhas, config = {}, recebimento, cardapioId }) {
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > MAX_LINHAS) {
    return { ok: false, erro: 'Pedido vazio ou grande demais.' }
  }
  const porUuid = new Map(itens.map(i => [i.uuid, i]))
  const vistos = new Set()
  const resolvidas = []

  for (const l of linhas) {
    const item = porUuid.get(l?.uuid)
    if (!item) return { ok: false, erro: 'Item indisponível. Atualize a página do cardápio.' }
    if (vistos.has(l.uuid)) return { ok: false, erro: 'Item repetido no pedido.' }
    vistos.add(l.uuid)
    const qtd = l.qtd
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > MAX_QTD) return { ok: false, erro: 'Quantidade inválida.' }
    resolvidas.push({ ...item, qtd, subtotal_centavos: item.preco_centavos * qtd })
  }

  // Mínimo por categoria — só cobra categorias que têm algo escolhido (igual ao HTML)
  const porCat = {}
  for (const r of resolvidas) {
    const c = (porCat[r.categoria] ||= { valor: 0, unidades: 0 })
    c.valor += r.subtotal_centavos
    c.unidades += r.qtd
  }
  const pendencias = []
  for (const [cat, min] of Object.entries(config.minimos || {})) {
    const atual = porCat[cat]
    if (!atual) continue
    const falta = (min.valor_centavos > 0 && atual.valor < min.valor_centavos) ||
                  (min.unidades > 0 && atual.unidades < min.unidades)
    if (falta) pendencias.push(cat)
  }
  if (pendencias.length) return { ok: false, erro: `Pedido mínimo não atingido: ${pendencias.join(', ')}.`, pendencias }

  const subtotal = resolvidas.reduce((s, r) => s + r.subtotal_centavos, 0)
  // dia a dia: taxa fixa se for entrega. festa: nunca tem taxa fixa ("a combinar" no WhatsApp)
  const taxa = cardapioId === 'diaadia' && recebimento === 'entrega'
    ? Math.max(0, Math.round(config.taxa_entrega_centavos || 0)) : 0
  const total = subtotal + taxa
  const fracao = Math.min(1, Math.max(0, (config.sinal_percentual || 0) / 100))
  const sinal = config.sinal_ativo && fracao > 0 ? Math.round(total * fracao) : total

  return { ok: true, linhas: resolvidas, subtotal, taxa, total, sinal }
}
