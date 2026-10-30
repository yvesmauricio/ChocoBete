// DELETE /api/admin/pedidos/:uuid — o app avisa que o dono apagou o pedido.
// Exclusão lógica (some das listagens e é removido de vez depois de 30 dias). Repetir a chamada é seguro.
import { json, tokenValido, uuidOk } from '../../../_lib/util.js'

export async function onRequestDelete({ request, env, params }) {
  if (!tokenValido(request, env)) return json({ erro: 'Não autorizado' }, 401)
  if (!uuidOk(params.uuid)) return json({ erro: 'Pedido inválido' }, 400)
  const agora = Date.now()
  await env.DB.prepare('UPDATE pedidos SET apagado_em = ?, atualizado_em = ? WHERE uuid = ? AND apagado_em IS NULL')
    .bind(agora, agora, params.uuid).run()
  return json({ ok: true })
}
