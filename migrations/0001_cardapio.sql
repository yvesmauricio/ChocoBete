-- ChocoBete · D1 · migração 0001
-- Convenções que valem para o app inteiro (a sync futura reaproveita):
--   · ids = uuid em TEXT (gerado no aparelho; permite criar offline)
--   · dinheiro = INTEGER em centavos (nunca float)
--   · atualizado_em = ms desde 1970, SEMPRE carimbado pelo servidor
--   · apagado_em    = exclusão lógica (nunca DELETE), senão o outro aparelho não fica sabendo
 
-- rCardápios (diaadia, festa): configuração + HTML publicado
CREATE TABLE cardapios (
  id            TEXT PRIMARY KEY,                 -- 'diaadia' | 'festa'
  config        TEXT NOT NULL DEFAULT '{}',       -- JSON só com o que o servidor precisa
                                                  -- {sinal_ativo,sinal_percentual,taxa_entrega_centavos,
                                                  --  minimos:{cat:{valor_centavos,unidades}}}
  html          TEXT,                             -- versão publicada (NULL = ainda serve o arquivo estático)
  versao        INTEGER NOT NULL DEFAULT 0,
  publicado_em  INTEGER,
  atualizado_em INTEGER NOT NULL
);

-- Itens à venda: o PREÇO que vale é este, não o do navegador
CREATE TABLE itens (
  cardapio_id    TEXT NOT NULL REFERENCES cardapios(id),
  uuid           TEXT NOT NULL,                   -- = uuid da receita no app
  nome           TEXT NOT NULL,
  categoria      TEXT NOT NULL,
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
  ativo          INTEGER NOT NULL DEFAULT 1,
  ordem          INTEGER NOT NULL DEFAULT 0,
  atualizado_em  INTEGER NOT NULL,
  apagado_em     INTEGER,
  PRIMARY KEY (cardapio_id, uuid)
);
CREATE INDEX idx_itens_sync ON itens(atualizado_em);

-- Pedidos (site e balcão)
CREATE TABLE pedidos (
  uuid             TEXT PRIMARY KEY,              -- gerado no aparelho/página: reenviar não duplica
  cardapio_id      TEXT NOT NULL REFERENCES cardapios(id),
  origem           TEXT NOT NULL CHECK (origem IN ('site','balcao')),
  cliente_nome     TEXT,
  cliente_telefone TEXT,
  recebimento      TEXT CHECK (recebimento IN ('retirada','entrega')),
  subtotal_centavos INTEGER NOT NULL,
  taxa_centavos     INTEGER NOT NULL DEFAULT 0,
  total_centavos    INTEGER NOT NULL,
  sinal_centavos    INTEGER NOT NULL DEFAULT 0,   -- quanto é cobrado no Pix agora
  status           TEXT NOT NULL DEFAULT 'pendente', -- pendente | agendado | entregue
  ip_hash          TEXT,                          -- só para limitar spam; não é o IP
  dados            TEXT NOT NULL DEFAULT '{}',    -- JSON: data/hora combinada, endereço, observações
  criado_em        INTEGER NOT NULL,
  atualizado_em    INTEGER NOT NULL,
  apagado_em       INTEGER
);
CREATE INDEX idx_pedidos_sync ON pedidos(atualizado_em);
CREATE INDEX idx_pedidos_ip ON pedidos(ip_hash, criado_em);

-- Itens do pedido guardam nome e preço DA ÉPOCA (mudar o cardápio não reescreve o histórico)
CREATE TABLE pedido_itens (
  pedido_uuid    TEXT NOT NULL REFERENCES pedidos(uuid),
  item_uuid      TEXT NOT NULL,
  nome           TEXT NOT NULL,
  categoria      TEXT NOT NULL,
  preco_centavos INTEGER NOT NULL,
  qtd            INTEGER NOT NULL CHECK (qtd > 0),
  PRIMARY KEY (pedido_uuid, item_uuid)
);

-- Resto do app (receitas, produtos, financeiro, caderneta...) entra aqui na fase de sync,
-- como JSON, sem criar uma tabela D1 para cada tabela do Dexie.
CREATE TABLE registros (
  tabela        TEXT NOT NULL,
  uuid          TEXT NOT NULL,
  dados         TEXT NOT NULL,
  atualizado_em INTEGER NOT NULL,
  apagado_em    INTEGER,
  PRIMARY KEY (tabela, uuid)
);
CREATE INDEX idx_registros_sync ON registros(atualizado_em);

INSERT INTO cardapios (id, atualizado_em) VALUES ('diaadia', 0), ('festa', 0);
