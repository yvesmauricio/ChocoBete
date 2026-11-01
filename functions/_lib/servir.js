// Serve o cardápio publicado. Se ainda não há versão no D1, cai no arquivo estático de hoje
// (por isso dá para ligar/desligar sem risco).
export async function servirCardapio(id, { env, next }) {
  let row = null
  try { row = await env.DB.prepare('SELECT html FROM cardapios WHERE id = ?').bind(id).first() } catch { /* D1 fora do ar: usa o estático */ }
  if (!row?.html) return next()
  // Chave PÚBLICA do Turnstile (variável TURNSTILE_SITE_KEY): entra na página na hora de servir, sem republicar.
  const html = row.html.replace('%%TURNSTILE_SITEKEY%%', env.TURNSTILE_SITE_KEY || '')
  return new Response(html, { headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, must-revalidate',   // mesma regra do seu _headers atual
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  } })
}
