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

/** Lê /version.json direto da rede (ignora cache e service worker). null se offline/erro. */
export async function buscarVersaoPublicada() {
  try {
    const base = import.meta.env?.BASE_URL ?? '/'
    const r = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return j && typeof j.versao === 'string' ? j : null
  } catch { return null }
}
