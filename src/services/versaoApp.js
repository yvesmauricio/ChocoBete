/* global __APP_VERSION__, __APP_BUILD__, __APP_COMMIT__ */
// Versão do app: a INSTALADA (embutida no build) e a PUBLICADA (version.json).
// __APP_*__ são injetados pelo vite.config.js; os fallbacks cobrem testes/dev.
export const versaoInstalada = {
  versao: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  build: typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : '',
  commit: typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : ''
}

/** "28/10/2026 21:10" no fuso do aparelho (ou '' se não houver data). */
export function dataBuild(v) {
  const d = v?.build ? new Date(v.build) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Rótulos curtos pra comparar duas versões. Se o número é diferente, basta
 * "v3.0.0 → v3.1.0". Se é o mesmo (publicou sem mudar o número), inclui a data
 * do build pra não parecer que nada mudou.
 */
export function rotulosVersao(atual, nova) {
  const mesmaVersao = atual?.versao === nova?.versao
  const rot = (v) => `v${v?.versao ?? '?'}` + (mesmaVersao && dataBuild(v) ? ` · ${dataBuild(v)}` : '')
  return { atual: rot(atual), nova: rot(nova) }
}

/**
 * Lê /version.json direto da rede (ignora cache e service worker) e diz POR QUE falhou:
 *   { ok: true, dados }  ou  { ok: false, motivo, status? } com motivo:
 *   'rede'          — sem resposta (internet, Wi-Fi sem saída, servidor fora);
 *   'redirecionado' — o servidor mandou para outra página (típico: login do Cloudflare Access);
 *   'http'          — o servidor respondeu erro (ex.: 404, 500 — ver `status`);
 *   'nao-json'      — veio uma PÁGINA no lugar do arquivo (o Cloudflare Pages devolve a página
 *                     inicial quando o arquivo não existe no deploy; ou uma tela de login);
 *   'invalido'      — é JSON mas não tem o formato esperado.
 */
export async function consultarVersaoPublicada() {
  try {
    const base = import.meta.env?.BASE_URL ?? '/'
    const r = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store', redirect: 'manual' })
    if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) return { ok: false, motivo: 'redirecionado' }
    if (!r.ok) return { ok: false, motivo: 'http', status: r.status }
    const texto = await r.text()
    let j
    try { j = JSON.parse(texto) } catch { return { ok: false, motivo: 'nao-json' } }
    if (!j || typeof j.versao !== 'string') return { ok: false, motivo: 'invalido' }
    return { ok: true, dados: j }
  } catch { return { ok: false, motivo: 'rede' } }
}

/** Como antes: a versão publicada, ou null se não deu para ler (o motivo está em consultarVersaoPublicada). */
export async function buscarVersaoPublicada() {
  const r = await consultarVersaoPublicada()
  return r.ok ? r.dados : null
}

/** Mensagem em português, com o que fazer, para cada motivo de falha. */
export function descreverFalhaVersao(motivo, status) {
  switch (motivo) {
    case 'rede':
      return 'Sem resposta do servidor. Confira a internet do aparelho (Wi-Fi sem sinal ou bloqueado) e tente de novo.'
    case 'redirecionado':
      return 'O servidor pediu login (Cloudflare Access) em vez de entregar a versão. Abra o site no navegador e entre de novo, ou libere /version.json e /sw.js no Access.'
    case 'http':
      return status === 404
        ? 'O arquivo de versão não existe no servidor (erro 404). O deploy mais recente pode não ter terminado ou não incluiu a atualização.'
        : `O servidor respondeu com erro (HTTP ${status}). Tente de novo em instantes.`
    case 'nao-json':
      return 'O servidor devolveu uma página no lugar do arquivo de versão. Costuma ser o deploy sem o /version.json (o Cloudflare devolve a página inicial quando um arquivo não existe) ou uma tela de login. Teste abrir /version.json no navegador do celular.'
    case 'invalido':
      return 'O arquivo de versão do servidor está num formato inesperado.'
    default:
      return 'Não consegui consultar o servidor agora. Tente de novo em instantes.'
  }
}
