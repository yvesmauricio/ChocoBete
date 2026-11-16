const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const DRIVE_FILE_NAME = 'ChocoBete-backup.json'
// Prefixo dos arquivos de histórico — cada save no Drive arquiva o
// conteúdo anterior num arquivo novo com esse prefixo + data/hora, antes
// de sobrescrever o principal. Mantemos só os N mais recentes (poda no
// final de arquivarVersaoAtual), então dá pra voltar mais de uma versão
// no tempo, não só "a última antes desta".
const DRIVE_HISTORY_PREFIX = 'ChocoBete-backup-hist-'
// Política de retenção do histórico:
//  • as DRIVE_HISTORY_MAX versões mais recentes (cobrem o erro de "agora há pouco");
//  • a última versão de cada dia nos últimos DRIVE_HISTORY_DIAS dias (cobre o erro
//    descoberto só no dia seguinte ou na semana seguinte);
//  • a última versão de cada semana nas últimas DRIVE_HISTORY_SEMANAS semanas;
//  • versões "fixadas" (appProperties.pin) — guardadas ao resolver um conflito —
//    nunca são podadas automaticamente.
// Para o histórico não virar uma fila de versões quase idênticas (o perfil da
// Bete salva a cada ação), só se arquiva a versão anterior se a última cópia do
// histórico tiver mais de DRIVE_HISTORY_INTERVALO_MIN minutos e o conteúdo for
// diferente dela. Assim cada "rajada" de edições deixa UMA versão: o estado de
// antes dela começar.
const DRIVE_HISTORY_MAX = 8
const DRIVE_HISTORY_DIAS = 14
const DRIVE_HISTORY_SEMANAS = 8
const DRIVE_HISTORY_INTERVALO_MIN = 20
const DRIVE_APP_PROPERTY_KEY = 'app'
const DRIVE_APP_PROPERTY_VALUE = 'ChocoBete'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
const DRIVE_CONNECTED_KEY = 'ChocoBete-google-drive-connected'
const DRIVE_CONTA_KEY = 'ChocoBete-google-drive-conta'

// Chave no localStorage para guardar token + expiração
const TOKEN_CACHE_KEY = 'ChocoBete-gtoken'

let scriptPromise = null
let tokenClientSilent = null   // para renovações sem popup
let tokenClientPrompt = null   // para login explícito com popup
let accessToken = null
let tokenExpiresAt = 0         // timestamp ms
let silentPending = false      // evita chamadas silenciosas simultâneas

// ── Persistência do token ─────────────────────────────────────────────────

function saveTokenCache(token, expiresIn = 3500) {
  try {
    const payload = JSON.stringify({
      token,
      exp: Date.now() + expiresIn * 1000
    })
    localStorage.setItem(TOKEN_CACHE_KEY, payload)
  } catch {}
}

function loadTokenCache() {
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_KEY)
    if (!raw) return null
    const { token, exp } = JSON.parse(raw)
    // Considera válido se ainda tem mais de 2 minutos de vida
    if (exp - Date.now() > 120_000) {
      return { token, exp }
    }
    localStorage.removeItem(TOKEN_CACHE_KEY)
    return null
  } catch {
    return null
  }
}

function clearTokenCache() {
  localStorage.removeItem(TOKEN_CACHE_KEY)
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function ensureConfigured() {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google Drive nao configurado')
}

function ensureBrowserSupport() {
  if (!isBrowser()) throw new Error('Google Drive indisponivel neste ambiente')
}

function setConnected(value) {
  if (!isBrowser()) return
  if (value) localStorage.setItem(DRIVE_CONNECTED_KEY, '1')
  else localStorage.removeItem(DRIVE_CONNECTED_KEY)
}

function loadGoogleIdentityScript() {
  ensureBrowserSupport()
  if (!navigator.onLine) {
    return Promise.reject(new Error('Sem conexão com a internet para carregar os serviços do Google.'))
  }

  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`)
    if (existing) {
      if (window.google?.accounts?.oauth2) { resolve(); return }
      existing.addEventListener('load',  () => resolve(), { once: true })
      existing.addEventListener('error', () => {
        const msg = navigator.onLine ? 'Falha ao carregar Google Identity Services' : 'Sem conexão para carregar Google Identity Services'
        reject(new Error(msg))
      }, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = GOOGLE_IDENTITY_SCRIPT
    script.async = true
    script.defer = true
    script.onload  = () => resolve()
    script.onerror = () => {
      const msg = navigator.onLine ? 'Falha ao carregar Google Identity Services' : 'Sem conexão para carregar Google Identity Services'
      reject(new Error(msg))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

// ── Obtenção de token ─────────────────────────────────────────────────────

/**
 * Tenta renovar o token silenciosamente (sem popup).
 * Funciona se o usuário tiver sessão Google ativa no browser.
 * Retorna o token ou null se precisar de interação.
 */
async function getTokenSilently() {
  ensureConfigured()
  // Evita múltiplas chamadas silenciosas simultâneas
  if (silentPending) return null
  silentPending = true
  try {
    await loadGoogleIdentityScript()

    if (!tokenClientSilent) {
      tokenClientSilent = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: () => {}
      })
    }

    return await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 8000)

      tokenClientSilent.callback = (response) => {
        clearTimeout(timeout)
        if (response?.error || !response?.access_token) {
          resolve(null)
          return
        }
        accessToken = response.access_token
        tokenExpiresAt = Date.now() + (response.expires_in ?? 3500) * 1000
        saveTokenCache(accessToken, response.expires_in ?? 3500)
        resolve(accessToken)
      }

      try {
        tokenClientSilent.requestAccessToken({ prompt: '' })
      } catch {
        clearTimeout(timeout)
        resolve(null)
      }
    })
  } finally {
    silentPending = false
  }
}

/**
 * Solicita token com popup (interação do usuário).
 * Só chamado no fluxo de conexão explícita.
 */
async function getTokenWithPrompt() {
  ensureConfigured()
  await loadGoogleIdentityScript()

  if (!tokenClientPrompt) {
    tokenClientPrompt = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {}
    })
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Autenticacao cancelada ou nao respondeu')), 120_000)

    tokenClientPrompt.callback = (response) => {
      clearTimeout(timeout)
      if (response?.error) {
        reject(new Error(response.error))
        return
      }
      accessToken = response.access_token
      tokenExpiresAt = Date.now() + (response.expires_in ?? 3500) * 1000
      saveTokenCache(accessToken, response.expires_in ?? 3500)
      setConnected(true)
      resolve(accessToken)
    }

    try {
      tokenClientPrompt.requestAccessToken({ prompt: 'select_account' })
    } catch (e) {
      clearTimeout(timeout)
      reject(new Error('Nao foi possivel autenticar no Google'))
    }
  })
}

/**
 * Retorna um token válido. Ordem de prioridade:
 * 1. Token em memória ainda válido
 * 2. Token no localStorage ainda válido
 * 3. Renovação silenciosa (sem popup) — funciona se sessão Google ativa
 * 4. null — caller deve pedir token com prompt
 */
async function getTokenAuto() {
  // 1. Em memória e válido
  if (accessToken && Date.now() < tokenExpiresAt - 120_000) {
    return accessToken
  }

  // 2. Persistido no localStorage
  const cached = loadTokenCache()
  if (cached) {
    accessToken = cached.token
    tokenExpiresAt = cached.exp
    return accessToken
  }

  // 3. Tentativa silenciosa (sem popup)
  if (isGoogleDriveBackupConnected()) {
    const token = await getTokenSilently()
    if (token) return token
  }

  return null
}

// ── driveFetch ────────────────────────────────────────────────────────────

async function driveFetch(url, options = {}, retry = true) {
  if (!navigator.onLine) {
    throw new Error('OFFLINE')
  }

  // getTokenAuto() já tenta renovação silenciosa internamente quando há uma
  // conexão prévia (passo 3 dali) — chamar getTokenSilently() de novo aqui
  // duplicava a tentativa e fazia a tela do Google aparecer 2x seguidas.
  const token = await getTokenAuto()

  if (!token) {
    throw new Error('TOKEN_NEEDED')
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  })

  if (response.status === 401 && retry) {
    // Token inválido: descarta cache e tenta renovação silenciosa
    accessToken = null
    tokenExpiresAt = 0
    clearTokenCache()
    const newToken = await getTokenSilently()
    if (newToken) {
      return driveFetch(url, options, false)
    }
    throw new Error('TOKEN_NEEDED')
  }

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `Google Drive respondeu com erro ${response.status}`)
  }

  return response
}

// ── Multipart helper ──────────────────────────────────────────────────────

function createMultipartBody(metadata, content) {
  const boundary = `receitasv3-${Math.random().toString(16).slice(2)}`
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--`
  return { boundary, body }
}

// ── Arquivos no Drive ─────────────────────────────────────────────────────

async function findBackupFile() {
  const query = [
    `name='${DRIVE_FILE_NAME}'`,
    "trashed=false",
    `'appDataFolder' in parents`,
    `appProperties has { key='${DRIVE_APP_PROPERTY_KEY}' and value='${DRIVE_APP_PROPERTY_VALUE}' }`
  ].join(' and ')

  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', query)
  url.searchParams.set('fields', 'files(id,name,modifiedTime,size)')
  url.searchParams.set('pageSize', '1')
  url.searchParams.set('orderBy', 'modifiedTime desc')

  const response = await driveFetch(url.toString())
  const data = await response.json()
  return data.files?.[0] || null
}

async function findHistoricoFiles() {
  const query = [
    `name contains '${DRIVE_HISTORY_PREFIX}'`,
    "trashed=false",
    `'appDataFolder' in parents`,
    `appProperties has { key='${DRIVE_APP_PROPERTY_KEY}' and value='${DRIVE_APP_PROPERTY_VALUE}' }`
  ].join(' and ')

  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', query)
  url.searchParams.set('fields', 'files(id,name,modifiedTime,size,appProperties)')
  url.searchParams.set('pageSize', '100')
  url.searchParams.set('orderBy', 'modifiedTime desc')

  const response = await driveFetch(url.toString())
  const data = await response.json()
  return data.files || []
}

/** Hash rápido (FNV-1a + tamanho) do texto — só para detectar "igual ao anterior". */
export function hashTexto(texto) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${texto.length}:${h.toString(16)}`
}

function chaveSemana(d) {
  // Segunda-feira da semana, em data local (yyyy-mm-dd)
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x.toLocaleDateString('sv')
}

/** Decide quais arquivos de histórico ficam (ids). Pura — não acessa o Drive.
 *  Fica: as `recentes` mais novas + a mais nova de cada dia dos últimos `dias`
 *  dias + a mais nova de cada semana das últimas `semanas` semanas + as
 *  fixadas. Arquivo sem data nunca é apagado (na dúvida, guarda). */
export function escolherHistoricoParaManter(arquivos, {
  recentes = DRIVE_HISTORY_MAX,
  dias = DRIVE_HISTORY_DIAS,
  semanas = DRIVE_HISTORY_SEMANAS,
  agora = new Date(),
} = {}) {
  const manter = new Set()
  const comData = []
  for (const f of arquivos || []) {
    if (f.appProperties?.pin) manter.add(f.id)
    if (f.modifiedTime && !isNaN(new Date(f.modifiedTime))) comData.push(f)
    else manter.add(f.id)
  }
  comData.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))
  comData.slice(0, recentes).forEach(f => manter.add(f.id))
  const limiteDia = agora.getTime() - dias * 86_400_000
  const limiteSemana = agora.getTime() - semanas * 7 * 86_400_000
  const diasVistos = new Set()
  const semanasVistas = new Set()
  for (const f of comData) {
    const d = new Date(f.modifiedTime)
    if (d.getTime() >= limiteDia) {
      const dia = d.toLocaleDateString('sv')
      if (!diasVistos.has(dia)) { diasVistos.add(dia); manter.add(f.id) }
    }
    if (d.getTime() >= limiteSemana) {
      const sem = chaveSemana(d)
      if (!semanasVistas.has(sem)) { semanasVistas.add(sem); manter.add(f.id) }
    }
  }
  return manter
}

/** Pura: dado o histórico atual (mais novo primeiro), diz se vale arquivar a
 *  versão que está prestes a ser sobrescrita. */
export function deveArquivarAgora(historico, { agora = new Date(), forcar = false } = {}) {
  if (forcar) return true
  const lista = (historico || [])
    .filter(f => f.modifiedTime && !isNaN(new Date(f.modifiedTime)))
    .sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))
  if (!lista.length) return true
  const idadeMin = (agora.getTime() - new Date(lista[0].modifiedTime).getTime()) / 60_000
  return idadeMin >= DRIVE_HISTORY_INTERVALO_MIN
}

/** Antes de sobrescrever o arquivo principal, guarda uma cópia do que
 *  estava lá como um novo arquivo de histórico datado (respeitando o
 *  intervalo mínimo e ignorando conteúdo idêntico ao último arquivado).
 *  Depois poda conforme a política de retenção. `fixar` marca a cópia como
 *  protegida contra poda (usado ao resolver conflitos). */
async function arquivarVersaoAtual(currentFileId, { forcar = false, fixar = false } = {}) {
  let historico = await findHistoricoFiles()
  if (!deveArquivarAgora(historico, { forcar })) return

  const contentResp = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${currentFileId}?alt=media`
  )
  const rawText = await contentResp.text()
  const hash = hashTexto(rawText)

  const maisNovo = [...historico].sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0]
  if (!forcar && maisNovo?.appProperties?.h === hash) return // conteúdo igual ao último arquivado

  const nomeHistorico = `${DRIVE_HISTORY_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const boundary = `hist-${Math.random().toString(16).slice(2)}`
  const appProperties = { [DRIVE_APP_PROPERTY_KEY]: DRIVE_APP_PROPERTY_VALUE, h: hash }
  if (fixar) appProperties.pin = '1'
  const metaJson = JSON.stringify({
    name: nomeHistorico,
    parents: ['appDataFolder'],
    appProperties
  })
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${rawText}\r\n--${boundary}--`

  await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    }
  )

  // Poda: apaga o que não deve ser mantido. Falha silenciosa item a item —
  // se uma exclusão falhar, não interrompe o save (a versão nova ainda
  // vai ser salva, que é o que importa).
  historico = await findHistoricoFiles()
  const manter = escolherHistoricoParaManter(historico)
  const excedentes = historico.filter(f => !manter.has(f.id))
  for (const arquivo of excedentes) {
    await driveFetch(`https://www.googleapis.com/drive/v3/files/${arquivo.id}`, { method: 'DELETE' }).catch(() => {})
  }
}

// ── API pública ───────────────────────────────────────────────────────────

export function isGoogleDriveBackupConfigured() {
  return Boolean(GOOGLE_CLIENT_ID)
}

export function isGoogleDriveBackupConnected() {
  return Boolean(GOOGLE_CLIENT_ID)
    && isBrowser()
    && localStorage.getItem(DRIVE_CONNECTED_KEY) === '1'
}

/**
 * Conexão explícita: mostra popup, salva token e marca como conectado.
 * Só precisa ser chamado UMA vez pelo usuário.
 */
export async function conectarGoogleDriveBackup() {
  await getTokenWithPrompt()
}

/** Conta Google guardada da última vez que foi consultada (nome + e-mail).
 *  Serve pra mostrar algo na hora, mesmo offline. */
export function lerContaGoogleEmCache() {
  if (!isBrowser()) return null
  try {
    const c = JSON.parse(localStorage.getItem(DRIVE_CONTA_KEY) || 'null')
    return c && (c.nome || c.email) ? c : null
  } catch { return null }
}

/** Pergunta ao Drive quem é a conta conectada. O endpoint `about` aceita o
 *  escopo drive.appdata que já usamos — não precisa pedir permissão nova.
 *  Se falhar (offline etc.), devolve o que estava guardado. */
export async function getContaGoogle() {
  try {
    ensureConfigured()
    const res = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)')
    if (!res.ok) return lerContaGoogleEmCache()
    const { user } = await res.json()
    if (!user) return lerContaGoogleEmCache()
    const conta = { nome: user.displayName || '', email: user.emailAddress || '' }
    if (isBrowser()) localStorage.setItem(DRIVE_CONTA_KEY, JSON.stringify(conta))
    return conta
  } catch {
    return lerContaGoogleEmCache()
  }
}

export async function desconectarGoogleDriveBackup() {
  ensureBrowserSupport()
  if (isBrowser()) localStorage.removeItem(DRIVE_CONTA_KEY)
  const token = accessToken
  accessToken = null
  tokenExpiresAt = 0
  clearTokenCache()
  setConnected(false)
  tokenClientSilent = null
  tokenClientPrompt = null
  if (token && window.google?.accounts?.oauth2?.revoke) {
    await new Promise(resolve => window.google.accounts.oauth2.revoke(token, resolve))
  }
}

/**
 * Tenta renovar o token silenciosamente ao abrir o app.
 * Chame isso no onMounted do App.vue quando isGoogleDriveBackupConnected() for true.
 * Não lança erro — falha silenciosamente, o sync vai tentar de novo quando precisar.
 */
export async function tentarReconectarSilenciosamente() {
  if (!isGoogleDriveBackupConnected()) return
  try {
    await getTokenAuto()
  } catch {}
}

export async function getBackupTimestamp() {
  try {
    ensureConfigured()
    const file = await findBackupFile()
    return file?.modifiedTime ? new Date(file.modifiedTime) : null
  } catch {
    return null
  }
}

/** Estado atual do arquivo principal no Drive: { id, modifiedTime } ou null se
 *  ainda não existe. DIFERENTE de getBackupTimestamp: aqui erro de rede/token
 *  é lançado (quem chama precisa distinguir "não existe" de "não consegui ver"). */
export async function lerEstadoRemoto() {
  ensureConfigured()
  const file = await findBackupFile()
  return file ? { id: file.id, modifiedTime: file.modifiedTime || null } : null
}

async function modifiedTimeAtual(fileId) {
  const resp = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`)
  const data = await resp.json()
  return data?.modifiedTime || null
}

function erroConflito(remoto) {
  const e = new Error('CONFLICT')
  e.remoteModifiedTime = remoto || null
  return e
}

/**
 * Salva o backup no Drive.
 *  • `verificarContra` (string): modifiedTime do arquivo no Drive que este
 *    aparelho viu na última sincronização. Se o arquivo no Drive foi alterado
 *    por outro aparelho desde então, NÃO sobrescreve: lança Error('CONFLICT').
 *    A checagem roda antes de arquivar e de novo imediatamente antes de gravar.
 *  • `arquivarSempre`: arquiva a versão atual do Drive mesmo que o último
 *    arquivamento seja recente (usado ao restaurar versões antigas).
 *  • `forcar`: grava mesmo com conflito (a versão do Drive é arquivada e
 *    fixada no histórico antes, pra poder voltar).
 * Retorna { modifiedTime } do arquivo recém-gravado.
 */
export async function salvarBackupNoDrive(backup, { verificarContra, forcar = false, arquivarSempre = false } = {}) {
  try {
    ensureConfigured()
    const existingFile = await findBackupFile()
    const verificar = typeof verificarContra === 'string' && !forcar

    if (existingFile && verificar && existingFile.modifiedTime !== verificarContra) {
      throw erroConflito(existingFile.modifiedTime)
    }

    if (existingFile) {
      await arquivarVersaoAtual(existingFile.id, {
        forcar: forcar || arquivarSempre,
        fixar: forcar && typeof verificarContra === 'string' && existingFile.modifiedTime !== verificarContra
      })
      // Reconfere logo antes de gravar: o arquivamento leva alguns segundos e
      // outro aparelho pode ter salvo nesse intervalo.
      if (verificar) {
        const agora = await modifiedTimeAtual(existingFile.id)
        if (agora && agora !== verificarContra) throw erroConflito(agora)
      }
    }

    const metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: 'application/json',
      appProperties: { [DRIVE_APP_PROPERTY_KEY]: DRIVE_APP_PROPERTY_VALUE }
    }
    if (!existingFile) metadata.parents = ['appDataFolder']

    const content = JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      backup
    })

    const { boundary, body } = createMultipartBody(metadata, content)
    const campos = 'fields=id,modifiedTime'
    const endpoint = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&${campos}`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&${campos}`
    const method = existingFile ? 'PATCH' : 'POST'

    const resp = await driveFetch(endpoint, {
      method,
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    })
    const salvo = await resp.json().catch(() => ({}))
    return { modifiedTime: salvo?.modifiedTime || null }
  } catch (error) {
    if (error?.message !== 'CONFLICT') console.error('Erro ao salvar backup no Google Drive:', error)
    throw error
  }
}

export async function restaurarBackupDoDrive() {
  ensureConfigured()
  const file = await findBackupFile()
  if (!file) throw new Error('Nenhum backup encontrado no Google Drive')

  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  )
  const data = await response.json()
  return data?.backup || data
}

/** Como restaurarBackupDoDrive, mas também devolve o modifiedTime do arquivo
 *  lido (lido ANTES do download — se o arquivo mudar no meio, o próximo
 *  sync apenas baixa de novo, nunca perde alteração). */
export async function restaurarBackupDoDriveComInfo() {
  ensureConfigured()
  const file = await findBackupFile()
  if (!file) throw new Error('Nenhum backup encontrado no Google Drive')
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  )
  const data = await response.json()
  return { backup: data?.backup || data, modifiedTime: file.modifiedTime || null }
}

export async function listarHistoricoDrive() {
  try {
    ensureConfigured()
    const arquivos = await findHistoricoFiles()
    return arquivos.map(f => ({
      id: f.id,
      modifiedTime: f.modifiedTime ? new Date(f.modifiedTime) : null,
      size: Number(f.size || 0),
      fixada: Boolean(f.appProperties?.pin),
    }))
  } catch {
    return []
  }
}

/** Resumo do que há no Drive: data/tamanho do backup principal e o total ocupado
 *  (principal + versões anteriores). null se não conseguir consultar. */
export async function getInfoBackupDrive() {
  try {
    ensureConfigured()
    const [principal, historico] = await Promise.all([findBackupFile(), findHistoricoFiles()])
    if (!principal) return null
    const tamanhoPrincipal = Number(principal.size || 0)
    const tamanhoHistorico = historico.reduce((s, f) => s + Number(f.size || 0), 0)
    return {
      modifiedTime: principal.modifiedTime ? new Date(principal.modifiedTime) : null,
      tamanhoPrincipal,
      versoes: historico.length,
      tamanhoTotal: tamanhoPrincipal + tamanhoHistorico,
    }
  } catch {
    return null
  }
}

/** Restaura uma versão específica do histórico pelo id do arquivo (vindo
 *  de listarHistoricoDrive). */
export async function restaurarVersaoHistoricoDrive(fileId) {
  ensureConfigured()
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  )
  const data = await response.json()
  return data?.backup || data
}