// services/cadernetaServidor.js
// Ponte da Caderneta no MODO SERVIDOR (ver modoServidor.js). Duas direções:
//
//  ESCRITA (aparelho → servidor)
//    1. a operação é gravada na fila (durável) ANTES de qualquer coisa;
//    2. só então o banco local recebe a mesma alteração, de forma otimista (a tela atualiza na hora, mesmo sem sinal);
//    3. quem decide é o servidor. Se ele recusar, a operação fica visível como "recusada" e a próxima leitura
//       do servidor desfaz o otimismo local (o servidor sempre vence).
//    A ordem importa: se o app fechar entre 1 e 2, a fila ainda tem a intenção e o espelho acerta o resto;
//    se fosse o contrário, o local poderia ficar com um pagamento que o servidor nunca soube.
//
//  LEITURA (servidor → aparelho)
//    `projetarServidorNoLocal` copia o espelho do servidor para as tabelas cad_* do banco local, que as telas
//    já sabem ler. Registros com operação pendente na fila NÃO são sobrescritos (o aparelho ainda tem a versão
//    mais nova da pessoa; o servidor ainda não viu).
import { db } from '../db.js'
import { liberarEscrita } from './travaPorPapel.js'
import { uidServidor } from './uidServidor.js'
import { comEscritaLocalLiberada } from './modoServidor.js'
import { enfileirar, filaDb, novoUid } from './filaOperacoes.js'
import {
  atualizarFiado, aplicarPagamento, receberParcialCliente, estornarPagamento, salvarFiado, excluirFiado, hoje, horaAtual,
} from '../composables/useCaderneta.js'

const cent = (v) => Math.round((Number(v) || 0) * 100)
const reais = (c) => (Number(c) || 0) / 100
const iso = (ms) => (ms ? new Date(Number(ms)).toISOString() : null)
const vendaUid = (f) => {
  if (!f?.uid) throw new Error('Essa compra ainda não tem identificador. Reabra a tela e tente de novo.')
  return uidServidor(f.uid, 'cad_fiados')
}
/** A tela às vezes entrega um resumo da compra; o que vale é a linha do banco local (tem uid, saldo e pagamentos). */
const fiadoCompleto = async (f) => (f?.uid && Array.isArray(f.pagamentos) ? f : (await db.cad_fiados.get(f?.id)) || f)

// ───────────────────────── ESCRITA ─────────────────────────

/** Recebe um pagamento (valor em reais, limitado ao saldo, como a tela já faz). */
export async function receberPagamentoServidor(fiado, valor) {
  const f = await fiadoCompleto(fiado)
  const pago = Math.min(Number(valor) || 0, Number(f.saldo) || 0)
  if (!(pago > 0)) throw new Error('Informe um valor maior que zero.')
  const mud = aplicarPagamento(f, pago)
  const p = mud.pagamentos[mud.pagamentos.length - 1]
  await enfileirar('pagamento.registrar', { uid: p.uid, venda_uid: vendaUid(f), valor_centavos: cent(pago), data: p.data, hora: p.hora })
  await comEscritaLocalLiberada(() => atualizarFiado(f.id, mud))
  return mud
}

/** Quita todas as compras em aberto de um cliente. */
export async function quitarTudoServidor(fiados) {
  for (const f of fiados) if (Number(f.saldo) > 0) await receberPagamentoServidor(f, f.saldo)
}

/** Recebe um valor parcial de um cliente com várias compras (abate da mais antiga) e reagenda o restante. */
export async function receberParcialServidor(fiados, valor, novaDataVenc) {
  const ids = fiados.map(f => f.id)
  const uidBase = novoUid()
  const atuais = (await db.cad_fiados.bulkGet(ids)).filter(Boolean)
  await enfileirar('recebimento.parcial', {
    uid: uidBase, venda_uids: atuais.map(vendaUid), valor_centavos: cent(valor), nova_data_venc: novaDataVenc || undefined, data: hoje(), hora: horaAtual(),
  })
  return comEscritaLocalLiberada(() => receberParcialCliente(ids, valor, novaDataVenc, { uidBase }))
}

/** Estorna um pagamento (ele continua no histórico; o estorno é um registro novo). */
export async function estornarServidor(fiado, alvo) {
  if (!alvo?.uid) {
    throw new Error('Esse pagamento ainda não foi sincronizado com o servidor. Conecte-se, aguarde o envio e tente de novo.')
  }
  await enfileirar('pagamento.estornar', { uid: novoUid(), pagamento_uid: alvo.uid, data: hoje(), hora: horaAtual() })
  return comEscritaLocalLiberada(() => estornarPagamento(fiado.id, alvo))
}

export async function alterarVencimentoServidor(fiado, dataVenc) {
  const f = await fiadoCompleto(fiado)
  await enfileirar('venda.vencimento', { venda_uid: vendaUid(f), data_venc: dataVenc })
  await comEscritaLocalLiberada(() => atualizarFiado(f.id, { dataVenc }))
}

// ── Venda: lançar, cancelar e corrigir ──
/** Monta os dados da operação a partir de uma venda no formato da tela (reais) → centavos inteiros, mesma conta do servidor. */
function dadosDaVenda(f) {
  let itens = (f.itens || []).map(i => ({ id: i.id ?? null, nome: i.nome, emoji: i.emoji || null, qtd: Number(i.qty ?? i.qtd) || 0, preco_centavos: cent(i.preco) }))
  if (!itens.length) { // "nota livre" (sem itens): vira um item único com o texto da nota
    itens = [{ id: null, nome: String(f.descricaoLivre || 'Cobrança avulsa').trim().slice(0, 120) || 'Cobrança avulsa', emoji: null, qtd: 1, preco_centavos: cent((Number(f.total) || 0) + (Number(f.desconto) || 0)) }]
  }
  const bruto = itens.reduce((t, i) => t + Math.round(i.qtd * i.preco_centavos), 0)
  const desconto = cent(f.desconto)
  const total = bruto - desconto
  // O que a pessoa viu na tela precisa bater com a conta em centavos; se não bater, algo está errado: não envia.
  if (Math.abs(total - cent(f.total)) > 1) throw new Error('O total da tela não bate com os itens. Confira os valores e tente de novo.')
  return { itens, desconto_centavos: desconto, desconto_motivo: f.descontoMotivo || undefined, total_centavos: total,
    data_venda: f.dataVenda, hora_venda: f.horaVenda || undefined, data_venc: f.dataVenc || undefined }
}

/** Lança uma venda nova (vale offline). Retorna a venda com `id` e `uid` locais. */
export async function lancarVendaServidor(fiado) {
  const cliente = await db.cad_clientes.get(fiado.clienteId)
  if (!cliente?.uid) throw new Error('Cliente sem identificador. Reabra a tela e tente de novo.')
  const uid = fiado.uid || novoUid()
  await enfileirar('venda.criar', { uid, cliente_uid: uidServidor(cliente.uid, 'cad_clientes'), ...dadosDaVenda(fiado) })
  const id = await comEscritaLocalLiberada(() => salvarFiado({ ...fiado, uid }))
  return { ...fiado, uid, id }
}

const semPagamentoAtivo = (f, acao) => {
  if ((f.pagamentos || []).length) throw new Error(`Esta compra já tem pagamento recebido. Estorne os pagamentos antes de ${acao}.`)
}

/** "Excluir" no modo servidor = CANCELAR: a venda continua guardada (com motivo e usuário) e sai da cobrança. */
export async function cancelarVendaServidor(fiado, motivo = '') {
  const f = await fiadoCompleto(fiado)
  semPagamentoAtivo(f, 'cancelar')
  await enfileirar('venda.cancelar', { venda_uid: vendaUid(f), motivo: String(motivo || '').trim() || undefined })
  await comEscritaLocalLiberada(() => excluirFiado(f.id))
}

/** Corrigir valor/itens/desconto/datas = cancelar a venda errada e lançar a certa, numa operação só (tudo ou nada). */
export async function corrigirVendaServidor(fiado, mudancas) {
  const f = await fiadoCompleto(fiado)
  semPagamentoAtivo(f, 'corrigir')
  const nova = { ...f, ...mudancas }
  const uid = novoUid()
  await enfileirar('venda.corrigir', { venda_uid: vendaUid(f), nova: { uid, ...dadosDaVenda(nova) } })
  return comEscritaLocalLiberada(async () => {
    await excluirFiado(f.id)
    const { id: _id, ...sem } = nova
    const id = await salvarFiado({ ...sem, uid, saldo: nova.total, status: 'aberto', pagamentos: [], estornos: [], pagoEm: null, criadoEm: new Date().toISOString() })
    return { ...sem, uid, id }
  })
}

/** Canceladas, corrigidas e estornadas (histórico de correções), mais novas primeiro. Só lê o espelho do servidor. */
export async function listarCorrecoes(limite = 40) {
  const ler = async (t) => filaDb.espelho.where('tabela').equals(t).toArray()
  const [vendas, estornos, pagamentos] = await Promise.all([ler('vendas'), ler('estornos'), ler('pagamentos')])
  const porUid = new Map(vendas.map(v => [v.uid, v])), pagPorUid = new Map(pagamentos.map(p => [p.uid, p]))
  const canceladas = vendas.filter(v => v.cancelada_em).map(v => ({
    tipo: v.motivo_cancelamento?.startsWith('Corrigida') ? 'corrigida' : 'cancelada', quando: v.cancelada_em, cliente: v.cliente_nome, loja: v.loja_nome,
    valor: reais(v.total_centavos), data: v.data_venda, motivo: v.motivo_cancelamento || '' }))
  const estornadas = estornos.map(e => {
    const v = porUid.get(e.venda_uid)
    return { tipo: 'estorno', quando: e.criado_em, cliente: v?.cliente_nome || '', loja: v?.loja_nome || '', valor: reais(e.valor_centavos), data: pagPorUid.get(e.pagamento_uid)?.data || e.data, motivo: e.motivo || '' }
  })
  return [...canceladas, ...estornadas].sort((a, b) => b.quando - a.quando).slice(0, limite)
}

// ───────────────────────── LEITURA ─────────────────────────
const vendasPendentes = async () => {
  const set = new Set()
  for (const op of await filaDb.fila.where('estado').equals('pendente').toArray()) {
    const d = op.dados || {}
    if (d.venda_uid) set.add(d.venda_uid)
    for (const u of d.venda_uids || []) set.add(u)
    if (op.tipo === 'venda.criar' && d.uid) set.add(d.uid)
  }
  return set
}

/**
 * Copia o espelho do servidor para as tabelas cad_* locais. Cria o que falta (ex.: venda lançada em outro aparelho),
 * atualiza o que mudou e remove venda cancelada. Não toca em venda com operação pendente. Retorna contagens.
 */
export async function projetarServidorNoLocal() {
  const espelho = async (t) => (await filaDb.espelho.where('tabela').equals(t).toArray())
  const [lojasS, clientesS, vendasS, pagS, estS] = await Promise.all(['lojas', 'clientes', 'vendas', 'pagamentos', 'estornos'].map(espelho))
  if (!lojasS.length && !vendasS.length) return { lojas: 0, clientes: 0, vendas: 0 }
  const pend = await vendasPendentes()

  const pagPorVenda = new Map(), estPorVenda = new Map(), estornados = new Set(estS.map(e => e.pagamento_uid))
  const pagPorUid = new Map(pagS.map(p => [p.uid, p]))
  for (const p of pagS) { if (!pagPorVenda.has(p.venda_uid)) pagPorVenda.set(p.venda_uid, []); pagPorVenda.get(p.venda_uid).push(p) }
  for (const e of estS) { if (!estPorVenda.has(e.venda_uid)) estPorVenda.set(e.venda_uid, []); estPorVenda.get(e.venda_uid).push(e) }

  const cont = { lojas: 0, clientes: 0, vendas: 0, removidas: 0 }
  await comEscritaLocalLiberada(() => db.transaction('rw', db.cad_lojas, db.cad_clientes, db.cad_fiados, async () => {
    liberarEscrita() // esta gravação vem do servidor: não passa pela trava de papel (como importar/restaurar)

    const mapa = async (tabela) => new Map((await db[tabela].toArray()).map(r => [uidServidor(r.uid, tabela), r]))
    const lojasL = await mapa('cad_lojas'), clientesL = await mapa('cad_clientes'), fiadosL = await mapa('cad_fiados')
    const idLoja = new Map([...lojasL].map(([u, r]) => [u, r.id]))
    const idCliente = new Map([...clientesL].map(([u, r]) => [u, r.id]))

    for (const l of lojasS) {
      const novo = { nome: l.nome, arquivado: !!l.arquivada_em, arquivadoEm: l.arquivada_em ? iso(l.arquivada_em) : undefined }
      const atual = lojasL.get(l.uid)
      if (atual) { if (atual.nome !== novo.nome || !!atual.arquivado !== novo.arquivado) { await db.cad_lojas.put({ ...atual, ...novo }); cont.lojas++ } }
      else { idLoja.set(l.uid, await db.cad_lojas.add({ uid: l.uid, ...novo })); cont.lojas++ }
    }
    for (const c of clientesS) {
      const lojaId = idLoja.get(c.loja_uid)
      if (lojaId == null) continue
      const novo = { lojaId, nome: c.nome, telefone: c.telefone || '', funcao: c.funcao || '', arquivado: !!c.arquivado_em }
      const atual = clientesL.get(c.uid)
      if (atual) {
        if (['lojaId', 'nome', 'telefone', 'funcao'].some(k => (atual[k] ?? '') !== (novo[k] ?? '')) || !!atual.arquivado !== novo.arquivado) { await db.cad_clientes.put({ ...atual, ...novo }); cont.clientes++ }
      } else { idCliente.set(c.uid, await db.cad_clientes.add({ uid: c.uid, ...novo })); cont.clientes++ }
    }

    for (const v of vendasS) {
      const atual = fiadosL.get(v.uid)
      if (pend.has(v.uid)) continue
      if (v.cancelada_em) { if (atual) { await db.cad_fiados.delete(atual.id); cont.removidas++ } continue }
      const clienteId = idCliente.get(v.cliente_uid), lojaId = idLoja.get(v.loja_uid)
      if (clienteId == null || lojaId == null) continue

      const ativos = (pagPorVenda.get(v.uid) || []).filter(p => !estornados.has(p.uid)).sort((a, b) => a.criado_em - b.criado_em || a.uid.localeCompare(b.uid))
      const pagamentos = ativos.map(p => ({ uid: p.uid, valor: reais(p.valor_centavos), data: p.data, hora: p.hora || '', saldoAntes: reais(p.saldo_antes_centavos), saldoDepois: reais(p.saldo_depois_centavos), criadoEm: iso(p.criado_em) }))
      const estornos = (estPorVenda.get(v.uid) || []).sort((a, b) => a.criado_em - b.criado_em).map(e => {
        const p = pagPorUid.get(e.pagamento_uid)
        return { uid: e.uid, valor: reais(e.valor_centavos), pagamentoData: p?.data || null, pagamentoHora: p?.hora || null, pagamentoCriadoEm: iso(p?.criado_em), data: e.data, hora: e.hora || '', criadoEm: iso(e.criado_em), motivo: e.motivo || null }
      })
      const itens = (v.itens || []).map(i => ({ id: i.item_id, nome: i.nome, emoji: i.emoji, qty: i.qtd, preco: reais(i.preco_centavos), subtotal: reais(i.subtotal_centavos) }))
      const novo = {
        clienteId, lojaId, clienteNome: v.cliente_nome, lojaNome: v.loja_nome, itens,
        total: reais(v.total_centavos), saldo: reais(v.saldo_centavos), desconto: reais(v.desconto_centavos), descontoMotivo: v.desconto_motivo || null,
        status: v.status, dataVenda: v.data_venda, horaVenda: v.hora_venda || null, dataVenc: v.data_venc || null,
        criadoEm: iso(v.criado_em), pagoEm: iso(v.pago_em), pagamentos, estornos,
      }
      if (atual) await db.cad_fiados.put({ ...atual, ...novo }); else await db.cad_fiados.add({ uid: v.uid, ...novo })
      cont.vendas++
    }
  }))
  return cont
}

/** Avisa as telas abertas que o banco local mudou por causa do servidor. */
export const EVENTO_ATUALIZADA = 'caderneta-atualizada'
