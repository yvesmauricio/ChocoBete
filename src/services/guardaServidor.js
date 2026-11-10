// Instala nas tabelas da Caderneta a guarda do modo servidor (ver modoServidor.js).
import Dexie from 'dexie'
import { cadernetaNoServidor, TABELAS_CADERNETA, escritaLocalLiberada } from './modoServidor.js'

export class EscritaForaDoServidorError extends Error {
  constructor(tabela) {
    super('Modo servidor: esta alteração da Caderneta ainda não é enviada ao servidor. Nada foi alterado.')
    this.name = 'EscritaForaDoServidorError'
    this.tabela = tabela
  }
}

export function instalarGuardaServidor(db) {
  const remover = []
  const checar = (tabela) => {
    if (!cadernetaNoServidor()) return
    if (escritaLocalLiberada() || Dexie.currentTransaction?.__escritaLiberada) return   // ponte, projeção, importação
    throw new EscritaForaDoServidorError(tabela)
  }
  for (const nome of TABELAS_CADERNETA) {
    const t = db[nome]
    const c = function () { checar(nome) }, u = function () { checar(nome) }, d = function () { checar(nome) }
    t.hook('creating', c); t.hook('updating', u); t.hook('deleting', d)
    remover.push(() => { t.hook('creating').unsubscribe(c); t.hook('updating').unsubscribe(u); t.hook('deleting').unsubscribe(d) })
  }
  return () => remover.forEach(f => f())
}
