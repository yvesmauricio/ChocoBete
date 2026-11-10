// GET /api/caderneta/estado?desde=<cursor> — o que mudou na Caderneta depois do cursor (0 = tudo).
import { json } from '../../_lib/util.js'
import { autenticar } from '../../_lib/acesso.js'
import { lerEstado } from '../../_lib/caderneta.js'

export async function onRequestGet({ request, env }) {
  const quem = await autenticar(request, env)
  if (!quem.ok) return json({ erro: 'Não autorizado' }, 401)
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  const desde = Math.max(0, Number(new URL(request.url).searchParams.get('desde')) || 0)
  return json(await lerEstado(env.DB, desde))
}
