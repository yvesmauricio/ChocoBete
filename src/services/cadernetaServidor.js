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
import { acessoRef } from './acessoServidor.js'
import { enfileirar, filaDb, novoUid } from './filaOperacoes.js'
import {
  atualizarFiado, aplicarPagamento, receberParcialCliente, estornarPagamento, salvarFiado, excluirFiado, hoje, horaAtual,
  acharLojaDuplicada, acharClienteDuplicado,
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

// ── Loja e cliente ──
// Nada é excluído no servidor: "excluir" vira ARQUIVAR (some das listas, o histórico fica). Cadastros repetidos não
// existem mais (o banco recusa mesmo telefone / mesmo nome), então "juntar duplicados" não se aplica.
const limpar = (v) => String(v || '').trim().replace(/\s+/g, ' ')
const agoraISO = () => new Date().toISOString()

/** Cria/renomeia loja. Mesmo contrato de `salvarLojaValidada`: { ok, id, renomeou, vendasAtualizadas } ou { ok:false, dup }. */
export async function salvarLojaServidor(obj) {
  const nome = limpar(obj.nome)
  if (!nome) throw new Error('NOME_VAZIO')
  const atual = obj.id != null ? await db.cad_lojas.get(obj.id) : null
  if (obj.id != null && !atual) throw new Error('LOJA_NAO_ENCONTRADA')
  const dup = await acharLojaDuplicada(nome, atual?.id ?? null)
  if (dup) return { ok: false, dup }
  const uidLocal = atual?.uid || novoUid()
  const renomeou = !!atual && atual.nome !== nome
  const vendas = renomeou ? await db.cad_fiados.where('lojaId').equals(atual.id).count() : 0
  await enfileirar('loja.salvar', { uid: uidServidor(uidLocal, 'cad_lojas'), nome })
  const id = await comEscritaLocalLiberada(async () => {
    const id = await db.cad_lojas.put({ ...(atual || {}), ...obj, nome, uid: uidLocal })
    if (renomeou) await db.cad_fiados.where('lojaId').equals(id).modify({ lojaNome: nome })   // o espelho mostra o nome atual
    return id
  })
  return { ok: true, id, renomeou, vendasAtualizadas: vendas }
}

export async function arquivarLojaServidor(id, arquivar = true) {
  const l = await db.cad_lojas.get(id)
  if (!l?.uid) throw new Error('LOJA_NAO_ENCONTRADA')
  await enfileirar('loja.arquivar', { uid: uidServidor(l.uid, 'cad_lojas'), arquivar })
  await comEscritaLocalLiberada(() => db.cad_lojas.update(id, arquivar ? { arquivado: true, arquivadoEm: agoraISO() } : { arquivado: false, arquivadoEm: null }))
}

/** "Excluir" loja vazia = arquivar (com histórico a tela já arquiva). */
export async function excluirLojaServidor(id) {
  const [nClientes, nFiados] = await Promise.all([db.cad_clientes.where('lojaId').equals(id).count(), db.cad_fiados.where('lojaId').equals(id).count()])
  if (nClientes || nFiados) throw new Error('LOJA_COM_HISTORICO')
  await arquivarLojaServidor(id, true)
}

/** Cria/edita cliente. Mesmo contrato de `salvarClienteValidado`: { ok, id } ou { ok:false, dup }. */
export async function salvarClienteServidor(obj, { moverAbertos = false } = {}) {
  const atual = obj.id != null ? await db.cad_clientes.get(obj.id) : null
  const final = { ...(atual || {}), ...obj }
  const nome = limpar(final.nome)
  if (!nome) throw new Error('NOME_VAZIO')
  const dup = await acharClienteDuplicado(final, final.id ?? null)
  if (dup) return { ok: false, dup }
  const loja = await db.cad_lojas.get(final.lojaId)
  if (!loja?.uid) throw new Error('LOJA_NAO_ENCONTRADA')
  const uidLocal = atual?.uid || novoUid()
  const uid = uidServidor(uidLocal, 'cad_clientes')
  const mover = !!(moverAbertos && atual && atual.lojaId !== final.lojaId)
  await enfileirar('cliente.salvar', { uid, loja_uid: uidServidor(loja.uid, 'cad_lojas'), nome, telefone: final.telefone || '', funcao: final.funcao || '', mover_abertos: mover })
  if (atual && !!atual.arquivado !== !!final.arquivado) await enfileirar('cliente.arquivar', { uid, arquivar: !!final.arquivado })
  const id = await comEscritaLocalLiberada(() => db.transaction('rw', db.cad_clientes, db.cad_fiados, async () => {
    const id = await db.cad_clientes.put({ ...final, nome, uid: uidLocal })
    if (atual && atual.nome !== nome) await db.cad_fiados.where('clienteId').equals(id).modify({ clienteNome: nome })
    if (mover) await db.cad_fiados.where('clienteId').equals(id).filter(f => f.status === 'aberto').modify({ lojaId: final.lojaId, lojaNome: loja.nome })
    return id
  }))
  return { ok: true, id }
}

export async function arquivarClienteServidor(id, arquivar = true) {
  const c = await db.cad_clientes.get(id)
  if (!c?.uid) throw new Error('CLIENTE_NAO_ENCONTRADO')
  await enfileirar('cliente.arquivar', { uid: uidServidor(c.uid, 'cad_clientes'), arquivar })
  await comEscritaLocalLiberada(() => db.cad_clientes.update(id, arquivar ? { arquivado: true, arquivadoEm: agoraISO() } : { arquivado: false, arquivadoEm: null }))
}

/** "Excluir" cliente sem nenhuma venda = arquivar. */
export async function excluirClienteServidor(id) {
  if (await db.cad_fiados.where('clienteId').equals(id).count()) throw new Error('CLIENTE_COM_HISTORICO')
  await arquivarClienteServidor(id, true)
}

export const MSG_JUNTAR_SERVIDOR = 'No modo servidor não há cadastros repetidos para juntar: o servidor impede o mesmo telefone e o mesmo nome de loja.'

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
  const usuario = acessoRef.value?.usuario || null   // quem lançou (a Vendas pode desfazer a PRÓPRIA venda nos primeiros minutos)
  const id = await comEscritaLocalLiberada(() => salvarFiado({ ...fiado, uid, usuario }))
  return { ...fiado, uid, usuario, id }
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
    const usuario = acessoRef.value?.usuario || sem.usuario || null
    const id = await salvarFiado({ ...sem, uid, usuario, saldo: nova.total, status: 'aberto', pagamentos: [], estornos: [], pagoEm: null, criadoEm: new Date().toISOString() })
    return { ...sem, uid, usuario, id }
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
/** uids (de venda, loja e cliente) com operação ainda na fila: o aparelho tem a versão mais nova, não pisamos. */
const uidsPendentes = async () => {
  const set = new Set()
  for (const op of await filaDb.fila.where('estado').equals('pendente').toArray()) {
    const d = op.dados || {}
    for (const k of ['uid', 'venda_uid', 'loja_uid', 'cliente_uid']) if (d[k]) set.add(d[k])
    for (const u of d.venda_uids || []) set.add(u)
    if (d.nova?.uid) set.add(d.nova.uid)
  }
  return set
}
/** Operações de CRIAÇÃO que o servidor recusou: o que o aparelho criou "de otimismo" precisa sumir daqui. */
const criacoesRecusadas = async () => {
  const por = { cad_lojas: new Set(), cad_clientes: new Set(), cad_fiados: new Set() }
  for (const op of await filaDb.fila.where('estado').equals('rejeitada').toArray()) {
    const d = op.dados || {}
    if (op.tipo === 'loja.salvar' && d.uid) por.cad_lojas.add(d.uid)
    if (op.tipo === 'cliente.salvar' && d.uid) por.cad_clientes.add(d.uid)
    if (op.tipo === 'venda.criar' && d.uid) por.cad_fiados.add(d.uid)
    if (op.tipo === 'venda.corrigir' && d.nova?.uid) por.cad_fiados.add(d.nova.uid)
  }
  return por
}

/**
 * Copia o espelho do servidor para as tabelas cad_* locais. Cria o que falta (ex.: venda lançada em outro aparelho),
 * atualiza o que mudou e remove venda cancelada. Não toca em venda com operação pendente. Retorna contagens.
 */
export async function projetarServidorNoLocal() {
  const espelho = async (t) => (await filaDb.espelho.where('tabela').equals(t).toArray())
  const [lojasS, clientesS, vendasS, pagS, estS] = await Promise.all(['lojas', 'clientes', 'vendas', 'pagamentos', 'estornos'].map(espelho))
  if (!lojasS.length && !vendasS.length) return { lojas: 0, clientes: 0, vendas: 0 }
  const pend = await uidsPendentes()
  const recusadas = await criacoesRecusadas()
  const lojaNomePorUid = new Map(lojasS.map(l => [l.uid, l.nome])), clienteNomePorUid = new Map(clientesS.map(c => [c.uid, c.nome]))

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

    // 0) O servidor recusou uma CRIAÇÃO feita aqui (ex.: telefone que outro aparelho cadastrou antes): some do aparelho.
    const recusa = async (tabela, mapaL, tabelaEsp, idsMap) => {
      for (const u of recusadas[tabela]) {
        const alvo = mapaL.get(uidServidor(u, tabela))
        const noServidor = tabelaEsp.some(r => r.uid === uidServidor(u, tabela))
        if (alvo && !noServidor && !pend.has(u)) { await db[tabela].delete(alvo.id); mapaL.delete(uidServidor(u, tabela)); idsMap?.delete(uidServidor(u, tabela)); cont.removidas++ }
      }
    }
    await recusa('cad_fiados', fiadosL, vendasS)
    await recusa('cad_clientes', clientesL, clientesS, idCliente)
    await recusa('cad_lojas', lojasL, lojasS, idLoja)

    const mudou = (atual, novo) => Object.keys(novo).some(k => JSON.stringify(atual[k] ?? null) !== JSON.stringify(novo[k] ?? null))

    for (const l of lojasS) {
      if (pend.has(l.uid)) continue
      const novo = { nome: l.nome, arquivado: !!l.arquivada_em, arquivadoEm: l.arquivada_em ? iso(l.arquivada_em) : null }
      const atual = lojasL.get(l.uid)
      if (atual) { if (mudou(atual, novo)) { await db.cad_lojas.put({ ...atual, ...novo }); cont.lojas++ } }
      else { idLoja.set(l.uid, await db.cad_lojas.add({ uid: l.uid, ...novo })); cont.lojas++ }
    }
    for (const c of clientesS) {
      if (pend.has(c.uid)) continue
      const lojaId = idLoja.get(c.loja_uid)
      if (lojaId == null) continue
      const novo = { lojaId, nome: c.nome, telefone: c.telefone || '', funcao: c.funcao || '', arquivado: !!c.arquivado_em, arquivadoEm: c.arquivado_em ? iso(c.arquivado_em) : null }
      const atual = clientesL.get(c.uid)
      if (atual) { if (mudou(atual, novo)) { await db.cad_clientes.put({ ...atual, ...novo }); cont.clientes++ } }
      else { idCliente.set(c.uid, await db.cad_clientes.add({ uid: c.uid, ...novo })); cont.clientes++ }
    }

    for (const v of vendasS) {
      const atual = fiadosL.get(v.uid)
      if (pend.has(v.uid) || pend.has(v.cliente_uid) || pend.has(v.loja_uid)) continue   // ainda há algo do aparelho a caminho
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
        clienteId, lojaId,
        // No servidor a venda guarda o nome DA ÉPOCA; as telas mostram o nome ATUAL do cadastro (como sempre mostraram).
        clienteNome: clienteNomePorUid.get(v.cliente_uid) ?? v.cliente_nome, lojaNome: lojaNomePorUid.get(v.loja_uid) ?? v.loja_nome, itens,
        total: reais(v.total_centavos), saldo: reais(v.saldo_centavos), desconto: reais(v.desconto_centavos), descontoMotivo: v.desconto_motivo || null,
        status: v.status, dataVenda: v.data_venda, horaVenda: v.hora_venda || null, dataVenc: v.data_venc || null,
        criadoEm: iso(v.criado_em), pagoEm: iso(v.pago_em), pagamentos, estornos, usuario: v.usuario || null,
      }
      if (!atual) { await db.cad_fiados.add({ uid: v.uid, ...novo }); cont.vendas++ }
      else if (mudou(atual, novo)) { await db.cad_fiados.put({ ...atual, ...novo }); cont.vendas++ }
    }
  }))
  return cont
}

/** Avisa as telas abertas que o banco local mudou por causa do servidor. */
export const EVENTO_ATUALIZADA = 'caderneta-atualizada'
