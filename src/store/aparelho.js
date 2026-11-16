// Perfil DO APARELHO: cada celular/computador diz uma vez quem é ("Celular da
// Bete") e qual o tipo — Vendedor ou Admin. Daí em diante ele só abre o módulo
// dele. Fica numa chave local (CONFIG_CHAVES_DO_APARELHO em db.js): não entra no
// backup nem no sync, senão um aparelho viraria o outro.
//
// O PIN do Admin, ao contrário, é um dado do NEGÓCIO: vai no backup e vale em
// todos os aparelhos. Guardamos só o hash (SHA-256 com sal), nunca o número.
import { ref } from 'vue'
import { configGet, configSet } from '../db.js'

const CHAVE_APARELHO = 'aparelho_perfil'
const CHAVE_PIN = 'admin_pin'

export const PAPEIS = { vendedor: 'vendedor', admin: 'admin' }

export const aparelho = ref(null)            // { nome, papel } ou null (ainda não configurado)
export const aparelhoCarregado = ref(false)  // já leu o banco?

export const ehAparelhoAdmin = () => aparelho.value?.papel === PAPEIS.admin
export const ehAparelhoVendedor = () => aparelho.value?.papel === PAPEIS.vendedor

export async function carregarAparelho() {
  const v = await configGet(CHAVE_APARELHO, null)
  const nome = typeof v?.nome === 'string' ? v.nome.trim().slice(0, 30) : ''
  const papel = Object.values(PAPEIS).includes(v?.papel) ? v.papel : null
  aparelho.value = nome && papel ? { nome, papel } : null
  aparelhoCarregado.value = true
  return aparelho.value
}

export async function salvarAparelho({ nome, papel }) {
  const limpo = { nome: String(nome || '').trim().slice(0, 30), papel }
  if (!limpo.nome || !Object.values(PAPEIS).includes(papel)) throw new Error('APARELHO_INVALIDO')
  await configSet(CHAVE_APARELHO, limpo)
  aparelho.value = limpo
}

// ── PIN do Admin ─────────────────────────────────────────────
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

async function hashPin(pin, salt) {
  if (!globalThis.crypto?.subtle) throw new Error('SEM_CRYPTO')
  const dados = new TextEncoder().encode(`${salt}:${pin}`)
  return hex(await crypto.subtle.digest('SHA-256', dados))
}

export const pinValido = (pin) => /^\d{4,6}$/.test(String(pin || ''))

export async function temPin() {
  const v = await configGet(CHAVE_PIN, null)
  return !!(v?.hash && v?.salt)
}

export async function definirPin(pin) {
  if (!pinValido(pin)) throw new Error('PIN_INVALIDO')
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)))
  await configSet(CHAVE_PIN, { salt, hash: await hashPin(pin, salt) })
}

export async function removerPin() {
  await configSet(CHAVE_PIN, null)
}

// Freio simples contra tentativa e erro: 5 erros seguidos travam por 30 s.
let erros = 0
let travadoAte = 0
export const segundosTravado = () => Math.max(0, Math.ceil((travadoAte - Date.now()) / 1000))

/** true = PIN certo (ou não há PIN definido). false = errado. Lança 'PIN_TRAVADO' no freio. */
export async function verificarPin(pin) {
  const v = await configGet(CHAVE_PIN, null)
  if (!v?.hash || !v?.salt) return true
  if (segundosTravado() > 0) throw new Error('PIN_TRAVADO')
  const ok = (await hashPin(String(pin || ''), v.salt)) === v.hash
  if (ok) { erros = 0; return true }
  if (++erros >= 5) { erros = 0; travadoAte = Date.now() + 30_000 }
  return false
}
