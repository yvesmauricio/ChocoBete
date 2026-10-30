// GET /api/admin/pedidos?desde=<ms> — só o app. Lista pedidos novos (a "caixa de entrada" do app).
// Pedidos apagados pelo app não aparecem aqui. Quem foi apagado há mais de 30 dias é removido de vez.
import { json, tokenValido } from '../../_lib/util.js'

const DIAS_ATE_REMOVER = 30

export async function onRequestGet({ request, env }) {
  if (!tokenValido(request, env)) return json({ erro: 'Não autorizado' }, 401)
  const desde = Number(new URL(request.url).searchParams.get('desde')) || 0

  // Faxina: aproveita a chamada do app (não há agendador no Pages). Itens primeiro, depois o pedido.
  const limite = Date.now() - DIAS_ATE_REMOVER * 86_400_000
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pedido_itens WHERE pedido_uuid IN (SELECT uuid FROM pedidos WHERE apagado_em IS NOT NULL AND apagado_em < ?)').bind(limite),
    env.DB.prepare('DELETE FROM pedidos WHERE apagado_em IS NOT NULL AND apagado_em < ?').bind(limite),
  ])

  const { results: pedidos } = await env.DB.prepare(
    `SELECT uuid, cardapio_id, origem, cliente_nome, cliente_telefone, recebimento, subtotal_centavos, taxa_centavos,
            total_centavos, sinal_centavos, status, dados, criado_em, atualizado_em
       FROM pedidos WHERE atualizado_em > ? AND apagado_em IS NULL ORDER BY atualizado_em LIMIT 200`).bind(desde).all()
  if (!pedidos.length) return json({ pedidos: [], itens: [] })
  const marcas = pedidos.map(() => '?').join(',')
  const { results: itens } = await env.DB.prepare(
    `SELECT pedido_uuid, item_uuid, nome, categoria, preco_centavos, qtd FROM pedido_itens WHERE pedido_uuid IN (${marcas})`)
    .bind(...pedidos.map(p => p.uuid)).all()
  return json({ pedidos, itens })
}
