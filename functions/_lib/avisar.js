// Aviso de pedido novo por Telegram. Nunca atrapalha o pedido: qualquer falha é engolida.
// Precisa dos segredos TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID; sem eles não faz nada.
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function montarAviso({ pedidoId, cardapioId, nome, telefone, recebimento, total, sinal, linhas }) {
  const itens = linhas.map(l => `${l.qtd}x ${l.nome}`).join('\n')
  return [
    `🍫 Novo pedido nº ${String(pedidoId).slice(-6).toUpperCase()} (${cardapioId})`,
    nome ? `Cliente: ${nome}` : null,
    telefone ? `WhatsApp: ${telefone}` : null,
    `Recebimento: ${recebimento}`,
    '',
    itens,
    '',
    `Total: ${brl(total)}` + (sinal ? ` · Sinal: ${brl(sinal)}` : ''),
  ].filter(x => x !== null).join('\n')
}

export async function avisarTelegram(env, dados, { fetchFn = fetch, timeoutMs = 5000 } = {}) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetchFn(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: montarAviso(dados) }),
      signal: ctl.signal,
    })
    return r.ok
  } catch { return false } finally { clearTimeout(timer) }
}
