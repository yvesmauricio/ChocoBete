// ─────────────────────────────────────────────────────────────────────────
// Trava de gravação por papel: o banco LOCAL recusa gravar numa área que não
// é deste aparelho (ver papelAparelho.js). É a rede de segurança por baixo da
// tela: mesmo que um botão apareça por engano ou um bug tente gravar, a
// gravação é abortada e nada muda.
//
// Implementada com os hooks do Dexie (creating/updating/deleting), que pegam
// TODAS as formas de gravar (put, add, update, bulkPut, modify, delete…).
//
// Exceções:
//   • importações de dados (sync, restauração) rodam numa transação marcada
//     com `liberarEscrita()` — só aquela transação é liberada;
//   • chaves de config "do aparelho" (sync_*, papel, timer) sempre gravam.
// ─────────────────────────────────────────────────────────────────────────
import Dexie from 'dexie'
import { podeEscreverTabela, podeEscreverConfig, mensagemSomenteConsulta, papelValido } from './papelAparelho.js'
import { cadernetaNoServidor, TABELAS_CADERNETA, escritaLocalLiberada } from './modoServidor.js'

export class SomenteConsultaError extends Error {
  constructor(tabela, papel) {
    super(mensagemSomenteConsulta(tabela, papel))
    this.name = 'SomenteConsultaError'
    this.tabela = tabela
  }
}

/** Marca a transação em curso como liberada (usar dentro de db.transaction). */
export function liberarEscrita() {
  const tx = Dexie.currentTransaction
  if (tx) tx.__escritaLiberada = true
}

const liberada = () => Boolean(Dexie.currentTransaction?.__escritaLiberada)

/**
 * @param db  instância Dexie
 * @param opts.obterPapel  () => 'admin' | 'vendas' | null  (lido a cada gravação)
 * @param opts.chavesDoAparelho  chaves de config que sempre podem gravar
 * @param opts.aoBloquear  (erro) => void  — avisa a tela (toast)
 * @returns função que remove os hooks
 */
export function instalarTravaPorPapel(db, { obterPapel, chavesDoAparelho = [], aoBloquear = () => {} }) {
  const remover = []

  function checar(tabela, chave) {
    if (liberada()) return
    // Modo servidor: a Caderneta é decidida pelo PERFIL da pessoa no servidor (e não pelo papel do aparelho).
    // Só a ponte grava aqui (a guarda do modo servidor barra o resto), então ela passa por esta trava.
    if (TABELAS_CADERNETA.includes(tabela) && cadernetaNoServidor() && escritaLocalLiberada()) return
    const papel = obterPapel()
    if (tabela === 'config') {
      if (chavesDoAparelho.includes(chave)) return
      if (String(chave).startsWith('__')) return // marcas técnicas
      if (papelValido(papel) && podeEscreverConfig(papel, chave)) return
    } else if (podeEscreverTabela(papel, tabela)) {
      return
    }
    const erro = new SomenteConsultaError(tabela === 'config' ? 'config' : tabela, papel)
    try { aoBloquear(erro) } catch { /* aviso não pode derrubar a trava */ }
    throw erro
  }

  for (const t of db.tables) {
    const nome = t.name
    const chaveDe = (pk, obj) => (nome === 'config' ? (obj?.chave ?? pk) : undefined)
    const criando = function (pk, obj) { checar(nome, chaveDe(pk, obj)) }
    const atualizando = function (mods, pk, obj) { checar(nome, chaveDe(pk, obj)) }
    const apagando = function (pk, obj) { checar(nome, chaveDe(pk, obj)) }
    t.hook('creating', criando)
    t.hook('updating', atualizando)
    t.hook('deleting', apagando)
    remover.push(() => { t.hook('creating').unsubscribe(criando); t.hook('updating').unsubscribe(atualizando); t.hook('deleting').unsubscribe(apagando) })
  }
  return () => remover.forEach(f => f())
}
