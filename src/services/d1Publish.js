// services/d1Publish.js
// Publica o cardápio no servidor (Cloudflare D1, via Pages Functions) em vez de
// fazer commit no GitHub. Vantagens: sem token de escrita no repositório, sem
// esperar deploy, e o servidor passa a conhecer os preços (valida os pedidos).
//
// Segue DESLIGADO enquanto não houver token salvo em Ajustes: sem token, o app
// continua publicando pelo GitHub exatamente como antes.

import { configGet, configSet } from '../db.js'

export const CHAVE_CONFIG_D1 = 'd1_publish_config'

export async function carregarConfigD1() {
  const salvo = await configGet(CHAVE_CONFIG_D1, null)
  return { token: '', ...(salvo || {}) }
}

export async function salvarConfigD1(config) {
  await configSet(CHAVE_CONFIG_D1, { token: String(config?.token || '').trim() })
}

// O servidor recusa tokens com menos de 32 caracteres
export const d1Configurado = (config) => String(config?.token || '').length >= 32

// Mesma origem do app quando ele roda no próprio site; no .env pode apontar pro domínio público.
function base() {
  return String(import.meta.env.VITE_GH_DOMINIO || '').trim().replace(/\/+$/, '')
}

async function chamar(caminho, config, opcoes = {}, ms = 20000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(base() + caminho, {
      ...opcoes,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('O servidor demorou demais para responder.')
    throw new Error('Sem conexão com o servidor.')
  } finally {
    clearTimeout(t)
  }
}

/** Confere se o servidor responde e se o token vale. Lança erro com mensagem legível se não. */
export async function testarConexaoD1(config) {
  const resp = await chamar(`/api/admin/pedidos?desde=${Date.now()}`, config, {}, 10000)
  if (resp.status === 401) throw new Error('Token não aceito pelo servidor. Confira se é o mesmo do ADMIN_TOKEN.')
  if (!resp.ok) throw new Error(`O servidor respondeu com erro (HTTP ${resp.status}).`)
  return true
}

/** Dados que o SERVIDOR precisa conhecer (o resto fica só no HTML). Valores em centavos. */
export function montarConfigServidor(config, grupos, cardapioId) {
  const minimos = {}
  for (const g of grupos) {
    const m = config?.categorias_min?.[g.categoria]
    const valor = Number(m?.valor || 0)
    const unidades = Number(m?.unidades || 0)
    if (valor > 0 || unidades > 0) minimos[g.categoria] = { valor_centavos: Math.round(valor * 100), unidades }
  }
  return {
    sinal_ativo: !!config?.sinal_ativo,
    sinal_percentual: Number(config?.sinal_percentual || 0),
    taxa_entrega_centavos: cardapioId === 'diaadia' ? Math.round(Number(config?.taxa_entrega || 0) * 100) : 0,
    minimos,
  }
}

export function montarItensServidor(grupos) {
  let ordem = 0
  return grupos.flatMap(g => g.itens.map(i => ({
    uuid: i.uuid,
    nome: i.nome,
    categoria: i.categoria,
    // mesmo arredondamento usado no HTML gerado (2 casas), para o total do servidor bater com o da página
    preco_centavos: Math.round(Number(i.preco || 0) * 100),
    ativo: true,
    ordem: ordem++,
  })))
}

/** Publica o HTML + preços no servidor. Retorna { publicadoEm }. */
export async function publicarCardapioD1({ id, html, config, grupos }) {
  const cfg = await carregarConfigD1()
  if (!d1Configurado(cfg)) throw new Error('Publicação no servidor não configurada (Ajustes → Sistema).')
  const resp = await chamar(`/api/admin/cardapio/${encodeURIComponent(id)}`, cfg, {
    method: 'PUT',
    body: JSON.stringify({ html, config: montarConfigServidor(config, grupos, id), itens: montarItensServidor(grupos) }),
  })
  const corpo = await resp.json().catch(() => null)
  if (resp.status === 401) throw new Error('Token do servidor inválido. Confira em Ajustes → Sistema.')
  if (!resp.ok) throw new Error(corpo?.erro || `Falha ao publicar no servidor (HTTP ${resp.status}).`)
  return { publicadoEm: corpo?.publicado_em }
}

/** Volta o link a servir o arquivo estático (GitHub). Usado ao desligar o servidor em Ajustes. */
export async function despublicarCardapioD1(id, config) {
  const resp = await chamar(`/api/admin/cardapio/${encodeURIComponent(id)}`, config, { method: 'DELETE' }, 10000)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
}
