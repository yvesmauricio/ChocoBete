// Caderneta no servidor (Etapa 1).
//
// O aparelho manda OPERAÇÕES ({ op_id, tipo, dados }); este módulo valida, grava e responde.
//   · idempotente: a mesma op_id nunca é aplicada duas vezes (reenvio depois de queda de sinal é seguro);
//   · atômico: cada operação é um único `batch` (tudo ou nada), junto com o registro em `operacoes`;
//   · o BANCO é a última barreira: os gatilhos de 0003_caderneta.sql recusam o que viola as regras,
//     mesmo que esta camada tenha uma falha. Aqui só traduzimos o erro para uma frase que o usuário entende.
// Dinheiro: sempre centavos inteiros. Nada é apagado.
import { uuidOk } from './util.js'

// ───────────────────────── utilitários (mesmas regras do app atual) ─────────────────────────
export const normalizar = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
export const chaveNome = (v) => normalizar(v).replace(/\s+/g, ' ').trim()
export const limparTexto = (v) => String(v || '').trim().replace(/\s+/g, ' ')

const digitosTelefone = (v) => {
  let d = String(v || '').replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  return d
}
/** DDD + últimos 8 dígitos (reconhece o mesmo número com e sem o nono dígito). */
export const chaveTelefone = (v) => {
  const d = digitosTelefone(v)
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d
}
/** '' se válido (ou vazio); senão a mensagem. */
export const validarTelefone = (v) => {
  const d = digitosTelefone(v)
  if (!d) return ''
  if (d.length !== 10 && d.length !== 11) return 'Telefone incompleto. Use o DDD + número (10 ou 11 dígitos).'
  if (d[0] === '0' || d[1] === '0') return 'DDD inválido.'
  if (d.length === 11 && d[2] !== '9') return 'Celular com 11 dígitos precisa começar com 9 depois do DDD.'
  return ''
}

const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/
const RE_HORA = /^\d{2}:\d{2}$/
const ehInteiro = (n) => Number.isSafeInteger(n)

/** Data e hora no fuso do negócio (America/Sao_Paulo) a partir de um instante em ms. */
export function dataHoraSP(ms) {
  const p = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ms)).reduce((o, x) => ({ ...o, [x.type]: x.value }), {})
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

/** Recusa "de negócio": a operação é registrada como rejeitada e o aparelho mostra o motivo. */
export class Rejeicao extends Error {}
const rejeitar = (msg) => { throw new Rejeicao(msg) }

const MENSAGENS = {
  E_VENDA_INICIAL: 'Toda venda nasce aberta, com saldo igual ao total.',
  E_VENDA_IMUTAVEL: 'Valores e identificação de uma venda não podem ser alterados.',
  E_VENDA_CANCELADA: 'Essa compra foi cancelada.',
  E_VENDA_INEXISTENTE: 'Essa compra não existe.',
  E_CANCELAR_COM_PAGAMENTO: 'Compra com pagamento recebido não pode ser cancelada: estorne o pagamento primeiro.',
  E_VENDA_PAGA_NAO_MUDA_LOJA: 'Compra já paga fica na loja onde aconteceu.',
  E_SALDO_INCOERENTE: 'O saldo não bate com os pagamentos. Nada foi gravado.',
  E_SEM_EXCLUSAO: 'Nada é excluído: arquive ou cancele.',
  E_PAG_MAIOR_QUE_SALDO: 'O valor é maior que o saldo atual da compra.',
  E_PAGAMENTO_INEXISTENTE: 'Esse pagamento não existe nessa compra.',
  E_ESTORNO_VALOR: 'O estorno precisa ser do valor exato do pagamento.',
  E_HISTORICO_IMUTAVEL: 'O histórico não pode ser alterado.',
}
const MENSAGENS_UNICIDADE = [
  ['cad_lojas.nome_chave', 'Já existe uma loja com esse nome.'],
  ['cad_clientes.telefone_chave', 'Esse telefone já está cadastrado em outro cliente.'],
  ['cad_clientes.loja_uid', 'Já existe um cliente com esse nome e função nessa loja.'],
  ['cad_estornos.pagamento_uid', 'Esse pagamento já foi estornado.'],
]

/** Traduz erro do banco em { status, motivo } ou null (erro inesperado → o chamador relança). */
function traduzirErroBanco(e) {
  const msg = String(e?.message || e)
  if (msg.includes('E_SALDO_DESATUALIZADO')) return { status: 'tentar_de_novo' } // outra operação mexeu no saldo no meio
  if (msg.includes('operacoes.op_id')) return { status: 'duplicada' }
  const cod = /E_[A-Z_]+/.exec(msg)?.[0]
  if (cod && MENSAGENS[cod]) return { status: 'rejeitada', motivo: MENSAGENS[cod] }
  if (/UNIQUE constraint failed/i.test(msg)) {
    const m = MENSAGENS_UNICIDADE.find(([c]) => msg.includes(c))
    return { status: 'rejeitada', motivo: m ? m[1] : 'Esse registro já existe.' }
  }
  if (/CHECK constraint failed/i.test(msg)) return { status: 'rejeitada', motivo: 'Valores inválidos (regra de integridade do banco).' }
  if (/FOREIGN KEY constraint failed/i.test(msg)) return { status: 'rejeitada', motivo: 'Registro relacionado não existe (loja, cliente ou compra).' }
  return null
}

// ───────────────────────── operações ─────────────────────────
const exigirUid = (v, nome) => { if (!uuidOk(v)) rejeitar(`Identificador inválido (${nome}).`); return v }
const exigirData = (v, nome) => { if (!RE_DATA.test(String(v || ''))) rejeitar(`Data inválida (${nome}).`); return v }

async function lerVenda(DB, uid) {
  return DB.prepare('SELECT * FROM cad_vendas WHERE uid = ?').bind(uid).first()
}

function stmtPagamento(DB, { uid, venda, valor, data, hora, ctx }) {
  return DB.prepare(
    `INSERT INTO cad_pagamentos (uid, venda_uid, valor_centavos, saldo_antes_centavos, saldo_depois_centavos, data, hora, usuario, criado_no_aparelho, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid, venda.uid, valor, venda.saldo_centavos, venda.saldo_centavos - valor, data, hora || null, ctx.usuario || null, ctx.criadoNoAparelho ?? null, ctx.agora)
}

const dataHoraDaOp = (d, ctx) => {
  const f = ctx.criadoNoAparelho ? dataHoraSP(ctx.criadoNoAparelho) : dataHoraSP(ctx.agora)
  const data = d.data ? exigirData(d.data, 'data') : f.data
  const hora = d.hora ? (RE_HORA.test(d.hora) ? d.hora : rejeitar('Hora inválida.')) : f.hora
  return { data, hora }
}

export const TIPOS = {
  async 'loja.salvar'(DB, d, ctx) {
    const uid = exigirUid(d.uid, 'loja')
    const nome = limparTexto(d.nome)
    if (!nome) rejeitar('Informe o nome da loja.')
    const chave = chaveNome(nome)
    const atual = await DB.prepare('SELECT uid FROM cad_lojas WHERE uid = ?').bind(uid).first()
    // Renomear NÃO mexe nas vendas: cada venda guarda o nome que a loja tinha quando ela aconteceu.
    return atual
      ? [DB.prepare('UPDATE cad_lojas SET nome = ?, nome_chave = ?, atualizado_em = ? WHERE uid = ?').bind(nome, chave, ctx.agora, uid)]
      : [DB.prepare('INSERT INTO cad_lojas (uid, nome, nome_chave, criado_em, atualizado_em) VALUES (?,?,?,?,?)').bind(uid, nome, chave, ctx.agora, ctx.agora)]
  },

  async 'loja.arquivar'(DB, d, ctx) {
    const uid = exigirUid(d.uid, 'loja')
    if (!(await DB.prepare('SELECT 1 AS x FROM cad_lojas WHERE uid = ?').bind(uid).first())) rejeitar('Loja não encontrada.')
    return [DB.prepare('UPDATE cad_lojas SET arquivada_em = ?, atualizado_em = ? WHERE uid = ?').bind(d.arquivar === false ? null : ctx.agora, ctx.agora, uid)]
  },

  async 'cliente.salvar'(DB, d, ctx) {
    const uid = exigirUid(d.uid, 'cliente')
    const nome = limparTexto(d.nome)
    if (!nome) rejeitar('Informe o nome do cliente.')
    const erroTel = validarTelefone(d.telefone)
    if (erroTel) rejeitar(erroTel)
    const loja = await DB.prepare('SELECT uid, nome FROM cad_lojas WHERE uid = ?').bind(exigirUid(d.loja_uid, 'loja')).first()
    if (!loja) rejeitar('Loja não encontrada.')
    const telChave = chaveTelefone(d.telefone) || null
    const funcao = limparTexto(d.funcao)
    const atual = await DB.prepare('SELECT uid, loja_uid FROM cad_clientes WHERE uid = ?').bind(uid).first()
    const stmts = []
    if (atual) {
      stmts.push(DB.prepare(
        'UPDATE cad_clientes SET loja_uid=?, nome=?, nome_chave=?, telefone=?, telefone_chave=?, funcao=?, funcao_chave=?, atualizado_em=? WHERE uid=?')
        .bind(loja.uid, nome, chaveNome(nome), limparTexto(d.telefone) || null, telChave, funcao || null, chaveNome(funcao), ctx.agora, uid))
      if (d.mover_abertos && atual.loja_uid !== loja.uid) {
        stmts.push(DB.prepare(
          `UPDATE cad_vendas SET loja_uid = ?, loja_nome = ?, atualizado_em = ?
            WHERE cliente_uid = ? AND status = 'aberto' AND cancelada_em IS NULL`).bind(loja.uid, loja.nome, ctx.agora, uid))
      }
    } else {
      stmts.push(DB.prepare(
        `INSERT INTO cad_clientes (uid, loja_uid, nome, nome_chave, telefone, telefone_chave, funcao, funcao_chave, criado_em, atualizado_em)
         VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .bind(uid, loja.uid, nome, chaveNome(nome), limparTexto(d.telefone) || null, telChave, funcao || null, chaveNome(funcao), ctx.agora, ctx.agora))
    }
    return stmts
  },

  async 'cliente.arquivar'(DB, d, ctx) {
    const uid = exigirUid(d.uid, 'cliente')
    if (!(await DB.prepare('SELECT 1 AS x FROM cad_clientes WHERE uid = ?').bind(uid).first())) rejeitar('Cliente não encontrado.')
    return [DB.prepare('UPDATE cad_clientes SET arquivado_em = ?, atualizado_em = ? WHERE uid = ?').bind(d.arquivar === false ? null : ctx.agora, ctx.agora, uid)]
  },

  async 'venda.criar'(DB, d, ctx) {
    const uid = exigirUid(d.uid, 'venda')
    const cli = await DB.prepare(
      `SELECT c.uid, c.nome, c.loja_uid, c.arquivado_em, l.nome AS loja_nome
         FROM cad_clientes c JOIN cad_lojas l ON l.uid = c.loja_uid WHERE c.uid = ?`).bind(exigirUid(d.cliente_uid, 'cliente')).first()
    if (!cli) rejeitar('Cliente não encontrado.')
    if (cli.arquivado_em) rejeitar('Cliente arquivado: desarquive antes de lançar.')

    const itens = Array.isArray(d.itens) ? d.itens : []
    if (!itens.length || itens.length > 200) rejeitar('A venda precisa ter de 1 a 200 itens.')
    let bruto = 0
    const linhas = itens.map((it, pos) => {
      const qtd = Number(it?.qtd)
      const preco = it?.preco_centavos
      if (!(qtd > 0) || !Number.isFinite(qtd)) rejeitar(`Quantidade inválida no item ${pos + 1}.`)
      if (!ehInteiro(preco) || preco < 0) rejeitar(`Preço inválido no item ${pos + 1} (use centavos inteiros).`)
      if (!limparTexto(it?.nome)) rejeitar(`Item ${pos + 1} sem nome.`)
      const subtotal = Math.round(qtd * preco)
      bruto += subtotal
      return { pos, item_id: it.id ?? null, nome: limparTexto(it.nome), emoji: it.emoji || null, qtd, preco, subtotal }
    })
    const desconto = d.desconto_centavos ?? 0
    if (!ehInteiro(desconto) || desconto < 0) rejeitar('Desconto inválido (use centavos inteiros).')
    if (bruto <= 0) rejeitar('O valor da venda precisa ser maior que zero.')
    if (desconto >= bruto) rejeitar('O desconto precisa ser menor que o valor da venda.')
    const total = bruto - desconto
    // O aparelho calcula o total que mostrou na tela; se não bater com a conta do servidor, algo está errado.
    if (d.total_centavos !== undefined && d.total_centavos !== total) {
      rejeitar(`O total enviado (${reais(Number(d.total_centavos) || 0)}) não bate com os itens (${reais(total)}).`)
    }
    const { data: dh, hora: hh } = dataHoraDaOp({ data: d.data_venda, hora: d.hora_venda }, ctx)
    const venc = d.data_venc ? exigirData(d.data_venc, 'vencimento') : null
    const substitui = d.substitui_uid ? exigirUid(d.substitui_uid, 'venda substituída') : null

    return [
      DB.prepare(
        `INSERT INTO cad_vendas (uid, cliente_uid, loja_uid, cliente_nome, loja_nome, bruto_centavos, desconto_centavos, desconto_motivo,
                                 total_centavos, saldo_centavos, status, data_venda, hora_venda, data_venc, usuario, criado_no_aparelho, criado_em, atualizado_em, substitui_uid)
         VALUES (?,?,?,?,?,?,?,?,?,?, 'aberto', ?,?,?,?,?,?,?,?)`)
        .bind(uid, cli.uid, cli.loja_uid, cli.nome, cli.loja_nome, bruto, desconto, limparTexto(d.desconto_motivo) || null,
          total, total, dh, hh, venc, ctx.usuario || null, ctx.criadoNoAparelho ?? null, ctx.agora, ctx.agora, substitui),
      ...linhas.map(l => DB.prepare(
        'INSERT INTO cad_venda_itens (venda_uid, pos, item_id, nome, emoji, qtd, preco_centavos, subtotal_centavos) VALUES (?,?,?,?,?,?,?,?)')
        .bind(uid, l.pos, l.item_id, l.nome, l.emoji, l.qtd, l.preco, l.subtotal)),
    ]
  },

  async 'venda.vencimento'(DB, d, ctx) {
    const v = await lerVenda(DB, exigirUid(d.venda_uid, 'venda'))
    if (!v) rejeitar('Essa compra não existe.')
    if (v.cancelada_em) rejeitar('Essa compra foi cancelada.')
    return [DB.prepare('UPDATE cad_vendas SET data_venc = ?, atualizado_em = ? WHERE uid = ?').bind(exigirData(d.data_venc, 'vencimento'), ctx.agora, v.uid)]
  },

  async 'venda.cancelar'(DB, d, ctx) {
    const v = await lerVenda(DB, exigirUid(d.venda_uid, 'venda'))
    if (!v) rejeitar('Essa compra não existe.')
    if (v.cancelada_em) rejeitar('Essa compra já foi cancelada.')
    if (v.saldo_centavos !== v.total_centavos) rejeitar('Compra com pagamento recebido não pode ser cancelada: estorne o pagamento primeiro.')
    return [DB.prepare('UPDATE cad_vendas SET cancelada_em = ?, motivo_cancelamento = ?, atualizado_em = ? WHERE uid = ?')
      .bind(ctx.agora, limparTexto(d.motivo) || null, ctx.agora, v.uid)]
  },

  /**
   * Corrigir valor/itens/desconto/datas = CANCELAR a venda errada e LANÇAR a certa, numa operação só (tudo ou nada).
   * A antiga fica cancelada (com motivo e ligação com a nova); nada é apagado. Só vale sem pagamento ativo:
   * com pagamento, estorne primeiro (o histórico do dinheiro recebido não é reescrito).
   */
  async 'venda.corrigir'(DB, d, ctx) {
    const velha = await lerVenda(DB, exigirUid(d.venda_uid, 'venda'))
    if (!velha) rejeitar('Essa compra não existe.')
    if (velha.cancelada_em) rejeitar('Essa compra já foi cancelada.')
    if (velha.saldo_centavos !== velha.total_centavos) rejeitar('Compra com pagamento recebido: estorne os pagamentos antes de corrigir.')
    const nova = d.nova || {}
    if (exigirUid(nova.uid, 'venda nova') === velha.uid) rejeitar('A venda corrigida precisa de um identificador novo.')
    const criar = await TIPOS['venda.criar'](DB, { ...nova, cliente_uid: velha.cliente_uid, substitui_uid: velha.uid }, ctx)
    return [
      DB.prepare('UPDATE cad_vendas SET cancelada_em = ?, motivo_cancelamento = ?, atualizado_em = ? WHERE uid = ?')
        .bind(ctx.agora, `Corrigida: substituída pela venda ${nova.uid}`, ctx.agora, velha.uid),
      ...criar,
    ]
  },

  async 'pagamento.registrar'(DB, d, ctx) {
    const uid = exigirUid(d.uid, 'pagamento')
    const valor = d.valor_centavos
    if (!ehInteiro(valor) || valor <= 0) rejeitar('Informe um valor maior que zero (em centavos inteiros).')
    const v = await lerVenda(DB, exigirUid(d.venda_uid, 'venda'))
    if (!v) rejeitar('Essa compra não existe.')
    if (v.cancelada_em) rejeitar('Essa compra foi cancelada.')
    if (v.saldo_centavos === 0) rejeitar('Essa compra já está quitada.')
    // Regra de segurança: NÃO cortamos o valor em silêncio. Se foi recebido mais que o saldo,
    // a operação é recusada e aparece para a pessoa decidir (pode ser outro aparelho que já lançou).
    if (valor > v.saldo_centavos) rejeitar(`O valor (${reais(valor)}) é maior que o saldo atual (${reais(v.saldo_centavos)}).`)
    const { data, hora } = dataHoraDaOp(d, ctx)
    return [stmtPagamento(DB, { uid, venda: v, valor, data, hora, ctx })]
  },

  async 'pagamento.estornar'(DB, d, ctx) {
    const uid = exigirUid(d.uid, 'estorno')
    const p = await DB.prepare('SELECT * FROM cad_pagamentos WHERE uid = ?').bind(exigirUid(d.pagamento_uid, 'pagamento')).first()
    if (!p) rejeitar('Esse pagamento não existe.')
    if (await DB.prepare('SELECT 1 AS x FROM cad_estornos WHERE pagamento_uid = ?').bind(p.uid).first()) rejeitar('Esse pagamento já foi estornado.')
    const { data, hora } = dataHoraDaOp(d, ctx)
    // O pagamento original continua lá; o estorno é uma linha nova que o anula.
    return [DB.prepare(
      `INSERT INTO cad_estornos (uid, pagamento_uid, venda_uid, valor_centavos, motivo, data, hora, usuario, criado_no_aparelho, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(uid, p.uid, p.venda_uid, p.valor_centavos, limparTexto(d.motivo) || null, data, hora, ctx.usuario || null, ctx.criadoNoAparelho ?? null, ctx.agora)]
  },

  /** Recebimento de um valor de cliente com várias compras abertas: abate da mais antiga para a mais nova. */
  async 'recebimento.parcial'(DB, d, ctx) {
    const base = exigirUid(d.uid, 'recebimento')
    if (base.length > 50) rejeitar('Identificador do recebimento longo demais.')
    const valor = d.valor_centavos
    if (!ehInteiro(valor) || valor <= 0) rejeitar('Informe um valor maior que zero (em centavos inteiros).')
    const ids = [...new Set((Array.isArray(d.venda_uids) ? d.venda_uids : []).map(x => exigirUid(x, 'venda')))]
    if (!ids.length || ids.length > 100) rejeitar('Selecione de 1 a 100 compras.')
    const { results } = await DB.prepare(
      `SELECT * FROM cad_vendas WHERE uid IN (${ids.map(() => '?').join(',')}) AND status = 'aberto' AND cancelada_em IS NULL AND saldo_centavos > 0`)
      .bind(...ids).all()
    if (!results.length) rejeitar('Essas compras já estão quitadas.')
    results.sort((a, b) => String(a.data_venda).localeCompare(String(b.data_venda)) || String(a.hora_venda || '').localeCompare(String(b.hora_venda || '')) || a.uid.localeCompare(b.uid))
    const saldoTotal = results.reduce((s, v) => s + v.saldo_centavos, 0)
    if (valor > saldoTotal) rejeitar(`O valor (${reais(valor)}) é maior que o saldo em aberto (${reais(saldoTotal)}).`)
    const sobra = saldoTotal - valor
    const novaVenc = sobra > 0 ? exigirData(d.nova_data_venc, 'data do restante') : null
    const { data, hora } = dataHoraDaOp(d, ctx)

    let falta = valor
    const stmts = []
    // uid do pagamento = `${op}-${posição da venda na ordem de abatimento}`: determinístico (o aparelho calcula o mesmo)
    // e dentro do formato válido (letras, números, _ e -; até 64), para poder ser estornado depois.
    for (const [i, v] of results.entries()) {
      const parte = Math.min(falta, v.saldo_centavos)
      if (parte > 0) {
        stmts.push(stmtPagamento(DB, { uid: `${base}-${i}`, venda: v, valor: parte, data, hora, ctx }))
        falta -= parte
      }
      if (novaVenc && v.saldo_centavos - parte > 0) {
        stmts.push(DB.prepare('UPDATE cad_vendas SET data_venc = ?, atualizado_em = ? WHERE uid = ?').bind(novaVenc, ctx.agora, v.uid))
      }
    }
    if (falta !== 0) rejeitar('A conferência dos valores falhou. Nada foi alterado.')
    return stmts
  },
}

// ───────────────────────── execução de uma operação ─────────────────────────
function stmtRegistrarOp(DB, op, ctx, resultado, motivo, ignorarSeExiste = false) {
  return DB.prepare(
    `INSERT ${ignorarSeExiste ? 'OR IGNORE ' : ''}INTO operacoes (op_id, tipo, usuario, aparelho, criado_no_aparelho, recebido_em, resultado, motivo, payload)
     VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(op.op_id, String(op.tipo || '?').slice(0, 60), ctx.usuario || null, ctx.aparelho || null, ctx.criadoNoAparelho ?? null, ctx.agora, resultado, motivo || null, JSON.stringify(op.dados ?? null).slice(0, 20000))
}

/**
 * Aplica UMA operação. Retorna { op_id, status, motivo? }:
 *   aplicada | duplicada (já tinha sido aplicada/recusada antes) | rejeitada (+motivo) | tentar_de_novo (concorrência)
 * Erros inesperados (banco fora do ar etc.) são relançados: o aparelho mantém a operação na fila e tenta depois.
 */
export async function aplicarOperacao(DB, op, { usuario, aparelho, agora = Date.now() } = {}) {
  if (!op || !uuidOk(op.op_id)) return { op_id: op?.op_id ?? null, status: 'rejeitada', motivo: 'Operação sem identificador válido.' }
  const ja = await DB.prepare('SELECT resultado, motivo FROM operacoes WHERE op_id = ?').bind(op.op_id).first()
  if (ja) return { op_id: op.op_id, status: 'duplicada', resultado: ja.resultado, motivo: ja.motivo || undefined }

  const ctx = { usuario, aparelho, agora, criadoNoAparelho: Number.isSafeInteger(op.criado_no_aparelho) ? op.criado_no_aparelho : null }
  const registrarRejeicao = async (motivo) => {
    await stmtRegistrarOp(DB, op, ctx, 'rejeitada', motivo, true).run()
    return { op_id: op.op_id, status: 'rejeitada', motivo }
  }
  const tratar = TIPOS[op.tipo]
  if (!tratar) return registrarRejeicao(`Tipo de operação desconhecido: ${String(op.tipo).slice(0, 40)}`)

  try {
    const stmts = await tratar(DB, op.dados || {}, ctx)
    await DB.batch([...stmts, stmtRegistrarOp(DB, op, ctx, 'aplicada', null)])
    return { op_id: op.op_id, status: 'aplicada' }
  } catch (e) {
    if (e instanceof Rejeicao) return registrarRejeicao(e.message)
    const t = traduzirErroBanco(e)
    if (!t) throw e
    if (t.status === 'rejeitada') return registrarRejeicao(t.motivo)
    return { op_id: op.op_id, ...t }
  }
}

// ───────────────────────── leitura incremental ─────────────────────────
const LIMITE_MUDANCAS = 500

/** Tudo que mudou depois do número `desde` (0 = tudo). O aparelho guarda `cursor` e pergunta de novo a partir dele. */
export async function lerEstado(DB, desde = 0) {
  const { results: mud } = await DB.prepare(
    'SELECT tabela, uid, MAX(seq) AS seq FROM mudancas WHERE seq > ? GROUP BY tabela, uid ORDER BY seq LIMIT ?').bind(desde, LIMITE_MUDANCAS).all()
  const out = { cursor: desde, mais: false, lojas: [], clientes: [], vendas: [], itens: [], pagamentos: [], estornos: [] }
  if (!mud.length) return out
  out.mais = mud.length === LIMITE_MUDANCAS
  // Se houver mais, o cursor para no último item devolvido, sem pular nenhum.
  out.cursor = Math.max(...mud.map(m => m.seq))
  const por = (t) => mud.filter(m => m.tabela === t).map(m => m.uid)
  const buscar = async (tabela, uids, extra = '') => {
    if (!uids.length) return []
    const { results } = await DB.prepare(`SELECT * FROM ${tabela} WHERE uid IN (${uids.map(() => '?').join(',')}) ${extra}`).bind(...uids).all()
    return results
  }
  out.lojas = await buscar('cad_lojas', por('lojas'))
  out.clientes = await buscar('cad_clientes', por('clientes'))
  out.vendas = await buscar('cad_vendas', por('vendas'))
  out.pagamentos = await buscar('cad_pagamentos', por('pagamentos'))
  out.estornos = await buscar('cad_estornos', por('estornos'))
  if (out.vendas.length) {
    const { results } = await DB.prepare(
      `SELECT * FROM cad_venda_itens WHERE venda_uid IN (${out.vendas.map(() => '?').join(',')}) ORDER BY venda_uid, pos`).bind(...out.vendas.map(v => v.uid)).all()
    out.itens = results
  }
  return out
}

// ───────────────────────── conferências (seção 11 do mapeamento) ─────────────────────────
/** Números para comparar com o sistema antigo e para detectar qualquer violação (devem ser todas 0). */
export async function conferenciaCaderneta(DB) {
  const um = async (sql) => (await DB.prepare(sql).first())
  const n = async (sql) => Number((await um(sql))?.n ?? 0)
  const contagens = {}
  for (const [k, t] of [['lojas', 'cad_lojas'], ['clientes', 'cad_clientes'], ['vendas', 'cad_vendas'], ['itens', 'cad_venda_itens'],
    ['pagamentos', 'cad_pagamentos'], ['estornos', 'cad_estornos'], ['operacoes', 'operacoes']]) contagens[k] = await n(`SELECT COUNT(*) AS n FROM ${t}`)

  const saldoAberto = await n(`SELECT COALESCE(SUM(saldo_centavos),0) AS n FROM cad_vendas WHERE cancelada_em IS NULL`)
  const { results: porLoja } = await DB.prepare(
    `SELECT loja_uid, loja_nome, SUM(saldo_centavos) AS saldo_centavos FROM cad_vendas WHERE cancelada_em IS NULL AND saldo_centavos > 0 GROUP BY loja_uid ORDER BY loja_nome`).all()

  const violacoes = {
    pagas_com_saldo: await n(`SELECT COUNT(*) AS n FROM cad_vendas WHERE status='pago' AND saldo_centavos <> 0`),
    abertas_sem_saldo: await n(`SELECT COUNT(*) AS n FROM cad_vendas WHERE status='aberto' AND saldo_centavos = 0`),
    saldo_fora_da_faixa: await n(`SELECT COUNT(*) AS n FROM cad_vendas WHERE saldo_centavos < 0 OR saldo_centavos > total_centavos`),
    saldo_diferente_dos_pagamentos: await n(
      `SELECT COUNT(*) AS n FROM cad_vendas v WHERE v.saldo_centavos <> v.total_centavos - COALESCE((
         SELECT SUM(p.valor_centavos) FROM cad_pagamentos p WHERE p.venda_uid = v.uid
            AND NOT EXISTS (SELECT 1 FROM cad_estornos e WHERE e.pagamento_uid = p.uid)),0)`),
    itens_diferentes_do_bruto: await n(
      `SELECT COUNT(*) AS n FROM cad_vendas v WHERE v.bruto_centavos <> COALESCE((SELECT SUM(subtotal_centavos) FROM cad_venda_itens i WHERE i.venda_uid = v.uid),0)`),
    estorno_sem_pagamento: await n(`SELECT COUNT(*) AS n FROM cad_estornos e WHERE NOT EXISTS (SELECT 1 FROM cad_pagamentos p WHERE p.uid = e.pagamento_uid)`),
  }
  return { contagens, saldo_aberto_centavos: saldoAberto, saldo_aberto_por_loja: porLoja, violacoes, ok: Object.values(violacoes).every(v => v === 0) }
}
