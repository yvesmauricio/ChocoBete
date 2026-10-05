// services/contatoService.js
// Pequenos helpers de apresentação/normalização de contato (telefone e
// Instagram), usados na aba "Meu contato" da Caderneta, em Ajustes e no
// cardápio. Tudo puro (sem rede) — funciona offline.

/** Aceita "@user", "user", "instagram.com/user/", "https://www.instagram.com/user?igsh=..."
 *  e devolve só o usuário limpo ("user"). Vazio se não sobrar nada válido. */
export function normalizarInstagram(bruto) {
  let t = String(bruto || '').trim()
  t = t.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^(www\.)?instagram\.com\//i, '')
  t = t.split(/[/?#]/)[0]
  t = t.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30)
  return t.toLowerCase()
}

export function urlInstagram(usuario) {
  const u = normalizarInstagram(usuario)
  return u ? `https://instagram.com/${u}` : ''
}

/** Só apresentação: "(21) 99943-0023" → "(21) 9 9943-0023". O dado salvo não muda. */
export function telefoneBonito(bruto) {
  let d = String(bruto || '').replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return String(bruto || '')
}

/** Link wa.me pra abrir conversa com um número (qualquer formato) + texto pronto.
 *  Sem número, abre o WhatsApp só com o texto (a pessoa escolhe o contato). */
export function urlWhatsapp(telefoneBruto, texto = '') {
  let d = String(telefoneBruto || '').replace(/\D/g, '')
  if (d && !d.startsWith('55') && d.length <= 11) d = '55' + d
  const t = texto ? `?text=${encodeURIComponent(texto)}` : ''
  return d ? `https://wa.me/${d}${t}` : `https://wa.me/${t}`
}
