const SEGURANCA = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}
export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...SEGURANCA, ...extra },
  })

// Comparação em tempo constante (evita descobrir o token por diferença de tempo)
export function tokenValido(req, env) {
  const recebido = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const esperado = env.ADMIN_TOKEN || ''
  // token curto demais = configuração fraca: recusa tudo em vez de aceitar
  if (esperado.length < 32 || recebido.length !== esperado.length) return false
  let diff = 0
  for (let i = 0; i < esperado.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i)
  return diff === 0
}

export const uuidOk = (s) => typeof s === 'string' && /^[0-9a-zA-Z_-]{8,64}$/.test(s)

// Só aceita POST vindo da própria página (bloqueia formulário/script de outro site)
export function mesmaOrigem(req) {
  const o = req.headers.get('origin')
  if (!o) return true // alguns navegadores omitem em same-origin; o limite por IP cobre o resto
  try { return new URL(o).host === new URL(req.url).host } catch { return false }
}

// Lê o corpo com teto de tamanho (não confia em Content-Length)
export async function lerJson(req, maxBytes) {
  const buf = await req.arrayBuffer()
  if (buf.byteLength > maxBytes) throw new Error('grande')
  return JSON.parse(new TextDecoder().decode(buf))
}

export async function hashIp(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || 'sem-ip'
  const dados = new TextEncoder().encode(ip + '|' + (env.ADMIN_TOKEN || '').slice(0, 16))
  const h = await crypto.subtle.digest('SHA-256', dados)
  return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')
}
