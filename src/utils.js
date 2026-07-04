const moneyFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Converte qualquer valor para número de forma segura */
export const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/** Arredonda valores monetários para 2 casas decimais */
export const roundMoney = (value) => {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100
}

export const R$ = (v, compact = false) => {
  const n = Number(v || 0)
  if (compact && Math.abs(n) >= 1000) {
    return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'
  }
  return moneyFmt.format(n)
}

export const maskMoney = (v) => {
  return R$(typeof v === 'number' ? v : parseMoney(v))
}

export const parseMoney = (v) => {
  if (!v) return 0
  return Number(String(v).replace(/\D/g, "")) / 100
}


/** Parse de input monetário para o usuário digitar naturalmente (ex: "2,50" → 2.50).
 *  Diferente de parseMoney (modo bancário centavos), aqui vírgula = separador decimal. */

export const dataHoraBR = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

export const fmtQtd = (v, u = '') => {
  const n = Number(v || 0)
  const fmt = n.toLocaleString('pt-BR', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })
  return fmt + (u ? ' ' + u : '')
}

export const formatarData = (dataIso) => {
  if (!dataIso) return ''
  const [ano, mes, dia] = dataIso.split('-')
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataIso
}

/** Converte data BR (DD/MM/YYYY) para ISO (YYYY-MM-DD) */
export const parseDataBr = (valor) => {
  const texto = String(valor || '').trim()
  // Se já for ISO, retorna como está
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return texto
  
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return ''
  const [, dia, mes, ano] = match
  return `${ano}-${mes}-${dia}`
}

export const labelNatureza = (n) => {
  return { entrada: '↑ Receita', operacional: '↓ Operacional', pessoal: '↓ Pessoal', interna: '⇄ Interna' }[n] || n
}

/** Converte valores monetários BR (R$ 1.234,56 ou -1.234,56) para Number */
export const parseValorBr = (valor) => {
  if (typeof valor === 'number') return valor
  const texto = String(valor || '').trim()
  if (!texto) return 0
  const negativo = texto.includes('-')
  const limpo = texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const numero = Number(limpo.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(numero)) return 0
  return negativo ? -Math.abs(numero) : numero
}

/** Detecta delimitador de CSV (ponto-e-vírgula, vírgula ou tab) */
export const detectarDelimitadorCsv = (texto) => {
  const primeiraLinha = String(texto || '').split(/\r?\n/).find(Boolean) || ''
  const candidatos = [';', ',', '\t']
  let melhor = ';', maiorScore = -1
  for (const d of candidatos) {
    const score = primeiraLinha.split(d).length
    if (score > maiorScore) { maiorScore = score; melhor = d }
  }
  return melhor
}

/** Divide linha de CSV respeitando campos entre aspas */
export const dividirLinhaCsv = (linha, delimitador) => {
  const colunas = []
  let atual = '', emAspas = false
  for (let i = 0; i < linha.length; i++) {
    const char = linha[i], prox = linha[i + 1]
    if (char === '"') {
      if (emAspas && prox === '"') { atual += '"'; i++ }
      else emAspas = !emAspas
      continue
    }
    if (char === delimitador && !emAspas) { colunas.push(atual); atual = '' }
    else atual += char
  }
  colunas.push(atual)
  return colunas.map(item => item.trim())
}

/** Lê um arquivo e retorna seu texto, tratando codificação UTF-8 e ISO-8859-1 */
export const lerArquivoComoTexto = async (arquivo) => {
  const buffer = await arquivo.arrayBuffer()
  let texto = new TextDecoder('utf-8').decode(buffer)
  // Se contiver o caractere de substituição (), tenta ler como ISO-8859-1
  if (texto.includes('\uFFFD')) {
    texto = new TextDecoder('iso-8859-1').decode(buffer)
  }
  return texto
}

/** Processa o conteúdo de um arquivo CSV e retorna array de objetos */
export const processarCsv = (texto) => {
  const delimitador = detectarDelimitadorCsv(texto)
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (linhas.length < 2) return []
  const cabecalhos = dividirLinhaCsv(linhas[0], delimitador)
  return linhas.slice(1).map(linha => {
    const valores = dividirLinhaCsv(linha, delimitador)
    return cabecalhos.reduce((acc, chave, idx) => {
      acc[chave] = valores[idx] ?? ''
      return acc
    }, {})
  })
}
export const normalizar = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function getMesRef(dataIso) {
  const [ano, mes] = String(dataIso || '').split('-')
  return ano && mes ? `${mes}/${ano}` : ''
}

/** Aliases comuns para colunas de extratos bancários */
export const COLUNAS_ALIASES = {
  data: ['data', 'datadatransacao', 'datadolancamento', 'datadomovimento', 'datahora', 'lancamento'],
  tipo: ['tipo', 'tipodatransacao', 'tipodolancamento', 'natureza', 'tipolancamento'],
  descricao: ['descricao', 'descricaodatransacao', 'descricaodolancamento', 'historico', 'detalhes', 'titulo', 'transacao'],
  valor: ['valor', 'valorliquido', 'valorbruto', 'valortransacao', 'valordatransacao', 'montante', 'quantia'],
  // Específicos para BB
  lancamento: ['lancamento'],
  detalhes: ['detalhes']
}

/** Detecta automaticamente as chaves do objeto baseado em aliases */
export const detectarColunasExtrato = (primeiraLinha) => {
  const mapa = {}
  const normalizarChave = (v) => normalizar(v).replace(/[^a-z0-9]/g, '')
  
  for (const chaveOriginal of Object.keys(primeiraLinha || {})) {
    mapa[normalizarChave(chaveOriginal)] = chaveOriginal
  }

  const resultado = {}
  for (const [campo, aliases] of Object.entries(COLUNAS_ALIASES)) {
    const encontrado = aliases.find(alias => mapa[alias])
    if (encontrado) {
      resultado[campo] = mapa[encontrado]
    }
  }
  
  return resultado
}

/** Máscara para CPF: 000.000.000-00 */
export const maskCpf = (v) => {
  v = String(v || '').replace(/\D/g, '')
  if (v.length > 11) v = v.slice(0, 11)
  return v.replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/** Máscara para CNPJ: 00.000.000/0000-00 */
export const maskCnpj = (v) => {
  v = String(v || '').replace(/\D/g, '')
  if (v.length > 14) v = v.slice(0, 14)
  return v.replace(/^(\d{2})(\d)/, '$1.$2')
          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d)/, '.$1/$2')
          .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Máscara para CNAE: 0000-0/00 */
export const maskCnae = (v) => {
  v = String(v || '').replace(/\D/g, '')
  if (v.length > 7) v = v.slice(0, 7)
  return v.replace(/(\d{4})(\d)/, '$1-$2')
          .replace(/(\d{4})-(\d)(\d{1,2})$/, '$1-$2/$3')
}

export const isInsumoSemPeso = (nome) => {
  const chave = normalizar(nome)
  return ['etiqueta', 'embalagem', 'rotulo', 'rótulo', 'fita', 'laco', 'laço', 'caixa', 'sacola'].some(term => chave.includes(term))
}
/** @alias isInsumoSemPeso — mesmo critério, nome usado em contexto de pesagem/cozinha */
export const isInsumoOculto = isInsumoSemPeso

/**
 * Decide se um produto é embalagem (não deve contar no peso/pesagem).
 * Prioriza o campo `tipo` cadastrado no produto (fonte confiável);
 * só recorre à busca por palavra-chave no nome quando o produto não tem
 * `tipo` definido (dado legado), para evitar falsos positivos como
 * "Leite Condensado Caixa" (ingrediente, mas o nome contém "caixa").
 */
export const isProdutoEmbalagem = (produto) => {
  if (!produto) return false
  if (produto.tipo === 'embalagem') return true
  if (produto.tipo === 'insumo') return false
  return isInsumoSemPeso(produto.nome)
}

// Data ISO para datetime-local input
export const getNowLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const CORES = ['#7a4a1e','#0f766e','#1d4ed8','#7c3aed','#c45a09','#1a7a45','#b91c1c']
export const avatarColor = (nome) => {
  let h = 0; for (const c of String(nome || '')) h = (h * 31 + c.charCodeAt(0)) & 0xff
  return CORES[h % CORES.length]
}
/** Remove sufixos técnicos do nome de uma receita (ex: "Trufa Ninho - Base" -> "Trufa Ninho") */
export function limparNomeReceita(n) {
  return String(n || '')
    .replace(/\s*[-–]\s*(base|final|intermediária|intermediaria)\s*$/i, '')
    .replace(/\s*\(.*?\)\s*$/i, '')
    .trim()
}

/** Remove o prefixo de categoria do nome (ex: "Trufa Tradicional" + categoria "Trufa" -> "Tradicional") */
export function limparApenasSabor(nome, categoria = '') {
  const nomeLimpo = limparNomeReceita(nome)
  const prefixos = [categoria, 'Trufa', 'Cone', 'Barra', 'Brownie', 'Bolo', 'Ovo']
    .filter(Boolean)
    .map(item => String(item).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (!prefixos.length) return nomeLimpo

  return nomeLimpo.replace(new RegExp(`^\\s*(?:${prefixos.join('|')})\\s+`, 'i'), '').trim() || nomeLimpo
}

/** Texto a usar numa etiqueta: usa o campo nome_etiqueta se preenchido, senão extrai só o sabor do nome completo */
export function textoEtiquetaReceita(receita) {
  if (!receita) return ''
  return receita.nome_etiqueta?.trim() || limparApenasSabor(receita.nome, receita.categoria)
}
