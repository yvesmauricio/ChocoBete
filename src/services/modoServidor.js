// Interruptor do "modo servidor" da Caderneta, POR APARELHO (localStorage; nunca vai para o Drive).
//   desligado (padrão): tudo funciona como sempre (banco local + Drive).
//   ligado: gravações da Caderneta viram operações na fila do servidor; o banco local passa a ser só um
//           espelho do servidor; e a Caderneta deixa de ser mesclada pelo Drive (o servidor é a verdade).
// Só ligue DEPOIS de importar os dados no servidor e conferir os totais (ver docs/ETAPA1_CADERNETA.md).
const CHAVE = 'chocobete_caderneta_servidor'
export const TABELAS_CADERNETA = ['cad_lojas', 'cad_clientes', 'cad_fiados']

export function cadernetaNoServidor() {
  try { return globalThis.localStorage?.getItem(CHAVE) === '1' } catch { return false }
}
export function definirCadernetaNoServidor(ligado) {
  try { ligado ? globalThis.localStorage.setItem(CHAVE, '1') : globalThis.localStorage.removeItem(CHAVE) } catch { /* sem storage: fica desligado */ }
}
/** Tabelas que o merge do Drive deve deixar quietas neste aparelho. */
export const tabelasForaDoDrive = () => (cadernetaNoServidor() ? TABELAS_CADERNETA : [])

// ── Guarda: no modo servidor, só a ponte (cadernetaServidor.js), a projeção do servidor e importações liberadas
// podem gravar nas tabelas cad_*. O resto (ex.: venda nova, edição, exclusão, loja, cliente enquanto ainda
// não têm operação no servidor) seria uma gravação que o servidor nunca saberia: melhor recusar.
let escritasLiberadas = 0
export async function comEscritaLocalLiberada(fn) {
  escritasLiberadas++
  try { return await fn() } finally { escritasLiberadas-- }
}
export const escritaLocalLiberada = () => escritasLiberadas > 0

/**
 * Liga/desliga o modo servidor por link, neste aparelho:  ?caderneta=servidor  |  ?caderneta=local
 * Retorna true se mudou (a página precisa recarregar). Remove o parâmetro da barra de endereço.
 */
export function aplicarParametroDeUrl(loc = globalThis.location, hist = globalThis.history) {
  try {
    const url = new URL(loc.href)
    const v = url.searchParams.get('caderneta')
    if (v !== 'servidor' && v !== 'local') return false
    const antes = cadernetaNoServidor()
    definirCadernetaNoServidor(v === 'servidor')
    url.searchParams.delete('caderneta')
    hist?.replaceState?.(null, '', url.pathname + (url.search || '') + url.hash)
    return antes !== cadernetaNoServidor()
  } catch { return false }
}
