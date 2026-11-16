// DELETE /api/admin/pedidos/:uuid — o app avisa que o dono apagou o pedido.
// Exclusão lógica (some das listagens e é removido de vez depois de 30 dias). Repetir a chamada é seguro.
import { json, tokenValido, uuidOk, lerJson } from '../../../_lib/util.js'

const STATUS_VALIDOS = new Set(['pendente', 'agendado', 'entregue', 'cancelado'])

export async function onRequestPut({ request, env, params }) {
  if (!tokenValido(request, env)) return json({ erro: 'Não autorizado' }, 401)
  if (!uuidOk(params.uuid)) return json({ erro: 'Pedido inválido' }, 400)
  let dados
  try { dados = await lerJson(request, 4096) } catch { return json({ erro: 'Dados inválidos' }, 400) }
  if (!STATUS_VALIDOS.has(dados?.status)) return json({ erro: 'Status inválido' }, 400)
  const agora = Date.now()
  const resultado = await env.DB.prepare('UPDATE pedidos SET status = ?, dados = json_set(COALESCE(dados, \'{}\'), \'$.agendadoPara\', ?, \'$.horaAgendada\', ?), atualizado_em = ? WHERE uuid = ? AND apagado_em IS NULL')
    .bind(dados.status, dados.agendadoPara || null, dados.horaAgendada || null, agora, params.uuid).run()
  if (!resultado.meta?.changes) return json({ erro: 'Pedido não encontrado' }, 404)
  return json({ ok: true, atualizado_em: agora })
}

export async function onRequestDelete({ request, env, params }) {
  if (!tokenValido(request, env)) return json({ erro: 'Não autorizado' }, 401)
  if (!uuidOk(params.uuid)) return json({ erro: 'Pedido inválido' }, 400)
  const agora = Date.now()
  await env.DB.prepare('UPDATE pedidos SET apagado_em = ?, atualizado_em = ? WHERE uuid = ? AND apagado_em IS NULL')
    .bind(agora, agora, params.uuid).run()
  return json({ ok: true })
}
