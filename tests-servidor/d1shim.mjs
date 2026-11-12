// Dublê de D1 para testes: SQLite real (node:sqlite) com a mesma interface (prepare/bind/run/first/all/batch).
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** `dirMigracoes: null` cria um banco VAZIO (para restaurar um dump por cima). */
export function criarD1(dirMigracoes = new URL('../migrations/', import.meta.url).pathname) {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  if (dirMigracoes) for (const f of readdirSync(dirMigracoes).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(dirMigracoes, f), 'utf8'))
  const stmt = (sql) => ({
    args: [], bind(...a) { this.args = a; return this },
    async run() { const r = db.prepare(sql).run(...this.args); return { success: true, meta: { changes: Number(r.changes) } } },
    async first() { return db.prepare(sql).get(...this.args) ?? null },
    async all() { return { results: db.prepare(sql).all(...this.args) } },
  })
  return {
    raw: db,
    prepare: stmt,
    async batch(lista) {
      db.exec('BEGIN')
      try { const out = []; for (const s of lista) out.push(await s.run()); db.exec('COMMIT'); return out }
      catch (e) { db.exec('ROLLBACK'); throw e }
    },
  }
}
