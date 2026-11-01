// GET /api/ping — rota de teste da fase 1. Prova, de uma vez: a rota responde, o login vale,
// o banco (binding DB) responde e as tabelas esperadas existem. Não grava nada.
// Sem login: 401 sem nenhum detalhe.
import { json } from '../_lib/util.js'
import { autenticar } from '../_lib/acesso.js'

// Tabelas que a migração 0001 cria. Se alguma faltar, o ping avisa qual (migração não aplicada).
const TABELAS_ESPERADAS = ['cardapios', 'itens', 'pedidos', 'pedido_itens', 'registros']

export async function onRequestGet({ request, env }) {
  const quem = await autenticar(request, env)
  if (!quem.ok) return json({ erro: 'Não autorizado' }, 401)

  const t0 = Date.now()
  const resp = { ok: true, hora: t0, login: { modo: quem.modo, usuario: quem.usuario } }

  if (!env.DB) {
    return json({ ...resp, ok: false, banco: { ok: false, erro: 'Binding DB não configurado neste ambiente.' } }, 503)
  }
  try {
    await env.DB.prepare('SELECT 1 AS um').first()
    const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    const existentes = new Set(results.map(r => r.name))
    const faltando = TABELAS_ESPERADAS.filter(n => !existentes.has(n))
    resp.banco = { ok: faltando.length === 0, tabelas_faltando: faltando, ms: Date.now() - t0 }
    if (faltando.length) resp.ok = false
  } catch (e) {
    return json({ ...resp, ok: false, banco: { ok: false, erro: 'O banco não respondeu.' } }, 503)
  }
  return json(resp, resp.ok ? 200 : 503)
}
