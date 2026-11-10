// Identificador de um registro da Caderneta no SERVIDOR, a partir do `uid` que ele tem neste aparelho.
// É a MESMA regra usada pelo script de migração (scripts/migrar-caderneta.mjs): o que foi importado e o que o
// aparelho calcula aqui precisam bater, senão uma operação aponta para um registro que o servidor não conhece.
// Só letras, números, _ e - (o servidor recusa outros), mínimo 8 e máximo 64 caracteres. Idempotente.
const PREFIXO = { cad_lojas: 'loja', cad_clientes: 'cliente', cad_fiados: 'venda', loja: 'loja', cliente: 'cliente', venda: 'venda' }

export function uidServidor(uidLocal, tabela) {
  let u = String(uidLocal ?? `${PREFIXO[tabela] || 'reg'}_sem_uid`).replace(/[^0-9A-Za-z_-]/g, '_')
  if (u.length < 8) u = `${PREFIXO[tabela] || 'reg'}_${u}`
  return u.slice(0, 64)
}
