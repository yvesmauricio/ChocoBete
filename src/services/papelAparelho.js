// ─────────────────────────────────────────────────────────────────────────
// Papel do aparelho e DONO de cada área dos dados.
//
// Todo aparelho é "admin" ou "vendas" (escolhido uma vez, guardado só no
// aparelho). Cada área do banco tem UM dono; o outro aparelho só lê:
//
//   • Cobranças (cad_lojas, cad_clientes, cad_fiados) e o Cardápio do balcão
//     (pedidos e a configuração dele) → aparelho "vendas"
//   • Todo o resto (receitas, produtos, financeiro, config…) → aparelho "admin"
//
// Efeito: dois aparelhos nunca editam a mesma área, então não há duas
// "verdades" disputando o mesmo registro. A regra vale em dois lugares:
//   1. no banco local (travaPorPapel.js) — recusa gravar o que não é seu;
//   2. no merge (merge.js) — o que não é seu vem SEMPRE do Drive, então
//      nunca é reenviado, mesmo que este aparelho tenha dados estranhos ali.
//
// Módulo puro: sem banco, rede ou relógio.
// ─────────────────────────────────────────────────────────────────────────

export const PAPEL_ADMIN = 'admin'
export const PAPEL_VENDAS = 'vendas'
export const PAPEIS = [PAPEL_ADMIN, PAPEL_VENDAS]

/** Tabelas do aparelho de vendas: cobranças e pedidos do balcão. */
export const TABELAS_DE_VENDAS = ['cad_lojas', 'cad_clientes', 'cad_fiados', 'cardapio_pedidos']

/** Chaves da tabela `config` do aparelho de vendas: tudo que a caderneta
 *  guarda (`cad_taxas`, `cad_precos_categorias`, `cad_log_renomeacao_loja`…)
 *  e a configuração do cardápio (`cardapio_config`, `cardapio_config_<id>`). */
export const CONFIG_DE_VENDAS = []
const PREFIXOS_CONFIG_VENDAS = ['cad_', 'cardapio_config']

export const papelValido = (p) => PAPEIS.includes(p)

/** Dono de uma tabela do banco. */
export function donoDaTabela(tabela) {
  return TABELAS_DE_VENDAS.includes(tabela) ? PAPEL_VENDAS : PAPEL_ADMIN
}

/** Dono de uma chave da tabela `config`. */
export function donoDaConfig(chave) {
  const c = String(chave ?? '')
  if (CONFIG_DE_VENDAS.includes(c) || PREFIXOS_CONFIG_VENDAS.some(p => c.startsWith(p))) return PAPEL_VENDAS
  return PAPEL_ADMIN
}

/** Este papel pode gravar nesta tabela? Sem papel definido, nada grava. */
export function podeEscreverTabela(papel, tabela) {
  if (!papelValido(papel)) return false
  return donoDaTabela(tabela) === papel
}

export function podeEscreverConfig(papel, chave) {
  if (!papelValido(papel)) return false
  return donoDaConfig(chave) === papel
}

export const NOME_DO_PAPEL = {
  [PAPEL_ADMIN]: 'Admin',
  [PAPEL_VENDAS]: 'Vendas'
}

/** Mensagem curta, em português simples, para quando uma gravação é recusada. */
export function mensagemSomenteConsulta(tabela, papel) {
  if (!papelValido(papel)) return 'Defina primeiro o papel deste aparelho (Admin ou Vendas).'
  const nome = String(tabela)
  const dono = NOME_DO_PAPEL[donoDaTabela(nome)]
  if (nome.startsWith('cad_')) return `Somente consulta: as cobranças só são editadas no aparelho ${dono}.`
  if (nome.startsWith('cardapio')) return `Somente consulta: o cardápio e os pedidos só são editados no aparelho ${dono}.`
  return `Somente consulta: esta área só é editada no aparelho ${dono}.`
}
