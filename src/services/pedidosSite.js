// services/pedidosSite.js
// Traz para dentro do app os pedidos feitos no site (cardápio publicado no servidor).
//
// Eles entram na MESMA tabela dos pedidos do balcão (cardapio_pedidos), então:
//   • aparecem na tela de Pedidos e no aviso "pedidos do cardápio aguardando" da Caderneta;
//   • viajam junto com o resto pelo Drive para os outros aparelhos (a tabela já está no merge).
// Desligado enquanto não houver chave do servidor salva em Ajustes.

import { configGet, configSet, importarPedidosSite } from '../db.js'
import { carregarConfigD1, d1Configurado, buscarPedidosD1, apagarPedidoD1 } from './d1Publish.js'

export const CHAVE_CURSOR = 'd1_pedidos_cursor'
export const CHAVE_FILA_APAGAR = 'd1_pedidos_apagar'
const reais = (centavos) => Math.round(Number(centavos) || 0) / 100

/** Converte um pedido do servidor (centavos) para o formato que a tela de pedidos já entende. */
export function pedidoSiteParaApp(p, itens) {
  let extra = {}
  try { extra = JSON.parse(p.dados || '{}') || {} } catch { /* dados corrompidos: segue sem extras */ }
  const pedeSinal = Number(p.sinal_centavos) < Number(p.total_centavos)
  return {
    uuid: p.uuid,
    origem: 'site',
    codigo: String(p.uuid).slice(-6).toUpperCase(), // o mesmo "Pedido nº" que o cliente manda no WhatsApp
    cardapioId: p.cardapio_id,
    clienteNome: p.cliente_nome || '',
    clienteTelefone: p.cliente_telefone || '',
    recebimento: p.recebimento || 'retirada',
    endereco: extra.endereco || '',
    obs: extra.obs || '',
    itens: itens.map(i => ({ nome: i.nome, qtd: i.qtd, preco: reais(i.preco_centavos) })),
    itensTotal: reais(p.subtotal_centavos),
    entregaValor: reais(p.taxa_centavos),
    total: reais(p.total_centavos),
    // O servidor não sabe se o cliente já pagou; só mostramos o sinal quando ele é parcial.
    cobrarSinal: pedeSinal,
    valorPix: pedeSinal ? reais(p.sinal_centavos) : 0,
    valorRestante: pedeSinal ? reais(Number(p.total_centavos) - Number(p.sinal_centavos)) : 0,
    temFesta: p.cardapio_id === 'festa',
    status: 'pendente',
    agendadoPara: null,
    horaAgendada: null,
    criadoEm: new Date(Number(p.criado_em)).toISOString(),
  }
}

/**
 * Avisa o servidor que o pedido foi apagado aqui. Se estiver sem internet (ou o servidor falhar),
 * o aviso fica numa fila neste aparelho e é reenviado na próxima verificação. Nunca lança erro.
 */
export async function apagarPedidoNoServidor(uuid) {
  try {
    const cfg = await carregarConfigD1()
    if (!d1Configurado(cfg)) return
    const fila = (await configGet(CHAVE_FILA_APAGAR, [])) || []
    if (!fila.includes(uuid)) await configSet(CHAVE_FILA_APAGAR, [...fila, uuid])
    await descarregarFilaApagar(cfg)
  } catch { /* segue: o aviso fica na fila */ }
}

async function descarregarFilaApagar(cfg) {
  const fila = (await configGet(CHAVE_FILA_APAGAR, [])) || []
  if (!fila.length) return
  const restantes = []
  for (const uuid of fila) {
    try { await apagarPedidoD1(uuid, cfg) } catch { restantes.push(uuid) }
  }
  await configSet(CHAVE_FILA_APAGAR, restantes)
}

let emAndamento = null

/** Busca o que chegou desde a última vez. Seguro de chamar de vários lugares ao mesmo tempo. */
export function importarPedidosDoSite() {
  if (emAndamento) return emAndamento
  emAndamento = (async () => {
    const cfg = await carregarConfigD1().catch(() => null)
    if (!d1Configurado(cfg)) return { ativo: false, novos: 0 }

    await descarregarFilaApagar(cfg).catch(() => {}) // primeiro, o que ficou pendente de avisar
    let cursor = Number(await configGet(CHAVE_CURSOR, 0)) || 0
    let novos = 0
    for (let volta = 0; volta < 10; volta++) {
      const { pedidos, itens } = await buscarPedidosD1(cursor, cfg)
      if (!pedidos.length) break
      const itensPorPedido = new Map()
      for (const i of itens) {
        if (!itensPorPedido.has(i.pedido_uuid)) itensPorPedido.set(i.pedido_uuid, [])
        itensPorPedido.get(i.pedido_uuid).push(i)
      }
      novos += await importarPedidosSite(pedidos.map(p => pedidoSiteParaApp(p, itensPorPedido.get(p.uuid) || [])))
      // O cursor só avança DEPOIS de gravar: se algo falhar no meio, busca de novo na próxima.
      cursor = Math.max(cursor, ...pedidos.map(p => Number(p.atualizado_em) || 0))
      await configSet(CHAVE_CURSOR, cursor)
      if (pedidos.length < 200) break
    }
    return { ativo: true, novos }
  })()
    .catch(err => ({ ativo: true, novos: 0, erro: err?.message || 'Falha ao buscar pedidos do site.' }))
    .finally(() => { emAndamento = null })
  return emAndamento
}

/**
 * Verifica o servidor de tempos em tempos enquanto o app está aberto e visível,
 * ao voltar para o app e ao voltar a internet. Retorna uma função que desliga tudo.
 */
export function iniciarMonitorPedidosSite({ aoChegar, intervaloMs = 60_000 } = {}) {
  const rodar = async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const r = await importarPedidosDoSite()
    if (r.novos > 0) aoChegar?.(r.novos)
  }
  const aoVoltar = () => { if (document.visibilityState === 'visible') rodar() }
  const timer = setInterval(rodar, intervaloMs)
  const inicio = setTimeout(rodar, 3000)
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('online', rodar)
  return () => {
    clearInterval(timer)
    clearTimeout(inicio)
    document.removeEventListener('visibilitychange', aoVoltar)
    window.removeEventListener('online', rodar)
  }
}
