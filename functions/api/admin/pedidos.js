// GET /api/admin/pedidos?desde=<ms> — só o app. Lista pedidos novos/alterados (base da futura sync).
import { json, tokenValido } from '../../_lib/util.js'

export async function onRequestGet({ request, env }) {
  if (!tokenValido(request, env)) return json({ erro: 'Não autorizado' }, 401)
  const desde = Number(new URL(request.url).searchParams.get('desde')) || 0
  const { results: pedidos } = await env.DB.prepare(
    `SELECT uuid, cardapio_id, origem, cliente_nome, cliente_telefone, recebimento, subtotal_centavos, taxa_centavos,
            total_centavos, sinal_centavos, status, dados, criado_em, atualizado_em, apagado_em
       FROM pedidos WHERE atualizado_em > ? ORDER BY atualizado_em LIMIT 200`).bind(desde).all()
  if (!pedidos.length) return json({ pedidos: [], itens: [] })
  const marcas = pedidos.map(() => '?').join(',')
  const { results: itens } = await env.DB.prepare(
    `SELECT pedido_uuid, item_uuid, nome, categoria, preco_centavos, qtd FROM pedido_itens WHERE pedido_uuid IN (${marcas})`)
    .bind(...pedidos.map(p => p.uuid)).all()
  return json({ pedidos, itens })
}
