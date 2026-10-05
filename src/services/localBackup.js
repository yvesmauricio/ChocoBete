// ─────────────────────────────────────────────────────────────────────────
// Backup local automático — grava um arquivo de verdade numa pasta do
// dispositivo (fora da sandbox do navegador), pra sobreviver a "limpar
// dados do app" ou reinstalar o PWA. Só funciona em navegadores com File
// System Access API (Chrome/Edge desktop; suporte no Android é parcial e
// inconsistente; Safari/Firefox não suportam) — por isso é uma camada
// extra, nunca a única.
//
// A referência da pasta (o "handle") fica guardada num IndexedDB próprio,
// separado do banco principal (chocobeteDB_v2) de propósito: assim ela
// nunca entra nos arquivos de backup exportados (Drive/manual) nem é
// apagada quando um backup é restaurado — é um detalhe técnico do
// navegador, não um dado do negócio.
// ─────────────────────────────────────────────────────────────────────────

const HANDLE_DB_NAME = 'chocobeteLocalBackupCfg'
const HANDLE_STORE = 'handles'
const HANDLE_KEY = 'pastaBackupLocal'

const AUTO_FILE_NAME = 'chocobete-backup-auto.json'
const HISTORY_PREFIX = 'chocobete-backup-hist-'
const HISTORY_MAX = 5

export function suportaBackupLocalAutomatico() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

function abrirHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(HANDLE_STORE)) {
        req.result.createObjectStore(HANDLE_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getHandleSalvo() {
  if (!suportaBackupLocalAutomatico()) return null
  try {
    const idb = await abrirHandleDb()
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(HANDLE_STORE, 'readonly')
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function salvarHandle(handle) {
  const idb = await abrirHandleDb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(HANDLE_STORE, 'readwrite')
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

async function apagarHandleSalvo() {
  try {
    const idb = await abrirHandleDb()
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(HANDLE_STORE, 'readwrite')
      tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}

async function temPermissao(handle, modo) {
  try {
    // queryPermission é silencioso (não mostra popup) — só confirma se uma
    // permissão concedida antes ainda vale. Sem gesto do usuário aqui não
    // dá pra pedir de novo se tiver sido revogada.
    const status = await handle.queryPermission({ mode: modo })
    return status === 'granted'
  } catch {
    return false
  }
}

export async function pastaBackupLocalConfigurada() {
  return Boolean(await getHandleSalvo())
}

export async function nomePastaBackupLocal() {
  const handle = await getHandleSalvo()
  return handle?.name || null
}

/** Abre o seletor de pasta do sistema — precisa ser chamado a partir de um
 *  clique/toque do usuário, senão o navegador bloqueia. */
export async function escolherPastaBackupLocal() {
  if (!suportaBackupLocalAutomatico()) {
    throw new Error('Esse navegador não permite escolher uma pasta no dispositivo para backup automático.')
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  const permissao = await handle.requestPermission({ mode: 'readwrite' })
  if (permissao !== 'granted') throw new Error('Permissão de escrita na pasta foi negada.')
  await salvarHandle(handle)
  return handle
}

export async function desconectarPastaBackupLocal() {
  await apagarHandleSalvo()
}

async function podarHistoricoLocal(handle) {
  try {
    const nomes = []
    for await (const nome of handle.keys()) {
      if (nome.startsWith(HISTORY_PREFIX)) nomes.push(nome)
    }
    // Nomes têm timestamp ISO no final — ordenação de texto já ordena por data.
    nomes.sort().reverse()
    for (const nome of nomes.slice(HISTORY_MAX)) {
      await handle.removeEntry(nome).catch(() => {})
    }
  } catch {
    // Enumerar diretório não é suportado em todo navegador — não é crítico,
    // só significa que o histórico vai acumular até ser limpo manualmente.
  }
}

/** Escreve o backup na pasta configurada, silenciosamente (sem pedir nada
 *  ao usuário) — só roda se a permissão de escrita ainda estiver valendo.
 *  Antes de sobrescrever, arquiva a versão anterior com data no nome,
 *  mantendo as últimas HISTORY_MAX como histórico local. */
export async function salvarBackupLocalAutomatico(dados) {
  const handle = await getHandleSalvo()
  if (!handle) return false
  if (!(await temPermissao(handle, 'readwrite'))) return false

  try {
    const conteudo = JSON.stringify(
      { versao: 1, atualizadoEm: new Date().toISOString(), backup: dados },
      null,
      2
    )

    // Arquiva o arquivo principal atual (se existir) antes de sobrescrever.
    try {
      const atual = await handle.getFileHandle(AUTO_FILE_NAME)
      const texto = await (await atual.getFile()).text()
      const nomeHistorico = `${HISTORY_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      const histHandle = await handle.getFileHandle(nomeHistorico, { create: true })
      const wHist = await histHandle.createWritable()
      await wHist.write(texto)
      await wHist.close()
    } catch {
      // Primeira vez — ainda não existe arquivo anterior pra arquivar.
    }

    const principal = await handle.getFileHandle(AUTO_FILE_NAME, { create: true })
    const writable = await principal.createWritable()
    await writable.write(conteudo)
    await writable.close()

    await podarHistoricoLocal(handle)
    return true
  } catch (err) {
    console.error('Erro ao salvar backup local automático:', err)
    return false
  }
}

/** Usado na recuperação silenciosa: se a pasta ainda está configurada e com
 *  permissão válida, tenta ler o backup automático dela. */
export async function restaurarDaPastaBackupLocal() {
  const handle = await getHandleSalvo()
  if (!handle) return null
  if (!(await temPermissao(handle, 'read'))) return null
  try {
    const arquivo = await handle.getFileHandle(AUTO_FILE_NAME)
    const texto = await (await arquivo.getFile()).text()
    const data = JSON.parse(texto)
    return data?.backup || data
  } catch {
    return null
  }
}

/** Usado na tela de recuperação quando a referência à pasta se perdeu
 *  (ex.: depois de limpar os dados do app) — o usuário escolhe de novo a
 *  MESMA pasta onde os backups automáticos ficavam, o app procura o
 *  arquivo principal dentro dela, devolve os dados pra importar e já
 *  reconecta a pasta pra continuar salvando ali dali pra frente. */
export async function recuperarEscolhendoPastaBackupLocal() {
  if (!suportaBackupLocalAutomatico()) {
    throw new Error('Esse navegador não permite escolher uma pasta no dispositivo.')
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  const permissao = await handle.requestPermission({ mode: 'readwrite' })
  if (permissao !== 'granted') throw new Error('Permissão negada para essa pasta.')

  let arquivoHandle
  try {
    arquivoHandle = await handle.getFileHandle(AUTO_FILE_NAME)
  } catch {
    throw new Error('Não encontramos um backup automático dentro dessa pasta.')
  }
  const texto = await (await arquivoHandle.getFile()).text()
  const data = JSON.parse(texto)

  await salvarHandle(handle) // reconecta pra seguir salvando aqui
  return data?.backup || data
}
