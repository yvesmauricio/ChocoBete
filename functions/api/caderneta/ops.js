// POST /api/caderneta/ops — o aparelho envia a fila de operações (em ordem de criação).
// Corpo: { aparelho, ops: [{ op_id, tipo, dados, criado_no_aparelho }] }  (máx. 50 por chamada)
// Resposta: { resultados: [{ op_id, status, motivo? }] } com status aplicada | duplicada | rejeitada | tentar_de_novo.
// Para no primeiro "tentar_de_novo" (as seguintes podem depender dela); o aparelho reenvia depois.
// Login: Cloudflare Access (nenhum token fica no aparelho) ou ADMIN_TOKEN.
import { json, lerJson, mesmaOrigem } from '../../_lib/util.js'
import { autenticar } from '../../_lib/acesso.js'
import { aplicarOperacao } from '../../_lib/caderneta.js'

export async function onRequestPost({ request, env }) {
  const quem = await autenticar(request, env)
  if (!quem.ok) return json({ erro: 'Não autorizado' }, 401)
  if (!mesmaOrigem(request)) return json({ erro: 'Origem não permitida' }, 403)
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  let corpo
  try { corpo = await lerJson(request, 256 * 1024) } catch { return json({ erro: 'Corpo inválido ou grande demais' }, 400) }
  const ops = Array.isArray(corpo?.ops) ? corpo.ops : null
  if (!ops || !ops.length || ops.length > 50) return json({ erro: 'Envie de 1 a 50 operações' }, 400)

  const resultados = []
  for (const op of ops) {
    try {
      const r = await aplicarOperacao(env.DB, op, { usuario: quem.usuario, aparelho: String(corpo.aparelho || '').slice(0, 60) })
      resultados.push(r)
      if (r.status === 'tentar_de_novo') break
    } catch {
      return json({ resultados, erro: 'Falha temporária no servidor' }, 503) // as já aplicadas constam; o resto segue na fila
    }
  }
  return json({ resultados })
}
