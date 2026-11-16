// POST /api/pedido — público. Recebe SÓ ids e quantidades; o servidor decide o preço.
import { calcularPedido } from '../_lib/preco.js'
import { montarPayloadPix } from '../_lib/pix.js'
import { json, uuidOk, mesmaOrigem, lerJson, hashIp } from '../_lib/util.js'

const LIMITE_POR_IP_10MIN = 6
const LIMITE_GLOBAL_HORA = 300

// O código do pedido (o "Pedido nº" que o cliente e o app veem) é o final do id, em maiúsculas.
const codigoDoPedido = (id) => String(id).slice(-6).toUpperCase()

// Resposta única para pedido novo e repetido. O Pix leva o valor a pagar agora (sinal ou total).
function resposta(config, id, v, extra = {}) {
  const codigo = codigoDoPedido(id)
  const payload = montarPayloadPix({ pix: config.pix, valorCentavos: v.sinal, txid: 'CB' + codigo })
  return json({ ok: true, pedido_id: id, codigo, subtotal: v.subtotal, taxa: v.taxa, total: v.total, sinal: v.sinal,
                pix: payload ? { payload, valor: v.sinal } : null, ...extra })
}

export async function onRequestPost({ request, env }) {
  if (!mesmaOrigem(request)) return json({ erro: 'Origem não permitida' }, 403)

  let b
  try { b = await lerJson(request, 20_000) } catch (e) {
    return json({ erro: e.message === 'grande' ? 'Pedido grande demais' : 'JSON inválido' }, e.message === 'grande' ? 413 : 400)
  }

  const cardapioId = b?.cardapio_id
  if (!['diaadia', 'festa'].includes(cardapioId)) return json({ erro: 'Cardápio inválido' }, 400)
  if (!uuidOk(b.pedido_id)) return json({ erro: 'pedido_id inválido' }, 400)
  const texto = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null
  const endereco = texto(b.endereco, 300)
  // Quem manda endereço está pedindo entrega: não dá para escapar da taxa declarando "retirada".
  const recebimento = (b.recebimento === 'entrega' || endereco) ? 'entrega' : 'retirada'
  if (recebimento === 'entrega' && !endereco) return json({ erro: 'Informe o endereço da entrega.' }, 422)

  const agora = Date.now()
  const ipHash = await hashIp(request, env)

  const cab = await env.DB.prepare('SELECT config FROM cardapios WHERE id = ?').bind(cardapioId).first()
  if (!cab) return json({ erro: 'Cardápio não encontrado' }, 404)
  const config = JSON.parse(cab.config || '{}')

  // Reenvio do MESMO pedido (clique duplo, rede ruim): devolve o que já existe, sem contar como spam
  const ja = await env.DB.prepare('SELECT subtotal_centavos, taxa_centavos, total_centavos, sinal_centavos FROM pedidos WHERE uuid = ?')
    .bind(b.pedido_id).first()
  if (ja) return resposta(config, b.pedido_id, { subtotal: ja.subtotal_centavos, taxa: ja.taxa_centavos, total: ja.total_centavos, sinal: ja.sinal_centavos }, { repetido: true })

  // Limite de spam: por IP (anônimo) e global
  const [porIp, global] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) n FROM pedidos WHERE ip_hash = ? AND criado_em > ?').bind(ipHash, agora - 600_000).first(),
    env.DB.prepare("SELECT COUNT(*) n FROM pedidos WHERE origem = 'site' AND criado_em > ?").bind(agora - 3_600_000).first(),
  ])
  if (porIp.n >= LIMITE_POR_IP_10MIN || global.n >= LIMITE_GLOBAL_HORA) {
    return json({ erro: 'Muitos pedidos agora. Envie pelo WhatsApp mesmo.' }, 429)
  }

  const { results: itens } = await env.DB.prepare(
    `SELECT uuid, nome, categoria, preco_centavos FROM itens
      WHERE cardapio_id = ? AND ativo = 1 AND apagado_em IS NULL`).bind(cardapioId).all()

  const r = calcularPedido({ itens, linhas: b.itens, config, recebimento, cardapioId })
  if (!r.ok) return json({ erro: r.erro }, 422)

  // O total que o cliente VIU precisa ser o total do servidor. Se não for (preço mudou, página adulterada),
  // nada é gravado: a página recarrega com os valores certos. Não sobra pedido "fantasma" no banco.
  if (Number.isInteger(b.total_visto) && b.total_visto !== r.total) {
    return json({ erro: 'precos_mudaram', total: r.total }, 409)
  }

  // telefone: só dígitos, 10 a 13 (DDD + número, com ou sem 55); fora disso guarda vazio em vez de lixo
  const digitos = String(b.cliente_telefone ?? '').replace(/\D/g, '')
  const telefone = digitos.length >= 10 && digitos.length <= 13 ? digitos : null
  const extra = { obs: texto(b.obs, 500), endereco }
  // Pedido e itens entram JUNTOS (uma transação): o app do dono nunca lê um pedido sem itens.
  // OR IGNORE: se dois envios do mesmo pedido_id chegarem ao mesmo tempo, o segundo não duplica nem falha.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO pedidos
         (uuid, cardapio_id, origem, cliente_nome, cliente_telefone, recebimento,
          subtotal_centavos, taxa_centavos, total_centavos, sinal_centavos, ip_hash, dados, criado_em, atualizado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(b.pedido_id, cardapioId, 'site', texto(b.cliente_nome, 80), telefone, recebimento,
            r.subtotal, r.taxa, r.total, r.sinal, ipHash, JSON.stringify(extra), agora, agora),
    ...r.linhas.map(l => env.DB.prepare(
      `INSERT OR IGNORE INTO pedido_itens (pedido_uuid, item_uuid, nome, categoria, preco_centavos, qtd) VALUES (?,?,?,?,?,?)`)
      .bind(b.pedido_id, l.uuid, l.nome, l.categoria, l.preco_centavos, l.qtd)),
  ])

  return resposta(config, b.pedido_id, r)
}
