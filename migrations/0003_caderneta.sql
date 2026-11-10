-- ChocoBete · D1 · migração 0003 · CADERNETA (Etapa 1)
--
-- O servidor é a fonte única da verdade. O celular só ENVIA OPERAÇÕES (tabela `operacoes`);
-- quem decide se valem é este banco. As regras abaixo valem mesmo que a tela, o app ou um
-- script mande algo errado:
--   · dinheiro = INTEGER em centavos (nunca float)
--   · saldo nunca negativo e nunca maior que o total
--   · status 'pago' se e somente se saldo = 0
--   · pagamento nunca maior que o saldo
--   · saldo SEMPRE = total − soma dos pagamentos não estornados (conferido a cada alteração)
--   · estorno é uma linha nova; o pagamento original NUNCA é apagado nem alterado
--   · pagamentos, estornos, itens e operações são imutáveis (UPDATE/DELETE abortam)
--   · nada é excluído: loja/cliente são arquivados, venda é cancelada
--
-- Ids = uuid em TEXT gerado no aparelho (criar offline; reenviar não duplica).
-- Mensagens de erro dos gatilhos começam com "E_" (o servidor traduz para o usuário).

-- ───────────────────────── Lojas e clientes ─────────────────────────
CREATE TABLE cad_lojas (
  uid            TEXT PRIMARY KEY,
  nome           TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_chave     TEXT NOT NULL,                 -- sem acento/caixa/espaços repetidos (calculado no servidor)
  arquivada_em   INTEGER,
  criado_em      INTEGER NOT NULL,
  atualizado_em  INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_cad_lojas_nome ON cad_lojas(nome_chave);

CREATE TABLE cad_clientes (
  uid             TEXT PRIMARY KEY,
  loja_uid        TEXT NOT NULL REFERENCES cad_lojas(uid),
  nome            TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_chave      TEXT NOT NULL,
  telefone        TEXT,
  telefone_chave  TEXT,                          -- DDD + últimos 8 dígitos; NULL = sem telefone
  funcao          TEXT,
  funcao_chave    TEXT NOT NULL DEFAULT '',
  arquivado_em    INTEGER,
  criado_em       INTEGER NOT NULL,
  atualizado_em   INTEGER NOT NULL
);
-- mesmo telefone = mesma pessoa, em qualquer loja (regra atual do app)
CREATE UNIQUE INDEX ux_cad_clientes_tel ON cad_clientes(telefone_chave) WHERE telefone_chave IS NOT NULL;
-- sem telefone: mesmo nome + mesma função na mesma loja é duplicado
CREATE UNIQUE INDEX ux_cad_clientes_nome ON cad_clientes(loja_uid, nome_chave, funcao_chave) WHERE telefone_chave IS NULL;
CREATE INDEX ix_cad_clientes_loja ON cad_clientes(loja_uid);

-- ───────────────────────── Vendas fiadas ─────────────────────────
CREATE TABLE cad_vendas (
  uid                  TEXT PRIMARY KEY,
  cliente_uid          TEXT NOT NULL REFERENCES cad_clientes(uid),
  loja_uid             TEXT NOT NULL REFERENCES cad_lojas(uid),
  cliente_nome         TEXT NOT NULL,            -- como estava NA VENDA (histórico; não muda ao renomear)
  loja_nome            TEXT NOT NULL,
  bruto_centavos       INTEGER NOT NULL CHECK (bruto_centavos > 0),
  desconto_centavos    INTEGER NOT NULL DEFAULT 0 CHECK (desconto_centavos >= 0),
  desconto_motivo      TEXT,
  total_centavos       INTEGER NOT NULL,
  saldo_centavos       INTEGER NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('aberto','pago')),
  data_venda           TEXT NOT NULL CHECK (data_venda GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  hora_venda           TEXT,
  data_venc            TEXT CHECK (data_venc IS NULL OR data_venc GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  pago_em              INTEGER,
  cancelada_em         INTEGER,
  motivo_cancelamento  TEXT,
  usuario              TEXT,
  criado_no_aparelho   INTEGER,
  criado_em            INTEGER NOT NULL,         -- sempre carimbado pelo servidor
  atualizado_em        INTEGER NOT NULL,
  origem_json          TEXT,                     -- migração: registro original, para auditoria
  CHECK (desconto_centavos < bruto_centavos),
  CHECK (total_centavos = bruto_centavos - desconto_centavos),
  CHECK (saldo_centavos >= 0 AND saldo_centavos <= total_centavos),
  CHECK ((status = 'pago') = (saldo_centavos = 0))
);
CREATE INDEX ix_cad_vendas_cliente ON cad_vendas(cliente_uid);
CREATE INDEX ix_cad_vendas_loja ON cad_vendas(loja_uid);
CREATE INDEX ix_cad_vendas_venc ON cad_vendas(data_venc) WHERE status = 'aberto';

CREATE TABLE cad_venda_itens (
  venda_uid         TEXT NOT NULL REFERENCES cad_vendas(uid),
  pos               INTEGER NOT NULL,
  item_id           TEXT,
  nome              TEXT NOT NULL,
  emoji             TEXT,
  qtd               REAL NOT NULL CHECK (qtd > 0),
  preco_centavos    INTEGER NOT NULL CHECK (preco_centavos >= 0),
  subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos = CAST(ROUND(qtd * preco_centavos) AS INTEGER)),
  PRIMARY KEY (venda_uid, pos)
);

-- ───────────────────────── Pagamentos e estornos (linhas próprias) ─────────────────────────
CREATE TABLE cad_pagamentos (
  uid                   TEXT PRIMARY KEY,
  venda_uid             TEXT NOT NULL REFERENCES cad_vendas(uid),
  valor_centavos        INTEGER NOT NULL CHECK (valor_centavos > 0),
  saldo_antes_centavos  INTEGER NOT NULL CHECK (saldo_antes_centavos > 0),
  saldo_depois_centavos INTEGER NOT NULL CHECK (saldo_depois_centavos >= 0),
  data                  TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  hora                  TEXT,
  usuario               TEXT,
  criado_no_aparelho    INTEGER,
  criado_em             INTEGER NOT NULL,
  CHECK (saldo_depois_centavos = saldo_antes_centavos - valor_centavos)
);
CREATE INDEX ix_cad_pag_venda ON cad_pagamentos(venda_uid);

CREATE TABLE cad_estornos (
  uid                TEXT PRIMARY KEY,
  pagamento_uid      TEXT NOT NULL UNIQUE REFERENCES cad_pagamentos(uid),   -- um pagamento só é estornado uma vez
  venda_uid          TEXT NOT NULL REFERENCES cad_vendas(uid),
  valor_centavos     INTEGER NOT NULL CHECK (valor_centavos > 0),
  motivo             TEXT,
  data               TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  hora               TEXT,
  usuario            TEXT,
  criado_no_aparelho INTEGER,
  criado_em          INTEGER NOT NULL
);
CREATE INDEX ix_cad_est_venda ON cad_estornos(venda_uid);

-- ───────────────────────── Operações recebidas (idempotência + auditoria) ─────────────────────────
CREATE TABLE operacoes (
  op_id              TEXT PRIMARY KEY,           -- gerado no aparelho; reenviar a mesma operação não repete o efeito
  tipo               TEXT NOT NULL,
  usuario            TEXT,
  aparelho           TEXT,
  criado_no_aparelho INTEGER,
  recebido_em        INTEGER NOT NULL,
  resultado          TEXT NOT NULL CHECK (resultado IN ('aplicada','rejeitada')),
  motivo             TEXT,
  payload            TEXT NOT NULL
);

-- Diário de mudanças: o celular pergunta "o que mudou depois do número N?" (sem depender de relógio)
CREATE TABLE mudancas (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  tabela  TEXT NOT NULL,
  uid     TEXT NOT NULL
);

-- ═════════════════════════ GATILHOS: as regras ═════════════════════════

-- Venda nasce aberta, com saldo = total
CREATE TRIGGER trg_vendas_ins BEFORE INSERT ON cad_vendas
BEGIN
  SELECT RAISE(ABORT, 'E_VENDA_INICIAL')
   WHERE NEW.saldo_centavos <> NEW.total_centavos OR NEW.status <> 'aberto' OR NEW.cancelada_em IS NOT NULL;
END;

-- Venda: o que é dinheiro/identidade não muda nunca
CREATE TRIGGER trg_vendas_upd BEFORE UPDATE ON cad_vendas
BEGIN
  SELECT RAISE(ABORT, 'E_VENDA_IMUTAVEL')
   WHERE NEW.uid <> OLD.uid OR NEW.cliente_uid <> OLD.cliente_uid OR NEW.bruto_centavos <> OLD.bruto_centavos
      OR NEW.desconto_centavos <> OLD.desconto_centavos OR NEW.total_centavos <> OLD.total_centavos
      OR NEW.data_venda <> OLD.data_venda OR NEW.criado_em <> OLD.criado_em
      OR NEW.cliente_nome <> OLD.cliente_nome;
  SELECT RAISE(ABORT, 'E_VENDA_CANCELADA') WHERE OLD.cancelada_em IS NOT NULL;
  SELECT RAISE(ABORT, 'E_CANCELAR_COM_PAGAMENTO')
   WHERE NEW.cancelada_em IS NOT NULL AND NEW.saldo_centavos <> NEW.total_centavos;
  SELECT RAISE(ABORT, 'E_VENDA_PAGA_NAO_MUDA_LOJA')
   WHERE OLD.status = 'pago' AND NEW.loja_uid <> OLD.loja_uid;
END;

-- Rede de segurança: depois de QUALQUER alteração, saldo = total − pagamentos não estornados
CREATE TRIGGER trg_vendas_coerencia AFTER UPDATE ON cad_vendas
BEGIN
  SELECT RAISE(ABORT, 'E_SALDO_INCOERENTE')
   WHERE NEW.saldo_centavos <> NEW.total_centavos - COALESCE((
     SELECT SUM(p.valor_centavos) FROM cad_pagamentos p
      WHERE p.venda_uid = NEW.uid
        AND NOT EXISTS (SELECT 1 FROM cad_estornos e WHERE e.pagamento_uid = p.uid)), 0);
END;

CREATE TRIGGER trg_vendas_del BEFORE DELETE ON cad_vendas BEGIN SELECT RAISE(ABORT, 'E_SEM_EXCLUSAO'); END;
CREATE TRIGGER trg_lojas_del BEFORE DELETE ON cad_lojas BEGIN SELECT RAISE(ABORT, 'E_SEM_EXCLUSAO'); END;
CREATE TRIGGER trg_clientes_del BEFORE DELETE ON cad_clientes BEGIN SELECT RAISE(ABORT, 'E_SEM_EXCLUSAO'); END;

-- Pagamento: confere contra o saldo REAL do banco (não confia no que a tela mostrava)
CREATE TRIGGER trg_pag_ins BEFORE INSERT ON cad_pagamentos
BEGIN
  SELECT RAISE(ABORT, 'E_VENDA_INEXISTENTE') WHERE NOT EXISTS (SELECT 1 FROM cad_vendas WHERE uid = NEW.venda_uid);
  SELECT RAISE(ABORT, 'E_VENDA_CANCELADA') WHERE EXISTS (SELECT 1 FROM cad_vendas WHERE uid = NEW.venda_uid AND cancelada_em IS NOT NULL);
  SELECT RAISE(ABORT, 'E_PAG_MAIOR_QUE_SALDO')
   WHERE NEW.valor_centavos > (SELECT saldo_centavos FROM cad_vendas WHERE uid = NEW.venda_uid);
  SELECT RAISE(ABORT, 'E_SALDO_DESATUALIZADO')
   WHERE NEW.saldo_antes_centavos <> (SELECT saldo_centavos FROM cad_vendas WHERE uid = NEW.venda_uid);
END;

CREATE TRIGGER trg_pag_apos AFTER INSERT ON cad_pagamentos
BEGIN
  UPDATE cad_vendas
     SET saldo_centavos = saldo_centavos - NEW.valor_centavos,
         status         = CASE WHEN saldo_centavos - NEW.valor_centavos = 0 THEN 'pago' ELSE 'aberto' END,
         pago_em        = CASE WHEN saldo_centavos - NEW.valor_centavos = 0 THEN NEW.criado_em ELSE pago_em END,
         atualizado_em  = NEW.criado_em
   WHERE uid = NEW.venda_uid;
END;

-- Estorno: só de pagamento da mesma venda, pelo valor exato; devolve o saldo e reabre a venda
CREATE TRIGGER trg_est_ins BEFORE INSERT ON cad_estornos
BEGIN
  SELECT RAISE(ABORT, 'E_PAGAMENTO_INEXISTENTE')
   WHERE NOT EXISTS (SELECT 1 FROM cad_pagamentos WHERE uid = NEW.pagamento_uid AND venda_uid = NEW.venda_uid);
  SELECT RAISE(ABORT, 'E_ESTORNO_VALOR')
   WHERE NEW.valor_centavos <> (SELECT valor_centavos FROM cad_pagamentos WHERE uid = NEW.pagamento_uid);
  SELECT RAISE(ABORT, 'E_VENDA_CANCELADA') WHERE EXISTS (SELECT 1 FROM cad_vendas WHERE uid = NEW.venda_uid AND cancelada_em IS NOT NULL);
END;

CREATE TRIGGER trg_est_apos AFTER INSERT ON cad_estornos
BEGIN
  UPDATE cad_vendas
     SET saldo_centavos = saldo_centavos + NEW.valor_centavos,
         status         = 'aberto',
         pago_em        = NULL,
         atualizado_em  = NEW.criado_em
   WHERE uid = NEW.venda_uid;
END;

-- Histórico imutável
CREATE TRIGGER trg_pag_upd BEFORE UPDATE ON cad_pagamentos BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_pag_del BEFORE DELETE ON cad_pagamentos BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_est_upd BEFORE UPDATE ON cad_estornos BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_est_del BEFORE DELETE ON cad_estornos BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_itens_upd BEFORE UPDATE ON cad_venda_itens BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_itens_del BEFORE DELETE ON cad_venda_itens BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_oper_upd BEFORE UPDATE ON operacoes BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_oper_del BEFORE DELETE ON operacoes BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;

-- Diário de mudanças (alimenta a leitura incremental do celular)
CREATE TRIGGER trg_mud_lojas_i AFTER INSERT ON cad_lojas BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('lojas', NEW.uid); END;
CREATE TRIGGER trg_mud_lojas_u AFTER UPDATE ON cad_lojas BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('lojas', NEW.uid); END;
CREATE TRIGGER trg_mud_clientes_i AFTER INSERT ON cad_clientes BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('clientes', NEW.uid); END;
CREATE TRIGGER trg_mud_clientes_u AFTER UPDATE ON cad_clientes BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('clientes', NEW.uid); END;
CREATE TRIGGER trg_mud_vendas_i AFTER INSERT ON cad_vendas BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('vendas', NEW.uid); END;
CREATE TRIGGER trg_mud_vendas_u AFTER UPDATE ON cad_vendas BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('vendas', NEW.uid); END;
CREATE TRIGGER trg_mud_pag_i AFTER INSERT ON cad_pagamentos BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('pagamentos', NEW.uid); END;
CREATE TRIGGER trg_mud_est_i AFTER INSERT ON cad_estornos BEGIN INSERT INTO mudancas(tabela, uid) VALUES ('estornos', NEW.uid); END;
