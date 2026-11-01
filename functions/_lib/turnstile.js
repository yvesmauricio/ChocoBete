// Verificação do Cloudflare Turnstile (anti-robô) para pedidos do site.
// - Sem TURNSTILE_SECRET configurado: não verifica (nada muda para os clientes).
// - Com o segredo: pedido sem token válido é recusado (403). O cliente segue pelo WhatsApp como sempre.
// - Se o serviço de verificação da Cloudflare estiver fora do ar/lento: deixa passar (os limites por IP continuam valendo),
//   para o pedido nunca depender de um terceiro.
const URL_VERIFICACAO = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verificarTurnstile(token, ip, env, { timeoutMs = 4000, fetchFn = fetch } = {}) {
  if (!env.TURNSTILE_SECRET) return { ok: true, pulado: true }
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) return { ok: false, motivo: 'sem-token' }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token })
    if (ip) form.set('remoteip', ip)
    const r = await fetchFn(URL_VERIFICACAO, { method: 'POST', body: form, signal: ctl.signal })
    if (!r.ok) return { ok: true, indisponivel: true }
    const d = await r.json()
    return d.success === true ? { ok: true } : { ok: false, motivo: (d['error-codes'] || []).join(',') || 'recusado' }
  } catch {
    return { ok: true, indisponivel: true }
  } finally {
    clearTimeout(timer)
  }
}
