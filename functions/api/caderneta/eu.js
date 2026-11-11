// GET /api/caderneta/eu — quem sou eu e o que posso fazer (o app usa só para esconder botões; o servidor decide).
// 401 sem login. Logado sem perfil: 200 com papel null (o app mostra "sem permissão" em vez de falhar em silêncio).
import { json } from '../../_lib/util.js'
import { autenticar } from '../../_lib/acesso.js'
import { descreverAcesso } from '../../_lib/papeis.js'

export async function onRequestGet({ request, env }) {
  const quem = await autenticar(request, env)
  if (!quem.ok) return json({ erro: 'Não autorizado' }, 401)
  return json(descreverAcesso(quem, env))
}
