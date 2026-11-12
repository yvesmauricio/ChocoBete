// G-ET /api/caderneta/conferencia — contagens, saldo em aberto (total e por loja) e violações (devem ser 0). Só Admin.
import { json } from '../../_lib/util.js'
import { exigirPerfil } from '../../_lib/cadernetaHttp.js'
import { conferenciaCaderneta } from '../../_lib/caderneta.js'

export async function onRequestGet({ request, env }) {
  const acesso = await exigirPerfil(request, env, { soAdmin: true })
  if (acesso.erro) return acesso.erro
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  return json(await conferenciaCaderneta(env.DB))
}
