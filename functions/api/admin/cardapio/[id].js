// PUT /api/admin/cardapio/:id — só o app (Bearer ADMIN_TOKEN). Substitui o "publicar no GitHub".
// Corpo: { html, config, itens:[{uuid,nome,categoria,preco_centavos,ativo,ordem}] }
import { json, tokenValido, lerJson } from '../../../_lib/util.js'

const str = (v, n) => String(v ?? '').slice(0, n)

// DELETE /api/admin/cardapio/:id — "despublica": o link volta a servir o arquivo estático do GitHub.
// Os itens e os pedidos continuam guardados.
export async function onRequestDelete({ request, env, params }) {
  if (!tokenValido(request, env)) return json({ erro: 'Não autorizado' }, 401)
  if (!['diaadia', 'festa'].includes(params.id)) return json({ erro: 'Cardápio inválido' }, 404)
  const agora = Date.now()
  await env.DB.prepare('UPDATE cardapios SET html=NULL, versao=versao+1, atualizado_em=? WHERE id=?').bind(agora, params.id).run()
  return json({ ok: true })
}

export async function onRequestPut({ request, env, params }) {
  if (!tokenValido(request, env)) return json({ erro: 'Não autorizado' }, 401)
  const id = params.id
  if (!['diaadia', 'festa'].includes(id)) return json({ erro: 'Cardápio inválido' }, 404)

  let b
  try { b = await lerJson(request, 2_000_000) } catch { return json({ erro: 'JSON inválido ou grande demais' }, 400) }
  if (typeof b.html !== 'string' || b.html.length < 500 || b.html.length > 1_500_000) return json({ erro: 'html ausente ou fora do tamanho' }, 400)
  if (!Array.isArray(b.itens) || b.itens.length === 0 || b.itens.length > 400) return json({ erro: 'itens inválidos' }, 400)

  const vistos = new Set()
  const itens = []
  for (const i of b.itens) {
    const preco = i?.preco_centavos
    if (!i?.uuid || vistos.has(i.uuid) || !Number.isInteger(preco) || preco < 0 || preco > 10_000_000) {
      return json({ erro: `item inválido: ${str(i?.nome, 40)}` }, 400)
    }
    vistos.add(i.uuid)
    itens.push({ uuid: str(i.uuid, 64), nome: str(i.nome, 120), categoria: str(i.categoria, 60), preco, ativo: i.ativo === false ? 0 : 1, ordem: i.ordem | 0 })
  }
  const config = JSON.stringify(b.config || {})
  if (config.length > 20_000) return json({ erro: 'config grande demais' }, 400)

  const agora = Date.now()
  await env.DB.batch([
    env.DB.prepare(`UPDATE cardapios SET html=?, config=?, versao=versao+1, publicado_em=?, atualizado_em=? WHERE id=?`)
      .bind(b.html, config, agora, agora, id),
    // o que sumiu do cardápio vira "apagado" (exclusão lógica); o que veio volta a valer no upsert abaixo
    env.DB.prepare(`UPDATE itens SET apagado_em=?, atualizado_em=? WHERE cardapio_id=? AND apagado_em IS NULL`).bind(agora, agora, id),
    ...itens.map(i => env.DB.prepare(
      `INSERT INTO itens (cardapio_id, uuid, nome, categoria, preco_centavos, ativo, ordem, atualizado_em, apagado_em)
       VALUES (?,?,?,?,?,?,?,?,NULL)
       ON CONFLICT(cardapio_id, uuid) DO UPDATE SET nome=excluded.nome, categoria=excluded.categoria,
         preco_centavos=excluded.preco_centavos, ativo=excluded.ativo, ordem=excluded.ordem,
         atualizado_em=excluded.atualizado_em, apagado_em=NULL`)
      .bind(id, i.uuid, i.nome, i.categoria, i.preco, i.ativo, i.ordem, agora)),
  ]) // tudo ou nada
  return json({ ok: true, publicado_em: agora, itens: itens.length })
}
