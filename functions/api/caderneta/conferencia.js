// GET /api/caderneta/conferencia — contagens, saldo em aberto (total e por loja) e violações (devem ser 0).
import { json } from '../../_lib/util.js'
import { autenticar } from '../../_lib/acesso.js'
import { conferenciaCaderneta } from '../../_lib/caderneta.js'

export async function onRequestGet({ request, env }) {
  const quem = await autenticar(request, env)
  if (!quem.ok) return json({ erro: 'Não autorizado' }, 401)
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  return json(await conferenciaCaderneta(env.DB))
}
