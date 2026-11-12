-- ChocoBete · D1 · migração 0006 · registro dos backups feitos
-- A rotina diária (GitHub Actions) só registra aqui DEPOIS de exportar, provar que a cópia restaura e guardar
-- criptografada fora do Cloudflare. Quem olha este registro sabe se o backup está em dia (e a "vigia" avisa se não estiver).
-- Imutável, como o resto do histórico.
CREATE TABLE backups_registro (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  feito_em  INTEGER NOT NULL,                                   -- carimbado pelo servidor
  arquivo   TEXT    NOT NULL CHECK (length(arquivo) BETWEEN 1 AND 200),
  bytes     INTEGER NOT NULL CHECK (bytes > 0),
  sha256    TEXT    NOT NULL CHECK (length(sha256) = 64),       -- do arquivo CRIPTOGRAFADO que foi guardado
  resumo    TEXT    NOT NULL                                    -- contagens e saldo no momento do backup (JSON, sem dados pessoais)
);
CREATE TRIGGER trg_backups_upd BEFORE UPDATE ON backups_registro BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
CREATE TRIGGER trg_backups_del BEFORE DELETE ON backups_registro BEGIN SELECT RAISE(ABORT, 'E_HISTORICO_IMUTAVEL'); END;
