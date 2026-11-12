// Rotina de backup (GitHub Actions) ⇄ servidor. Autenticação: BACKUP_TOKEN (chave só de backup) ou ADMIN_TOKEN.
//   GET  → { contagens, saldo_aberto_centavos, backup:{ultimo,horas_desde,atrasado} }   (só números, sem dados pessoais)
//          A rotina lê ANTES e DEPOIS de exportar: nada é apagado no banco, então a cópia restaurada precisa ter
//          pelo menos as contagens de "antes" e no máximo as de "depois".
//   POST → registra um backup já verificado e guardado fora: { arquivo, bytes, sha256, resumo:{…números…} }
import { json, lerJson, tokenValido } from '../../_lib/util.js'
import { backupTokenValido } from '../../_lib/backupToken.js'
import { conferenciaCaderneta, statusBackup, registrarBackup, Rejeicao } from '../../_lib/caderneta.js'

const autorizado = (req, env) => backupTokenValido(req, env) || tokenValido(req, env)

export async function onRequestGet({ request, env }) {
  if (!autorizado(request, env)) return json({ erro: 'Não autorizado' }, 401)
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  const c = await conferenciaCaderneta(env.DB)
  return json({ contagens: c.contagens, saldo_aberto_centavos: c.saldo_aberto_centavos, violacoes: c.violacoes, ok: c.ok, backup: c.backup })
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) return json({ erro: 'Não autorizado' }, 401)
  if (!env.DB) return json({ erro: 'Banco não configurado' }, 503)
  let corpo
  try { corpo = await lerJson(request, 16 * 1024) } catch { return json({ erro: 'Corpo inválido' }, 400) }
  try { return json(await registrarBackup(env.DB, corpo), 201) }
  catch (e) { return e instanceof Rejeicao ? json({ erro: e.message }, 422) : json({ erro: 'Falha ao registrar' }, 500) }
}
