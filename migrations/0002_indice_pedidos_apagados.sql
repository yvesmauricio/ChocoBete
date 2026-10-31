-- ChocoBete · D1 · migração 0002
-- A faxina de pedidos apagados (functions/api/admin/pedidos.js) filtra por apagado_em.
-- Índice parcial: só guarda os pedidos apagados (poucos), então quase não ocupa espaço
-- e a faxina deixa de ler a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_pedidos_apagados ON pedidos(apagado_em) WHERE apagado_em IS NOT NULL;
