// modules/etiquetasProducao.js
// Etiquetas de CONTROLE DA PRODUÇÃO (não são as etiquetas de venda):
//   • TRUFA  → 1 etiqueta por FORMA, só com o sabor centralizado.
//              (forma de 8 cavidades se a trufa pesa 30 g ou mais; de 12 se pesa menos — mesma regra da Cozinha)
//   • demais (barrinha, cone, brownie…) → 1 etiqueta por receita, com o sabor em cima e a
//              quantidade a produzir embaixo (ex.: "Crocante" / "3 un").
// Função PURA: recebe os itens da produção e as receitas, devolve as etiquetas. Não lê banco nem tela.

import { normalizar, textoEtiquetaReceita, limparApenasSabor, fmtQtd } from '../utils.js'

// Mesma regra de TabCozinha.vue (ehTrufa / getPassoProducao). Se mudar lá, mude aqui.
const CATEGORIAS_PROPRIAS = ['cone', 'barra', 'brownie', 'bolo', 'ovo', 'pascoa', 'base', 'presentes']

export function ehTrufa(r) {
  if (!r) return false
  const cat = normalizar(r.categoria)
  if (cat.includes('trufa')) return true
  if (CATEGORIAS_PROPRIAS.some(c => cat.includes(c))) return false
  return normalizar(r.nome).includes('trufa')
}

/** Quantas trufas cabem numa forma. */
export function trufasPorForma(r) {
  const peso = Number(r?.peso_unitario || 0)
  if (peso >= 30) return 8
  if (peso > 0) return 12
  return Number(r?.rendimento || 1) || 1
}

const qtdDoItem = (p) => Number(p?.quantidade_produzida || p?.quantidade || 0)

/**
 * @param itens    linhas de produção (db.producoes / grupo.itens)
 * @param receitas todas as receitas (para achar categoria, peso e nome da etiqueta)
 * @returns {{ etiquetas: Array<{sabor:string, contato:string, destaque:boolean}>, linhas: Array<{sabor:string, tipo:'forma'|'unidade', qtd:number, etiquetas:number, rotuloQtd:string}> }}
 *   `etiquetas` = uma entrada por etiqueta a imprimir (já repetidas); `linhas` = resumo para mostrar ao usuário.
 */
export function montarEtiquetasProducao(itens = [], receitas = []) {
  const porUuid = new Map((receitas || []).map(r => [r.uuid, r]))
  const grupos = new Map() // `${tipo}|${sabor}|${unidade}` → linha de resumo

  for (const p of itens || []) {
    const r = porUuid.get(p.receita_id)
    if (p.eh_intermediaria || r?.eh_intermediaria) continue // massa/ganache/recheio não levam etiqueta
    const qtd = qtdDoItem(p)
    if (!(qtd > 0)) continue
    const sabor = r ? textoEtiquetaReceita(r) : limparApenasSabor(p.nome_receita || p.receita_nome)
    if (!sabor) continue

    if (ehTrufa(r)) {
      const formas = Math.ceil(qtd / Math.max(1, trufasPorForma(r)) - 1e-9)
      const chave = `forma|${sabor}`
      const g = grupos.get(chave) || { sabor, tipo: 'forma', qtd: 0, etiquetas: 0, unidade: '' }
      g.qtd += formas
      g.etiquetas += formas
      grupos.set(chave, g)
    } else {
      const unidade = String(p.unidade_rendimento || r?.unidade_rendimento || 'un').trim() || 'un'
      const chave = `unidade|${sabor}|${normalizar(unidade)}`
      const g = grupos.get(chave) || { sabor, tipo: 'unidade', qtd: 0, etiquetas: 0, unidade }
      g.qtd += qtd
      g.etiquetas = 1
      grupos.set(chave, g)
    }
  }

  const linhas = []
  const etiquetas = []
  for (const g of grupos.values()) {
    const rotuloQtd = g.tipo === 'forma' ? `${g.qtd} forma${g.qtd > 1 ? 's' : ''}` : fmtQtd(g.qtd, g.unidade)
    linhas.push({ sabor: g.sabor, tipo: g.tipo, qtd: g.qtd, etiquetas: g.etiquetas, rotuloQtd })
    for (let i = 0; i < g.etiquetas; i++) {
      etiquetas.push(g.tipo === 'forma'
        ? { sabor: g.sabor, contato: '', destaque: false }                     // só o sabor, centralizado
        : { sabor: g.sabor, contato: fmtQtd(g.qtd, g.unidade), destaque: true }) // sabor + quantidade embaixo
    }
  }
  return { etiquetas, linhas }
}
