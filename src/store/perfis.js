// Perfis de acesso (Admin, Vendas e perfis extras) — lógica pura, sem estado.
import { normalizar } from '../utils.js'

// IDs 'ym' e 'bete' são fixos de propósito — além de identificar a tela,
// eles também marcam a ORIGEM de registros de produção/financeiro já
// salvos no banco (campo `origem: 'bete'` em vários lugares). Nunca renomear
// ou remover esses dois ids; qualquer perfil novo é sempre "extra".
export const PERFIS_PADRAO = {
  inicial: 'selecao',
  ym: {
    nome: 'Admin',
    descricao: 'Produção, custos, financeiro',
    modulos: ['painel', 'cozinha', 'receitas', 'insumos', 'financeiro', 'producao', 'inteligencia', 'etiquetas', 'cardapio', 'ajustes']
  },
  bete: {
    nome: 'Vendas',
    descricao: 'Fiados, clientes, entregas',
    modulos: ['caderneta']
  },
  // Perfis criados livremente pelo usuário (ex.: Produção, Financeiro).
  // Cada um: { id, nome, descricao, cor, modulos[] }. Reaproveitam a mesma
  // "casca" de tela do Admin, só mudando quais módulos aparecem.
  extras: [
    {
      id: 'producao',
      nome: 'Produção',
      descricao: 'Fila de produção e cozinha',
      cor: '#b45309',
      modulos: ['painel', 'producao', 'cozinha', 'receitas', 'insumos']
    },
    {
      id: 'financeiro',
      nome: 'Financeiro',
      descricao: 'Fluxo de caixa e contas',
      cor: '#15803d',
      modulos: ['painel', 'financeiro']
    }
  ]
}

// Módulos que um perfil (padrão ou extra) pode receber. Mantido em um único
// lugar para validar tanto o que vem salvo quanto o que a tela de Ajustes
// deixa marcar.
export const MODULOS_VALIDOS = [
  'painel', 'cozinha', 'receitas', 'insumos', 'financeiro', 'producao',
  'inteligencia', 'etiquetas', 'cardapio', 'ajustes', 'caderneta'
]

const PALETA_PERFIS_EXTRA = ['#b45309', '#15803d', '#1d4ed8', '#a21caf', '#b91c1c', '#0f766e']

function corParaIndice(i) {
  return PALETA_PERFIS_EXTRA[i % PALETA_PERFIS_EXTRA.length]
}

function slugPerfilExtra(nome, idsExistentes) {
  const base = normalizar(nome || 'perfil')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'perfil'
  let candidato = base
  let n = 2
  while (idsExistentes.includes(candidato) || ['ym', 'bete'].includes(candidato)) {
    candidato = `${base}_${n}`
    n++
  }
  return candidato
}

function normalizarPerfilExtra(valor, idsUsados, indice) {
  if (!valor || typeof valor !== 'object') return null
  const nome = typeof valor.nome === 'string' ? valor.nome.trim().slice(0, 30) : ''
  if (!nome) return null
  const idBruto = typeof valor.id === 'string' ? valor.id.trim() : ''
  const id = idBruto && !idsUsados.includes(idBruto) && !['ym', 'bete'].includes(idBruto)
    ? idBruto
    : slugPerfilExtra(idBruto || nome, idsUsados)
  const descricao = typeof valor.descricao === 'string' ? valor.descricao.trim().slice(0, 80) : ''
  const cor = typeof valor.cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(valor.cor) ? valor.cor : corParaIndice(indice)
  const modulosBrutos = Array.isArray(valor.modulos) ? valor.modulos : []
  const modulos = [...new Set(modulosBrutos.filter(m => MODULOS_VALIDOS.includes(m)))]
  return { id, nome, descricao, cor, modulos: modulos.length ? modulos : ['painel'] }
}

function normalizarPerfis(valor) {
  const base = JSON.parse(JSON.stringify(PERFIS_PADRAO))
  if (!valor || typeof valor !== 'object') return base

  for (const id of ['ym', 'bete']) {
    const nomeSalvo = typeof valor[id]?.nome === 'string' ? valor[id].nome.trim() : ''
    const nomeLegado = id === 'ym' ? 'Yves' : 'Bete'
    if (nomeSalvo && nomeSalvo !== nomeLegado) base[id].nome = nomeSalvo
    if (typeof valor[id]?.descricao === 'string') base[id].descricao = valor[id].descricao.trim()
    if (Array.isArray(valor[id]?.modulos)) {
      const modulos = [...new Set(valor[id].modulos.filter(m => MODULOS_VALIDOS.includes(m)))]
      if (modulos.length) base[id].modulos = modulos
    }
  }

  // Perfis extras: só substitui os padrões se o usuário já salvou algo antes
  // (mesmo que seja uma lista vazia — significa que ele removeu os dois
  // padrões de propósito). Se nunca existiu a chave, mantém os padrões.
  if (Array.isArray(valor.extras)) {
    const idsUsados = []
    base.extras = valor.extras
      .map((e, i) => normalizarPerfilExtra(e, idsUsados, i))
      .filter(Boolean)
      .map(e => { idsUsados.push(e.id); return e })
  }

  const idsValidos = ['selecao', 'ym', 'bete', ...base.extras.map(e => e.id)]
  base.inicial = idsValidos.includes(valor.inicial) ? valor.inicial : 'selecao'

  return base
}

export { normalizarPerfis }
