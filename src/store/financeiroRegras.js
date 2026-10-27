// Regras financeiras: contas, categorias MEI, classificação e normalização de lançamentos.
// Factory: recebe os refs compartilhados do store e devolve funções/refs prontos.
import { ref } from 'vue'
import { configSet } from '../db.js'
import { normalizar, getMesRef } from '../utils.js'

export function criarRegrasFinanceiras({ contasFinanceiras }) {
  const normalizarTextoFinanceiro = (texto) =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

  const normalizarTextoDuplicidadeFinanceiro = (texto) =>
    normalizarTextoFinanceiro(texto)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  function gerarContaId() {
    return `conta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function normalizarContaFinanceira(conta = {}) {
    return {
      id: conta.id || gerarContaId(),
      nome: String(conta.nome || '').trim(),
      banco: normalizarTextoFinanceiro(conta.banco || ''),
      titular: String(conta.titular || '').trim(),
      natureza: conta.natureza === 'empresarial' ? 'empresarial' : 'pessoal',
      papel: String(conta.papel || '').trim()
    }
  }

  function getContaFinanceiraById(id) {
    return contasFinanceiras.value.find(conta => conta.id === id) || null
  }

  function getContasFinanceirasPorBanco(banco) {
    const bancoNorm = normalizarTextoFinanceiro(banco || '')
    return contasFinanceiras.value.filter(conta => conta.banco === bancoNorm)
  }

  function resolverContaFinanceira(dados = {}) {
    if (dados.conta_id) {
      const conta = getContaFinanceiraById(dados.conta_id)
      if (conta) return conta
    }

    const contasMesmoBanco = getContasFinanceirasPorBanco(dados.banco || '')
    if (contasMesmoBanco.length === 1) return contasMesmoBanco[0]
    return null
  }

  function normalizarTipoFinanceiro(tipo) {
    return normalizarTextoFinanceiro(tipo)
  }

  // ─────────────────────────────────────────────────────────────
  // CATEGORIAS MEI — padrão contábil simplificado
  // natureza: 'entrada' | 'operacional' | 'pessoal' | 'interna'
  // ─────────────────────────────────────────────────────────────
  //
  // Conta PJ → PagBank   (banco: 'pagbank')
  // Conta PF → Itaú / BB (banco: 'itau' | 'bb')
  // REGRA: TODO pix recebido = Receita de Vendas (empresa),
  //        mesmo vindo do Itaú (período de migração PF→PJ).
  //
  // Transferências entre contas PRÓPRIAS (Itaú→PagBank ou PagBank→Itaú):
  //   natureza 'interna' → excluída dos totais de receita e despesa.

  // Lista PADRÃO de fábrica. Os nomes aqui são EXATAMENTE os mesmos usados
  // em classificarLancamentoFinanceiro() (a lógica de importação) — assim,
  // um lançamento importado sempre aparece com a categoria certa já marcada
  // ao abrir "Editar Lançamento". Se você mudar algo aqui, mude também lá.
  const CATEGORIAS_MEI_PADRAO = [
    // ── RECEITAS ──────────────────────────────────────────────
    { nome: 'Receita de Vendas',      natureza: 'entrada',      grupo: 'Receitas', icon: 'fa-arrow-trend-up' },
    { nome: 'Rendimento Financeiro',  natureza: 'entrada',      grupo: 'Receitas', icon: 'fa-piggy-bank' },
    { nome: 'Outras Receitas',        natureza: 'entrada',      grupo: 'Receitas', icon: 'fa-plus-circle' },

    // ── CUSTOS DO NEGÓCIO ─────────────────────────────────────
    { nome: 'Insumos e Matéria-Prima', natureza: 'operacional', grupo: 'Negócio', icon: 'fa-cookie' },
    { nome: 'Embalagens e Materiais',  natureza: 'operacional', grupo: 'Negócio', icon: 'fa-box' },
    { nome: 'Transporte e Entrega',    natureza: 'operacional', grupo: 'Negócio', icon: 'fa-car' },
    { nome: 'Impostos e Contribuições',natureza: 'operacional', grupo: 'Negócio', icon: 'fa-file-invoice-dollar' },
    { nome: 'Tarifas Bancárias',       natureza: 'operacional', grupo: 'Negócio', icon: 'fa-building-columns' },
    { nome: 'Manutenção e Reparos',    natureza: 'operacional', grupo: 'Negócio', icon: 'fa-screwdriver-wrench' },
    { nome: 'Serviços e Assinaturas',  natureza: 'operacional', grupo: 'Negócio', icon: 'fa-rectangle-list' },
    { nome: 'Outras Despesas',         natureza: 'operacional', grupo: 'Negócio', icon: 'fa-receipt' },

    // ── PESSOAL ───────────────────────────────────────────────
    { nome: 'Renda Pessoal',           natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-hand-holding-dollar' },
    { nome: 'Pró-labore / Retirada',   natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-user-tie' },
    { nome: 'Moradia',                 natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-house' },
    { nome: 'Condomínio',              natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-building' },
    { nome: 'Energia Elétrica',        natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-bolt' },
    { nome: 'Gás',                     natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-fire' },
    { nome: 'Internet e Telefonia',    natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-wifi' },
    { nome: 'Alimentação Pessoal',     natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-utensils' },
    { nome: 'Saúde e Bem-Estar',       natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-heart-pulse' },
    { nome: 'Vestuário e Compras',     natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-shirt' },
    { nome: 'Compras no Débito',       natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-credit-card' },
    { nome: 'Lazer e Outros Pessoais', natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-mask' },

    // ── ESPECIAL ──────────────────────────────────────────────
    { nome: 'Transferência Interna', natureza: 'interna', grupo: 'Especial', icon: 'fa-arrow-right-arrow-left' },
  ];

  // Lista efetiva (padrão + personalizações salvas pelo usuário em Configurações)
  const categoriasFinanceiro = ref(CATEGORIAS_MEI_PADRAO.map(c => ({ ...c })))

  // Regras aprendidas: quando o usuário reclassifica manualmente um lançamento,
  // guardamos "descrição normalizada → categoria" para aplicar automaticamente
  // em futuras importações com a mesma descrição (evita reconfigurar sempre).
  const regrasCategoriaFinanceiro = ref({})

  function aprenderRegraCategoria(descricao, categoriaNome) {
    const chave = normalizar(descricao || '')
    if (!chave || !categoriaNome) return
    if (regrasCategoriaFinanceiro.value[chave] === categoriaNome) return
    regrasCategoriaFinanceiro.value = { ...regrasCategoriaFinanceiro.value, [chave]: categoriaNome }
    configSet('regras_categoria_financeiro', regrasCategoriaFinanceiro.value)
  }

  /**
   * Corrige as regras de categoria já aprendidas quando uma categoria é
   * renomeada, excluída ou quando a lista é restaurada ao padrão. Sem isso,
   * uma regra continua apontando pro nome antigo — que não existe mais na
   * lista — e o lançamento acaba classificado com outro nome na próxima
   * importação (a regra aprendida "silenciosamente" para de bater).
   *   substituicoes: { 'Nome Antigo': 'Nome Novo' | null }  (null remove a regra)
   */
  function remapearRegrasCategoria(substituicoes) {
    if (!substituicoes || !Object.keys(substituicoes).length) return
    let mudou = false
    const atualizado = { ...regrasCategoriaFinanceiro.value }
    for (const chave in atualizado) {
      const categoriaAtual = atualizado[chave]
      if (!(categoriaAtual in substituicoes)) continue
      const novoNome = substituicoes[categoriaAtual]
      mudou = true
      if (novoNome) atualizado[chave] = novoNome
      else delete atualizado[chave]
    }
    if (!mudou) return
    regrasCategoriaFinanceiro.value = atualizado
    configSet('regras_categoria_financeiro', regrasCategoriaFinanceiro.value)
  }

  // Regras de descrição aprendidas: quando o usuário renomeia a descrição
  // "crua" vinda do banco (ex: "PIX RECEBIDO JOAO DA SILVA") para algo mais
  // legível (ex: "Cliente João - Encomenda"), guardamos a chave a partir da
  // descrição ORIGINAL do banco → texto padronizado. Assim, novas importações
  // com a mesma descrição original já chegam com o nome padronizado, em vez
  // de "esquecer" o que já foi configurado.
  const regrasDescricaoFinanceiro = ref({})

  function aprenderRegraDescricao(descricaoOriginal, descricaoNova) {
    const chave = normalizar(descricaoOriginal || '')
    const valor = String(descricaoNova || '').trim()
    if (!chave || !valor) return
    if (regrasDescricaoFinanceiro.value[chave] === valor) return
    regrasDescricaoFinanceiro.value = { ...regrasDescricaoFinanceiro.value, [chave]: valor }
    configSet('regras_descricao_financeiro', regrasDescricaoFinanceiro.value)
  }

  // Termos que identificam remetente/destinatário como conta própria
  const TERMOS_CONTA_PROPRIA = [
    'pagbank', 'pagseguro', 'banco inter', 'nubank', 'c6 bank',
    'itau', 'itaú', 'banco itau', 'banco do brasil', 'bradesco',
    'transf propria', 'transferencia propria', 'conta propria'
  ]
  const TERMOS_ESTRITOS_INTERNA = ['transf propria', 'transferencia propria', 'conta propria', 'entre contas', 'mesmo titular']

  const NOMES_PROPRIETARIOS = [
    'yves',
    'yves mauricio',
    'elisabete',
    'elisabete batista',
    'bete',
    'mauricio yves'
  ]

  // PIX recebidos de Evelyn Ribeiro não compõem receita MEI (renda pessoal separada do negócio)
  const NOMES_RENDA_PESSOAL = ['evelyn', 'evelyn ribeiro']

  function hasNomeRendaPessoal(descNorm) {
    return NOMES_RENDA_PESSOAL.some(nome => descNorm.includes(nome))
  }

  function isMovimentoTransferenciaSaida(tipoNorm, valorNum) {
    return valorNum < 0 && (
      tipoNorm.includes('pix enviado') ||
      tipoNorm.includes('qr code pix enviado') ||
      tipoNorm.includes('pix transf') ||
      tipoNorm.includes('ted') ||
      tipoNorm.includes('doc')
    )
  }

  function isMovimentoTransferenciaEntrada(tipoNorm, valorNum) {
    return valorNum > 0 && (
      tipoNorm.includes('pix recebido') ||
      tipoNorm.includes('qr code pix recebido') ||
      tipoNorm.includes('pix transf') ||
      tipoNorm.includes('ted recebido')
    )
  }

  function hasNomeProprietario(descNorm) {
    return NOMES_PROPRIETARIOS.some(nome => descNorm.includes(nome))
  }

  function isTransferenciaInterna(descNorm, tipoNorm, valorNum) {
    if (!isMovimentoTransferenciaSaida(tipoNorm, valorNum)) return false
    // Só é interna se houver termo explícito de "propria" ou banco conhecido.
    const temTermoInterno = TERMOS_ESTRITOS_INTERNA.some(t => descNorm.includes(t))
    return temTermoInterno || (TERMOS_CONTA_PROPRIA.some(t => descNorm.includes(t)) && hasNomeProprietario(descNorm))
  }

  // PIX recebido vindo de conta própria (ex: PagBank recebendo do Itaú)
  function isPixRecebidoInterno(descNorm, tipoNorm, valorNum) {
    if (!isMovimentoTransferenciaEntrada(tipoNorm, valorNum)) return false
    // IMPORTANTE: Evitar que PIX de cliente vindo de "Itaú" caia aqui.
    // Exigimos que a descrição seja explicitamente de transferência própria ou contenha seu nome.
    return TERMOS_ESTRITOS_INTERNA.some(t => descNorm.includes(t)) ||
      hasNomeProprietario(descNorm) ||
      (TERMOS_CONTA_PROPRIA.some(t => descNorm.includes(t)) && hasNomeProprietario(descNorm))
  }

  function diferencaDias(dataA, dataB) {
    const a = new Date(`${String(dataA || '').slice(0, 10)}T00:00:00`)
    const b = new Date(`${String(dataB || '').slice(0, 10)}T00:00:00`)
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Infinity
    return Math.abs(a.getTime() - b.getTime()) / 86400000
  }

  function isParTransferenciaInterna(origem, destino) {
    if (!origem || !destino) return false
    if ((origem.banco || '') === (destino.banco || '')) return false

    const valorOrigem = Number(origem.valor || 0)
    const valorDestino = Number(destino.valor || 0)
    if (!(valorOrigem < 0 && valorDestino > 0)) return false
    if (Math.abs(Math.abs(valorOrigem) - Math.abs(valorDestino)) > 0.009) return false
    if (diferencaDias(origem.data, destino.data) > 3) return false

    const origemTipo = normalizarTipoFinanceiro(origem.tipo)
    const destinoTipo = normalizarTipoFinanceiro(destino.tipo)
    if (!isMovimentoTransferenciaSaida(origemTipo, valorOrigem)) return false
    if (!isMovimentoTransferenciaEntrada(destinoTipo, valorDestino)) return false

    const origemDesc = normalizarTextoFinanceiro(origem.descricao)
    const destinoDesc = normalizarTextoFinanceiro(destino.descricao)

    return (
      isPixRecebidoInterno(destinoDesc, destinoTipo, valorDestino) ||
      TERMOS_ESTRITOS_INTERNA.some(t => origemDesc.includes(t)) ||
      TERMOS_ESTRITOS_INTERNA.some(t => destinoDesc.includes(t))
    )
  }

  function reconciliarTransferenciasInternas(lancamentos = []) {
    const atualizados = lancamentos.map(item => ({ ...item }))
    const entradasPorValor = new Map()

    atualizados.forEach((item, index) => {
      const valor = Number(item.valor || 0)
      const tipoNorm = normalizarTipoFinanceiro(item.tipo)
      if (!isMovimentoTransferenciaEntrada(tipoNorm, valor)) return
      const chave = Math.abs(valor).toFixed(2)
      const bucket = entradasPorValor.get(chave) || []
      bucket.push({ item, index })
      entradasPorValor.set(chave, bucket)
    })

    atualizados.forEach((item, index) => {
      if (item.editado_manualmente) return

      const valor = Number(item.valor || 0)
      const tipoNorm = normalizarTipoFinanceiro(item.tipo)
      if (!isMovimentoTransferenciaSaida(tipoNorm, valor)) return

      const candidatos = entradasPorValor.get(Math.abs(valor).toFixed(2)) || []
      const par = candidatos.find(({ item: entrada }) => isParTransferenciaInterna(item, entrada))
      if (!par) return

      atualizados[index] = {
        ...atualizados[index],
        categoria: 'Transferência Interna',
        natureza: 'interna'
      }

      if (!atualizados[par.index].editado_manualmente) {
        atualizados[par.index] = {
          ...atualizados[par.index],
          categoria: 'Transferência Interna',
          natureza: 'interna'
        }
      }
    })

    return atualizados
  }

  function classificarLancamentoFinanceiro({ tipo, descricao, valor, banco, conta = null }) {
    const tipoNorm = normalizarTipoFinanceiro(tipo)
    const descNorm = normalizarTextoFinanceiro(descricao)
    const valorNum = Number(valor || 0)
    const contaEmpresarial = conta?.natureza === 'empresarial'
    const contaPessoal = conta?.natureza === 'pessoal'

    // ── Regra aprendida com o usuário tem prioridade sobre tudo ──
    // Se o usuário já classificou manualmente um lançamento com esta mesma
    // descrição antes, aplicamos a mesma categoria automaticamente.
    const categoriaAprendida = regrasCategoriaFinanceiro.value[normalizar(descricao || '')]
    if (categoriaAprendida) {
      const catDef = categoriasFinanceiro.value.find(c => c.nome === categoriaAprendida)
      if (catDef) return { categoria: catDef.nome, natureza: catDef.natureza }
    }

    // ── 0. Prioridade para Notas Fiscais (Importação de Compras) ──
    if (tipoNorm === 'nota fiscal') {
      return { categoria: 'Insumos e Matéria-Prima', natureza: 'operacional' }
    }

    // ── 1. Transferência de saída entre contas próprias ──────
    if (isTransferenciaInterna(descNorm, tipoNorm, valorNum)) {
      return { categoria: 'Transferência Interna', natureza: 'interna' }
    }

    // ── 2. PIX recebido de conta própria (ex: repasse Itaú→PagBank) ──
    if (isPixRecebidoInterno(descNorm, tipoNorm, valorNum)) {
      return { categoria: 'Transferência Interna', natureza: 'interna' }
    }

    // ── 3. RECEITAS — PIX de terceiros ─────────────────────────────
    // 3a. PIX de Evelyn Ribeiro → renda pessoal separada da receita MEI
    if (
      (tipoNorm.includes('pix recebido') || tipoNorm.includes('qr code pix recebido') ||
        (tipoNorm.includes('pix transf') && valorNum > 0)) &&
      hasNomeRendaPessoal(descNorm)
    ) {
      return { categoria: 'Renda Pessoal', natureza: 'pessoal' }
    }

    // 3b. Demais PIX recebidos de clientes → Receita de Vendas MEI
    if (
      (tipoNorm.includes('pix recebido') || tipoNorm.includes('qr code pix recebido') ||
        tipoNorm.includes('pix transf')) && valorNum > 0
    ) {
      return { categoria: 'Receita de Vendas', natureza: 'entrada' }
    }

    // ── 4. Rendimentos de aplicação ──────────────────────────
    if (tipoNorm.includes('rendimento') || tipoNorm.includes('rend pago') || descNorm.includes('aplic aut')) {
      return { categoria: 'Rendimento Financeiro', natureza: 'entrada' }
    }

    // ── 5. Tarifas e anuidades bancárias ────────────────────
    if (tipoNorm.includes('tarifa') || tipoNorm.startsWith('tar ') || descNorm.includes('anuidade')) {
      return { categoria: 'Tarifas Bancárias', natureza: 'operacional' }
    }

    // ── 6. Impostos e contribuições (DAS MEI, ISS, INSS) ────
    if (
      descNorm.includes('das mei') || descNorm.includes('contrib mei') ||
      descNorm.includes('municipio') || descNorm.includes('prefeitura') ||
      descNorm.includes('receita federal') || descNorm.includes('inss') ||
      descNorm.includes('issqn') || descNorm.includes('iss ')
    ) {
      return { categoria: 'Impostos e Contribuições', natureza: 'operacional' }
    }

    // ── 7. Insumos e matéria-prima (compras para produção) ──
    // Fornecedores conhecidos de insumos: sempre operacional mesmo se pago
    // de conta pessoal (dono compra do próprio bolso — estoque sobe para empresa)
    const ehFornecedorInsumo =
      descNorm.includes('casas pedro') || descNorm.includes('superdoce') ||
      descNorm.includes('tarita doces') || descNorm.includes('biscoito')
    const ehComercioGenerico =
      descNorm.includes('supermerc') || descNorm.includes('mercado') ||
      descNorm.includes('acougue') || descNorm.includes('atacado')

    if (ehFornecedorInsumo) {
      return { categoria: 'Insumos e Matéria-Prima', natureza: 'operacional' }
    }
    if (ehComercioGenerico) {
      if (contaPessoal) return { categoria: 'Alimentação Pessoal', natureza: 'pessoal' }
      return { categoria: 'Insumos e Matéria-Prima', natureza: 'operacional' }
    }

    // ── 8. Embalagens e materiais ────────────────────────────
    if (
      descNorm.includes('embalagem') || descNorm.includes('caixa') ||
      descNorm.includes('sacola') || descNorm.includes('descartav') ||
      descNorm.includes('plastico') || descNorm.includes('pote')
    ) {
      return { categoria: 'Embalagens e Materiais', natureza: 'operacional' }
    }

    // ── 9. Manutenção e reparos ──────────────────────────────
    if (
      descNorm.includes('manutenc') || descNorm.includes('reparo') ||
      descNorm.includes('conserto') || descNorm.includes('tecnico') ||
      descNorm.includes('assistencia') || descNorm.includes('boa casa') ||
      descNorm.includes('cumani') || descNorm.includes('madeira')
    ) {
      return { categoria: 'Manutenção e Reparos', natureza: 'operacional' }
    }

    // ── 10. Serviços e assinaturas ───────────────────────────
    if (
      descNorm.includes('mais.mobi') || descNorm.includes('google') ||
      descNorm.includes('meta ') || descNorm.includes('instagram') ||
      descNorm.includes('canva') || descNorm.includes('assinatura') ||
      descNorm.includes('mensalidade')
    ) {
      if (
        contaPessoal &&
        (
          descNorm.includes('internet') || descNorm.includes('fibra') ||
          descNorm.includes('claro') || descNorm.includes('vivo') ||
          descNorm.includes('tim') || descNorm.includes('oi ')
        )
      ) {
        return { categoria: 'Internet e Telefonia', natureza: 'pessoal' }
      }
      return { categoria: 'Serviços e Assinaturas', natureza: 'operacional' }
    }

    // ── 11. Transporte e entrega ─────────────────────────────
    if (
      descNorm.includes('uber') || descNorm.includes('99pop') || descNorm.includes('grab') ||
      descNorm.includes('correios') || descNorm.includes('jadlog') || descNorm.includes('loggi') ||
      descNorm.includes('combustivel') || descNorm.includes('posto ') || descNorm.includes('estacion')
    ) {
      return { categoria: 'Transporte e Entrega', natureza: 'operacional' }
    }

    // ── 12. Moradia (conta PF / pessoal) ────────────────────
    if (descNorm.includes('condominio') || descNorm.includes('edificio')) {
      return { categoria: 'Condomínio', natureza: 'pessoal' }
    }

    if (
      descNorm.includes('light') || descNorm.includes('enel') ||
      descNorm.includes('energia eletrica') || descNorm.includes('eletric')
    ) {
      return { categoria: 'Energia Elétrica', natureza: 'pessoal' }
    }

    if (
      descNorm.includes('ceg') || descNorm.includes('naturgy') ||
      descNorm.includes('gas ')
    ) {
      return { categoria: 'Gás', natureza: 'pessoal' }
    }

    if (
      descNorm.includes('internet') || descNorm.includes('fibra') ||
      descNorm.includes('claro') || descNorm.includes('vivo') ||
      descNorm.includes('tim') || descNorm.includes('oi ')
    ) {
      return { categoria: 'Internet e Telefonia', natureza: 'pessoal' }
    }

    if (
      descNorm.includes('aluguel') || descNorm.includes('iptu')
    ) {
      return { categoria: 'Moradia', natureza: 'pessoal' }
    }

    // ── 13. Saúde (pessoal) ──────────────────────────────────
    if (
      descNorm.includes('drogaria') || descNorm.includes('farmac') ||
      descNorm.includes('pacheco') || descNorm.includes('medico') ||
      descNorm.includes('hospital') || descNorm.includes('clinica')
    ) {
      return { categoria: 'Saúde e Bem-Estar', natureza: 'pessoal' }
    }

    // ── 14. Alimentação pessoal ──────────────────────────────
    if (
      descNorm.includes('padaria') || descNorm.includes('restaurante') ||
      descNorm.includes('lanchonete') || descNorm.includes('burger') ||
      descNorm.includes('le depan') || descNorm.includes('ifd ') ||
      descNorm.includes('ifood')
    ) {
      return { categoria: 'Alimentação Pessoal', natureza: 'pessoal' }
    }

    // ── 15. Vestuário e compras pessoais ────────────────────
    if (
      descNorm.includes('marisa') || descNorm.includes('lojas ame') ||
      descNorm.includes('shopping') || descNorm.includes('riachuelo') ||
      descNorm.includes('renner') || descNorm.includes('hering')
    ) {
      return { categoria: 'Vestuário e Compras', natureza: 'pessoal' }
    }

    // ── 16. Pró-labore / Retirada (PIX enviado conta PJ) ────
    if (
      (tipoNorm.includes('pix enviado') || tipoNorm.includes('ted')) &&
      (contaEmpresarial || banco === 'pagbank') && valorNum < 0
    ) {
      return { categoria: 'Pró-labore / Retirada', natureza: 'pessoal' }
    }

    // ── 17. Compras débito (conta PF = pessoal) ──────────────
    if (tipoNorm.includes('cartao de debito') || tipoNorm.includes('rshop')) {
      if (contaEmpresarial) return { categoria: 'Outras Despesas', natureza: 'operacional' }
      return { categoria: 'Compras no Débito', natureza: 'pessoal' }
    }

    // ── 18. Lazer e outros pessoais ──────────────────────────
    if (tipoNorm.includes('pix enviado') && valorNum < 0 && (contaPessoal || banco !== 'pagbank')) {
      return { categoria: 'Lazer e Outros Pessoais', natureza: 'pessoal' }
    }

    // ── fallback ─────────────────────────────────────────────
    return {
      categoria: valorNum >= 0 ? 'Outras Receitas' : 'Outras Despesas',
      natureza: valorNum >= 0 ? 'entrada' : 'operacional'
    }
  }

  // Observação: usamos SEMPRE a descrição ORIGINAL do banco (descricao_original)
  // para gerar as assinaturas de duplicidade, nunca a descrição já padronizada
  // pelo usuário. Assim, renomear um lançamento não faz o app deixar de
  // reconhecer a mesma transação em importações futuras.
  function getAssinaturasDuplicidadeFinanceiro({ data, valor, tipo, descricao, descricao_original, banco }) {
    const valorNormalizado = Number(valor || 0).toFixed(2)
    const dataNormalizada = String(data || '').slice(0, 10)
    const bancoNormalizado = normalizarTextoFinanceiro(banco || 'pagbank')
    const tipoNormalizado = normalizarTextoDuplicidadeFinanceiro(tipo)
    const descricaoNormalizada = normalizarTextoDuplicidadeFinanceiro(descricao_original || descricao)

    return [
      [dataNormalizada, valorNormalizado, tipoNormalizado, descricaoNormalizada].join('|'),
      [bancoNormalizado, dataNormalizada, valorNormalizado, descricaoNormalizada].join('|'),
      [dataNormalizada, valorNormalizado, descricaoNormalizada].join('|')
    ]
  }

  function getHashDuplicidadeFinanceiro({ data, valor, tipo, descricao, descricao_original, banco }) {
    const base = [
      normalizarTextoFinanceiro(banco || 'pagbank'),
      String(data || '').slice(0, 10),
      Number(valor || 0).toFixed(2),
      normalizarTextoDuplicidadeFinanceiro(descricao_original || descricao)
    ].join('|')
    let hash = 2166136261
    for (let i = 0; i < base.length; i++) {
      hash ^= base.charCodeAt(i)
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return `fin-${(hash >>> 0).toString(36)}-${base}`
  }

  function normalizarLancamentoFinanceiro(dados = {}) {
    const conta = resolverContaFinanceira(dados)
    const data = String(dados.data || '').slice(0, 10)
    const valor = Number(dados.valor || 0)
    const tipoLegado = !dados.tipo && !dados.categoria && valor > 0 ? 'Pix recebido' : ''
    const tipo = String(dados.tipo || tipoLegado).trim()
    // A descrição original (crua, como veio do banco) é preservada separadamente.
    // Se o usuário já padronizou essa mesma descrição antes, aplicamos o nome
    // padronizado automaticamente — inclusive em novas importações.
    const descricao_original = String(dados.descricao || '').trim()
    const regraDescricao = regrasDescricaoFinanceiro.value[normalizar(descricao_original)]
    const descricao = regraDescricao || descricao_original
    const banco = conta?.banco || normalizar(dados.banco || 'pagbank')
    const classificacao = classificarLancamentoFinanceiro({ tipo, descricao: descricao_original, valor, banco, conta })
    const mes_ref = dados.mes_ref || getMesRef(data)
    const hash_duplicidade = dados.hash_duplicidade || getHashDuplicidadeFinanceiro({ data, valor, tipo, descricao: descricao_original, banco })

    // banco_tipo: 'pj' = conta empresarial, 'pf' = conta física (migração)
    const banco_tipo = banco === 'pagbank' ? 'pj' : 'pf'

    return {
      data,
      valor,
      tipo,
      descricao,
      descricao_original,
      banco,
      banco_tipo,
      conta_id: conta?.id || dados.conta_id || '',
      conta_nome: conta?.nome || dados.conta_nome || '',
      conta_titular: conta?.titular || dados.conta_titular || '',
      conta_natureza: conta?.natureza || dados.conta_natureza || '',
      conta_papel: conta?.papel || dados.conta_papel || '',
      categoria: dados.categoria || classificacao.categoria,
      natureza: dados.natureza || classificacao.natureza,
      mes_ref,
      hash_duplicidade
    }
  }

  return {
    normalizarTextoFinanceiro,
    normalizarTextoDuplicidadeFinanceiro,
    gerarContaId,
    normalizarContaFinanceira,
    getContaFinanceiraById,
    getContasFinanceirasPorBanco,
    resolverContaFinanceira,
    normalizarTipoFinanceiro,
    CATEGORIAS_MEI_PADRAO,
    categoriasFinanceiro,
    regrasCategoriaFinanceiro,
    aprenderRegraCategoria,
    remapearRegrasCategoria,
    regrasDescricaoFinanceiro,
    aprenderRegraDescricao,
    TERMOS_CONTA_PROPRIA,
    TERMOS_ESTRITOS_INTERNA,
    NOMES_PROPRIETARIOS,
    NOMES_RENDA_PESSOAL,
    hasNomeRendaPessoal,
    isMovimentoTransferenciaSaida,
    isMovimentoTransferenciaEntrada,
    hasNomeProprietario,
    isTransferenciaInterna,
    isPixRecebidoInterno,
    diferencaDias,
    isParTransferenciaInterna,
    reconciliarTransferenciasInternas,
    classificarLancamentoFinanceiro,
    getAssinaturasDuplicidadeFinanceiro,
    getHashDuplicidadeFinanceiro,
    normalizarLancamentoFinanceiro
  }
}
