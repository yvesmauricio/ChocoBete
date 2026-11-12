// Chave SÓ do backup (BACKUP_TOKEN): a rotina diária usa esta, e não a chave de administrador.
// Se vazar do GitHub, quem a tem só consegue registrar "backup feito" e ler contagens — nada de lançar, estornar ou ler clientes.
export function backupTokenValido(req, env) {
  const recebido = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const esperado = env.BACKUP_TOKEN || ''
  if (esperado.length < 32 || recebido.length !== esperado.length) return false   // chave curta = configuração fraca: recusa tudo
  let diff = 0
  for (let i = 0; i < esperado.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i)
  return diff === 0
}
