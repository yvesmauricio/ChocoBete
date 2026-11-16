-- Para quem já aplicou o 0001 antigo: a tabela `registros` nunca foi usada
-- (a sincronização entre aparelhos continua sendo pelo Google Drive). Pode remover.
DROP INDEX IF EXISTS idx_registros_sync;
DROP TABLE IF EXISTS registros;
