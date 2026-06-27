import { defineStore } from "pinia"
import { ref, computed } from 'vue'
import { db, configGet, configSet, exportarDados, importarDados, garantirPersistencia, migrateLegacyDbIfNeeded } from './db.js' // Removed getMesRef, normalizar
import {
  isGoogleDriveBackupConfigured,
  isGoogleDriveBackupConnected,
  conectarGoogleDriveBackup,
  desconectarGoogleDriveBackup,
  salvarBackupNoDrive,
  restaurarBackupDoDrive,
  restaurarBakDoDrive,
  getBackupTimestamp,
  getBackupBakTimestamp
} from './services/googleDriveBackup.js'
import { isInsumoSemPeso, normalizar, getMesRef, dataHoraBR } from './utils.js'

export const useStore = defineStore('choco', () => {

  // ── UI ─────────────────────────────────────
  const tab = ref('painel')
  const loading = ref(false)
  const toast = ref(null)

  // ── Dados ─────────────────────────────────
  const produtos = ref([])
  const receitas = ref([])
  const producoes = ref([])
  const financeiro = ref([])
  const contasFinanceiras = ref([])

  // ── Produção Fantasma ──
  const producaoFantasma = ref({
    diferenca: 0,
    producaoNaoFinanceira: [],
    producaoYM: [],
    producaoBete: []
  })

  // ── Estado da Cozinha (Agenda/Rascunho) ──
  const cozinhaLote = ref([])
  const cozinhaChecklist = ref({})
  const loteOriginalEmEdicao = ref(null)

  // ── Filtros Persistentes ──
  const producaoFiltroAtivo = ref('7dias')
  const producaoBusca = ref('')

  const now = ref(Date.now())
  let tickerId = null

  // ── Cronômetro Global ──────────────────────
  const timer = ref({
    isRunning: false,
    startTime: null, // Date.now()
    accumulatedMs: 0,
    activeLoteId: null // ID do grupo (data_producao)
  })

  const activeLoteName = computed(() => {
    if (!timer.value.activeLoteId) return null;
    // Encontra o primeiro item de produção no lote ativo
    const firstItemInLote = producoes.value.find(p => p.data_producao === timer.value.activeLoteId);
    if (firstItemInLote) {
      // Retorna o nome da receita do primeiro item, ou um genérico "Lote de [data]"
      return firstItemInLote.receita_nome || `Lote de ${dataHoraBR(timer.value.activeLoteId)}`;
    }
    // Fallback para exibir apenas a data/hora do lote se nenhuma receita for encontrada
    return `Lote de ${dataHoraBR(timer.value.activeLoteId)}`;
  });

  // ── Config ────────────────────────────────
  const company = ref({
    nome: 'ChocoBete Produção',
    slogan: 'Registro de Produção',
    posicao_etiqueta: 0,
    contato_etiqueta: '', // texto livre exibido na etiqueta (whatsapp/instagram)
    etiquetas_termos_excluidos: ['recheio', 'farofa', 'massa', 'cobertura', 'calda', 'ganache', 'creme', 'base', 'mistura', 'pasta', 'glacê', 'xarope'],
    etiquetas_excecoes_incluir: [], // uuids de receitas forçadas a aparecer mesmo batendo num termo excluído
    razao_social: '',
    cnpj: '',
    cpf: '',
    municipio: '',
    uf: '',
    cnae: '',
    teto_mei_anual: 81000,
    pessoas_familia: 1,
    custo_hora_trabalho: 0, // Valor por hora (ex: 25.50)
    meta_salario_mensal: 0,    // Meta de retirada/salário mensal desejado
    reserva_operacional_fixa: 0 // Valor manual para o Giro de Segurança (ex: 600)
  })

  const insumosCriticos = computed(() => 
    produtos.value.filter(p => (p.estoque_atual || 0) <= (p.estoque_minimo || 0) && p.estoque_minimo > 0)
      .sort((a, b) => (a.estoque_atual || 0) - (b.estoque_atual || 0))
  )

  const googleDriveConnected = ref(isGoogleDriveBackupConnected())
  const googleDriveAvailable = computed(() => isGoogleDriveBackupConfigured())
  const googleDriveConfigured = computed(() => googleDriveAvailable.value && googleDriveConnected.value)

  // ── Sync automático ───────────────────────
  // 'idle' | 'syncing' | 'ok' | 'error' | 'conflict'
  const syncStatus = ref('idle')
  const hasLocalChanges = ref(false)

  /**
   * Marca que existem alterações locais pendentes de sincronização.
   * Chamado após toda mutação de dados.
   */
  function agendarSync() {
    if (!googleDriveConfigured.value) return
    hasLocalChanges.value = true
  }

  async function _executarSync() {
    if (!googleDriveConfigured.value) return
    if (!navigator.onLine) {
      syncStatus.value = 'idle'
      return
    }

    syncStatus.value = 'syncing'
    try {
      const dados = await exportarDados()
      await salvarBackupNoDrive(dados)
      await configSet('sync_ts', new Date().toISOString())
      hasLocalChanges.value = false
      concluirSyncComAviso('Drive atualizado')
    } catch (err) {
      // TOKEN_NEEDED: sessão expirada, aguarda próximo login explícito sem mostrar erro
      if (err?.message === 'TOKEN_NEEDED') {
        syncStatus.value = 'idle'
        console.info('[sync] Token expirado, aguardando reconexão')
        return
      }
      console.error('[sync] Falha ao salvar no Drive:', err)
      syncStatus.value = 'error'
    }
  }

  function concluirSyncComAviso(message) {
    syncStatus.value = 'ok'
    notify(message)
    setTimeout(() => {
      if (syncStatus.value === 'ok') syncStatus.value = 'idle'
    }, 4000)
  }

  /**
   * Compara o timestamp do Drive com o local.
   * Se o Drive for mais novo, restaura silenciosamente.
   * Chamado ao abrir o app e ao retornar de outra aba/app.
   */
  async function iniciarSync() {
    if (hasLocalChanges.value) return // Não baixa do drive se tivermos mudanças locais não salvas
    if (!googleDriveConfigured.value) return
    if (!navigator.onLine) {
      syncStatus.value = 'idle'
      return
    }

    try {
      const [tsDriveRaw, tsLocalStr] = await Promise.all([
        getBackupTimestamp(),
        configGet('sync_ts', null)
      ])

      if (!tsDriveRaw) return // Nenhum backup no Drive ainda

      const tsDrive = new Date(tsDriveRaw)
      const tsLocal = tsLocalStr ? new Date(tsLocalStr) : null

      // Drive é mais novo que o nosso último sync: restaura
      if (!tsLocal || tsDrive > tsLocal) {
        syncStatus.value = 'syncing'
        const backup = await restaurarBackupDoDrive()
        await importarDados(backup)
        await configSet('sync_ts', tsDrive.toISOString())
        concluirSyncComAviso('Dados atualizados pelo Drive')
        // Recarrega os dados reativos sem reload de página
        const [p, r, pr, fin, contasCfg] = await Promise.all([
          db.produtos.toArray(),
          db.receitas.toArray(),
          db.producoes.toArray(),
          db.financeiro.orderBy('data').reverse().toArray(),
          configGet('contas_financeiras')
        ])
        produtos.value = p
        receitas.value = r
        producoes.value = pr
        financeiro.value = fin
        contasFinanceiras.value = Array.isArray(contasCfg)
          ? contasCfg.map(normalizarContaFinanceira).filter(c => c.nome)
          : []
      }
    } catch (err) {
      console.error('[sync] Falha ao verificar Drive:', err)
      syncStatus.value = 'error'
    }
  }

  /**
   * Força save imediato (sem debounce).
   * Usado ao minimizar/trocar de aba.
   */
  async function syncImediato() {
    await _executarSync()
  }

  const clean = (obj) => JSON.parse(JSON.stringify(obj))
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

  const CATEGORIAS_MEI = [
    // ── RECEITAS ──────────────────────────────────────────────
    { nome: 'Vendas',            natureza: 'entrada',      grupo: 'Receitas', icon: 'fa-arrow-trend-up' },
    { nome: 'Rendimentos',       natureza: 'entrada',      grupo: 'Receitas', icon: 'fa-piggy-bank' },
    { nome: 'Outras entradas',   natureza: 'entrada',      grupo: 'Receitas', icon: 'fa-plus-circle' },

    // ── CUSTOS DO NEGÓCIO ─────────────────────────────────────
    { nome: 'Ingredientes',           natureza: 'operacional', grupo: 'Negócio', icon: 'fa-cookie' },
    { nome: 'Embalagens',             natureza: 'operacional', grupo: 'Negócio', icon: 'fa-box' },
    { nome: 'Transporte e entregas',  natureza: 'operacional', grupo: 'Negócio', icon: 'fa-car' },
    { nome: 'DAS-MEI e taxas',        natureza: 'operacional', grupo: 'Negócio', icon: 'fa-file-invoice-dollar' },
    { nome: 'Outros custos',          natureza: 'operacional', grupo: 'Negócio', icon: 'fa-receipt' },

    // ── PESSOAL ───────────────────────────────────────────────
    { nome: 'Retirada (pró-labore)', natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-user-tie' },
    { nome: 'Despesas pessoais',     natureza: 'pessoal', grupo: 'Pessoal', icon: 'fa-house' },

    // ── ESPECIAL ──────────────────────────────────────────────
    { nome: 'Transferência Interna', natureza: 'interna', grupo: 'Especial', icon: 'fa-arrow-right-arrow-left' },
  ];

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

    // ── 0. Prioridade para Notas Fiscais (Importação de Compras) ──
    if (tipoNorm === 'nota fiscal') {
      return { categoria: 'Insumos: Chocolate e Bases', natureza: 'operacional' }
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

  function getAssinaturasDuplicidadeFinanceiro({ data, valor, tipo, descricao, banco }) {
    const valorNormalizado = Number(valor || 0).toFixed(2)
    const dataNormalizada = String(data || '').slice(0, 10)
    const bancoNormalizado = normalizarTextoFinanceiro(banco || 'pagbank')
    const tipoNormalizado = normalizarTextoDuplicidadeFinanceiro(tipo)
    const descricaoNormalizada = normalizarTextoDuplicidadeFinanceiro(descricao)

    return [
      [dataNormalizada, valorNormalizado, tipoNormalizado, descricaoNormalizada].join('|'),
      [bancoNormalizado, dataNormalizada, valorNormalizado, descricaoNormalizada].join('|'),
      [dataNormalizada, valorNormalizado, descricaoNormalizada].join('|')
    ]
  }

  function getHashDuplicidadeFinanceiro({ data, valor, tipo, descricao, banco }) {
    const base = [
      normalizarTextoFinanceiro(banco || 'pagbank'),
      String(data || '').slice(0, 10),
      Number(valor || 0).toFixed(2),
      normalizarTextoDuplicidadeFinanceiro(descricao)
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
    const descricao = String(dados.descricao || '').trim()
    const banco = conta?.banco || normalizar(dados.banco || 'pagbank')
    const classificacao = classificarLancamentoFinanceiro({ tipo, descricao, valor, banco, conta })
    const mes_ref = dados.mes_ref || getMesRef(data)
    const hash_duplicidade = dados.hash_duplicidade || getHashDuplicidadeFinanceiro({ data, valor, tipo, descricao, banco })

    // banco_tipo: 'pj' = conta empresarial, 'pf' = conta física (migração)
    const banco_tipo = banco === 'pagbank' ? 'pj' : 'pf'

    return {
      data,
      valor,
      tipo,
      descricao,
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

  function failValidation(message) {
    notify(message, 'error')
    const error = new Error(message)
    error.validation = true
    throw error
  }

  function hasDuplicateName(items, nome, uuid) {
    const nomeNorm = normalizar(nome)
    return items.some(item => item.uuid !== uuid && normalizar(item.nome) === nomeNorm)
  }

  function contarUsoProduto(uuid) {
    const emReceitas = receitas.value.filter(r =>
      (r.ingredientes || []).some(ing => ing.tipo === 'produto' && ing.id === uuid)
    ).length

    const emProducoes = producoes.value.filter(p =>
      (p.ingredientes_snapshot || []).some(ing => ing.tipo === 'produto' && ing.id === uuid)
    ).length

    return { emReceitas, emProducoes, total: emReceitas + emProducoes }
  }

  function contarUsoReceita(uuid) {
    const emReceitas = receitas.value.filter(r =>
      r.uuid !== uuid && (r.ingredientes || []).some(ing => ing.tipo === 'receita' && ing.id === uuid)
    ).length

    const emProducoes = producoes.value.filter(p =>
      p.receita_id === uuid || (p.ingredientes_snapshot || []).some(ing => ing.tipo === 'receita' && ing.id === uuid)
    ).length

    return { emReceitas, emProducoes, total: emReceitas + emProducoes }
  }

  function formatarUso({ emReceitas, emProducoes }) {
    const partes = []
    if (emReceitas) partes.push(`${emReceitas} receita${emReceitas > 1 ? 's' : ''}`)
    if (emProducoes) partes.push(`${emProducoes} producao${emProducoes > 1 ? 'oes' : ''}`)
    return partes.join(' e ')
  }

  // ── UI Actions ────────────────────────────
  function setTab(t) { tab.value = t }

  let _toastTimer = null
  function notify(msg, tipo = 'success', ms = 3000) {
    clearTimeout(_toastTimer)
    toast.value = { msg, tipo, id: Date.now() }
    if (ms > 0) _toastTimer = setTimeout(() => toast.value = null, ms)
  }

  // ── INIT ──────────────────────────────────
  async function init() {
    await migrateLegacyDbIfNeeded()
    await garantirPersistencia()
    loading.value = true
    try {
      const [p, r, pr, fin, cfg, contasCfg] = await Promise.all([
        db.produtos.toArray(),
        db.receitas.toArray(),
        db.producoes.toArray(), // Carrega todas as produções para o resumoProducaoPorMes
        db.financeiro.orderBy('data').reverse().toArray(),
        configGet('company'),
        configGet('contas_financeiras')
      ])
      produtos.value = p
      receitas.value = r.map(receita => ({
        ...receita,
        categoria: receita.categoria === 'Nenhuma' ? '' : receita.categoria
      }))
      producoes.value = pr
      financeiro.value = fin
      
      cozinhaLote.value = await configGet('cozinha_lote', [])
      cozinhaChecklist.value = await configGet('cozinha_checklist', {})
      loteOriginalEmEdicao.value = await configGet('cozinha_lote_original', null)

      if (cfg) company.value = cfg
      contasFinanceiras.value = Array.isArray(contasCfg)
        ? contasCfg.map(normalizarContaFinanceira).filter(conta => conta.nome)
        : []

      const savedTimer = await configGet('active_timer')
      if (savedTimer) {
        timer.value = savedTimer
        if (timer.value.isRunning) startTicker()
      }

      const reclassificados = fin.map(item => {
        if (item.editado_manualmente) return item
        const conta = resolverContaFinanceira(item)
        const cl = classificarLancamentoFinanceiro({
          tipo: item.tipo,
          descricao: item.descricao,
          valor: item.valor,
          banco: item.banco || 'pagbank',
          conta
        })
        return {
          ...item,
          banco: conta?.banco || item.banco || 'pagbank',
          conta_id: conta?.id || item.conta_id || '',
          conta_nome: conta?.nome || item.conta_nome || '',
          conta_titular: conta?.titular || item.conta_titular || '',
          conta_natureza: conta?.natureza || item.conta_natureza || '',
          conta_papel: conta?.papel || item.conta_papel || '',
          categoria: cl.categoria,
          natureza: cl.natureza
        }
      })
      const reconciliados = reconciliarTransferenciasInternas(reclassificados)
      const alterados = reconciliados.filter((item, index) => {
        const atual = fin[index]
        return atual && (
          atual.banco !== item.banco ||
          atual.conta_id !== item.conta_id ||
          atual.conta_nome !== item.conta_nome ||
          atual.conta_titular !== item.conta_titular ||
          atual.conta_natureza !== item.conta_natureza ||
          atual.conta_papel !== item.conta_papel ||
          atual.categoria !== item.categoria ||
          atual.natureza !== item.natureza
        )
      })

      if (alterados.length) {
        await db.financeiro.bulkPut(alterados)
        financeiro.value = await db.financeiro.orderBy('data').reverse().toArray()
      }
    } finally {
      loading.value = false
    }

    // Verifica se há dados mais recentes no Drive (sync entre dispositivos)
    iniciarSync()
  }

  // ── BACKUP ────────────────────────────────
  async function backupGeral() {
    try {
      const dados = await exportarDados()
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chocobete-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a) // Temporariamente anexa para maior compatibilidade de navegador
      a.click()
      document.body.removeChild(a) // Limpa o elemento
      setTimeout(() => URL.revokeObjectURL(url), 100) // Revoga a URL após um pequeno atraso para garantir que o download comece
      notify('Backup baixado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar backup local:', error)
      notify('Erro ao gerar backup local. Tente novamente.', 'error')
    }
  }

  async function backupGoogleDrive() {
    if (!googleDriveAvailable.value) {
      notify('Drive não configurado', 'error')
      return
    }
    if (!googleDriveConfigured.value) {
      notify('Conecte o Google Drive para usar o backup automático', 'warning')
      return
    }

    try {
      const dados = await exportarDados()
      await salvarBackupNoDrive(dados)
      notify('Backup salvo no Drive!')
    } catch (error) {
      if (error?.message === 'TOKEN_NEEDED') {
        notify('Sessão Google expirada. Reconecte o Drive nos Ajustes.', 'warning')
        return
      }
      console.error(error)
      notify('Erro ao salvar no Drive', 'error')
    }
  }

  async function restaurarGeral(arquivo) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const dados = JSON.parse(e.target.result)
        await importarDados(dados)
        notify('Dados restaurados! Recarregando…')
        setTimeout(() => location.reload(), 1500)
      } catch {
        notify('Erro ao restaurar backup', 'error')
      }
    }
    reader.readAsText(arquivo)
  }

  async function restaurarGoogleDrive() {
    if (!googleDriveAvailable.value) {
      notify('Drive não configurado', 'error')
      return
    }
    if (!googleDriveConfigured.value) {
      notify('Conecte o Google Drive para restaurar o backup', 'warning')
      return
    }

    try {
      const dados = await restaurarBackupDoDrive()
      await importarDados(dados)
      notify('Backup restaurado! Recarregando…')
      setTimeout(() => location.reload(), 1500)
    } catch (error) {
      console.error(error)
      notify(
        error?.message === 'Nenhum backup encontrado no Google Drive'
          ? 'Backup não encontrado no Drive'
          : 'Erro ao restaurar do Drive',
        'error'
      )
    }
  }

  async function restaurarGoogleDriveBak() {
    if (!googleDriveAvailable.value || !googleDriveConfigured.value) {
      notify('Drive não configurado', 'error')
      return
    }
    try {
      const dados = await restaurarBakDoDrive()
      await importarDados(dados)
      notify('Backup anterior restaurado! Recarregando…')
      setTimeout(() => location.reload(), 1500)
    } catch (error) {
      console.error(error)
      notify(
        error?.message === 'Nenhum backup anterior encontrado no Google Drive'
          ? 'Backup anterior não encontrado no Drive'
          : 'Erro ao restaurar backup anterior',
        'error'
      )
    }
  }

  async function getBackupBakTs() {
    try { return await getBackupBakTimestamp() } catch { return null }
  }

  // ── PRODUÇÕES ─────────────────────────────
  async function conectarGoogleDrive() {
    if (!googleDriveAvailable.value) {
      notify('Drive não configurado', 'error')
      return
    }
    try {
      await conectarGoogleDriveBackup()
      googleDriveConnected.value = true
      notify('Google Drive conectado!')
      await iniciarSync()
    } catch (error) {
      console.error(error)
      notify('Não foi possível conectar o Google Drive', 'error')
    }
  }

  async function desconectarGoogleDrive() {
    try {
      await desconectarGoogleDriveBackup()
    } catch (error) {
      console.error(error)
    } finally {
      googleDriveConnected.value = false
      syncStatus.value = 'idle'
      notify('Google Drive desconectado')
    }
  }

  async function carregarProducoes(dias = 7) {
    if (dias <= 0) {
      producoes.value = await db.producoes.toArray()
    } else {
      const desde = new Date()
      desde.setDate(desde.getDate() - dias)
      const iso = desde.toISOString().slice(0, 10)
      producoes.value = await db.producoes
        .where('data_producao')
        .aboveOrEqual(iso)
        .toArray()
    }
  }

// ── PRODUÇÃO FANTASMA ──────────────────────────────

/**
 * Calcula a diferença entre o que entrou na conta e o que foi produzido
 */
function calcularProducaoFantasma() {
  const mesAtual = getMesRef(new Date().toISOString())
  
  // Produções do mês atual
  const producoesMes = producoes.value.filter(p => 
    getMesRef(p.data_producao) === mesAtual
  )
  
  // Separa por origem
  const producaoYM = producoesMes.filter(p => p.origem === 'ym' || !p.origem)
  const producaoBete = producoesMes.filter(p => p.origem === 'bete')
  
  // Valor total produzido (apenas YM - o que foi registrado no financeiro)
  const valorProducaoYM = producaoYM.reduce((acc, p) => {
    const qtd = p.quantidade_produzida || p.quantidade || 0
    const preco = p.preco_unitario_snapshot || 0
    return acc + (qtd * preco)
  }, 0)
  
  // Entradas financeiras do mês
  const entradasMes = financeiro.value.filter(f => 
    f.mes_ref === mesAtual && 
    f.natureza === 'entrada' &&
    f.categoria !== 'Transferência Interna'
  )
  
  const totalEntradas = entradasMes.reduce((acc, f) => acc + f.valor, 0)
  
  // Diferença = dinheiro que entrou sem produção registrada
  const diferenca = totalEntradas - valorProducaoYM
  
  // Produção não financeira (Bete)
  const producaoNaoFinanceira = producaoBete.filter(p => !p.gerar_financeiro)
  
  // Valor estimado da produção da Bete
  const valorProducaoBete = producaoBete.reduce((acc, p) => {
    const qtd = p.quantidade_produzida || p.quantidade || 0
    const preco = p.preco_unitario_snapshot || 0
    return acc + (qtd * preco)
  }, 0)
  
  producaoFantasma.value = {
    diferenca: Math.max(0, diferenca),
    producaoNaoFinanceira,
    producaoYM,
    producaoBete,
    totalEntradas,
    valorProducaoYM,
    valorProducaoBete,
    mesAtual
  }
  
  return producaoFantasma.value
}

/**
 * Sugere possíveis produções da Bete baseado na diferença
 */
function sugerirProducaoFantasma() {
  const { diferenca, producaoBete, valorProducaoBete } = producaoFantasma.value
  
  if (diferenca <= 0) return null
  
  // Busca receitas que Bete mais faz (origem bete ou categorias comuns)
  const receitasBete = receitas.value.filter(r => 
    r.origem === 'bete' || 
    ['docinhos', 'brigadeiros', 'trufas'].includes(r.categoria)
  )
  
  if (!receitasBete.length) return null
  
  // Pega a receita mais frequente da Bete
  const receitaMaisComum = receitasBete.sort((a, b) => 
    (b.frequencia || 0) - (a.frequencia || 0)
  )[0]
  
  const precoUnitario = receitaMaisComum.preco_sugerido || 10
  const qtdEstimada = Math.round(diferenca / precoUnitario)
  
  return {
    receita: receitaMaisComum,
    quantidade_estimada: qtdEstimada,
    valor_estimado: diferenca,
    mensagem: `Parece que Bete produziu cerca de ${qtdEstimada} un de ${receitaMaisComum.nome} sem registrar`
  }
}

/**
 * Registra uma produção "fantasma" da Bete (sem gerar financeiro)
 */
async function registrarProducaoFantasma(dados) {
  const obj = {
    ...dados,
    uuid: dados.uuid || crypto.randomUUID(),
    data_producao: dados.data_producao || new Date().toISOString(),
    origem: 'bete',
    gerar_financeiro: false,
    data_inicio: null,
    data_fim: null,
    tempo_real_min: 0
  }
  
  // Busca a receita para obter snapshot
  const r = receitas.value.find(rec => rec.uuid === obj.receita_id)
  if (r) {
    obj.ingredientes_snapshot = JSON.parse(JSON.stringify(r.ingredientes || []))
    obj.custo_unitario_snapshot = getCustoProducaoReceita(r, obj.quantidade_produzida || 1, null) / (obj.quantidade_produzida || 1)
    obj.preco_unitario_snapshot = r.preco_sugerido || 0
    obj.custo_snapshot_version = 2
    obj.nome_receita = r.nome
    obj.unidade_rendimento = r.unidade_rendimento || 'un'
    obj.eh_intermediaria = r.eh_intermediaria || false
  }
  
  await registrarProducao(obj)
  calcularProducaoFantasma()
  return obj
}

  async function carregarFinanceiro() {
    financeiro.value = await db.financeiro.orderBy('data').reverse().toArray()
  }

  async function importarLancamentosFinanceiros(lancamentos = []) {
    const preparadosBase = lancamentos
      .map(normalizarLancamentoFinanceiro)
      .filter(item => item.data && item.descricao && Number.isFinite(item.valor) && item.tipo)

    const preparados = []
    const assinaturasNoArquivo = new Set()

    for (const item of preparadosBase) {
      const assinaturas = getAssinaturasDuplicidadeFinanceiro(item)
      if (assinaturas.some(assinatura => assinaturasNoArquivo.has(assinatura))) continue
      assinaturas.forEach(assinatura => assinaturasNoArquivo.add(assinatura))
      preparados.push(item)
    }

    if (!preparados.length) {
      return {
        recebidos: lancamentos.length,
        validos: 0,
        importadosCount: 0,
        duplicados: 0,
        totalImportado: 0
      }
    }

    const existentes = await db.financeiro.toArray()
    const assinaturasExistentes = new Set()

    for (const item of existentes) {
      getAssinaturasDuplicidadeFinanceiro(item).forEach(assinatura => assinaturasExistentes.add(assinatura))
      if (item.hash_duplicidade) assinaturasExistentes.add(item.hash_duplicidade)
    }

    const novos = preparados.filter(item => {
      const assinaturas = getAssinaturasDuplicidadeFinanceiro(item)
      const ehDuplicado = assinaturas.some(assinatura => assinaturasExistentes.has(assinatura))
      if (ehDuplicado || (item.hash_duplicidade && assinaturasExistentes.has(item.hash_duplicidade))) {
        return false
      }
      assinaturas.forEach(assinatura => assinaturasExistentes.add(assinatura))
      if (item.hash_duplicidade) assinaturasExistentes.add(item.hash_duplicidade)
      return true
    })

    if (novos.length) {
      await db.financeiro.bulkAdd(novos)
    }

    const todos = await db.financeiro.toArray()
    const reconciliados = reconciliarTransferenciasInternas(todos)
    const alterados = reconciliados.filter((item, index) => {
      const atual = todos[index]
      return atual && (
        atual.categoria !== item.categoria ||
        atual.natureza !== item.natureza
      )
    })

    if (alterados.length) {
      await db.financeiro.bulkPut(alterados)
    }

    if (novos.length || alterados.length) {
      await carregarFinanceiro()
      agendarSync()
    }

    return {
      recebidos: lancamentos.length,
      validos: preparados.length,
      importadosCount: novos.length,
      duplicados: preparados.length - novos.length,
      totalImportado: novos.reduce((acc, item) => acc + Number(item.valor || 0), 0),
      receitasImportadas: novos
        .filter(item => item.natureza === 'entrada')
        .reduce((acc, item) => acc + Number(item.valor || 0), 0),
      saidasImportadas: novos
        .filter(item => item.valor < 0)
        .reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0),
      producaoFantasma,
      calcularProducaoFantasma,
      sugerirProducaoFantasma,
      registrarProducaoFantasma
    }
  }

  async function atualizarLancamentoFinanceiro(id, dadosAtualizacao) {
    const lancamento = await db.financeiro.get(id)
    if (!lancamento) {
      notify('Lançamento não encontrado.', 'error')
      return
    }
    const atualizado = {
      ...lancamento,
      ...dadosAtualizacao,
      natureza: dadosAtualizacao.categoria
        ? (CATEGORIAS_MEI.find(c => c.nome === dadosAtualizacao.categoria)?.natureza ?? lancamento.natureza)
        : (dadosAtualizacao.natureza ?? lancamento.natureza),
      editado_manualmente: true
    }
    await db.financeiro.put(atualizado)
    await carregarFinanceiro()
    notify('Categoria atualizada!')
    agendarSync()
  }

  async function atualizarLancamentosEmLote(ids, dadosAtualizacao) {
    if (!ids.length) return
    const lancamentos = await db.financeiro.where('id').anyOf(ids).toArray()
    const naturezaCategoria = dadosAtualizacao.categoria
      ? (CATEGORIAS_MEI.find(c => c.nome === dadosAtualizacao.categoria)?.natureza ?? null)
      : null
    const atualizados = lancamentos.map(item => ({
      ...item,
      ...dadosAtualizacao,
      natureza: naturezaCategoria ?? dadosAtualizacao.natureza ?? item.natureza,
      editado_manualmente: true
    }))
    await db.financeiro.bulkPut(atualizados)
    await carregarFinanceiro()
    notify(`${ids.length} lançamento(s) atualizados!`)
    agendarSync()
  }

  function salvarCozinhaLocal() {
    configSet('cozinha_lote', cozinhaLote.value)
    configSet('cozinha_checklist', cozinhaChecklist.value)
    configSet('cozinha_lote_original', loteOriginalEmEdicao.value)
  }

  async function limparFinanceiro() {
    loading.value = true
    try {
      await db.financeiro.clear()
      financeiro.value = []
      notify('Todo o histórico financeiro foi removido.')
      agendarSync()
    } finally {
      loading.value = false
    }
  }

  async function limparFinanceiroPorBanco(banco) {
    loading.value = true
    try {
      if (banco === 'todos') {
        await db.financeiro.clear()
        financeiro.value = []
        notify('Todo o histórico financeiro foi removido.')
      } else {
        const ids = financeiro.value
          .filter(i => (i.banco || 'pagbank') === banco)
          .map(i => i.id)
        if (!ids.length) { notify('Nenhum lançamento encontrado para este banco.'); return }
        await db.financeiro.bulkDelete(ids)
        financeiro.value = financeiro.value.filter(i => (i.banco || 'pagbank') !== banco)
        const labels = { pagbank: 'PagBank', itau: 'Itaú', bb: 'BB' }
        notify(`Extrato ${labels[banco] || banco} removido — ${ids.length} lançamento(s) excluído(s).`)
      }
      agendarSync()
    } finally {
      loading.value = false
    }
  }

  async function reclassificarTodosFinanceiro() {
    // Reclassifica apenas lançamentos que não foram editados manualmente
    const todos = await db.financeiro.toArray()
    const paraAtualizar = todos.filter(i => !i.editado_manualmente)
    if (!paraAtualizar.length) {
      notify('Todos os lançamentos já estão no padrão atual.', 'warning')
      return 0
    }
    const reclassificados = paraAtualizar.map(item => {
      const conta = resolverContaFinanceira(item)
      const cl = classificarLancamentoFinanceiro({
        tipo: item.tipo,
        descricao: item.descricao,
        valor: item.valor,
        banco: item.banco || 'pagbank',
        conta
      })
      return {
        ...item,
        banco: conta?.banco || item.banco || 'pagbank',
        conta_id: conta?.id || item.conta_id || '',
        conta_nome: conta?.nome || item.conta_nome || '',
        conta_titular: conta?.titular || item.conta_titular || '',
        conta_natureza: conta?.natureza || item.conta_natureza || '',
        conta_papel: conta?.papel || item.conta_papel || '',
        categoria: cl.categoria,
        natureza: cl.natureza
      }
    })
    const porId = new Map(reclassificados.map(item => [item.id, item]))
    const consolidados = reconciliarTransferenciasInternas(
      todos.map(item => porId.get(item.id) || item)
    )
    const atualizados = consolidados.filter(item => !item.editado_manualmente)
    await db.financeiro.bulkPut(atualizados)
    await carregarFinanceiro()
    notify(`${atualizados.length} lançamento(s) reclassificados!`)
    agendarSync()
    return atualizados.length
  }

  async function historicoPrecoProduto(produtoUuid) {
    return await db.historico_precos
      .where('produto_uuid')
      .equals(produtoUuid)
      .sortBy('data')
  }

  // ── CRUD: INGREDIENTES (produtos) ────────
  async function salvarProduto(dados) {
    const obj = clean(dados)
    obj.uuid = obj.uuid || crypto.randomUUID()
    obj.nome = String(obj.nome || '').trim()

    if (!obj.nome) failValidation('Informe o nome do ingrediente.')
    if (hasDuplicateName(produtos.value, obj.nome, obj.uuid)) failValidation('Ja existe um ingrediente com esse nome.')
    if (Number(obj.fator_conversao || 0) <= 0) failValidation('Informe uma quantidade valida na embalagem.')
    if (Number(obj.custo_por_unidade || 0) < 0) failValidation('O preco de compra nao pode ser negativo.')
    if (Number(obj.peso_unitario || 0) < 0) failValidation('O peso por unidade nao pode ser negativo.')
    if (Number(obj.estoque_atual || 0) < 0) failValidation('O estoque atual nao pode ser negativo.')
    if (Number(obj.estoque_minimo || 0) < 0) failValidation('O estoque minimo nao pode ser negativo.')

    const antigo = await db.produtos.get(obj.uuid)
    const precoMudou = !antigo || antigo.custo_por_unidade !== obj.custo_por_unidade

    await db.produtos.put(obj)

    if (precoMudou) {
      await db.historico_precos.add({
        produto_uuid: obj.uuid,
        data: new Date().toISOString(),
        custo_por_unidade: obj.custo_por_unidade
      })
    }

    const i = produtos.value.findIndex(p => p.uuid === obj.uuid)
    if (i >= 0) {
      produtos.value[i] = obj
      notify('Ingrediente atualizado!')
    } else {
      produtos.value.push(obj)
      notify('Ingrediente salvo!')
    }
    agendarSync()
    return obj
  }

  async function excluirProduto(uuid) {
    if (!uuid) return console.error('Tentativa de excluir produto sem UUID')
    const uso = contarUsoProduto(uuid)
    if (uso.total) failValidation(`Nao foi possivel excluir este ingrediente porque ele ainda esta em uso em ${formatarUso(uso)}.`)
    await db.produtos.delete(uuid)
    produtos.value = produtos.value.filter(p => p.uuid !== uuid)
    notify('Ingrediente removido!')
    agendarSync()
  }

  // ── CRUD: RECEITAS ────────────────────────
  async function salvarReceita(dados) {
    const obj = clean(dados)
    obj.uuid = obj.uuid || crypto.randomUUID()
    obj.nome = String(obj.nome || '').trim() // Normalizar nome antes de salvar
    obj.categoria = normalizeReceitaCategoria(obj.categoria)

    if (!obj.nome) failValidation('Informe o nome da receita.')
    if (hasDuplicateName(receitas.value, obj.nome, obj.uuid)) failValidation('Ja existe uma receita com esse nome.')
    if (Number(obj.rendimento || 0) <= 0) failValidation('Informe um rendimento maior que zero.')
    if (Number(obj.preco_sugerido || 0) < 0) failValidation('O preco sugerido nao pode ser negativo.')
    if (Number(obj.peso_unitario || 0) < 0) failValidation('O peso por unidade nao pode ser negativo.')

    const ingredientes = Array.isArray(obj.ingredientes) ? obj.ingredientes : []
    if (!ingredientes.length) failValidation('Adicione pelo menos um ingrediente a receita.')

    const temIngredienteInvalido = ingredientes.some(ing => !ing?.id || Number(ing.quantidade || 0) <= 0)
    if (temIngredienteInvalido) failValidation('Revise os ingredientes: cada item precisa ter nome e quantidade maior que zero.')

    await db.receitas.put(obj)
    const i = receitas.value.findIndex(r => r.uuid === obj.uuid)
    if (i >= 0) {
      receitas.value[i] = obj
      notify('Receita atualizada!')
    } else {
      receitas.value.push(obj)
      notify('Receita criada!')
    }
    agendarSync()
    return obj
  }

  function normalizeReceitaCategoria(categoria) {
    return categoria === 'Nenhuma' ? '' : categoria
  }

  async function excluirReceita(uuid) {
    if (!uuid) return console.error('Tentativa de excluir receita sem UUID')
    const uso = contarUsoReceita(uuid)
    if (uso.total) failValidation(`Nao foi possivel excluir esta receita porque ela ainda esta em uso em ${formatarUso(uso)}.`)
    await db.receitas.delete(uuid)
    receitas.value = receitas.value.filter(r => r.uuid !== uuid)
    notify('Receita removida!')
    agendarSync()
  }

  // ── PRODUÇÃO ──────────────────────────────
  async function registrarProducao(dados) {
    const obj = clean(dados)
    obj.uuid = obj.uuid || crypto.randomUUID()
    obj.data_producao = obj.data_producao || new Date().toISOString()
    obj.data_inicio = obj.data_inicio || null
    obj.data_fim = obj.data_fim || null
    // O campo ingredientes_snapshot deve vir preenchido da View
    try {
      await db.producoes.put(obj)
      producoes.value.unshift(obj) // Adiciona reativamente para atualização imediata
      agendarSync()
    } catch (error) {
      console.error('Erro ao salvar produção no IndexedDB:', obj, error)
      throw new Error(`Falha ao salvar produção: ${error.message}`) // Re-lança para ser pego pelo registrarLoteProducao
    }
    return obj
  }

  async function atualizarLoteProducao(dataProducaoOriginal, novosDados) {
    const itensLote = producoes.value.filter(p => p.data_producao === dataProducaoOriginal)
    if (!itensLote.length) return

    const duracaoTotal = novosDados.tempo_real_min || 0

    // 1. Redistribuição proporcional do tempo total entre os itens do lote
    let tempoDistribuido = {}
    if (duracaoTotal > 0) {
      const tempoTeoricoTotal = itensLote.reduce((acc, item) => {
        const r = receitas.value.find(rec => rec.uuid === item.receita_id)
        const qtd = item.quantidade_produzida || item.quantidade || 1
        return acc + ((qtd / (r?.rendimento || 1)) * (r?.tempo_preparo_min || 0))
      }, 0)

      itensLote.forEach(item => {
        const r = receitas.value.find(rec => rec.uuid === item.receita_id)
        const qtd = item.quantidade_produzida || item.quantidade || 1
        const teoricoItem = (qtd / (r?.rendimento || 1)) * (r?.tempo_preparo_min || 0)
        const prop = tempoTeoricoTotal > 0 ? (teoricoItem / tempoTeoricoTotal) : (1 / itensLote.length)
        tempoDistribuido[item.receita_id] = duracaoTotal * prop
      })
    }

    // 2. Prepara os objetos limpos (sem Proxies) para o banco de dados
    const atualizados = itensLote.map(item => {
      const cleanedItem = clean(item); // Garante que o item original é um objeto puro
      const rId = cleanedItem.receita_id;
      const tempoItem = tempoDistribuido[rId] || 0;
      const r = receitas.value.find(rec => rec.uuid === rId);
      const qtd = cleanedItem.quantidade_produzida || cleanedItem.quantidade || 1;

      const novoCustoSnapshot = r
        ? getCustoProducaoReceita(r, qtd, tempoItem) / qtd
        : cleanedItem.custo_unitario_snapshot;

      return clean({ // Aplica clean novamente para o objeto final
        ...cleanedItem, // Espalha as propriedades do item já limpo
        data_producao: cleanedItem.data_producao, // Garante que data_producao permanece como o identificador original do lote
        data_inicio: novosDados.data_inicio || dataProducaoOriginal,
        data_fim: novosDados.data_fim || dataProducaoOriginal,
        tempo_real_min: tempoItem,
        custo_unitario_snapshot: novoCustoSnapshot,
        preco_unitario_snapshot: cleanedItem.preco_unitario_snapshot ?? (r?.preco_sugerido || 0),
        custo_snapshot_version: 2
      });
    });

    try {
      await db.producoes.bulkPut(atualizados)
      await carregarProducoes(0)
      notify('Lote atualizado com sucesso!')
      agendarSync()
    } catch (error) {
      console.error('Erro ao atualizar lote:', error)
      notify('Falha ao salvar no banco de dados.', 'error')
    }
  }

  async function registrarLoteProducao(itens) {
    for (const item of itens) {
      try {
        await registrarProducao(item)
      } catch (error) {
        console.error('Erro ao registrar item de produção:', item, error)
        notify(`Erro ao registrar item de produção: ${error.message}`, 'error')
      }
    }
    await carregarProducoes(0) // Recarrega todas as produções para garantir que a lista esteja atualizada
  }

  // ── Ações do Cronômetro ───────────────────
  function startTimer(loteId) {
    if (timer.value.activeLoteId !== loteId) {
      // Se mudou de lote, reseta o anterior
      timer.value.accumulatedMs = 0
    }
    timer.value.activeLoteId = loteId
    timer.value.startTime = Date.now()
    timer.value.isRunning = true
    configSet('active_timer', timer.value)
    startTicker()
  }

  function startTicker() {
    if (tickerId) return
    tickerId = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  function pauseTimer() {
    if (!timer.value.isRunning) return
    timer.value.accumulatedMs += Date.now() - timer.value.startTime
    timer.value.isRunning = false
    configSet('active_timer', timer.value)
    clearInterval(tickerId); tickerId = null
  }

  async function stopTimer() {
    const totalMs = timer.value.isRunning
      ? timer.value.accumulatedMs + (Date.now() - timer.value.startTime)
      : timer.value.accumulatedMs

    const totalMin = Math.round(totalMs / 60000)
    const loteId = timer.value.activeLoteId

    if (loteId && totalMin > 0) {
      await atualizarLoteProducao(loteId, {
        data_fim: new Date().toISOString(),
        tempo_real_min: totalMin
      })
    }

    resetTimer()
  }

  function resetTimer() {
    timer.value = { isRunning: false, startTime: null, accumulatedMs: 0, activeLoteId: null }
    configSet('active_timer', null)
    clearInterval(tickerId); tickerId = null
  }

  const timerDisplay = computed(() => {
    const _tick = now.value // Força re-cálculo a cada segundo
    if (!timer.value.activeLoteId && !timer.value.isRunning) return null

    let currentMs = timer.value.accumulatedMs
    if (timer.value.isRunning && timer.value.startTime) {
      currentMs += Date.now() - timer.value.startTime
    }

    const totalSeconds = Math.floor(currentMs / 1000)
    const totalMinutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (totalMinutes < 60) {
      // Menos de 1h: mostra MM:SS
      return `${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    } else {
      // 1h ou mais: mostra Xh YYmin
      const hours = Math.floor(totalMinutes / 60)
      const mins = totalMinutes % 60
      return mins > 0 ? `${hours}h ${String(mins).padStart(2, '0')}min` : `${hours}h`
    }
  })

    async function baixarEstoqueInsumos(listaUso) {
    const updates = []
    for (const item of listaUso) {
      const prod = produtos.value.find(p => p.uuid === item.id)
      if (prod) {
        const novoEstoque = (prod.estoque_atual || 0) - item.total
        prod.estoque_atual = novoEstoque
        updates.push(db.produtos.update(prod.uuid, { estoque_atual: novoEstoque }))
      }
    }
    if (updates.length) {
      await Promise.all(updates)
      agendarSync()
    }
  }

  async function recomporEstoqueInsumos(producao) {
    if (!producao.ingredientes_snapshot) return
    
    const updates = []
    const fator = (producao.quantidade_produzida || producao.quantidade || 0) / 1 // O snapshot já costuma estar escalado ou guardamos a base
    // Para garantir precisão, usamos a mesma lógica de expansão
    const mapaResgate = {}
    expandirIngredientes(producao.ingredientes_snapshot, fator, mapaResgate)

    for (const id in mapaResgate) {
      const prod = produtos.value.find(p => p.uuid === id)
      if (prod) {
        const novoEstoque = (prod.estoque_atual || 0) + mapaResgate[id].total
        prod.estoque_atual = novoEstoque
        updates.push(db.produtos.update(prod.uuid, { estoque_atual: novoEstoque }))
      }
    }
    if (updates.length) {
      await Promise.all(updates)
      agendarSync()
    }
  }

  async function retomarLoteNaCozinha(dataProducao) {
    const itens = producoes.value.filter(p => p.data_producao === dataProducao)
    if (!itens.length) return

    // Converte de volta para o formato de modelagem da cozinha
    cozinhaLote.value = itens.map(p => {
      const r = receitas.value.find(rec => rec.uuid === p.receita_id)
      return {
        receita_id: p.receita_id,
        nome: p.nome_receita || p.receita_nome,
        qtd_produzir: p.quantidade_produzida || p.quantidade,
        rendimento_base: r?.rendimento || 1,
        unidade: p.unidade_rendimento,
        peso_unitario: r?.peso_unitario || 0,
        peso_total: (p.quantidade_produzida || p.quantidade) * (r?.peso_unitario || 0),
        eh_intermediaria: p.eh_intermediaria,
        ingredientes: p.ingredientes_snapshot || r?.ingredientes || [],
        aberto: false
      }
    })
    cozinhaChecklist.value = {}
    loteOriginalEmEdicao.value = dataProducao
    salvarCozinhaLocal()

    notify('Lote carregado na Cozinha para edição!')
    setTab('cozinha')
  }

  async function estornarProducao(uuid) {
    if (!uuid) return console.error('Tentativa de estornar produção sem UUID')
    const p = await db.producoes.get(uuid)
    if (p) {
      await recomporEstoqueInsumos(p)
      await db.producoes.delete(uuid)
      producoes.value = producoes.value.filter(item => item.uuid !== uuid)
      notify('Produção estornada e insumos devolvidos ao estoque!')
    }
  }

  async function estornarLotePorData(dataProducao) {
    const itens = producoes.value.filter(p => p.data_producao === dataProducao)
    if (!itens.length) return
    
    for (const p of itens) {
      // Se não era apenas agendado, devolve os insumos ao estoque antes de excluir
      if (!p.agendado) {
        await recomporEstoqueInsumos(p)
      }
    }
    
    const ids = itens.map(p => p.uuid)
    await db.producoes.bulkDelete(ids)
    producoes.value = producoes.value.filter(p => !ids.includes(p.uuid))
    agendarSync()
  }

  /**
   * Adiciona itens a um lote já existente (data_producao = loteId).
   * Cada item segue o mesmo formato de registrarProducao.
   */
  async function adicionarItensAoLote(loteId, novosItens) {
    for (const item of novosItens) {
      const r = receitas.value.find(rec => rec.uuid === item.receita_id)
      if (!r) continue
      const obj = clean({
        ...item,
        uuid: crypto.randomUUID(),
        data_producao: loteId,
        data_inicio: null,
        data_fim: null,
        tempo_real_min: 0,
        ingredientes_snapshot: JSON.parse(JSON.stringify(r.ingredientes || [])),
        custo_unitario_snapshot: getCustoProducaoReceita(r, item.quantidade_produzida, null) / (item.quantidade_produzida || 1),
        preco_unitario_snapshot: r.preco_sugerido || 0,
        custo_snapshot_version: 2
      })
      await db.producoes.put(obj)
      producoes.value.unshift(obj)
    }
    await carregarProducoes(0)
    notify('Itens adicionados ao lote!')
    agendarSync()
  }

  /**
   * Edita um item individual de produção (quantidade e/ou nome).
   */
  async function editarItemProducao(uuid, dados) {
    const idx = producoes.value.findIndex(p => p.uuid === uuid)
    if (idx === -1) return
    const atual = clean(producoes.value[idx])
    const r = receitas.value.find(rec => rec.uuid === atual.receita_id)
    const qtd = dados.quantidade_produzida ?? atual.quantidade_produzida
    const novoCusto = r ? getCustoProducaoReceita(r, qtd, atual.tempo_real_min || null) / (qtd || 1) : atual.custo_unitario_snapshot
    const atualizado = clean({
      ...atual,
      ...dados,
      quantidade_produzida: qtd,
      custo_unitario_snapshot: novoCusto,
      custo_snapshot_version: 2
    })
    await db.producoes.put(atualizado)
    producoes.value.splice(idx, 1, atualizado)
    notify('Item atualizado!')
    agendarSync()
  }

  // ── CONFIG ────────────────────────────────
  function saveCompany(data) {
    company.value = { ...company.value, ...data }
    configSet('company', company.value)
    agendarSync()
  }

  function saveContasFinanceiras(contas = []) {
    const normalizadas = contas
      .map(normalizarContaFinanceira)
      .filter(conta => conta.nome && conta.banco)
    contasFinanceiras.value = normalizadas
    configSet('contas_financeiras', normalizadas)
    agendarSync()
  }

  // ── LÓGICA DE NEGÓCIO (Cálculos de Custos e Pesos) ───────────

  /** Custo por unidade de medida (ex: preço por grama) */
  function getPrecoUnitarioInsumo(prod) {
    if (!prod || !prod.fator_conversao) return 0
    return (prod.custo_por_unidade || 0) / prod.fator_conversao
  }

  /**
   * Calcula a média real de tempo gasto para uma receita baseada no histórico de produções.
   * Retorna o tempo em minutos para o rendimento padrão da receita.
   */
  function getMediaTempoReceita(receitaId) {
    const historico = producoes.value.filter(p =>
      p.receita_id === receitaId &&
      p.tempo_real_min > 0 &&
      (p.quantidade_produzida || p.quantidade) > 0
    )
    if (!historico.length) return 0

    const r = receitas.value.find(rec => rec.uuid === receitaId)
    if (!r) return 0

    const somaTempos = historico.reduce((acc, p) => acc + p.tempo_real_min, 0)
    const somaQtds = historico.reduce((acc, p) => acc + (p.quantidade_produzida || p.quantidade), 0) // Sum of produced quantities

    return (somaTempos / somaQtds) * (r.rendimento || 1)
  }

  /**
   * Retorna os ingredientes para produção, com explosão inteligente:
   * Se o item principal for FINAL e usar uma BASE, expande a base em 1 nível.
   * @param {Object} recipe - A receita sendo produzida
   * @param {number} factor - Fator de escala para as quantidades
   * @returns {Object} Um mapa de ingredientes diretos agrupados.
   */
  function getProductionIngredients(recipe, factor) {
    const mapa = {}
    if (!recipe || !recipe.ingredientes) return mapa

    for (const ing of recipe.ingredientes) {
      const qtdEscalada = (ing.quantidade || 0) * factor
      if (qtdEscalada <= 0) continue

      const alvo = ing.tipo === 'receita'
        ? receitas.value.find(x => x.uuid === ing.id)
        : produtos.value.find(p => p.uuid === ing.id)
      if (!alvo) continue

      const key = `${ing.tipo}-${ing.id}`
      if (!mapa[key]) {
        mapa[key] = {
          id: ing.id, tipo: ing.tipo, nome: alvo.nome, total: 0,
          unidade: ing.tipo === 'receita' ? alvo.unidade_rendimento : alvo.unidade_base,
          subIngredientes: []
        }
      }
      mapa[key].total += qtdEscalada

      // Se for uma sub-receita, carregamos seus ingredientes diretos para o "sub menu"
      if (ing.tipo === 'receita' && alvo.ingredientes) {
        const subFator = qtdEscalada / (alvo.rendimento || 1)
        alvo.ingredientes.forEach(sub => {
          const subAlvo = sub.tipo === 'receita' 
            ? receitas.value.find(x => x.uuid === sub.id) 
            : produtos.value.find(p => p.uuid === sub.id)
          if (!subAlvo || isInsumoSemPeso(subAlvo.nome)) return

          const existingSub = mapa[key].subIngredientes.find(s => s.id === sub.id)
          if (existingSub) {
            existingSub.total += (sub.quantidade || 0) * subFator
          } else {
            mapa[key].subIngredientes.push({
              id: sub.id,
              nome: subAlvo.nome,
              total: (sub.quantidade || 0) * subFator,
              unidade: sub.tipo === 'receita' ? subAlvo.unidade_rendimento : subAlvo.unidade_base
            })
          }
        })
      }
    }
    return mapa
  }

  function getCustoTotal(recipe, visitados = new Set(), cache = new Map(), tempoManual = null) {
    if (!recipe || !recipe.ingredientes) return 0
    const uuid = recipe.uuid || 'temp'
    if (cache.has(uuid)) return cache.get(uuid)
    if (uuid !== 'temp' && visitados.has(uuid)) return 0
    if (uuid !== 'temp') visitados.add(uuid)

    let totalIngredientes = 0
    for (const ing of recipe.ingredientes) {
      const qtd = Number(ing.quantidade || 0)
      if (qtd <= 0) continue

      if (ing.tipo === 'receita') {
        const sub = receitas.value.find(x => x.uuid === ing.id)
        if (!sub || !sub.rendimento) continue
        totalIngredientes += (getCustoTotal(sub, visitados, cache) / sub.rendimento) * qtd
      } else {
        const prod = produtos.value.find(p => p.uuid === ing.id)
        totalIngredientes += getPrecoUnitarioInsumo(prod) * qtd
      }
    }

    const totalGeral = totalIngredientes + getCustoMaoDeObra(recipe, tempoManual)
    if (uuid !== 'temp') cache.set(uuid, totalGeral)
    return totalGeral
  }

  function getCustoProducaoReceita(recipe, quantidade, tempoManual = null) {
    if (!recipe) return 0

    const qtd = Number(quantidade || 0)
    if (qtd <= 0) return 0

    const rendimento = Number(recipe.rendimento || 1) || 1
    const fator = qtd / rendimento
    const custoPadrao = getCustoTotal(recipe)

    if (tempoManual === null || tempoManual === undefined) {
      return custoPadrao * fator
    }

    const maoDeObraPadrao = getCustoMaoDeObra(recipe)
    const custoSemMaoDeObraDireta = custoPadrao - maoDeObraPadrao
    return (custoSemMaoDeObraDireta * fator) + getCustoMaoDeObra(recipe, tempoManual)
  }

  function getCustoMaoDeObra(recipe, tempoManual = null) {
    const tempo = tempoManual !== null ? tempoManual : (recipe?.tempo_preparo_min || 0)
    if (tempo > 0 && company.value.custo_hora_trabalho > 0) {
      return (tempo / 60) * company.value.custo_hora_trabalho
    }
    return 0
  }

  /** 
   * Explode uma receita em seus insumos básicos de forma recursiva.
   * Útil para Dashboard e Cozinha.
   */
  function expandirIngredientes(ingredientes, fator, mapa = {}, visitados = new Set()) {
    for (const ing of ingredientes) {
      const qtdEscalada = (ing.quantidade || 0) * fator
      if (qtdEscalada <= 0) continue

      if (ing.tipo === 'receita') {
        const sub = receitas.value.find(x => x.uuid === ing.id)
        if (!sub || !sub.rendimento || visitados.has(sub.uuid)) continue

        const novosVisitados = new Set(visitados)
        novosVisitados.add(sub.uuid)

        expandirIngredientes(sub.ingredientes || [], qtdEscalada / sub.rendimento, mapa, novosVisitados)
      } else {
        const prod = produtos.value.find(p => p.uuid === ing.id)
        if (!prod) continue // Should not happen if data is clean

        if (!mapa[prod.uuid]) {
          mapa[prod.uuid] = { id: prod.uuid, nome: prod.nome, total: 0, unidade: prod.unidade_base }
        }
        mapa[prod.uuid].total += qtdEscalada
      }
    }
    return mapa
  }

  /** Informações de lucratividade de uma receita */
  function getLucroInfo(recipe) {
    const custoTotal = getCustoTotal(recipe)
    const rendimento = Number(recipe.rendimento || 1) || 1
    const custoUnit = custoTotal / rendimento
    const venda = Number(recipe.preco_sugerido || 0)
    const valor = venda - custoUnit
    const percentual = venda > 0 ? (valor / venda) * 100 : 0
    return { valor, percentual, custoUnit, custoTotal }
  }

  /** Soma o peso físico de todos os ingredientes de uma receita */
  function getPesoTotal(recipe) {
    if (!recipe || !recipe.ingredientes) return 0
    return recipe.ingredientes.reduce((acc, ing) => {
      const qtd = Number(ing.quantidade || 0)
      if (qtd <= 0) return acc

      const alvo = ing.tipo === 'receita'
        ? receitas.value.find(x => x.uuid === ing.id)
        : produtos.value.find(x => x.uuid === ing.id)

      // Prioridade total à escolha manual (gera_peso), senão fallback por tipo/nome
      let soma = ing.gera_peso ?? true
      if (alvo?.tipo === 'embalagem') soma = false // Embalagens não somam peso
      if (alvo && isInsumoSemPeso(alvo.nome)) soma = false

      if (!soma) return acc

      if (ing.tipo === 'produto') {
        // Se unidade e tem peso definido, soma peso. Senão assume que a qtd é o peso (g/ml)
        if (alvo?.unidade_base === 'un' && (alvo.peso_unitario || 0) > 0) {
          return acc + (qtd * alvo.peso_unitario)
        }
        return acc + qtd
      } else {
        const unit = String(alvo?.unidade_rendimento || '').toLowerCase()
        if (unit === 'g') return acc + qtd
        if (unit === 'kg') return acc + (qtd * 1000)
        if (unit === 'un') {
          const pw = Number(alvo?.peso_unitario || 0)
          return acc + (pw > 0 ? (qtd * pw) : qtd)
        }
        return acc + qtd
      }
    }, 0)
  }

  const resumoFinanceiroPorMes = computed(() => {
    const meses = new Map()

    financeiro.value.forEach(item => {
      const mesRef = item.mes_ref || getMesRef(item.data) // Use getMesRef from utils
      if (!mesRef) return

      if (!meses.has(mesRef)) {
        meses.set(mesRef, {
          mes_ref: mesRef,
          total: 0,
          quantidade: 0,
          entradas: 0,
          receitas_mei: 0,
          renda_pessoal: 0,
          saidas_operacionais: 0,
          saidas_insumos: 0,    // Novo: Rastreador específico de insumos
          saidas_das_mei: 0,    // Novo: Rastreador específico de DAS
          saidas_pessoais: 0,
          rendimento_financeiro: 0
        })
      }

      const atual = meses.get(mesRef)
      const valor = Number(item.valor || 0)

      // Para conciliação, total e quantidade incluem tudo
      atual.total += valor
      atual.quantidade += 1

      if (item.natureza === 'interna') return

      if (item.natureza === 'entrada') {
        atual.entradas += valor
        if (item.categoria === 'Rendimento Financeiro') {
          atual.rendimento_financeiro += valor
        } else {
          atual.receitas_mei += valor
        }
      }
      else if (item.natureza === 'operacional') { // Saídas operacionais
        atual.saidas_operacionais -= valor
        
        // Identifica Insumos e DAS para provisionamento específico
        const cat = item.categoria || ''
        if (cat.includes('Insumos')) {
          atual.saidas_insumos -= valor
        } else if (cat === 'DAS-MEI' || cat === 'Impostos e Contribuições') {
          atual.saidas_das_mei -= valor
        }
      }
      else if (item.natureza === 'pessoal') {
        if (valor > 0) {
          atual.entradas += valor
          atual.renda_pessoal += valor
        } else {
          atual.saidas_pessoais += Math.abs(valor)
        }
      }
    })

    return [...meses.values()].sort((a, b) => {
      const [mesA, anoA] = a.mes_ref.split('/')
      const [mesB, anoB] = b.mes_ref.split('/')
      return `${anoB}${mesB}`.localeCompare(`${anoA}${mesA}`)
    })
  })

  const totalRecebidoAnoAtual = computed(() => {
    const anoAtual = String(new Date().getFullYear())
    return resumoFinanceiroPorMes.value
      .filter(item => item.mes_ref.endsWith(`/${anoAtual}`))
      .reduce((acc, item) => acc + Number(item.receitas_mei || 0), 0)
  })

  const relatorioMensalMei = computed(() => {
    return resumoFinanceiroPorMes.value.map(item => ({
      ...item,
      // Tudo que entrou mas NÃO é receita MEI nem rendimento financeiro (ex: Renda Pessoal, pensão, etc.)
      outras_entradas_nao_mei: Math.max(0,
        Number(item.entradas || 0) - Number(item.receitas_mei || 0) - Number(item.rendimento_financeiro || 0)
      ),
      saldo_operacional: Number(item.receitas_mei || 0) - Number(item.saidas_operacionais || 0),
      saldo_mes: Number(item.entradas || 0) - Number(item.saidas_operacionais || 0) - Number(item.saidas_pessoais || 0),
      get renda_per_capita() {
        const num = Math.max(1, company.value.pessoas_familia || 1)
        const familiarTotal = this.saldo_operacional + this.outras_entradas_nao_mei
        return familiarTotal / num
      }
    }))
  })

  const mediaDespesas3Meses = computed(() => {
    const meses = relatorioMensalMei.value.slice(0, 3)
    if (!meses.length) return 0
    const total = meses.reduce((acc, m) => acc + (m.saidas_operacionais || 0), 0)
    return total / meses.length
  })

  /** Média específica apenas de Insumos (últimos 3 meses) */
  const mediaInsumos3Meses = computed(() => {
    const meses = relatorioMensalMei.value.slice(0, 3)
    if (!meses.length) return 0
    return meses.reduce((acc, m) => acc + (m.saidas_insumos || 0), 0) / meses.length
  })

  /** Média específica do DAS-MEI (últimos 3 meses) */
  const mediaDasMei3Meses = computed(() => {
    const meses = relatorioMensalMei.value.slice(0, 3)
    if (!meses.length) return 0
    return meses.reduce((acc, m) => acc + (m.saidas_das_mei || 0), 0) / meses.length
  })

  /**
   * Sugestão de provisionamento focada apenas no operacional crítico:
   * Média de Insumos + Média de DAS-MEI (arredondado para cima)
   */
  const sugestaoProvisionamentoMensal = computed(() => {
    const totalCritico = mediaInsumos3Meses.value + mediaDasMei3Meses.value
    if (totalCritico <= 0) return 0
    // Arredonda para a próxima dezena (ex: 452 -> 460) para dar uma margem de segurança
    return Math.ceil(totalCritico / 10) * 10
  })

  /** 
   * Sugestão de capital de giro (Giro de Segurança):
   * Se houver valor manual definido em Ajustes, usa ele. Senão calcula a média semanal.
   */
  const sugestaoProvisionamentoSemanal = computed(() => {
    if (company.value.reserva_operacional_fixa > 0) return company.value.reserva_operacional_fixa
    return Math.ceil((sugestaoProvisionamentoMensal.value / 4.5) / 5) * 5
  })

  const reservaEmergenciaSugerida = computed(() => mediaDespesas3Meses.value * 3)

  /**
   * Resumo do tempo de produção e custo de mão de obra por mês.
   * Calcula o total de minutos trabalhados e o custo associado para cada mês
   * com base nas produções registradas e no custo da hora de trabalho configurado.
   */
  const resumoProducaoPorMes = computed(() => {
    const meses = new Map()
    const custoHora = company.value.custo_hora_trabalho || 0

    // 1. Inicializa com todos os meses que têm movimentação financeira (A Verdade do Banco)
    relatorioMensalMei.value.forEach(m => {
      meses.set(m.mes_ref, {
        mes_ref: m.mes_ref,
        total_tempo_min: 0,
        total_tempo_horas: 0,
        custo_mao_de_obra_total: 0,
        unidades_produzidas: 0,
        lucro_logado_producao: 0,
        // O "Real" gerado para o seu bolso é o Saldo Operacional (Receitas MEI - Despesas Empresa)
        total_gerado_retirada: m.saldo_operacional || 0,
        receitas_reais_banco: m.receitas_mei || 0,
        despesas_reais_banco: m.saidas_operacionais || 0
      })
    })

    // 2. Mescla os dados de produção registrados (O seu esforço cronometrado)
    producoes.value.forEach(prod => {
      const mesRef = getMesRef(prod.data_producao)
      if (!mesRef) return

      if (!meses.has(mesRef)) {
        meses.set(mesRef, {
          mes_ref: mesRef, total_tempo_min: 0, total_tempo_horas: 0,
          custo_mao_de_obra_total: 0, unidades_produzidas: 0,
          total_gerado_retirada: 0, receitas_reais_banco: 0, despesas_reais_banco: 0,
          lucro_logado_producao: 0
        })
      }

      const m = meses.get(mesRef);
      const qtdRaw = prod.quantidade_produzida || prod.quantidade || 0;
      const validQtd = isNaN(Number(qtdRaw)) ? 0 : Number(qtdRaw);
      
      m.total_tempo_min += Number(prod.tempo_real_min || 0);
      m.unidades_produzidas += validQtd;

      // Lucro estimado da produção (Preço Snapshot - Custo Snapshot)
      const pVenda = Number(prod.preco_unitario_snapshot || 0);
      const cTotal = Number(prod.custo_unitario_snapshot || 0);
      m.lucro_logado_producao += (pVenda - cTotal) * validQtd;
    })

    // 3. Finaliza cálculos de custo de mão de obra
    meses.forEach(mes => {
      mes.total_tempo_horas = mes.total_tempo_min / 60
      mes.custo_mao_de_obra_total = mes.total_tempo_horas * custoHora
      
      // Indicador de Saúde: Quanto o negócio pagou por hora trabalhada de fato
      // Se sobrou 1000 reais e trabalhei 10 horas, minha hora real foi R$ 100.
      mes.valor_hora_real = mes.total_tempo_horas > 0 
        ? mes.total_gerado_retirada / mes.total_tempo_horas 
        : 0

      // Identifica se houve lucro no banco além do que foi registrado na produção
      // Útil para o cenário onde a esposa produz e não registra no cronômetro
      const lucroBanco = mes.total_gerado_retirada;
      mes.tem_ganhos_nao_registrados = lucroBanco > (mes.lucro_logado_producao * 1.15); // Mais de 15% de diferença
    })

    return [...meses.values()].sort((a, b) => {
      const [mesA, anoA] = a.mes_ref.split('/')
      const [mesB, anoB] = b.mes_ref.split('/')
      return `${anoB}${mesB}`.localeCompare(`${anoA}${mesA}`)
    })
  })

  return {
    // UI
    tab, loading, toast,
    setTab, notify,
    activeLoteName,

    // Dados
    produtos, receitas, producoes, financeiro, contasFinanceiras,
    timer, timerDisplay, startTimer, pauseTimer, stopTimer, resetTimer,

    // Config
    company, googleDriveAvailable, googleDriveConfigured, saveCompany, saveContasFinanceiras,

    // Ações
    init, carregarProducoes, registrarProducao, atualizarLoteProducao, adicionarItensAoLote, editarItemProducao,
    registrarLoteProducao, estornarProducao, salvarProduto, excluirProduto, retomarLoteNaCozinha,
    salvarReceita, excluirReceita, getCustoTotal, getLucroInfo, getPesoTotal,
    insumosCriticos, baixarEstoqueInsumos, cozinhaLote, cozinhaChecklist, salvarCozinhaLocal,
    hasLocalChanges, recomporEstoqueInsumos, historicoPrecoProduto, estornarLotePorData,
    loteOriginalEmEdicao,
    producaoFiltroAtivo, producaoBusca,
    getPrecoUnitarioInsumo, getMediaTempoReceita, getProductionIngredients,
    getCustoProducaoReceita, getCustoMaoDeObra, expandirIngredientes,
    carregarFinanceiro, importarLancamentosFinanceiros,
    atualizarLancamentoFinanceiro, atualizarLancamentosEmLote,
    limparFinanceiro, limparFinanceiroPorBanco, reclassificarTodosFinanceiro,

    backupGeral, backupGoogleDrive, restaurarGeral, restaurarGoogleDrive, restaurarGoogleDriveBak,
    conectarGoogleDrive, desconectarGoogleDrive,
    syncStatus, iniciarSync, syncImediato,

    // Analytics e Resumos
    resumoFinanceiroPorMes, totalRecebidoAnoAtual, relatorioMensalMei,
    resumoProducaoPorMes, mediaDespesas3Meses, 
    mediaInsumos3Meses, mediaDasMei3Meses,
    sugestaoProvisionamentoMensal, sugestaoProvisionamentoSemanal, reservaEmergenciaSugerida,

    // Helpers e Constantes
    getContaFinanceiraById, getContasFinanceirasPorBanco,
    CATEGORIAS_MEI
  }
})