// composables/useCaderneta.js
// Lógica da Caderneta (fiados) integrada ao banco Dexie do Receitas
// Usa as tabelas cad_lojas, cad_clientes, cad_fiados do mesmo banco.

import { db } from '../db.js'

// ── Helpers ──────────────────────────────────────────────────
export const hoje = () => new Date().toLocaleDateString('sv')
export const horaAtual = () => new Date().toTimeString().slice(0, 5)

export function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function fmtBR(raw) {
  if (!raw) return '--/--'
  const b = String(raw).split('T')[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(b) ? b.split('-').reverse().join('/') : '--/--'
}
export function fmtHora(raw) {
  return /^\d{2}:\d{2}/.test(String(raw || '')) ? String(raw).slice(0, 5) : ''
}
export function iniciais(nome) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
export function normalizar(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── LOJAS ────────────────────────────────────────────────────
export async function getLojas() {
  return db.cad_lojas.orderBy('nome').toArray()
}
export async function salvarLoja(obj) {
  return db.cad_lojas.put(obj)
}
export async function excluirLoja(id) {
  // Cascata: remove clientes e fiados
  const clientes = await db.cad_clientes.where('lojaId').equals(id).toArray()
  for (const c of clientes) {
    await db.cad_fiados.where('clienteId').equals(c.id).delete()
    await db.cad_clientes.delete(c.id)
  }
  await db.cad_lojas.delete(id)
}

// ── CLIENTES ─────────────────────────────────────────────────
export async function getClientes(lojaId) {
  return db.cad_clientes.where('lojaId').equals(lojaId).sortBy('nome')
}
export async function getTodosClientes() {
  return db.cad_clientes.toArray()
}
export async function salvarCliente(obj) {
  return db.cad_clientes.put(obj)
}
export async function excluirCliente(id) {
  await db.cad_fiados.where('clienteId').equals(id).delete()
  await db.cad_clientes.delete(id)
}

// ── FIADOS ───────────────────────────────────────────────────

// Carrega TODOS os fiados (histórico completo) — use apenas em modo histórico
export async function getFiados() {
  return db.cad_fiados.toArray()
}

// Carrega apenas fiados abertos usando índice — rápido independente do volume total
export async function getFiadosAbertos() {
  return db.cad_fiados.where('status').equals('aberto').toArray()
}

// Alertas do dia: usa índice dataVenc — não carrega tabela inteira
export async function getFiadosVencendoHoje() {
  const hj = hoje()
  return db.cad_fiados
    .where('dataVenc').equals(hj)
    .filter(f => f.saldo > 0.01)
    .toArray()
}

export async function salvarFiado(obj) {
  return db.cad_fiados.put(obj)
}
export async function atualizarFiado(id, changes) {
  const atual = await db.cad_fiados.get(id)
  if (!atual) return
  await db.cad_fiados.put({ ...atual, ...changes })
}
export async function excluirFiado(id) {
  return db.cad_fiados.delete(id)
}

// ── RESUMO / STATS ───────────────────────────────────────────
// Usa getFiadosAbertos() — consulta por índice, não full scan
export async function getStats() {
  const abertos = await getFiadosAbertos()
  const hj = hoje()
  return {
    totalAberto:  abertos.reduce((s, f) => s + f.saldo, 0),
    totalVencido: abertos
      .filter(f => f.dataVenc && f.dataVenc < hj)
      .reduce((s, f) => s + f.saldo, 0),
    qtdAbertos: abertos.length,
  }
}

// ── PAGAMENTO ────────────────────────────────────────────────
export function dadosPagamento(valor, saldoAntes, saldoDepois) {
  return {
    valor,
    data: hoje(),
    hora: horaAtual(),
    saldoAntes,
    saldoDepois,
    criadoEm: new Date().toISOString()
  }
}
export function aplicarPagamento(fiado, pago) {
  const novoSaldo = Math.max(0, fiado.saldo - pago)
  const pagamentos = [...(fiado.pagamentos || []), dadosPagamento(pago, fiado.saldo, novoSaldo)]
  const quitado = novoSaldo <= 0.01
  return {
    saldo: novoSaldo,
    status: quitado ? 'pago' : 'aberto',
    pagamentos,
    pagoEm: quitado ? new Date().toISOString() : (fiado.pagoEm || null)
  }
}

// ── PRODUTOS (config caderneta) ──────────────────────────────
const CHAVE_PRODUTOS = 'cad_produtos'
const CHAVE_TAXAS   = 'cad_taxas'

const PRODUTOS_DEFAULT = [
  { id: 'trufa',    nome: 'Trufa',      emoji: '🍫', preco: 6  },
  { id: 'cone',     nome: 'Cone',       emoji: '🍦', preco: 8  },
  { id: 'bolo',     nome: 'Bolo/Torta', emoji: '🎂', preco: 15 },
  { id: 'barrinha', nome: 'Barrinha',   emoji: '🍫', preco: 7  },
]

export async function getProdutosCaderneta() {
  const row = await db.config.get(CHAVE_PRODUTOS).catch(() => null)
  if (row?.valor?.length) {
    const salvos = row.valor
    const merge = salvos.map(ps => {
      const def = PRODUTOS_DEFAULT.find(d => d.id === ps.id)
      return { emoji: '📦', ...def, ...ps }
    })
    const idsExistentes = new Set(merge.map(p => p.id))
    const novos = PRODUTOS_DEFAULT.filter(def => !idsExistentes.has(def.id))
    return [...merge, ...novos]
  }
  return PRODUTOS_DEFAULT.map(p => ({ ...p }))
}

export async function salvarProdutosCaderneta(lista) {
  await db.config.put({ chave: CHAVE_PRODUTOS, valor: lista })
  return lista
}

export async function getTaxas() {
  const row = await db.config.get(CHAVE_TAXAS).catch(() => null)
  return row?.valor || { debito: 2.98, credito_avista: 6.17 }
}

export async function salvarTaxas(t) {
  await db.config.put({ chave: CHAVE_TAXAS, valor: t })
}

// ── RESUMO ITENS ─────────────────────────────────────────────
export function resumoItens(itens) {
  if (!itens?.length) return ''
  return itens.map(i => {
    const emoji = i.emoji || '📦'
    return `${emoji} ${i.qtd || i.qty || 0}x ${i.nome}`
  }).join(' · ')
}