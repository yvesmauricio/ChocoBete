// Serve o cardápio publicado. Se ainda não há versão no D1, cai no arquivo estático de hoje
// (por isso dá para ligar/desligar sem risco).
//
// O visual (tema) vive em /tema-atelier.css, um arquivo do deploy. Aqui injetamos o <link> pra ele
// no HTML que veio do D1: assim, mudar cor/fonte/espaçamento só exige deploy — não precisa
// republicar cada cardápio. O <link> entra DEPOIS do <style> inline e por isso prevalece; o
// HTML publicado continua funcionando sozinho (com a cópia embutida) se o arquivo não carregar.
const LINK_TEMA = '<link rel="stylesheet" href="/tema-atelier.css">'

export function injetarTema(html) {
  if (html.includes('/tema-atelier.css')) return html
  const i = html.lastIndexOf('</head>')
  if (i === -1) return html
  return html.slice(0, i) + LINK_TEMA + '\n' + html.slice(i)
}

export async function servirCardapio(id, { env, next }) {
  let row = null
  try { row = await env.DB.prepare('SELECT html FROM cardapios WHERE id = ?').bind(id).first() } catch { /* D1 fora do ar: usa o estático */ }
  if (!row?.html) return next()
  return new Response(injetarTema(row.html), { headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, must-revalidate',   // mesma regra do seu _headers atual
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  } })
}
