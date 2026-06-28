const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const DRIVE_FILE_NAME = 'ChocoBete-backup.json'
const DRIVE_FILE_NAME_BAK = 'ChocoBete-backup.bak.json'
const DRIVE_APP_PROPERTY_KEY = 'app'
const DRIVE_APP_PROPERTY_VALUE = 'ChocoBete'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
const DRIVE_CONNECTED_KEY = 'ChocoBete-google-drive-connected'

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

  let token = await getTokenAuto()

  // Se não conseguiu token automaticamente e o usuário já conectou antes,
  // tenta renovação silenciosa uma vez. Se falhar, lança erro sem popup.
  // (O popup só acontece em conectarGoogleDriveBackup)
  if (!token) {
    if (isGoogleDriveBackupConnected()) {
      token = await getTokenSilently()
    }
    if (!token) {
      throw new Error('TOKEN_NEEDED')
    }
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
  url.searchParams.set('fields', 'files(id,name,modifiedTime)')
  url.searchParams.set('pageSize', '1')
  url.searchParams.set('orderBy', 'modifiedTime desc')

  const response = await driveFetch(url.toString())
  const data = await response.json()
  return data.files?.[0] || null
}

async function findBakFile() {
  const query = [
    `name='${DRIVE_FILE_NAME_BAK}'`,
    "trashed=false",
    `'appDataFolder' in parents`,
    `appProperties has { key='${DRIVE_APP_PROPERTY_KEY}' and value='${DRIVE_APP_PROPERTY_VALUE}' }`
  ].join(' and ')

  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', query)
  url.searchParams.set('fields', 'files(id,name,modifiedTime)')
  url.searchParams.set('pageSize', '1')

  const response = await driveFetch(url.toString())
  const data = await response.json()
  return data.files?.[0] || null
}

async function rotacionarParaBak(currentFileId) {
  const bakFile = await findBakFile()

  if (bakFile) {
    const contentResp = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${currentFileId}?alt=media`
    )
    const rawText = await contentResp.text()
    const boundary = `bak-${Math.random().toString(16).slice(2)}`
    const bakMeta = JSON.stringify({
      name: DRIVE_FILE_NAME_BAK,
      appProperties: { [DRIVE_APP_PROPERTY_KEY]: DRIVE_APP_PROPERTY_VALUE }
    })
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${bakMeta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${rawText}\r\n--${boundary}--`
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${bakFile.id}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body
      }
    )
  } else {
    await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${currentFileId}/copy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: DRIVE_FILE_NAME_BAK,
          parents: ['appDataFolder'],
          appProperties: { [DRIVE_APP_PROPERTY_KEY]: DRIVE_APP_PROPERTY_VALUE }
        })
      }
    )
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

export async function desconectarGoogleDriveBackup() {
  ensureBrowserSupport()
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

export async function salvarBackupNoDrive(backup) {
  try {
    ensureConfigured()
    const existingFile = await findBackupFile()

    if (existingFile) {
      await rotacionarParaBak(existingFile.id)
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
    const endpoint = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
    const method = existingFile ? 'PATCH' : 'POST'

    await driveFetch(endpoint, {
      method,
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    })
  } catch (error) {
    console.error('Erro ao salvar backup no Google Drive:', error)
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

export async function restaurarBakDoDrive() {
  ensureConfigured()
  const file = await findBakFile()
  if (!file) throw new Error('Nenhum backup anterior encontrado no Google Drive')

  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  )
  const data = await response.json()
  return data?.backup || data
}

export async function getBackupBakTimestamp() {
  try {
    ensureConfigured()
    const file = await findBakFile()
    return file?.modifiedTime ? new Date(file.modifiedTime) : null
  } catch {
    return null
  }
}
