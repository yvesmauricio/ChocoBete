// ─────────────────────────────────────────────────────────────────────────
// Análise de um extrato ANTES de gravar qualquer coisa (módulo puro: sem
// banco, rede ou relógio — a data de hoje entra como parâmetro).
//
// Responde: "este arquivo é mesmo do banco/conta que a pessoa escolheu, está
// íntegro e faz sentido?". O resultado alimenta a tela de conferência:
//
//   bloqueios → a importação NÃO pode seguir (arquivo de outro banco, já
//               importado, sem lançamentos, conta errada…);
//   avisos    → pode seguir, mas a pessoa precisa ver (período enorme, valor
//               muito alto, primeira importação desta conta…);
//   reforcada → faltou prova de que o arquivo é do banco esperado; a pessoa
//               precisa marcar uma confirmação extra.
//
// Limite honesto: reconhecer o banco pelo CONTEÚDO só é possível até onde o
// arquivo traz sinais (cabeçalhos do CSV, nome do banco no topo do PDF). Por
// isso há três camadas: sinal do arquivo → conta cadastrada (identificador
// opcional) → conferência visual obrigatória.
// ─────────────────────────────────────────────────────────────────────────

import { detectarColunasExtrato } from '../utils.js'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const chaveColuna = (s) => norm(s).replace(/[^a-z0-9]/g, '')

/** Bancos que o app sabe ler, e sinais de que um arquivo é de cada banco. */
export const BANCOS_LEITORES = {
  pagbank: { rotulo: 'PagBank', formato: 'csv' },
  itau: { rotulo: 'Itaú', formato: 'pdf' },
  bb: { rotulo: 'Banco do Brasil', formato: 'csv' }
}

/** Nomes que aparecem no TOPO de extratos. Servem para flagrar arquivo de outro banco. */
const SINAIS_DE_BANCO = {
  bb: ['banco do brasil', 'bancodobrasil'],
  itau: ['itau'],
  pagbank: ['pagbank', 'pagseguro'],
  nubank: ['nubank', 'nu pagamentos'],
  inter: ['banco inter'],
  caixa: ['caixa economica'],
  santander: ['santander'],
  bradesco: ['bradesco'],
  c6: ['c6 bank'],
  mercadopago: ['mercado pago', 'mercadopago'],
  sicoob: ['sicoob'],
  sicredi: ['sicredi'],
  picpay: ['picpay']
}
const ROTULO_OUTROS = {
  nubank: 'Nubank', inter: 'Inter', caixa: 'Caixa', santander: 'Santander', bradesco: 'Bradesco',
  c6: 'C6 Bank', mercadopago: 'Mercado Pago', sicoob: 'Sicoob', sicredi: 'Sicredi', picpay: 'PicPay'
}
const rotuloDoBanco = (b) => BANCOS_LEITORES[b]?.rotulo || ROTULO_OUTROS[b] || b

/** Só o topo do arquivo conta como "cabeçalho": o nome de outro banco numa
 *  descrição de PIX ("PIX ENVIADO BANCO INTER") não pode condenar o arquivo. */
const TOPO_PDF = 1500
function bancosNoTopo(texto, formato) {
  const topo = norm(String(texto ?? '').slice(0, formato === 'pdf' ? TOPO_PDF : 400))
  return Object.entries(SINAIS_DE_BANCO).filter(([, sinais]) => sinais.some(s => topo.includes(s))).map(([b]) => b)
}

const dentroDe = (iso) => /^\d{4}-\d{2}-\d{2}/.test(String(iso || ''))
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

export function resumirLancamentos(lancamentos = []) {
  const validos = lancamentos.filter(l => dentroDe(l.data) && Number.isFinite(Number(l.valor)))
  const datas = validos.map(l => String(l.data).slice(0, 10)).sort()
  let entradas = 0, saidas = 0, maior = 0
  for (const l of validos) {
    const v = Number(l.valor)
    if (v >= 0) entradas += v; else saidas += -v
    maior = Math.max(maior, Math.abs(v))
  }
  const r2 = (n) => Math.round(n * 100) / 100
  return {
    qtd: validos.length,
    ini: datas[0] || '', fim: datas[datas.length - 1] || '',
    entradas: r2(entradas), saidas: r2(saidas), maior: r2(maior),
    qtdEntradas: validos.filter(l => Number(l.valor) >= 0).length,
    qtdSaidas: validos.filter(l => Number(l.valor) < 0).length
  }
}

/** Assinatura do formato do arquivo: para comparar com as importações anteriores da mesma conta. */
export function assinaturaDoArquivo({ formato, colunas = [], texto = '', banco }) {
  if (formato === 'csv') return 'csv:' + colunas.map(chaveColuna).filter(Boolean).join('|')
  const doTopo = bancosNoTopo(texto, 'pdf')
  return 'pdf:' + (doTopo.includes(banco) ? banco : (doTopo[0] || 'sem-nome'))
}

/**
 * @param p.banco        'pagbank' | 'itau' | 'bb' (o importador escolhido)
 * @param p.formato      'csv' | 'pdf'
 * @param p.colunas      cabeçalhos do CSV, como vieram
 * @param p.texto        texto bruto do arquivo (CSV inteiro / texto do PDF)
 * @param p.lancamentos  lançamentos já extraídos pelo leitor
 * @param p.conta        conta de destino ({ id, nome, banco, identificador_extrato })
 * @param p.hashArquivo  SHA-256 do arquivo
 * @param p.importacoes  histórico de importações (para detectar arquivo repetido)
 * @param p.assinaturaConta  assinatura aprendida nesta conta (ou null)
 * @param p.hoje         Date (injetado)
 */
export function analisarExtrato(p) {
  const { banco, formato, colunas = [], texto = '', lancamentos = [], conta = null, hashArquivo = '', importacoes = [], assinaturaConta = null } = p
  const hoje = p.hoje instanceof Date ? p.hoje : new Date()
  const hojeIso = hoje.toISOString().slice(0, 10)
  const rotulo = rotuloDoBanco(banco)
  const bloqueios = [], avisos = []
  let reforcada = false
  const bloquear = (codigo, msg) => bloqueios.push({ codigo, msg })
  const avisar = (codigo, msg) => avisos.push({ codigo, msg })

  const resumo = resumirLancamentos(lancamentos)
  const assinatura = assinaturaDoArquivo({ formato, colunas, texto, banco })

  // 0) a conta de destino tem que existir e ser do banco do importador
  if (!conta) bloquear('sem_conta', 'Escolha a conta de destino.')
  else if (conta.banco !== banco) bloquear('conta_de_outro_banco', `A conta “${conta.nome}” não é do ${rotulo}.`)

  // 1) o formato do arquivo é o do banco escolhido?
  if (formato === 'csv') {
    const cabecalho = new Set(colunas.map(chaveColuna))
    const temBb = cabecalho.has('lancamento') && cabecalho.has('detalhes')
    if (banco === 'bb' && !temBb) {
      bloquear('formato_incompativel', 'Este CSV não tem o formato do extrato do Banco do Brasil (faltam as colunas “Lançamento” e “Detalhes”). Parece ser de outro banco.')
    }
    if (banco === 'pagbank') {
      if (temBb) bloquear('formato_incompativel', 'Este CSV tem o formato do Banco do Brasil, não do PagBank. Use a importação do Banco do Brasil.')
      // mesmas colunas (e apelidos) que o leitor do PagBank já exigia
      const achadas = detectarColunasExtrato(Object.fromEntries(colunas.map(c => [c, ''])))
      for (const [campo, nome] of [['data', 'Data'], ['tipo', 'Tipo'], ['descricao', 'Descrição'], ['valor', 'Valor']]) {
        if (!achadas[campo]) bloquear('formato_incompativel', `Não encontrei a coluna “${nome}” esperada no CSV do PagBank.`)
      }
    }
  }
  // sinais de OUTRO banco no topo do arquivo (e nenhum do esperado)
  const noTopo = bancosNoTopo(texto, formato)
  const outros = noTopo.filter(b => b !== banco)
  if (outros.length && !noTopo.includes(banco)) {
    bloquear('outro_banco', `O topo do arquivo indica ${rotuloDoBanco(outros[0])}, mas você escolheu ${rotulo}. Este extrato não é de uma conta cadastrada para esta importação.`)
  } else if (formato === 'pdf' && !noTopo.includes(banco) && !outros.length) {
    reforcada = true
    avisar('sem_identificacao', `Não encontrei o nome “${rotulo}” no início do PDF, então não consigo confirmar que é um extrato do ${rotulo}.`)
  }

  // 2) a conta é a certa? (identificador opcional cadastrado na conta)
  const ident = String(conta?.identificador_extrato || '').trim()
  if (ident) {
    const alvo = norm(texto).replace(/[^a-z0-9]/g, '')
    if (!alvo.includes(norm(ident).replace(/[^a-z0-9]/g, ''))) {
      bloquear('conta_diferente', `Não achei “${ident}” neste arquivo. Ele não parece ser da conta “${conta.nome}”. (Se os extratos desta conta não trazem esse número, apague o identificador em Ajustes → Contas.)`)
    }
  }

  // 3) já importado antes?
  const repetido = hashArquivo && importacoes.find(i => i.hash_arquivo === hashArquivo && !i.desfeito_em)
  if (repetido) {
    bloquear('arquivo_repetido', `Este mesmo arquivo já foi importado em ${String(repetido.quando).slice(0, 10).split('-').reverse().join('/')}. Para importar de novo, desfaça aquela importação no histórico.`)
  }

  // 4) o conteúdo faz sentido?
  if (!resumo.qtd) {
    bloquear('sem_lancamentos', 'Não encontrei nenhum lançamento válido neste arquivo.')
  } else {
    const futuros = lancamentos.filter(l => dentroDe(l.data) && String(l.data).slice(0, 10) > hojeIso).length
    if (futuros && futuros / resumo.qtd > 0.3) bloquear('datas_futuras', `${futuros} de ${resumo.qtd} lançamentos têm data no futuro. Um extrato não tem isso — o arquivo provavelmente não é um extrato.`)
    else if (futuros) avisar('datas_futuras', `${futuros} lançamento(s) com data futura.`)

    if (diasEntre(resumo.ini, resumo.fim) > 400) avisar('periodo_longo', `O arquivo cobre ${diasEntre(resumo.ini, resumo.fim)} dias (de ${resumo.ini.split('-').reverse().join('/')} a ${resumo.fim.split('-').reverse().join('/')}).`)
    if (diasEntre(resumo.ini, hojeIso) > 1095) avisar('datas_antigas', 'Há lançamentos com mais de 3 anos.')
    if (resumo.qtd > 1500) avisar('muitos_lancamentos', `${resumo.qtd} lançamentos num único arquivo é bem mais que o normal.`)
    if (resumo.maior >= 100000) avisar('valor_alto', `Há um lançamento de R$ ${resumo.maior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`)
    if (resumo.qtd >= 6 && (!resumo.qtdEntradas || !resumo.qtdSaidas)) avisar('so_um_sentido', resumo.qtdEntradas ? 'Só há entradas, nenhuma saída.' : 'Só há saídas, nenhuma entrada.')
  }

  // 5) mesmo formato das importações anteriores desta conta?
  if (assinaturaConta && assinaturaConta !== assinatura) {
    reforcada = true
    avisar('formato_mudou', 'O formato deste arquivo é diferente dos extratos anteriores desta conta.')
  } else if (!assinaturaConta && conta) {
    avisar('primeira_importacao', 'Primeira importação para esta conta: confira a prévia com atenção.')
  }

  const nivel = bloqueios.length ? 'bloqueado' : (avisos.length ? 'atencao' : 'ok')
  return { nivel, bloqueios, avisos, reforcada: reforcada && !bloqueios.length, resumo, assinatura, rotulo }
}
