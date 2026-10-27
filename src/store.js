import { defineStore } from "pinia"
import { ref, computed } from 'vue'
import { db, configGet, configSet, exportarDados, importarDados, garantirPersistencia, migrateLegacyDbIfNeeded } from './db.js' // Removed getMesRef, normalizar
import {
  isGoogleDriveBackupConfigured,
  isGoogleDriveBackupConnected,
  conectarGoogleDriveBackup,
  desconectarGoogleDriveBackup,
  salvarBackupNoDrive,
  lerEstadoRemoto,
  restaurarBackupDoDriveComInfo,
  listarHistoricoDrive,
  getInfoBackupDrive,
  getContaGoogle,
  lerContaGoogleEmCache,
  restaurarVersaoHistoricoDrive
} from './services/googleDriveBackup.js'
import { isProdutoEmbalagem, normalizar, getMesRef, dataHoraBR } from './utils.js'
import { useConfirm } from './composables/useConfirm.js'
import { suportaBackupLocalAutomatico, recuperarEscolhendoPastaBackupLocal, salvarBackupLocalAutomatico } from './services/localBackup.js'
import { salvarSnapshot, listarSnapshots, lerSnapshot, apagarSnapshot, salvarBase, lerBase, apagarBase, assinaturaDeDados } from './services/safetyBackup.js'
import { mesclar, igual } from './services/merge.js'

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

  const now = ref(Date.now())
  let tickerId = null

  // ── Cronômetro Global ──────────────────────
  const timer = ref({
    isRunning: false,
    startTime: null, // Date.now()
    accumulatedMs: 0,
    activeLoteId: null, // ID do grupo (data_producao)
    dataInicioReal: null // Horário real (ISO) em que o timer foi acionado pela 1ª vez neste lote
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

  // ── Sync automático ───────────────────────
  // 'idle' | 'syncing' | 'ok' | 'error' | 'conflict'
  const syncStatus = ref('idle')
  const hasLocalChanges = ref(false)
  // Sobe a cada vez que os dados do banco são TROCADOS por uma importação
  // (baixar do Drive, restaurar). Telas que carregam dados uma vez só (ex.:
  // Caderneta) observam isso pra recarregar.
  const dadosVersao = ref(0)

  // Contador de alterações locais. O envio ao Drive anota o valor de antes de
  // exportar e só limpa a marca de "pendente" se o contador não andou durante
  // o envio — senão uma edição feita no meio do upload ficava sem marca e só
  // seria enviada na próxima alteração (ou perdida por um pull).
  let mudancaSeq = 0

  /**
   * Marca que existem alterações locais pendentes de sincronização.
   * Chamado após toda mutação de dados.
   *
   * Além de marcar em memória, persiste no IndexedDB (chave 'sync_pending'):
   * se o app fechar antes do envio, ao reabrir ele lembra que há algo
   * pendente e não baixa do Drive por cima.
   */
  function agendarSync() {
    agendarBackupLocal()
    if (!googleDriveConfigured.value) return
    mudancaSeq++
    if (!hasLocalChanges.value) configSet('sync_pending', true)
    hasLocalChanges.value = true
    // Quando foi a última alteração aqui: desempata um mesmo campo editado nos
    // dois aparelhos (vale o mais recente). No máx. uma gravação a cada 2 s.
    const agora = Date.now()
    if (agora - _ultimoCarimbo > 2000) {
      _ultimoCarimbo = agora
      configSet('sync_last_change', new Date(agora).toISOString())
    }
  }
  let _ultimoCarimbo = 0

  // ── Backup automático em pasta local (File System Access) ──
  // Antes, localBackup.js existia mas nada chamava salvarBackupLocalAutomatico.
  // Agora toda alteração agenda uma gravação (no máximo uma a cada 30 s).
  let _localTimer = null
  const LOCAL_BACKUP_ESPERA_MS = 30_000
  async function _gravarBackupLocal() {
    _localTimer = null
    if (!suportaBackupLocalAutomatico()) return
    try {
      const dados = await exportarDados()
      await salvarBackupLocalAutomatico(dados)
    } catch (e) { console.warn('[backup local] falhou:', e) }
  }
  function agendarBackupLocal() {
    if (!suportaBackupLocalAutomatico() || _localTimer) return
    _localTimer = setTimeout(_gravarBackupLocal, LOCAL_BACKUP_ESPERA_MS)
  }
  /** Grava já (ex.: app indo pro segundo plano), cancelando a espera. */
  async function salvarBackupLocalAgora({ forcar = false } = {}) {
    if (!_localTimer && !forcar) return
    clearTimeout(_localTimer)
    await _gravarBackupLocal()
  }

  // ── Referência ao que está no Drive ────────
  // `sync_remote_ts` = modifiedTime (relógio do Google) do arquivo no Drive
  // na última vez que ESTE aparelho enviou ou baixou. Comparar com o valor
  // atual do Drive diz, sem depender do relógio do celular, se outro aparelho
  // salvou nesse meio-tempo. (Antes comparava com o relógio local, que andava
  // alguns segundos atrás do Drive: o aparelho baixava o próprio backup.)
  async function _remotoMudou(remoto) {
    const ref = await configGet('sync_remote_ts', null)
    if (ref) return remoto.modifiedTime !== ref
    // Instalação anterior a esta versão (sem referência): cai no critério
    // antigo, com 2 min de tolerância pra diferença de relógio.
    const tsLocalStr = await configGet('sync_ts', null)
    if (!tsLocalStr) return true
    return new Date(remoto.modifiedTime).getTime() > new Date(tsLocalStr).getTime() + 120_000
  }

  /** O que passar em `verificarContra` ao enviar: o modifiedTime que vimos
   *  por último; '' se há divergência já conhecida; undefined se não há
   *  arquivo no Drive ainda. */
  async function _baseParaEnvio() {
    const ref = await configGet('sync_remote_ts', null)
    if (ref) return ref
    const remoto = await lerEstadoRemoto()
    if (!remoto) return undefined
    return (await _remotoMudou(remoto)) ? '' : remoto.modifiedTime
  }

  /** Registra que este aparelho e o Drive estão iguais agora: guarda a
   *  referência do Drive e a BASE do próximo merge (`dadosBase` = exatamente o
   *  que está nos dois lados). */
  async function _registrarSyncOk(remoteTs, seq, dadosBase) {
    const tsAgora = new Date().toISOString()
    await configSet('sync_ts', tsAgora)
    ultimoSyncTs.value = tsAgora
    if (remoteTs) await configSet('sync_remote_ts', remoteTs)
    if (dadosBase) await salvarBase(dadosBase)
    if (seq === mudancaSeq) {
      hasLocalChanges.value = false
      await configSet('sync_pending', false)
    }
  }

  async function _registrarSyncBaixado(remoteTs, dadosBase) {
    const tsAgora = new Date().toISOString()
    await configSet('sync_ts', tsAgora)
    ultimoSyncTs.value = tsAgora
    if (remoteTs) await configSet('sync_remote_ts', remoteTs)
    if (dadosBase) await salvarBase(dadosBase)
    hasLocalChanges.value = false
    await configSet('sync_pending', false)
  }

  // ── Fila de envios ─────────────────────────
  // Só um envio por vez; pedidos que chegam durante um envio viram UM envio
  // extra depois. Sem isso, dois uploads concorrentes (a Bete dispara um por
  // ação) podiam terminar fora de ordem e a foto mais velha sobrescrever a nova.
  let _syncRodando = false
  let _syncPediuDeNovo = false
  let _resolvendoConflito = false
  let _arquivarSempreNoProximo = false

  async function _executarSync({ manual = false, arquivarSempre = false } = {}) {
    if (!googleDriveConfigured.value) return
    if (arquivarSempre) _arquivarSempreNoProximo = true
    // Com conflito aberto, envios automáticos esperam — só o toque manual
    // (que abre a decisão) segue.
    if (syncStatus.value === 'conflict' && !manual) return
    if (_syncRodando) { _syncPediuDeNovo = true; return }

    _syncRodando = true
    let resultado = 'ok'
    try {
      do {
        _syncPediuDeNovo = false
        const arquivar = _arquivarSempreNoProximo
        _arquivarSempreNoProximo = false
        resultado = await _sincronizar({ arquivarSempre: arquivar })
      } while (_syncPediuDeNovo && resultado === 'ok')
    } finally {
      _syncRodando = false
    }
    if (resultado === 'conflict') await resolverConflitoSync()
  }

  const MARCA_MIGRACAO = { chave: '__legacy_migrated__', valor: true }
  const comMarcaMigracao = (dados) => {
    const cfg = Array.isArray(dados.config) ? dados.config : []
    return cfg.some(r => r.chave === MARCA_MIGRACAO.chave) ? dados : { ...dados, config: [...cfg, { ...MARCA_MIGRACAO }] }
  }

  /**
   * Sincronização de duas vias com MERGE (Fase 2).
   *
   * 1. Lê o estado local e o do Drive.
   * 2. Drive igual ao que este aparelho viu na última vez → só envia se houver
   *    algo novo aqui.
   * 3. Drive mudou (outro aparelho salvou) → baixa e faz o merge de 3 vias
   *    (base = último ponto em comum, local, Drive): o trabalho dos dois
   *    aparelhos é juntado, nada é descartado. O resultado é gravado aqui e
   *    enviado ao Drive.
   *
   * Corridas: o merge só é aplicado se o banco local continua exatamente como
   * foi lido (conferido DENTRO da transação de gravação); senão recomeça. O
   * envio confere de novo o Drive logo antes de gravar. Depois de 4 voltas sem
   * convergir, cai na decisão manual (resolverConflitoSync).
   * Devolve 'ok' | 'offline' | 'token' | 'error' | 'conflict'.
   */
  async function _sincronizar({ arquivarSempre = false } = {}) {
    if (!navigator.onLine) {
      syncStatus.value = 'idle'
      return 'offline'
    }
    syncStatus.value = 'syncing'
    try {
      for (let volta = 0; volta < 4; volta++) {
        const seq = mudancaSeq
        const local = await exportarDados()
        const remoto = await lerEstadoRemoto()

        // Drive ainda vazio: sobe o que há aqui.
        if (!remoto) {
          const { modifiedTime } = await salvarBackupNoDrive(local, { arquivarSempre })
          await _registrarSyncOk(modifiedTime, seq, local)
          concluirSyncComAviso('Drive atualizado')
          return 'ok'
        }

        let base = await lerBase()
        const mudou = await _remotoMudou(remoto)

        // Sem base mas em dia com o Drive e sem pendências (ex.: primeira vez
        // depois da atualização do app): o estado atual É o ponto em comum.
        if (!base && !mudou && !hasLocalChanges.value) {
          await salvarBase(local)
          base = { dados: local }
        }
        const localSujo = !base || !igual(local, base.dados)

        if (!mudou) {
          if (!localSujo) {
            // Igual ao último ponto em comum (inclui "editou e desfez"): nada a enviar.
            if (seq === mudancaSeq && hasLocalChanges.value) {
              hasLocalChanges.value = false
              await configSet('sync_pending', false)
            }
            syncStatus.value = 'idle'
            return 'ok'
          }
          try {
            const { modifiedTime } = await salvarBackupNoDrive(local, { verificarContra: remoto.modifiedTime, arquivarSempre })
            await _registrarSyncOk(modifiedTime, seq, local)
            concluirSyncComAviso('Drive atualizado')
            return 'ok'
          } catch (err) {
            if (err?.message === 'CONFLICT') continue // alguém salvou nesse instante: refaz com o merge
            throw err
          }
        }

        // Drive mudou: baixa e junta.
        const { backup: remotoDados, modifiedTime: remotoTs } = await restaurarBackupDoDriveComInfo()
        const ultimaLocalMs = Date.parse(await configGet('sync_last_change', null) || '') || 0
        const preferirLocal = ultimaLocalMs >= (Date.parse(remotoTs || remoto.modifiedTime) || 0)
        const res = mesclar({ base: base?.dados || null, local, remote: remotoDados, preferirLocal })
        const dadosMesclados = comMarcaMigracao(res.dados)

        if (!res.igualAoLocal) {
          // Há dados do outro aparelho entrando: guarda uma cópia antes (só
          // quando este aparelho também tinha alterações suas — o merge de
          // verdade; num simples "baixar" não há nada local a proteger).
          if (localSujo) await _guardarSnapshot('antes de mesclar com o Drive')
          const assinatura = assinaturaDeDados(local)
          try {
            await importarDados(dadosMesclados, { guarda: (atual) => assinaturaDeDados(atual) === assinatura })
          } catch (err) {
            if (err?.message === 'LOCAL_MUDOU') continue // gravaram algo durante o merge: refaz
            throw err
          }
          await _recarregarEstadoAposImport()
          dadosVersao.value++
        }

        if (!res.igualAoRemoto) {
          try {
            const { modifiedTime } = await salvarBackupNoDrive(dadosMesclados, { verificarContra: remotoTs || remoto.modifiedTime, arquivarSempre })
            await _registrarSyncOk(modifiedTime, seq, dadosMesclados)
          } catch (err) {
            if (err?.message === 'CONFLICT') continue
            throw err
          }
        } else {
          await _registrarSyncBaixado(remotoTs || remoto.modifiedTime, dadosMesclados)
        }

        if (!res.igualAoLocal && localSujo) {
          concluirSyncComAviso(
            res.resumo.conflitos
              ? 'Alterações dos dois aparelhos foram juntadas (em itens editados dos dois lados vale o mais recente)'
              : 'Alterações dos dois aparelhos foram juntadas',
            { toast: true }
          )
        } else {
          concluirSyncComAviso('Dados atualizados pelo Drive')
        }
        return 'ok'
      }
      // Não convergiu (mudanças simultâneas sem parar): decisão manual.
      syncStatus.value = 'conflict'
      return 'conflict'
    } catch (err) {
      // TOKEN_NEEDED: sessão expirada, aguarda próximo login explícito sem mostrar erro
      if (err?.message === 'TOKEN_NEEDED') {
        syncStatus.value = 'idle'
        console.info('[sync] Token expirado, aguardando reconexão')
        return 'token'
      }
      if (err?.message === 'OFFLINE') {
        syncStatus.value = 'idle'
        return 'offline'
      }
      console.error('[sync] Falha ao sincronizar com o Drive:', err)
      syncStatus.value = 'error'
      return 'error'
    }
  }

  /** Recarrega os arrays reativos a partir do IndexedDB sem precisar dar
   *  reload na página. Usado depois de qualquer importação de dados (pull do
   *  Drive, restauração de histórico ou de cópia local). Recarrega também as
   *  configurações guardadas em `config` — senão a memória ficava com os
   *  valores antigos e a próxima gravação de uma delas desfazia o import. */
  async function _recarregarEstadoAposImport() {
    await atualizarStatusBackup()
    const [p, r, pr, fin, contasCfg, cfg, perfisCfg, categoriasCfg, regrasCategoriaCfg, regrasDescricaoCfg] = await Promise.all([
      db.produtos.toArray(),
      db.receitas.toArray(),
      db.producoes.toArray(),
      db.financeiro.orderBy('data').reverse().toArray(),
      configGet('contas_financeiras'),
      configGet('company'),
      configGet('perfis_app'),
      configGet('categorias_financeiro'),
      configGet('regras_categoria_financeiro'),
      configGet('regras_descricao_financeiro')
    ])
    const receitasCarregadas = (Array.isArray(r) ? r : []).map(normalizarReceitaCarregada)
    const receitasComAlteracoes = receitasCarregadas.filter((receita, index) => {
      const original = (Array.isArray(r) ? r : [])[index] || {}
      return (original.categoria || '') !== (receita.categoria || '') || (original.tamanho || '') !== (receita.tamanho || '')
    })
    if (receitasComAlteracoes.length) {
      await db.receitas.bulkPut(receitasComAlteracoes)
    }
    produtos.value = p
    receitas.value = receitasCarregadas
    producoes.value = pr
    financeiro.value = fin
    contasFinanceiras.value = Array.isArray(contasCfg)
      ? contasCfg.map(normalizarContaFinanceira).filter(c => c.nome)
      : []
    if (cfg) company.value = { ...company.value, ...cfg }
    perfis.value = normalizarPerfis(perfisCfg)
    if (Array.isArray(categoriasCfg) && categoriasCfg.length) categoriasFinanceiro.value = categoriasCfg
    if (regrasCategoriaCfg && typeof regrasCategoriaCfg === 'object') regrasCategoriaFinanceiro.value = regrasCategoriaCfg
    if (regrasDescricaoCfg && typeof regrasDescricaoCfg === 'object') regrasDescricaoFinanceiro.value = regrasDescricaoCfg
    cozinhaLote.value = await configGet('cozinha_lote', [])
    cozinhaChecklist.value = await configGet('cozinha_checklist', {})
    loteOriginalEmEdicao.value = await configGet('cozinha_lote_original', null)
    modoListaCompras.value = await configGet('modo_lista_compras', 'lista')
    listaComprasSalva.value = await configGet('lista_compras_salva', null)
  }

  // ── Cópias locais de segurança (antes de sobrescrever dados) ──────────
  // Guardadas num IndexedDB à parte (ver services/safetyBackup.js): várias
  // cópias, sem o limite do localStorage, e fora do alcance do importarDados.
  const snapshotsSeguranca = ref([]) // [{ id, ts, motivo }], da mais nova pra mais antiga

  async function carregarSnapshotsSeguranca() {
    snapshotsSeguranca.value = await listarSnapshots()
  }

  /** Guarda o estado atual antes de uma operação que o sobrescreve.
   *  Devolve false só se tentou e NÃO conseguiu guardar. Banco vazio não
   *  precisa de cópia (nada a proteger). */
  async function _guardarSnapshot(motivo) {
    try {
      const dados = await exportarDados()
      const vazio = Object.entries(dados).every(([nome, linhas]) => nome === 'config' || !linhas.length)
      if (vazio) return true
      const id = await salvarSnapshot(dados, motivo)
      await carregarSnapshotsSeguranca()
      return Boolean(id)
    } catch (e) {
      console.warn('[segurança] Falha ao guardar cópia antes de sobrescrever:', e)
      return false
    }
  }

  /** Restaura uma cópia local (a mais recente se `id` não vier). Antes, guarda
   *  o estado atual como mais uma cópia, então dá pra desfazer. */
  async function restaurarSnapshotSeguranca(id) {
    try {
      const lista = snapshotsSeguranca.value.length ? snapshotsSeguranca.value : await listarSnapshots()
      const alvoId = id || lista[0]?.id
      if (!alvoId) return { ok: false, erro: 'Nenhuma cópia local de segurança encontrada neste aparelho.' }
      const snap = await lerSnapshot(alvoId)
      if (!snap?.dados) return { ok: false, erro: 'Essa cópia não pôde ser lida.' }
      await _guardarSnapshot('antes de restaurar uma cópia local')
      await importarDados(snap.dados)
      await _recarregarEstadoAposImport()
      dadosVersao.value++
      await _aposRestauracaoManual()
      notify('Cópia local restaurada')
      return { ok: true }
    } catch (err) {
      console.error('[sync] Falha ao restaurar cópia local de segurança:', err)
      return { ok: false, erro: err.message || 'Erro ao restaurar cópia local.' }
    }
  }

  async function descartarSnapshotSeguranca(id) {
    await apagarSnapshot(id)
    await carregarSnapshotsSeguranca()
  }

  /** Depois de substituir os dados por uma restauração manual (arquivo,
   *  versão do histórico, cópia local): aquele conteúdo passa a ser a
   *  verdade DESTE aparelho, então marca como pendente — assim o próximo
   *  sync não baixa o Drive por cima — e, se o Drive está conectado, já envia
   *  (arquivando sempre a versão que estava lá). */
  async function _aposRestauracaoManual() {
    if (!googleDriveConfigured.value) return
    mudancaSeq++
    hasLocalChanges.value = true
    await configSet('sync_pending', true)
    await _executarSync({ manual: true, arquivarSempre: true })
  }

  function concluirSyncComAviso(message, { toast = false } = {}) {
    syncStatus.value = 'ok'
    if (toast) notify(message)
    setTimeout(() => {
      if (syncStatus.value === 'ok') syncStatus.value = 'idle'
    }, 4000)
  }

  const pausa = (ms) => new Promise(r => setTimeout(r, ms))

  /** Baixa a versão do Drive e a aplica, guardando antes uma cópia local.
   *  Devolve false se não conseguiu guardar a cópia (e então não aplica). */
  async function _aplicarVersaoDoDrive(motivoSnapshot) {
    const copiaOk = await _guardarSnapshot(motivoSnapshot)
    if (!copiaOk) return false
    const { backup, modifiedTime } = await restaurarBackupDoDriveComInfo()
    await importarDados(backup)
    await _registrarSyncBaixado(modifiedTime, await exportarDados())
    await _recarregarEstadoAposImport()
    dadosVersao.value++
    return true
  }

  /** Decisão quando dois aparelhos alteraram os dados: nada é sobrescrito
   *  sem a pessoa escolher, e as DUAS versões ficam guardadas de qualquer
   *  jeito (a deste aparelho numa cópia local, a do Drive fixada no histórico). */
  async function resolverConflitoSync() {
    if (_resolvendoConflito) return
    _resolvendoConflito = true
    try {
      const usarDrive = await confirmarAcao.ask(
        'Outro aparelho salvou alterações no Google Drive depois da última sincronização deste aparelho, e este aparelho também tem alterações que ainda não foram enviadas.\n\nQuer usar a versão do Drive? As alterações deste aparelho ficam guardadas numa cópia de segurança (Ajustes → Backup), mas deixam de aparecer no app.',
        { title: 'Dois aparelhos alteraram os dados', confirmLabel: 'Usar a versão do Drive', cancelLabel: 'Ver outra opção', type: 'warning', icon: 'fas fa-code-compare' }
      )
      if (usarDrive) {
        syncStatus.value = 'syncing'
        try {
          const ok = await _aplicarVersaoDoDrive('antes de baixar do Drive (conflito)')
          if (!ok) {
            syncStatus.value = 'conflict'
            notify('Não foi possível guardar a cópia de segurança — nada foi alterado.', 'error')
            return
          }
          concluirSyncComAviso('Dados atualizados pelo Drive', { toast: true })
        } catch (err) {
          console.error('[sync] Falha ao baixar do Drive no conflito:', err)
          syncStatus.value = 'conflict'
          notify('Não foi possível baixar do Drive. Nada foi alterado.', 'error')
        }
        return
      }

      await pausa(400) // deixa o primeiro diálogo fechar antes de abrir o segundo
      const enviarMinha = await confirmarAcao.ask(
        'Enviar os dados DESTE aparelho para o Drive no lugar da versão que está lá?\n\nA versão do Drive fica guardada e fixada no histórico (Ajustes → Backup → Versões anteriores), mas as alterações feitas no outro aparelho deixam de aparecer.',
        { title: 'Enviar a versão deste aparelho', confirmLabel: 'Enviar a versão deste aparelho', cancelLabel: 'Decidir depois', type: 'warning', icon: 'fas fa-cloud-arrow-up' }
      )
      if (!enviarMinha) {
        syncStatus.value = 'conflict' // segue pendente; o ícone da nuvem reabre esta decisão
        return
      }
      syncStatus.value = 'syncing'
      const seq = mudancaSeq
      try {
        const dados = await exportarDados()
        const { modifiedTime } = await salvarBackupNoDrive(dados, { verificarContra: '', forcar: true })
        await _registrarSyncOk(modifiedTime, seq, dados)
        concluirSyncComAviso('Drive atualizado com a versão deste aparelho', { toast: true })
      } catch (err) {
        console.error('[sync] Falha ao enviar no conflito:', err)
        syncStatus.value = 'conflict'
        notify('Não foi possível enviar ao Drive agora.', 'error')
      }
    } finally {
      _resolvendoConflito = false
    }
  }

  /**
   * Confere o Drive e sincroniza (baixa, junta e envia o que for preciso).
   * Chamado ao abrir o app, ao entrar no perfil da Bete e ao voltar de outra
   * aba/app. Não faz nada se não há diferença. Passa pela mesma fila dos
   * envios, então nunca roda em paralelo com um.
   */
  async function iniciarSync() {
    if (!googleDriveConfigured.value) return
    await _executarSync()
  }

  /**
   * Envio imediato (sem debounce). Marca as alterações como pendentes antes
   * de enviar — assim, se o envio falhar (offline, token), a marca fica e o
   * próximo pull não baixa o Drive por cima.
   * `manual: true` = toque da pessoa no ícone da nuvem (reabre a decisão se
   * houver conflito).
   */
  async function syncImediato({ manual = false } = {}) {
    agendarSync()
    if (manual && syncStatus.value === 'conflict') {
      await resolverConflitoSync()
      return
    }
    await _executarSync({ manual })
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

  // ── BACKUP ────────────────────────────────
  // Confere se o arquivo carregado realmente parece um backup do ChocoBete
  // antes de aplicar — evita que um JSON qualquer (arquivo errado, de
  // outro app, corrompido) apague os dados em silêncio. Basta que pelo
  // menos uma tabela conhecida do banco apareça como array no arquivo.
  function validarBackupValido(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return false
    const nomesTabelas = db.tables.map(t => t.name)
    return nomesTabelas.some(nome => Array.isArray(dados[nome]))
  }

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
      marcarBackupManual()
      notify('Backup baixado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar backup local:', error)
      notify('Erro ao gerar backup local. Tente novamente.', 'error')
    }
  }

  /** Ação do aviso de backup: Drive se estiver conectado, senão baixa o .json. */
  async function backupAgora() {
    if (googleDriveConfigured.value) await backupGoogleDrive()
    else await backupGeral()
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
      const tsAgora = new Date().toISOString()
      await configSet('sync_ts', tsAgora)
      ultimoSyncTs.value = tsAgora
      notify('Backup salvo no Drive!')
      carregarHistoricoDrive() // atualiza a lista de versões anteriores em segundo plano
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
        if (!validarBackupValido(dados)) {
          notify('Esse arquivo não parece ser um backup do app.', 'error')
          return
        }
        const ok = await confirmarAcao.ask(
          'Isso vai substituir todos os dados atuais pelo conteúdo desse arquivo. Essa ação não pode ser desfeita. Deseja continuar?',
          { title: 'Restaurar arquivo local', confirmLabel: 'Restaurar e substituir', type: 'danger' }
        )
        if (!ok) return
        await _guardarSnapshot('antes de restaurar arquivo local')
        await importarDados(dados)
        await _aposRestauracaoManual()
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

    const ok = await confirmarAcao.ask(
      'Isso vai substituir todos os dados atuais pela última versão salva no Drive. Essa ação não pode ser desfeita. Deseja continuar?',
      { title: 'Restaurar do Google Drive', confirmLabel: 'Restaurar e substituir', type: 'danger' }
    )
    if (!ok) return

    try {
      const ok = await _aplicarVersaoDoDrive('antes de restaurar do Drive')
      if (!ok) {
        notify('Não foi possível guardar a cópia de segurança — nada foi alterado.', 'error')
        return
      }
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

  // ── Histórico de versões no Drive ──────────────────────────
  // Além do arquivo principal, guardamos até 5 versões anteriores
  // datadas (ver arquivarVersaoAtual em googleDriveBackup.js). Essa lista
  // alimenta a tela de "restaurar uma versão específica" em Ajustes.
  const historicoDrive = ref([]) // [{ id, modifiedTime }]
  const carregandoHistoricoDrive = ref(false)

  async function carregarHistoricoDrive() {
    if (!googleDriveConfigured.value) { historicoDrive.value = []; return }
    carregandoHistoricoDrive.value = true
    try {
      const [lista, info] = await Promise.all([listarHistoricoDrive(), getInfoBackupDrive()])
      historicoDrive.value = lista
      infoBackupDrive.value = info
    } finally {
      carregandoHistoricoDrive.value = false
    }
  }

  async function restaurarGoogleDriveVersao(item) {
    if (!googleDriveAvailable.value || !googleDriveConfigured.value) {
      notify('Drive não configurado', 'error')
      return
    }
    const quando = item?.modifiedTime ? dataHoraBR(item.modifiedTime) : 'essa versão'
    const ok = await confirmarAcao.ask(
      `Isso vai substituir todos os dados atuais pela versão de ${quando}. Essa ação não pode ser desfeita. Deseja continuar?`,
      { title: 'Restaurar versão do histórico', confirmLabel: 'Restaurar e substituir', type: 'danger' }
    )
    if (!ok) return
    try {
      const dados = await restaurarVersaoHistoricoDrive(item.id)
      await _guardarSnapshot('antes de restaurar versão do histórico')
      await importarDados(dados)
      // A versão restaurada vira a verdade deste aparelho e é enviada ao Drive
      // (arquivando antes a versão que estava lá).
      await _aposRestauracaoManual()
      notify('Versão restaurada! Recarregando…')
      setTimeout(() => location.reload(), 1500)
    } catch (error) {
      console.error(error)
      notify('Erro ao restaurar essa versão', 'error')
    }
  }

  // ── Recuperação rápida (tela de seleção de perfil) ─────────────────
  // Mesma ideia dos restaurarX acima, mas pensada pra tela inicial:
  // sem confirmação de "isso vai substituir tudo" (não tem nada pra
  // substituir — é exatamente o cenário de banco vazio) e reaproveitando
  // o serviço de pasta local (localBackup.js) que já existia pronto mas
  // nunca tinha sido ligado a nada.
  const recuperandoDados = ref(false)
  const suportaPastaBackupLocal = suportaBackupLocalAutomatico()

  async function _aplicarRecuperacaoInicial(dados, origemLabel) {
    if (!validarBackupValido(dados)) {
      notify('Não encontramos um backup reconhecível do app aí.', 'error')
      return { ok: false }
    }
    await importarDados(dados)
    notify(`Dados restaurados${origemLabel ? ' ' + origemLabel : ''}! Recarregando…`)
    setTimeout(() => location.reload(), 1200)
    return { ok: true }
  }

  async function recuperarDeGoogleDrive() {
    if (!googleDriveAvailable.value) {
      notify('Google Drive não está configurado neste app.', 'error')
      return
    }
    recuperandoDados.value = true
    try {
      if (!googleDriveConfigured.value) {
        await conectarGoogleDriveBackup() // abre o popup de login Google
        googleDriveConnected.value = true
      }
      const { backup, modifiedTime } = await restaurarBackupDoDriveComInfo()
      const r = await _aplicarRecuperacaoInicial(backup, 'do Google Drive')
      if (r.ok) {
        await configSet('sync_ts', new Date().toISOString())
        if (modifiedTime) await configSet('sync_remote_ts', modifiedTime)
        await salvarBase(await exportarDados())
      }
    } catch (error) {
      console.error('[recuperação inicial] Drive:', error)
      notify(
        error?.message === 'Nenhum backup encontrado no Google Drive'
          ? 'Essa conta Google ainda não tem nenhum backup salvo.'
          : 'Não foi possível restaurar do Google Drive.',
        'error'
      )
    } finally {
      recuperandoDados.value = false
    }
  }

  async function recuperarDaPastaLocal() {
    recuperandoDados.value = true
    try {
      const dados = await recuperarEscolhendoPastaBackupLocal()
      await _aplicarRecuperacaoInicial(dados, 'da pasta local')
    } catch (error) {
      console.error('[recuperação inicial] Pasta local:', error)
      notify(error?.message || 'Não foi possível restaurar dessa pasta.', 'error')
    } finally {
      recuperandoDados.value = false
    }
  }

  async function recuperarDeArquivoLocal(arquivo) {
    if (!arquivo) return
    recuperandoDados.value = true
    try {
      const texto = await arquivo.text()
      const dados = JSON.parse(texto)
      await _aplicarRecuperacaoInicial(dados, 'do arquivo')
    } catch (error) {
      console.error('[recuperação inicial] Arquivo:', error)
      notify('Erro ao ler o arquivo de backup.', 'error')
    } finally {
      recuperandoDados.value = false
    }
  }

  // ── PRODUÇÕES ─────────────────────────────
  async function carregarContaGoogle() {
    if (!googleDriveConfigured.value) { contaGoogle.value = null; return }
    contaGoogle.value = await getContaGoogle()
  }

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
      carregarHistoricoDrive() // em segundo plano — não trava a conexão se demorar
      carregarContaGoogle()
    } catch (error) {
      console.error(error)
      notify('Não foi possível conectar o Google Drive', 'error')
    }
  }

  async function desconectarGoogleDrive() {
    try {
      await desconectarGoogleDriveBackup()
      // A base e a referência pertencem a ESTA conta Google; ao reconectar
      // (talvez em outra conta) recomeçam do zero, senão o merge trataria
      // registros da outra conta como "apagados aqui".
      await apagarBase()
      await configSet('sync_remote_ts', null)
    } catch (error) {
      console.error(error)
    } finally {
      googleDriveConnected.value = false
      contaGoogle.value = null
      syncStatus.value = 'idle'
      historicoDrive.value = []
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

  // ── Ações do Cronômetro ───────────────────
  function startTimer(loteId) {
    if (timer.value.activeLoteId !== loteId) {
      // Se mudou de lote, reseta o anterior
      timer.value.accumulatedMs = 0
      timer.value.dataInicioReal = null
    }
    // Só marca o "início real" na primeira vez que o play é acionado para este lote.
    // Pausas/retomadas seguintes não sobrescrevem esse horário.
    if (!timer.value.dataInicioReal) {
      timer.value.dataInicioReal = new Date().toISOString()
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
        data_inicio: timer.value.dataInicioReal || undefined,
        data_fim: new Date().toISOString(),
        tempo_real_min: totalMin
      })
    }

    resetTimer()
  }

  function resetTimer() {
    timer.value = { isRunning: false, startTime: null, accumulatedMs: 0, activeLoteId: null, dataInicioReal: null }
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
   * Expande a composição de uma sub-receita em lista plana, em profundidade
   * (pai logo seguido dos seus filhos), anotando o nível de cada linha.
   */
  function coletarSubIngredientes(receita, qtdPai, nivel, maxNivel, visitados, saida, chavePai) {
    if (!receita?.ingredientes || nivel > maxNivel) return
    if (receita.uuid && visitados.has(receita.uuid)) return // evita ciclo A -> B -> A
    const caminho = new Set(visitados)
    if (receita.uuid) caminho.add(receita.uuid)

    const subFator = qtdPai / (receita.rendimento || 1)
    for (const sub of receita.ingredientes) {
      const subAlvo = sub.tipo === 'receita'
        ? receitas.value.find(x => x.uuid === sub.id)
        : produtos.value.find(p => p.uuid === sub.id)
      if (!subAlvo) continue
      const subOculto = sub.gera_peso === false
        ? true
        : (sub.tipo !== 'receita' && isProdutoEmbalagem(subAlvo))
      if (subOculto) continue

      const qtd = (sub.quantidade || 0) * subFator
      const chave = `${chavePai}>${sub.tipo}-${sub.id}`
      const existente = saida.find(x => x.chave === chave)
      if (existente) {
        existente.total += qtd
      } else {
        saida.push({
          id: sub.id,
          tipo: sub.tipo,
          nome: subAlvo.nome,
          total: qtd,
          unidade: sub.tipo === 'receita' ? subAlvo.unidade_rendimento : subAlvo.unidade_base,
          nivel,
          chave,
          paiChave: chavePai
        })
      }
      if (sub.tipo === 'receita') {
        coletarSubIngredientes(subAlvo, qtd, nivel + 1, maxNivel, caminho, saida, chave)
      }
    }
  }

  /**
   * Retorna os ingredientes para produção, com explosão inteligente:
   * Se o item principal for FINAL e usar uma BASE, expande a base em 1 nível.
   * @param {Object} recipe - A receita sendo produzida
   * @param {number} factor - Fator de escala para as quantidades
   * @param {number} [profundidade=1] - Quantos níveis de sub-receita expandir em
   *   `subIngredientes` (1 = só a composição direta; 2+ abre sub-receitas dentro
   *   de sub-receitas). Cada sub-ingrediente traz `nivel`, `chave` e `paiChave`.
   * @returns {Object} Um mapa de ingredientes diretos agrupados.
   */
  function getProductionIngredients(recipe, factor, profundidade = 1) {
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
        // Prioridade: escolha manual (gera_peso) > tipo cadastrado do produto > heurística por nome (legado)
        const oculto = ing.gera_peso === false
          ? true
          : (ing.tipo === 'produto' ? isProdutoEmbalagem(alvo) : false)
        mapa[key] = {
          id: ing.id, tipo: ing.tipo, nome: alvo.nome, total: 0,
          unidade: ing.tipo === 'receita' ? alvo.unidade_rendimento : alvo.unidade_base,
          subIngredientes: [],
          oculto
        }
      }
      mapa[key].total += qtdEscalada

      // Se for uma sub-receita, carregamos sua composição (recursiva, respeitando o nível)
      if (ing.tipo === 'receita' && alvo.ingredientes) {
        coletarSubIngredientes(alvo, qtdEscalada, 1, profundidade, new Set(), mapa[key].subIngredientes, '')
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

  // ── Sanidade do cronômetro de produção ─────────────────────
  // Quanto o tempo cronometrado pode passar do tempo padrão da receita antes de
  // ser tratado como "fora do padrão" (cenário típico: cronômetro esquecido ligado).
  const LIMITE_TEMPO_MULTIPLICADOR = 2.5
  const LIMITE_TEMPO_MARGEM_MIN = 15 // tolerância mínima em minutos, para receitas curtas

  /**
   * Compara o tempo cronometrado de um lote com o tempo padrão esperado da receita
   * (para a quantidade produzida) e sinaliza quando o valor foge muito do esperado.
   * Quando sinalizado, o custo/relatórios usam o tempo padrão no lugar do tempo bruto,
   * para não inflar mão de obra por causa de um cronômetro esquecido ligado.
   * O valor bruto cronometrado nunca é descartado — fica preservado à parte para conferência.
   */
  function avaliarTempoProducao(recipe, tempoRealMin, quantidade) {
    const bruto = Number(tempoRealMin || 0)
    if (bruto <= 0) return { tempo: 0, tempoBruto: 0, tempoPadrao: 0, suspeito: false }

    const rendimento = Number(recipe?.rendimento || 1) || 1
    const qtd = Number(quantidade || rendimento)
    const tempoPadrao = Number(recipe?.tempo_preparo_min || 0) * (qtd / rendimento)

    // Sem tempo padrão cadastrado na receita não há referência para comparar.
    if (tempoPadrao <= 0) return { tempo: bruto, tempoBruto: bruto, tempoPadrao: 0, suspeito: false }

    const suspeito = bruto > (tempoPadrao * LIMITE_TEMPO_MULTIPLICADOR) &&
      (bruto - tempoPadrao) > LIMITE_TEMPO_MARGEM_MIN

    return {
      tempo: suspeito ? tempoPadrao : bruto,
      tempoBruto: bruto,
      tempoPadrao,
      suspeito
    }
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

      // Prioridade total à escolha manual (gera_peso); senão, tipo cadastrado do produto;
      // heurística por nome só como último recurso (produtos legados sem `tipo` definido)
      let soma
      if (ing.gera_peso !== undefined && ing.gera_peso !== null) {
        soma = ing.gera_peso
      } else {
        soma = !isProdutoEmbalagem(alvo)
      }

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
      saldo_mes: Number(item.entradas || 0) - Number(item.saidas_operacionais || 0) - Number(item.saidas_pessoais || 0)
    }))
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

  /** 
   * Devolve o valor de um campo "versionado" (meta de retirada, giro de
   * segurança) que valia em um mês específico — não o valor atual.
   * Procura, no histórico, a mudança mais recente que já tinha acontecido
   * até aquele mês; se não achar nenhuma (mês anterior a todo o histórico
   * registrado), usa o valor mais antigo conhecido como melhor estimativa.
   * `historico` é uma lista [{ mes: 'MM/YYYY', valor }]; `mesRef` também
   * é 'MM/YYYY' (mesmo formato de getMesRef/mes_ref usado no relatório).
   */
  function valorVigenteEm(historico, valorAtual, mesRef) {
    const chave = (mr) => {
      const [m, a] = String(mr || '').split('/').map(Number)
      return (a || 0) * 100 + (m || 0)
    }
    if (!Array.isArray(historico) || !historico.length) return valorAtual
    const alvo = chave(mesRef)
    const passados = historico.filter(h => chave(h.mes) <= alvo)
    if (!passados.length) {
      // Mês pedido é anterior a qualquer registro do histórico: usa o mais antigo
      return historico.reduce((a, b) => chave(a.mes) < chave(b.mes) ? a : b).valor
    }
    return passados.reduce((a, b) => chave(a.mes) > chave(b.mes) ? a : b).valor
  }

  /** Meta de retirada que valia em um mês específico (ex: '08/2026'). */
  function metaSalarioEm(mesRef) {
    return valorVigenteEm(company.value.meta_salario_historico, company.value.meta_salario_mensal, mesRef)
  }

  /** Giro de Segurança que valia em um mês específico. Sem valor manual
   *  registrado pra época, cai no cálculo automático atual (mesmo
   *  comportamento de sempre quando não há valor fixo definido). */
  function reservaGiroEm(mesRef) {
    const manual = valorVigenteEm(company.value.reserva_operacional_historico, company.value.reserva_operacional_fixa, mesRef)
    if (manual > 0) return manual
    return sugestaoProvisionamentoSemanal.value
  }

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