// POST /api/caderneta/ops — o aparelho envia a fila de operações (em ordem de criação).
// Corpo: { aparelho, ops: [{ op_id, tipo, dados, criado_no_aparelho }] }  (máx. 50 por chamada)
// Resposta: { resultados: [{ op_id, status, motivo? }] } com status aplicada | duplicada | rejeitada | tentar_de_novo.
// Para no primeiro "tentar_de_novo" (as seguintes podem depender dela); o aparelho reenvia depois.
// Login: Cloudflare Access (nenhum token fica no aparelho) ou ADMIN_TOKEN. Perfil: ver _lib/papeis.js.
import { json, lerJson, mesmaOrigem } from '../../_lib/util.js'
import { exigirPerfil, processarOps } from '../../_lib/cadernetaHttp.js'

export async function onRequestPost({ request, env }) {
  const acesso = await exigirPerfil(request, env)
  if (acesso.erro) return acesso.erro
  if (!mesmaOrigem(request)) return json({ erro: 'Origem não permitida' }, 403)
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  let corpo
  try { corpo = await lerJson(request, 256 * 1024) } catch { return json({ erro: 'Corpo inválido ou grande demais' }, 400) }
  const r = await processarOps({ DB: env.DB, quem: acesso.quem, papel: acesso.papel, env, corpo })
  return json(r.corpo, r.status)
}
