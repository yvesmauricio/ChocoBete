// Sync automático com o Google Drive, backup em pasta local, fila de envios,
// resolução de conflitos e cópias locais de segurança (snapshots).
import { ref } from 'vue'
import { db, configGet, configSet, exportarDados, importarDados } from '../db.js'
import { salvarBackupNoDrive, lerEstadoRemoto, restaurarBackupDoDriveComInfo } from '../services/googleDriveBackup.js'
import { suportaBackupLocalAutomatico, salvarBackupLocalAutomatico } from '../services/localBackup.js'
import { salvarSnapshot, listarSnapshots, lerSnapshot, apagarSnapshot, salvarBase, lerBase, assinaturaDeDados } from '../services/safetyBackup.js'
import { mesclar, igual } from '../services/merge.js'
import { normalizarPerfis } from './perfis.js'

// ctx: refs e funções do store de que o sync precisa (dados, toast, confirmação).
export function criarSync(ctx) {
  const {
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
  } = ctx

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

  return {
    syncStatus,
    hasLocalChanges,
    dadosVersao,
    mudancaSeq,
    agendarSync,
    _ultimoCarimbo,
    _localTimer,
    LOCAL_BACKUP_ESPERA_MS,
    _gravarBackupLocal,
    agendarBackupLocal,
    salvarBackupLocalAgora,
    _remotoMudou,
    _baseParaEnvio,
    _registrarSyncOk,
    _registrarSyncBaixado,
    _syncRodando,
    _syncPediuDeNovo,
    _resolvendoConflito,
    _arquivarSempreNoProximo,
    _executarSync,
    MARCA_MIGRACAO,
    comMarcaMigracao,
    _sincronizar,
    _recarregarEstadoAposImport,
    snapshotsSeguranca,
    carregarSnapshotsSeguranca,
    _guardarSnapshot,
    restaurarSnapshotSeguranca,
    descartarSnapshotSeguranca,
    _aposRestauracaoManual,
    concluirSyncComAviso,
    pausa,
    _aplicarVersaoDoDrive,
    resolverConflitoSync,
    iniciarSync,
    syncImediato
  }
}
