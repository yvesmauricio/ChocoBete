-- ChocoBete · D1 · migração 0005 · perfil de quem fez cada operação (auditoria)
ALTER TABLE operacoes ADD COLUMN papel TEXT;   -- 'admin' | 'vendas' (NULL em operações anteriores ao controle de perfis)
