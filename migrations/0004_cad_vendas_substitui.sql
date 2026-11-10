-- ChocoBete · D1 · migração 0004 · rastro de correção de venda
-- "Corrigir" uma cobrança = cancelar a antiga e lançar a certa (operação única `venda.corrigir`).
-- A venda nova guarda qual venda ela substitui; a antiga fica cancelada, com motivo, e nunca some.
ALTER TABLE cad_vendas ADD COLUMN substitui_uid TEXT REFERENCES cad_vendas(uid);
CREATE INDEX ix_cad_vendas_substitui ON cad_vendas(substitui_uid) WHERE substitui_uid IS NOT NULL;
