// GET /api/caderneta/estado?desde=<cursor> — o que mudou na Caderneta depois do cursor (0 = tudo).
// Qualquer perfil (Admin ou Vendas) lê.
import { json } from '../../_lib/util.js'
import { exigirPerfil } from '../../_lib/cadernetaHttp.js'
import { lerEstado } from '../../_lib/caderneta.js'

export async function onRequestGet({ request, env }) {
  const acesso = await exigirPerfil(request, env)
  if (acesso.erro) return acesso.erro
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  const desde = Math.max(0, Number(new URL(request.url).searchParams.get('desde')) || 0)
  return json(await lerEstado(env.DB, desde))
}
