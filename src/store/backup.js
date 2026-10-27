// Backup e restauração (arquivo local, Google Drive, pasta local) e recuperação inicial.
import { ref } from 'vue'
import { db, configSet, exportarDados, importarDados } from '../db.js'
import { dataHoraBR } from '../utils.js'
import { conectarGoogleDriveBackup, desconectarGoogleDriveBackup, salvarBackupNoDrive, restaurarBackupDoDriveComInfo, listarHistoricoDrive, getInfoBackupDrive, getContaGoogle, restaurarVersaoHistoricoDrive } from '../services/googleDriveBackup.js'
import { suportaBackupLocalAutomatico, recuperarEscolhendoPastaBackupLocal } from '../services/localBackup.js'
import { salvarBase, apagarBase } from '../services/safetyBackup.js'

// ctx: refs e funções do store que o backup precisa (sync, snapshots, toast, confirmação).
export function criarBackup(ctx) {
  const {
    notify,
    googleDriveConfigured,
    googleDriveAvailable,
    googleDriveConnected,
    contaGoogle,
    confirmarAcao,
    _guardarSnapshot,
    _aposRestauracaoManual,
    ultimoSyncTs,
    syncStatus,
    marcarBackupManual,
    iniciarSync,
    infoBackupDrive,
    _aplicarVersaoDoDrive
  } = ctx

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

  return {
    validarBackupValido,
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
    _aplicarRecuperacaoInicial,
    recuperarDeGoogleDrive,
    recuperarDaPastaLocal,
    recuperarDeArquivoLocal,
    carregarContaGoogle,
    conectarGoogleDrive,
    desconectarGoogleDrive
  }
}
