import { defineStore } from "pinia"
import { ref, computed } from 'vue'
import { db, configGet, configSet, exportarDados, garantirPersistencia, migrateLegacyDbIfNeeded } from './db.js' // Removed getMesRef, normalizar
import {
  isGoogleDriveBackupConfigured,
  isGoogleDriveBackupConnected,
  lerContaGoogleEmCache,
} from './services/googleDriveBackup.js'
import { normalizar, getMesRef } from './utils.js'
import { useConfirm } from './composables/useConfirm.js'
import { normalizarPerfis } from './store/perfis.js'
import { criarRegrasFinanceiras } from './store/financeiroRegras.js'
import { criarCustos } from './store/custos.js'
import { criarAnalytics } from './store/analytics.js'
import { criarCronometro } from './store/cronometro.js'
import { criarBackup } from './store/backup.js'
import { criarSync } from './store/sync.js'

export { PERFIS_PADRAO, MODULOS_VALIDOS } from './store/perfis.js'

export const useStore = defineStore('choco', () => {
  // Confirmação de ações destrutivas (mesmo modal usado em outras telas,
  // ex.: zerar dados) — usado aqui antes de qualquer restauração de
  // backup, porque restaurar sobrescreve TODOS os dados na hora, sem
  // como desfazer fora de outro backup.
  const confirmarAcao = useConfirm()

  // ── UI ─────────────────────────────────────
  const tab = ref('painel')
  const loading = ref(false)
  const toast = ref(null)
  // Ponte para abrir a tela de Etiquetas com sabores pré-selecionados (vindo de Produção)
  const etiquetasPreSelecao = ref(null) // [{ texto, qtd }] | null

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
  const producaoBusca = ref('')

  const {
    timer,
    activeLoteName,
    startTimer,
    startTicker,
    pauseTimer,
    stopTimer,
    resetTimer,
    timerDisplay
  } = criarCronometro({
    producoes,
    atualizarLoteProducao: (...args) => atualizarLoteProducao(...args)
  })

  // ── Config ────────────────────────────────
  const company = ref({
    nome: '', // vazio = telas usam um nome genérico até a loja preencher em Ajustes
    slogan: 'Registro de Produção',
    logo: null, // dataURL (base64, PNG) do logotipo enviado — null usa o ícone padrão
    posicao_etiqueta: 0,
    contato_etiqueta: '', // texto livre exibido na etiqueta (whatsapp/instagram)
    whatsapp_pedidos: '', // número (com DDD, formatado tipo "(21) 99999-0000") usado no link do WhatsApp do cardápio interativo — quem consome (numeroWhatsAppFormatado, chavePixDoWhatsapp) já limpa a formatação sozinho
    mostrar_hora_venda: true, // se falso, mensagens de WhatsApp da Caderneta (comprovante/cobrança) omitem o horário da venda — útil pra quem lança fiado fora da hora real da compra
    instagram: '', // usuário do Instagram (sem @) — aparece em Meu contato (Caderneta), no vCard/QR e no cardápio interativo
    razao_social: '',
    cnpj: '',
    cpf: '',
    municipio: '',
    uf: '',
    cnae: '',
    teto_mei_anual: 81000,
    custo_hora_trabalho: 0, // Valor por hora (ex: 25.50)
    meta_salario_mensal: 0,    // Meta de retirada/salário mensal desejado (vale a partir do mês em que foi definida — ver meta_salario_historico)
    meta_salario_historico: [], // [{ mes: 'MM/YYYY', valor }] — registro de quando a meta mudou, pra não alterar meses já passados
    reserva_operacional_fixa: 0, // Valor manual para o Giro de Segurança (ex: 600), vale a partir do mês em que foi definido
    reserva_operacional_historico: [] // [{ mes: 'MM/YYYY', valor }] — idem, pro Giro de Segurança
  })

  const perfis = ref(normalizarPerfis())

  // Usado na tela de seleção de perfil: enquanto não há nenhum dado real
  // (instalação nova, ou app recém-limpo), escondemos os perfis extras
  // pré-definidos (Produção/Financeiro, que vêm de fábrica em
  // PERFIS_PADRAO) e mostramos um jeito rápido de restaurar dados ali
  // mesmo, sem precisar entrar em Admin → Ajustes → Backup primeiro.
  const bancoVazio = computed(() =>
    produtos.value.length === 0 &&
    receitas.value.length === 0 &&
    producoes.value.length === 0 &&
    financeiro.value.length === 0
  )
  // Modo da tela "Compras" no Painel: 'lista' (padrão) = planejamento de
  // compras e custo estimado, sem depender de quantidade em mãos. 'estoque'
  // = controle de estoque de verdade (críticos por mínimo + filtra pelo que
  // já tem). Fica salvo pra poder trocar no futuro sem perder nada.
  const modoListaCompras = ref('lista')
  // A lista de compras em si (itens, marcados, valores ajustados) — fica
  // salva de verdade, não é recalculada do zero toda vez que abre o app.
  const listaComprasSalva = ref(null)


  const googleDriveConnected = ref(isGoogleDriveBackupConnected())
  const googleDriveAvailable = computed(() => isGoogleDriveBackupConfigured())
  const googleDriveConfigured = computed(() => googleDriveAvailable.value && googleDriveConnected.value)

  // ── Saúde do backup ───────────────────────
  // Quando foi o último envio ao Drive (config 'sync_ts', salvo no banco) e a última
  // exportação manual DESTE aparelho (localStorage — não entra no backup de propósito:
  // um .json baixado em outro aparelho não protege este).
  const MANUAL_TS_KEY = 'ChocoBete-backup-manual-ts'
  const ultimoSyncTs = ref(null)
  const backupManualTs = ref((() => { try { return localStorage.getItem(MANUAL_TS_KEY) } catch { return null } })())
  const contaGoogle = ref(lerContaGoogleEmCache())   // { nome, email } da conta conectada
  const infoBackupDrive = ref(null)        // { modifiedTime, tamanhoPrincipal, versoes, tamanhoTotal }
  const tamanhoDadosBytes = ref(null)      // tamanho do backup gerado agora, em bytes

  async function atualizarStatusBackup() {
    try { ultimoSyncTs.value = await configGet('sync_ts', null) } catch { /* sem dado */ }
  }
  function marcarBackupManual() {
    const agora = new Date().toISOString()
    backupManualTs.value = agora
    try { localStorage.setItem(MANUAL_TS_KEY, agora) } catch { /* sem localStorage */ }
  }

  /** Mede quanto pesa o backup completo (o mesmo JSON enviado ao Drive). */
  async function medirTamanhoDados() {
    try {
      const dados = await exportarDados()
      tamanhoDadosBytes.value = new Blob([JSON.stringify(dados)]).size
    } catch { tamanhoDadosBytes.value = null }
  }

  /** Aviso de segurança dos dados, ou null quando está tudo em dia. */
  const alertaBackup = computed(() => {
    const diasDesde = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 86_400_000 : Infinity
    const manual = diasDesde(backupManualTs.value)
    if (googleDriveConfigured.value) {
      const d = diasDesde(ultimoSyncTs.value)
      if (d > 2) {
        return {
          acao: 'drive',
          msg: Number.isFinite(d)
            ? `Último backup no Drive há ${Math.floor(d)} dias.`
            : 'Ainda não há backup no Drive.',
        }
      }
      return null
    }
    if (googleDriveAvailable.value) {
      return manual <= 7 ? null : { acao: 'manual', msg: 'Google Drive desconectado — seus dados só estão neste aparelho.' }
    }
    return manual <= 7 ? null : { acao: 'manual', msg: 'Faz mais de 7 dias que você não baixa um backup dos seus dados.' }
  })


  const clean = (obj) => JSON.parse(JSON.stringify(obj))
  const {
    normalizarContaFinanceira,
    getContaFinanceiraById,
    getContasFinanceirasPorBanco,
    resolverContaFinanceira,
    CATEGORIAS_MEI_PADRAO,
    categoriasFinanceiro,
    regrasCategoriaFinanceiro,
    aprenderRegraCategoria,
    remapearRegrasCategoria,
    regrasDescricaoFinanceiro,
    aprenderRegraDescricao,
    reconciliarTransferenciasInternas,
    classificarLancamentoFinanceiro,
    getAssinaturasDuplicidadeFinanceiro,
    normalizarLancamentoFinanceiro
  } = criarRegrasFinanceiras({ contasFinanceiras })

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

  function inferirCategoriaReceita(receita) {
    const nome = String(receita?.nome || '')
    const n = normalizar(nome)
    if (n.includes('trufa')) return 'Trufa'
    if (n.includes('cone')) return 'Cone'
    if (n.includes('barra')) return 'Barra'
    if (n.includes('brownie')) return 'Brownie'
    if (n.includes('bolo')) return 'Bolo'
    if (n.includes('ovo')) return 'Ovo'
    if (n.includes('recheio')) return 'Base'
    return ''
  }

  function normalizarReceitaCarregada(receita) {
    const categoriaOriginal = String(receita?.categoria || '').trim()
    const categoriaFinal = categoriaOriginal === 'Festa'
      ? inferirCategoriaReceita(receita)
      : (categoriaOriginal === 'Nenhuma' ? '' : categoriaOriginal)

    const tamanhoAtual = String(receita?.tamanho || '').trim()
    const tamanhoFinal = categoriaOriginal === 'Festa' && !tamanhoAtual
      ? 'Festa'
      : tamanhoAtual

    return {
      ...receita,
      categoria: categoriaFinal === 'Nenhuma' ? '' : categoriaFinal,
      tamanho: tamanhoFinal
    }
  }

  // ── INIT ──────────────────────────────────
  async function init() {
    await migrateLegacyDbIfNeeded()
    await garantirPersistencia()
    loading.value = true
    try {
      const [p, r, pr, fin, cfg, perfisCfg, contasCfg, categoriasCfg, regrasCategoriaCfg, regrasDescricaoCfg, pendenteSalvo] = await Promise.all([
        db.produtos.toArray(),
        db.receitas.toArray(),
        db.producoes.toArray(), // Carrega todas as produções para o resumoProducaoPorMes
        db.financeiro.orderBy('data').reverse().toArray(),
        configGet('company'),
        configGet('perfis_app'),
        configGet('contas_financeiras'),
        configGet('categorias_financeiro'),
        configGet('regras_categoria_financeiro'),
        configGet('regras_descricao_financeiro'),
        configGet('sync_pending', false)
      ])
      // Restaura a marca de "mudança pendente" de uma sessão anterior —
      // sem isso, fechar o app antes de sincronizar fazia o aviso sumir e
      // o próximo pull do Drive podia sobrescrever essa mudança sem avisar.
      if (pendenteSalvo) hasLocalChanges.value = true
      carregarSnapshotsSeguranca()
      const receitasCarregadas = (Array.isArray(r) ? r : []).map(normalizarReceitaCarregada)
      const receitasComAlteracoes = receitasCarregadas.filter((receita, index) => {
        const original = (Array.isArray(r) ? r : [])[index] || {}
        return (original.categoria || '') !== (receita.categoria || '') || (original.tamanho || '') !== (receita.tamanho || '')
      })
      if (receitasComAlteracoes.length) {
        await db.receitas.bulkPut(receitasComAlteracoes)
      }
      if (Array.isArray(categoriasCfg) && categoriasCfg.length) {
        categoriasFinanceiro.value = categoriasCfg
      }
      if (regrasCategoriaCfg && typeof regrasCategoriaCfg === 'object') {
        regrasCategoriaFinanceiro.value = regrasCategoriaCfg
      }
      if (regrasDescricaoCfg && typeof regrasDescricaoCfg === 'object') {
        regrasDescricaoFinanceiro.value = regrasDescricaoCfg
      }
      produtos.value = p
      receitas.value = receitasCarregadas
      producoes.value = pr
      financeiro.value = fin
      
      await atualizarStatusBackup()
      cozinhaLote.value = await configGet('cozinha_lote', [])
      cozinhaChecklist.value = await configGet('cozinha_checklist', {})
      loteOriginalEmEdicao.value = await configGet('cozinha_lote_original', null)
      modoListaCompras.value = await configGet('modo_lista_compras', 'lista')
      listaComprasSalva.value = await configGet('lista_compras_salva', null)

      if (cfg) company.value = { ...company.value, ...cfg }
      perfis.value = normalizarPerfis(perfisCfg)
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
          descricao: item.descricao_original || item.descricao,
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
    // Garante que a pasta de backup local (se configurada) tenha uma cópia atual
    agendarBackupLocal()
  }

  const {
    syncStatus,
    hasLocalChanges,
    dadosVersao,
    agendarSync,
    agendarBackupLocal,
    salvarBackupLocalAgora,
    snapshotsSeguranca,
    carregarSnapshotsSeguranca,
    _guardarSnapshot,
    restaurarSnapshotSeguranca,
    descartarSnapshotSeguranca,
    _aposRestauracaoManual,
    _aplicarVersaoDoDrive,
    resolverConflitoSync,
    iniciarSync,
    syncImediato
  } = criarSync({
    notify,
    googleDriveConfigured,
    ultimoSyncTs,
    confirmarAcao,
    company,
    regrasDescricaoFinanceiro,
    regrasCategoriaFinanceiro,
    receitas,
    produtos,
    producoes,
    perfis,
    modoListaCompras,
    listaComprasSalva,
    loteOriginalEmEdicao,
    financeiro,
    cozinhaLote,
    cozinhaChecklist,
    contasFinanceiras,
    categoriasFinanceiro,
    atualizarStatusBackup,
    normalizarContaFinanceira,
    normalizarReceitaCarregada
  })

  const {
    backupGeral,
    backupAgora,
    backupGoogleDrive,
    restaurarGeral,
    restaurarGoogleDrive,
    historicoDrive,
    carregandoHistoricoDrive,
    carregarHistoricoDrive,
    restaurarGoogleDriveVersao,
    recuperandoDados,
    suportaPastaBackupLocal,
    recuperarDeGoogleDrive,
    recuperarDaPastaLocal,
    recuperarDeArquivoLocal,
    carregarContaGoogle,
    conectarGoogleDrive,
    desconectarGoogleDrive
  } = criarBackup({
    notify, googleDriveConfigured, googleDriveAvailable, googleDriveConnected, contaGoogle,
    confirmarAcao, _guardarSnapshot, _aposRestauracaoManual, ultimoSyncTs, syncStatus,
    marcarBackupManual, iniciarSync, infoBackupDrive, _aplicarVersaoDoDrive
  })

  // ── PRODUÇÕES ─────────────────────────────
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
    mensagem: `Parece que cerca de ${qtdEstimada} un de ${receitaMaisComum.nome} foram produzidas sem registrar`
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

  // Guarda o lote da última importação de extrato (sessão atual) para permitir desfazer.
  const ultimaImportacao = ref(null)

  async function desfazerUltimaImportacao() {
    const lote = ultimaImportacao.value
    if (!lote || !lote.ids?.length) {
      notify('Não há nenhuma importação recente para desfazer.', 'warning')
      return false
    }
    await db.financeiro.bulkDelete(lote.ids)
    ultimaImportacao.value = null
    await carregarFinanceiro()
    agendarSync()
    notify(`Importação desfeita: ${lote.ids.length} lançamento(s) removido(s).`)
    return true
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

    let idsNovos = []
    if (novos.length) {
      idsNovos = await db.financeiro.bulkAdd(novos, { allKeys: true })
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

    ultimaImportacao.value = idsNovos.length
      ? { ids: idsNovos, banco: novos[0]?.banco || null, quando: new Date().toISOString() }
      : null

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
    // Chave estável para aprendizado: a descrição ORIGINAL do banco (não a já
    // padronizada), pra que a regra continue batendo com novas importações.
    const descricaoOriginalChave = lancamento.descricao_original || lancamento.descricao
    const novaDescricao = typeof dadosAtualizacao.descricao === 'string' ? dadosAtualizacao.descricao.trim() : ''
    const descricaoMudou = novaDescricao && novaDescricao !== lancamento.descricao

    const atualizado = {
      ...lancamento,
      ...dadosAtualizacao,
      ...(descricaoMudou ? { descricao: novaDescricao, descricao_original: descricaoOriginalChave } : {}),
      natureza: dadosAtualizacao.categoria
        ? (categoriasFinanceiro.value.find(c => c.nome === dadosAtualizacao.categoria)?.natureza ?? lancamento.natureza)
        : (dadosAtualizacao.natureza ?? lancamento.natureza),
      editado_manualmente: true
    }
    await db.financeiro.put(atualizado)
    if (dadosAtualizacao.categoria) {
      aprenderRegraCategoria(descricaoOriginalChave, dadosAtualizacao.categoria)
    }
    if (descricaoMudou) {
      aprenderRegraDescricao(descricaoOriginalChave, novaDescricao)
    }
    await carregarFinanceiro()
    notify(descricaoMudou && dadosAtualizacao.categoria ? 'Lançamento atualizado!' : (descricaoMudou ? 'Descrição atualizada!' : 'Categoria atualizada!'))
    agendarSync()
  }

  async function atualizarLancamentosEmLote(ids, dadosAtualizacao) {
    if (!ids.length) return
    const lancamentos = await db.financeiro.where('id').anyOf(ids).toArray()
    const naturezaCategoria = dadosAtualizacao.categoria
      ? (categoriasFinanceiro.value.find(c => c.nome === dadosAtualizacao.categoria)?.natureza ?? null)
      : null
    const novaDescricao = typeof dadosAtualizacao.descricao === 'string' ? dadosAtualizacao.descricao.trim() : ''
    const atualizados = lancamentos.map(item => ({
      ...item,
      ...dadosAtualizacao,
      ...(novaDescricao ? { descricao: novaDescricao, descricao_original: item.descricao_original || item.descricao } : {}),
      natureza: naturezaCategoria ?? dadosAtualizacao.natureza ?? item.natureza,
      editado_manualmente: true
    }))
    await db.financeiro.bulkPut(atualizados)
    const chavesOriginais = new Set(lancamentos.map(item => item.descricao_original || item.descricao))
    if (dadosAtualizacao.categoria) {
      chavesOriginais.forEach(desc => aprenderRegraCategoria(desc, dadosAtualizacao.categoria))
    }
    if (novaDescricao) {
      chavesOriginais.forEach(desc => aprenderRegraDescricao(desc, novaDescricao))
    }
    await carregarFinanceiro()
    notify(`${ids.length} lançamento(s) atualizados!`)
    agendarSync()
  }

  function salvarCozinhaLocal() {
    configSet('cozinha_lote', cozinhaLote.value)
    configSet('cozinha_checklist', cozinhaChecklist.value)
    configSet('cozinha_lote_original', loteOriginalEmEdicao.value)
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

  // ── Histórico de PREÇO DE VENDA das receitas (preco_sugerido) ──
  // Separado do historico_precos (que é o custo de COMPRA dos ingredientes).
  // Registrado toda vez que o preco_sugerido muda, seja editando direto na
  // tela de Receitas, seja pelo Cardápio (que mantém os dois sincronizados).
  async function historicoPrecoVenda(receitaUuid) {
    return await db.historico_precos_venda
      .where('receita_uuid')
      .equals(receitaUuid)
      .sortBy('data')
  }

  async function registrarHistoricoPrecoVenda(receitaUuid, preco, origem = 'receitas') {
    await db.historico_precos_venda.add({
      receita_uuid: receitaUuid,
      data: new Date().toISOString(),
      preco: Number(preco || 0),
      origem, // 'receitas' | 'cardapio:<id>' — de onde veio a alteração
    })
  }

  /**
   * Atualiza só o preco_sugerido de uma receita já existente, sem passar
   * pela validação completa de salvarReceita (usado pelo Cardápio, que só
   * mexe no preço — os ingredientes/rendimento continuam intactos). Mantém
   * o preço sincronizado nos dois lugares e registra no histórico por data.
   */
  async function sincronizarPrecoReceita(receitaUuid, novoPreco, origem = 'cardapio') {
    const atual = await db.receitas.get(receitaUuid)
    if (!atual) return null
    const precoNovo = Number(novoPreco || 0)
    if (Number(atual.preco_sugerido || 0) === precoNovo) return atual // nada mudou

    const obj = { ...atual, preco_sugerido: precoNovo }
    await db.receitas.put(obj)
    await registrarHistoricoPrecoVenda(receitaUuid, precoNovo, origem)

    const i = receitas.value.findIndex(r => r.uuid === receitaUuid)
    if (i >= 0) receitas.value[i] = obj

    agendarSync()
    return obj
  }

  // ── CRUD: INGREDIENTES (produtos) ────────
  // `meta` (opcional): { quantidade_comprada, valor_pago } — informado pela tela de
  // compra pra o histórico registrar exatamente o que foi comprado e pago.
  async function salvarProduto(dados, meta = {}) {
    const obj = clean(dados)
    obj.uuid = obj.uuid || crypto.randomUUID()
    obj.nome = String(obj.nome || '').trim()

    if (!obj.nome) failValidation('Informe o nome do ingrediente.')
    if (hasDuplicateName(produtos.value, obj.nome, obj.uuid)) failValidation('Ja existe um ingrediente com esse nome.')
    if (Number(obj.fator_conversao || 0) <= 0) failValidation('Informe uma quantidade valida na embalagem.')
    if (Number(obj.custo_por_unidade || 0) < 0) failValidation('O preco de compra nao pode ser negativo.')
    if (Number(obj.peso_unitario || 0) < 0) failValidation('O peso por unidade nao pode ser negativo.')
    // Insumos que ficaram negativos por baixas antigas: normaliza para 0 em vez de travar a edição
    if (Number(obj.estoque_atual || 0) < 0 && !(meta?.quantidade_comprada > 0)) {
      const ant = await db.produtos.get(obj.uuid)
      if (ant && Number(ant.estoque_atual || 0) === Number(obj.estoque_atual)) obj.estoque_atual = 0
    }
    if (Number(obj.estoque_atual || 0) < 0) failValidation('O estoque atual nao pode ser negativo.')
    if (Number(obj.estoque_minimo || 0) < 0) failValidation('O estoque minimo nao pode ser negativo.')

    const antigo = await db.produtos.get(obj.uuid)
    const estoqueAntigo = antigo ? Number(antigo.estoque_atual || 0) : 0
    const estoqueNovo = Number(obj.estoque_atual || 0)
    const qtdMeta = Number(meta?.quantidade_comprada || 0)
    const quantidadeComprada = qtdMeta > 0 ? qtdMeta : estoqueNovo - estoqueAntigo
    const houveEntradaEstoque = quantidadeComprada > 0 && (qtdMeta > 0 || estoqueNovo > estoqueAntigo)
    const precoMudou = !antigo || antigo.custo_por_unidade !== obj.custo_por_unidade

    await db.produtos.put(obj)

    // Registra no historico toda vez que o preco mudar OU que uma compra/entrada
    // de estoque for feita (aumento do estoque_atual) - antes so registrava
    // quando o preco mudava, entao compras repetidas pelo mesmo preco sumiam.
    if (precoMudou || houveEntradaEstoque) {
      const fatorHist = Number(obj.fator_conversao || 0)
      const precoUnitHist = fatorHist > 0 ? Number(obj.custo_por_unidade || 0) / fatorHist : null
      const valorPagoMeta = Number(meta?.valor_pago || 0)
      await db.historico_precos.add({
        produto_uuid: obj.uuid,
        data: new Date().toISOString(),
        // preço da EMBALAGEM cadastrada (mantido por compatibilidade)
        custo_por_unidade: obj.custo_por_unidade,
        // preço por unidade-base (g/ml/un) — comparável entre compras
        preco_unitario: precoUnitHist,
        quantidade_comprada: houveEntradaEstoque ? quantidadeComprada : null,
        // quanto foi realmente pago nesta compra
        valor_pago: houveEntradaEstoque
          ? (valorPagoMeta > 0 ? valorPagoMeta : (precoUnitHist ? precoUnitHist * quantidadeComprada : null))
          : null,
        estoque_apos: estoqueNovo
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
    obj.usar_em_etiquetas = obj.usar_em_etiquetas ?? !Number(obj.eh_intermediaria)

    if (!obj.nome) failValidation('Informe o nome da receita.')
    if (hasDuplicateName(receitas.value, obj.nome, obj.uuid)) failValidation('Ja existe uma receita com esse nome.')
    if (Number(obj.rendimento || 0) <= 0) failValidation('Informe um rendimento maior que zero.')
    if (Number(obj.preco_sugerido || 0) < 0) failValidation('O preco sugerido nao pode ser negativo.')
    if (Number(obj.peso_unitario || 0) < 0) failValidation('O peso por unidade nao pode ser negativo.')

    const ingredientes = Array.isArray(obj.ingredientes) ? obj.ingredientes : []
    if (!ingredientes.length) failValidation('Adicione pelo menos um ingrediente a receita.')

    const temIngredienteInvalido = ingredientes.some(ing => !ing?.id || Number(ing.quantidade || 0) <= 0)
    if (temIngredienteInvalido) failValidation('Revise os ingredientes: cada item precisa ter nome e quantidade maior que zero.')

    const antiga = await db.receitas.get(obj.uuid)
    const precoVendaMudou = Number(antiga?.preco_sugerido || 0) !== Number(obj.preco_sugerido || 0)

    await db.receitas.put(obj)
    // Registra no histórico de preço de venda toda vez que o preco_sugerido
    // muda (mesma lógica do histórico de custo dos ingredientes) — assim dá
    // pra acompanhar a evolução do preço por data, de onde quer que venha a edição.
    if (precoVendaMudou && Number(obj.preco_sugerido || 0) > 0) {
      await registrarHistoricoPrecoVenda(obj.uuid, obj.preco_sugerido, 'receitas')
    }
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
    let algumSuspeito = false
    const atualizados = itensLote.map(item => {
      const cleanedItem = clean(item); // Garante que o item original é um objeto puro
      const rId = cleanedItem.receita_id;
      const tempoItem = tempoDistribuido[rId] || 0;
      const r = receitas.value.find(rec => rec.uuid === rId);
      const qtd = cleanedItem.quantidade_produzida || cleanedItem.quantidade || 1;

      // Confere o tempo cronometrado contra o tempo padrão da receita: se estiver
      // muito acima do esperado (ex.: cronômetro esquecido ligado), o custeio usa
      // o tempo padrão em vez do bruto, evitando inflar a mão de obra do lote.
      const avaliacao = avaliarTempoProducao(r, tempoItem, qtd)
      if (avaliacao.suspeito) algumSuspeito = true

      const novoCustoSnapshot = r
        ? getCustoProducaoReceita(r, qtd, avaliacao.tempo) / qtd
        : cleanedItem.custo_unitario_snapshot;

      return clean({ // Aplica clean novamente para o objeto final
        ...cleanedItem, // Espalha as propriedades do item já limpo
        data_producao: novosDados.data_producao_nova || cleanedItem.data_producao,
        data_inicio: novosDados.data_inicio || dataProducaoOriginal,
        data_fim: novosDados.data_fim || dataProducaoOriginal,
        tempo_real_min: avaliacao.tempo,
        tempo_registrado_bruto_min: avaliacao.tempoBruto,
        tempo_suspeito: avaliacao.suspeito,
        custo_unitario_snapshot: novoCustoSnapshot,
        preco_unitario_snapshot: cleanedItem.preco_unitario_snapshot ?? (r?.preco_sugerido || 0),
        custo_snapshot_version: 2
      });
    });

    try {
      await db.producoes.bulkPut(atualizados)
      await carregarProducoes(0)
      if (algumSuspeito) {
        notify('Tempo registrado ficou bem acima do padrão da receita (possível cronômetro esquecido ligado). Usamos o tempo padrão no custo deste lote — se o tempo real informado estiver correto, edite o horário de início/fim do lote.', 'warning', 6000)
      } else {
        notify('Lote atualizado com sucesso!')
      }
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

  async function atualizarLoteFinanceiro(dataProducao, gerarFinanceiro, origem = 'bete') {
    const itens = producoes.value.filter(p => p.data_producao === dataProducao)
    if (!itens.length) return

    for (const item of itens) {
      const atualizado = clean({
        ...item,
        gerar_financeiro: gerarFinanceiro,
        origem: gerarFinanceiro
          ? (item.origem === 'bete' ? undefined : item.origem)
          : (item.origem || origem)
      })
      await db.producoes.put(atualizado)
      const idx = producoes.value.findIndex(p => p.uuid === item.uuid)
      if (idx !== -1) {
        producoes.value.splice(idx, 1, atualizado)
      }
    }
    agendarSync()
    await carregarProducoes(0)
  }


    async function baixarEstoqueInsumos(listaUso) {
    const updates = []
    for (const item of listaUso) {
      const prod = produtos.value.find(p => p.uuid === item.id)
      if (prod) {
        // Trava em zero: estoque negativo impediria salvar/editar o insumo depois
        const novoEstoque = Math.max(0, (prod.estoque_atual || 0) - item.total)
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
    // Mesma escala usada na baixa (Cozinha): quantidade produzida ÷ rendimento da receita.
    // O snapshot guarda os ingredientes para UM rendimento da receita, não por unidade.
    // Registros novos gravam `rendimento_base`; os antigos usam o rendimento atual da receita.
    const rec = receitas.value.find(r => r.uuid === producao.receita_id)
    const rendimentoBase = Number(producao.rendimento_base) || Number(rec?.rendimento) || 1
    const fator = (producao.quantidade_produzida || producao.quantidade || 0) / rendimentoBase
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

  // Cancela a correção em andamento sem precisar entrar na Cozinha.
  // Descarta o rascunho local (cozinhaLote) e destrava o lote no Histórico.
  function cancelarEdicaoLote() {
    cozinhaLote.value = []
    cozinhaChecklist.value = {}
    loteOriginalEmEdicao.value = null
    salvarCozinhaLocal()
    notify('Edição cancelada')
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

  function savePerfis(data) {
    perfis.value = normalizarPerfis(data)
    configSet('perfis_app', perfis.value)
    agendarSync()
  }

  function saveModoListaCompras(modo) {
    modoListaCompras.value = modo === 'estoque' ? 'estoque' : 'lista'
    configSet('modo_lista_compras', modoListaCompras.value)
    agendarSync()
  }

  /** Salva a lista de compras (itens, marcados, valores) local + sync. */
  function salvarListaComprasLocal(lista) {
    listaComprasSalva.value = lista
    configSet('lista_compras_salva', lista)
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

  // ── CATEGORIAS FINANCEIRAS (edição/lista de lançamentos) ──────
  // OBS: isso só afeta como os lançamentos são rotulados e organizados
  // no app (não tem relação com mes_ref nem com nada usado no relatório
  // fiscal/MEI, que continua fixo por data e mês-calendário).

  /**
   * Cria uma nova categoria ou edita uma existente (passe `nomeOriginal`
   * para editar). Se o nome for alterado, todos os lançamentos que já
   * usavam o nome antigo são atualizados automaticamente para o novo nome
   * — assim nada fica "órfão" ou deixa de aparecer marcado na edição.
   */
  async function salvarCategoriaFinanceiro(dados, nomeOriginal = null) {
    const nova = {
      nome: String(dados.nome || '').trim(),
      natureza: dados.natureza || 'operacional',
      grupo: dados.grupo || 'Negócio',
      icon: dados.icon || 'fa-tag'
    }
    if (!nova.nome) return

    const lista = categoriasFinanceiro.value.slice()
    const idxExistenteMesmoNome = lista.findIndex(c => c.nome === nova.nome && c.nome !== nomeOriginal)
    if (idxExistenteMesmoNome !== -1) {
      notify('Já existe uma categoria com esse nome.', 'error')
      return
    }

    if (nomeOriginal) {
      const idx = lista.findIndex(c => c.nome === nomeOriginal)
      if (idx !== -1) lista[idx] = nova
      else lista.push(nova)
    } else {
      lista.push(nova)
    }
    categoriasFinanceiro.value = lista
    await configSet('categorias_financeiro', lista)

    // Renomeou? Atualiza os lançamentos antigos para o novo nome/natureza,
    // e também as regras aprendidas — senão elas continuam apontando pro
    // nome antigo e param de bater nas próximas importações.
    if (nomeOriginal && nomeOriginal !== nova.nome) {
      remapearRegrasCategoria({ [nomeOriginal]: nova.nome })
      const afetados = financeiro.value.filter(item => item.categoria === nomeOriginal)
      if (afetados.length) {
        const atualizados = afetados.map(item => ({ ...item, categoria: nova.nome, natureza: nova.natureza }))
        await db.financeiro.bulkPut(atualizados)
        financeiro.value = await db.financeiro.orderBy('data').reverse().toArray()
        notify(`Categoria renomeada! ${afetados.length} lançamento(s) atualizado(s).`)
      } else {
        notify('Categoria salva!')
      }
    } else {
      notify('Categoria salva!')
    }
    agendarSync()
  }

  /**
   * Remove uma categoria da lista. Lançamentos que já usavam essa
   * categoria NÃO são apagados — passam a usar "Outras Despesas" ou
   * "Outras Receitas" (conforme a natureza), pra continuar visíveis e
   * editáveis.
   */
  async function excluirCategoriaFinanceiro(nome) {
    const cat = categoriasFinanceiro.value.find(c => c.nome === nome)
    if (!cat) return

    categoriasFinanceiro.value = categoriasFinanceiro.value.filter(c => c.nome !== nome)
    await configSet('categorias_financeiro', categoriasFinanceiro.value)

    const substituta = cat.natureza === 'entrada' ? 'Outras Receitas' : 'Outras Despesas'
    const naturezaSubstituta = cat.natureza === 'entrada' ? 'entrada' : 'operacional'
    // Regras aprendidas que apontavam pra esta categoria passam a apontar
    // pra substituta, senão a próxima importação com a mesma descrição cai
    // de novo na classificação automática e pode sair com outro nome ainda.
    remapearRegrasCategoria({ [nome]: substituta })

    const afetados = financeiro.value.filter(item => item.categoria === nome)
    if (afetados.length) {
      const atualizados = afetados.map(item => ({ ...item, categoria: substituta, natureza: naturezaSubstituta }))
      await db.financeiro.bulkPut(atualizados)
      financeiro.value = await db.financeiro.orderBy('data').reverse().toArray()
      notify(`Categoria removida. ${afetados.length} lançamento(s) movido(s) para "${substituta}".`)
    } else {
      notify('Categoria removida!')
    }
    agendarSync()
  }

  /** Restaura a lista de categorias para o padrão de fábrica. */
  async function restaurarCategoriasFinanceiroPadrao() {
    // Qualquer regra aprendida que aponte pra uma categoria personalizada
    // que não existe mais no padrão fica órfã — removê-la evita que uma
    // futura importação "acerte" uma categoria sem correspondência na lista.
    const nomesPadrao = new Set(CATEGORIAS_MEI_PADRAO.map(c => c.nome))
    const substituicoes = {}
    for (const nomeAtual of Object.values(regrasCategoriaFinanceiro.value)) {
      if (!nomesPadrao.has(nomeAtual)) substituicoes[nomeAtual] = null
    }
    remapearRegrasCategoria(substituicoes)

    categoriasFinanceiro.value = CATEGORIAS_MEI_PADRAO.map(c => ({ ...c }))
    await configSet('categorias_financeiro', categoriasFinanceiro.value)
    notify('Categorias restauradas para o padrão!')
    agendarSync()
  }

  const {
    getPrecoUnitarioInsumo,
    getMediaTempoReceita,
    getProductionIngredients,
    getCustoTotal,
    getCustoProducaoReceita,
    getCustoMaoDeObra,
    avaliarTempoProducao,
    expandirIngredientes,
    getLucroInfo,
    getPesoTotal
  } = criarCustos({ produtos, receitas, producoes, company })

  const {
    resumoFinanceiroPorMes,
    totalRecebidoAnoAtual,
    relatorioMensalMei,
    mediaInsumos3Meses,
    mediaDasMei3Meses,
    sugestaoProvisionamentoMensal,
    sugestaoProvisionamentoSemanal,
    metaSalarioEm,
    reservaGiroEm,
    resumoProducaoPorMes
  } = criarAnalytics({ financeiro, producoes, receitas, company })

  // ── Gerenciamento de avisos da Análise de Receitas (ignorados) ──
  async function getAnaliseIgnorados() {
    try {
      const arr = await configGet('analise_ignorados', [])
      return Array.isArray(arr) ? arr : []
    } catch (e) {
      return []
    }
  }

  async function setAnaliseIgnorados(arr) {
    await configSet('analise_ignorados', Array.isArray(arr) ? arr : [])
  }

  async function ignorarAnalise(chave) {
    if (!chave) return
    const arr = await getAnaliseIgnorados()
    if (!arr.includes(chave)) {
      arr.push(chave)
      await setAnaliseIgnorados(arr)
    }
  }

  async function desfazerIgnorarAnalise(chave) {
    if (!chave) return
    const arr = await getAnaliseIgnorados()
    const novo = arr.filter(x => x !== chave)
    await setAnaliseIgnorados(novo)
  }

  return {
    // UI
    tab, loading, toast, etiquetasPreSelecao,
    setTab, notify,
    activeLoteName,

    // Dados
    produtos, receitas, producoes, financeiro, contasFinanceiras,
    timer, timerDisplay, startTimer, pauseTimer, stopTimer, resetTimer,
    // Analise de receitas: gerenciamento de ignorados
    getAnaliseIgnorados, ignorarAnalise, desfazerIgnorarAnalise,

    // Config
    company, perfis, modoListaCompras, saveModoListaCompras, listaComprasSalva, salvarListaComprasLocal, googleDriveAvailable, googleDriveConfigured, saveCompany, savePerfis,
    saveContasFinanceiras,

    // Ações
    init, carregarProducoes, registrarProducao, atualizarLoteProducao, atualizarLoteFinanceiro, editarItemProducao,
    registrarLoteProducao, estornarProducao, salvarProduto, excluirProduto, retomarLoteNaCozinha,
    cancelarEdicaoLote,
    salvarReceita, excluirReceita, getCustoTotal, getLucroInfo, getPesoTotal,
    baixarEstoqueInsumos, cozinhaLote, cozinhaChecklist, salvarCozinhaLocal,
    hasLocalChanges, recomporEstoqueInsumos, historicoPrecoProduto, estornarLotePorData,
    historicoPrecoVenda, sincronizarPrecoReceita,
    loteOriginalEmEdicao,
    producaoBusca,
    getPrecoUnitarioInsumo, getMediaTempoReceita, getProductionIngredients,
    getCustoProducaoReceita, getCustoMaoDeObra, expandirIngredientes,
    carregarFinanceiro, importarLancamentosFinanceiros,
    ultimaImportacao, desfazerUltimaImportacao,
    atualizarLancamentoFinanceiro, atualizarLancamentosEmLote,
    limparFinanceiroPorBanco, reclassificarTodosFinanceiro,

    backupGeral, backupGoogleDrive, backupAgora, restaurarGeral, restaurarGoogleDrive,
    alertaBackup, infoBackupDrive, tamanhoDadosBytes, medirTamanhoDados, ultimoSyncTs,
    historicoDrive, carregandoHistoricoDrive, carregarHistoricoDrive, restaurarGoogleDriveVersao,
    snapshotsSeguranca, carregarSnapshotsSeguranca, restaurarSnapshotSeguranca, descartarSnapshotSeguranca,
    resolverConflitoSync, dadosVersao, salvarBackupLocalAgora,
    bancoVazio, recuperandoDados, suportaPastaBackupLocal,
    recuperarDeGoogleDrive, recuperarDaPastaLocal, recuperarDeArquivoLocal,
    conectarGoogleDrive, desconectarGoogleDrive, contaGoogle, carregarContaGoogle,
    syncStatus, iniciarSync, syncImediato, agendarSync,

    // Analytics e Resumos
    resumoFinanceiroPorMes, totalRecebidoAnoAtual, relatorioMensalMei,
    resumoProducaoPorMes,
    mediaInsumos3Meses, mediaDasMei3Meses,
    sugestaoProvisionamentoMensal, sugestaoProvisionamentoSemanal,
    metaSalarioEm, reservaGiroEm,

    // Helpers e Constantes
    getContaFinanceiraById, getContasFinanceirasPorBanco,
    categoriasFinanceiro, salvarCategoriaFinanceiro, excluirCategoriaFinanceiro, restaurarCategoriasFinanceiroPadrao,
    regrasCategoriaFinanceiro,
    regrasDescricaoFinanceiro
  }
})