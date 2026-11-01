// Login das rotas internas (/api/ping e, na fase de sync, /api/sync/*).
//
// Duas formas de entrar, qualquer uma basta:
//   1. Login do Cloudflare Access: o Access manda o cabeçalho `Cf-Access-Jwt-Assertion`. Aqui a assinatura
//      é conferida DE NOVO (defesa em profundidade: se alguém mexer na regra do Access por engano,
//      a rota continua fechada). Precisa de duas variáveis no projeto (não são segredos):
//        CF_ACCESS_TEAM_DOMAIN  ex.: meutime.cloudflareaccess.com   (sem https://)
//        CF_ACCESS_AUD          o "Application Audience (AUD) Tag" do aplicativo no Access
//   2. Chave de administrador (ADMIN_TOKEN), como as rotas /api/admin/* já usam.
// Sem as variáveis do Access, só a chave funciona.
import { tokenValido } from './util.js'

const TTL_CHAVES_MS = 10 * 60_000
let cacheChaves = { dominio: '', ate: 0, chaves: null }

const b64urlParaBytes = (s) => {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(s).length / 4) * 4, '='))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}
const b64urlParaJson = (s) => JSON.parse(new TextDecoder().decode(b64urlParaBytes(s)))

async function chavesDoAccess(dominio) {
  const agora = Date.now()
  if (cacheChaves.chaves && cacheChaves.dominio === dominio && agora < cacheChaves.ate) return cacheChaves.chaves
  const r = await fetch(`https://${dominio}/cdn-cgi/access/certs`, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`certs ${r.status}`)
  const { keys } = await r.json()
  if (!Array.isArray(keys) || !keys.length) throw new Error('sem chaves')
  cacheChaves = { dominio, ate: agora + TTL_CHAVES_MS, chaves: keys }
  return keys
}

/** Confere um JWT do Access. Retorna { email, sub } ou lança Error com o motivo. */
export async function verificarJwtAccess(jwt, { dominio, aud, agora = Date.now() }) {
  const partes = String(jwt || '').split('.')
  if (partes.length !== 3) throw new Error('formato')
  const cab = b64urlParaJson(partes[0])
  if (cab.alg !== 'RS256') throw new Error('algoritmo')
  const dados = b64urlParaJson(partes[1])

  const chaves = await chavesDoAccess(dominio)
  const jwk = chaves.find(k => k.kid === cab.kid)
  if (!jwk) { cacheChaves.ate = 0; throw new Error('chave desconhecida') } // pode ter girado: busca de novo na próxima
  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, b64urlParaBytes(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`))
  if (!ok) throw new Error('assinatura')

  const s = Math.floor(agora / 1000)
  if (!Number.isFinite(dados.exp) || s >= dados.exp) throw new Error('expirado')
  if (Number.isFinite(dados.nbf) && s + 60 < dados.nbf) throw new Error('ainda não vale')
  if (dados.iss !== `https://${dominio}`) throw new Error('emissor')
  const auds = Array.isArray(dados.aud) ? dados.aud : [dados.aud]
  if (!aud || !auds.includes(aud)) throw new Error('audiência')
  return { email: dados.email || null, sub: dados.sub || null }
}

/**
 * Quem está chamando? Retorna { ok:true, modo:'access'|'token', usuario } ou { ok:false }.
 * Nunca lança: qualquer problema vira "não autenticado".
 */
export async function autenticar(request, env) {
  if (tokenValido(request, env)) return { ok: true, modo: 'token', usuario: 'administrador' }
  const jwt = request.headers.get('cf-access-jwt-assertion')
  if (jwt && env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
    try {
      const u = await verificarJwtAccess(jwt, { dominio: env.CF_ACCESS_TEAM_DOMAIN, aud: env.CF_ACCESS_AUD })
      return { ok: true, modo: 'access', usuario: u.email || u.sub || 'access' }
    } catch { /* cai no não autenticado */ }
  }
  return { ok: false }
}

// só para testes: limpa o cache de chaves entre cenários
export const _limparCache = () => { cacheChaves = { dominio: '', ate: 0, chaves: null } }
