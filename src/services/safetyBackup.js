// ─────────────────────────────────────────────────────────────────────────
// Cópias de segurança locais ("snapshots") guardadas neste aparelho ANTES de
// qualquer operação que sobrescreve os dados: baixar do Drive, restaurar
// arquivo/versão do histórico, resolver conflito.
//
// Antes isso ficava no localStorage (limite ~5 MB — o banco inteiro com logo
// em base64 estourava em silêncio) e guardava UMA só cópia, que o puxão
// seguinte substituía. Agora fica num IndexedDB próprio (separado do banco
// principal, então nunca entra em backup nem é apagado ao restaurar) e
// mantém várias cópias.
// ─────────────────────────────────────────────────────────────────────────

const DB_NAME = 'chocobeteSafetyDB'
const STORE = 'snapshots'
const BASE_STORE = 'base'   // ponto em comum da última sincronização (base do merge de 3 vias)
const BASE_KEY = 'base'
const MAX_SNAPSHOTS = 8
const LEGACY_LS_KEY = 'ChocoBete-pre-pull-snapshot'

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!req.result.objectStoreNames.contains(BASE_STORE)) {
        req.result.createObjectStore(BASE_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function pedido(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function todos(idb) {
  const tx = idb.transaction(STORE, 'readonly')
  return pedido(tx.objectStore(STORE).getAll())
}

/** Hash rápido (FNV-1a 32 bits + tamanho) só para detectar "igual ao anterior". */
export function assinaturaDeDados(dados) {
  const texto = JSON.stringify(dados)
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${texto.length}:${h.toString(16)}`
}

async function migrarLegado(idb) {
  let raw = null
  try { raw = localStorage.getItem(LEGACY_LS_KEY) } catch { return }
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.ts && parsed?.dados) {
      const reg = {
        id: `legado-${parsed.ts}`,
        ts: parsed.ts,
        motivo: 'cópia antiga (antes de baixar do Drive)',
        assinatura: assinaturaDeDados(parsed.dados),
        dados: parsed.dados,
      }
      const tx = idb.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(reg)
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
    }
    localStorage.removeItem(LEGACY_LS_KEY)
  } catch { /* se não der pra migrar, deixa onde está */ }
}

/** Guarda uma cópia. Se for idêntica à mais recente, não duplica.
 *  Retorna o id (ou null se falhou — nunca lança, pra não travar o fluxo
 *  principal; quem chama decide se prossegue sem a cópia). */
export async function salvarSnapshot(dados, motivo = '') {
  try {
    const idb = await abrir()
    try {
      const existentes = (await todos(idb)).sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
      const assinatura = assinaturaDeDados(dados)
      if (existentes[0]?.assinatura === assinatura) return existentes[0].id

      const ts = new Date().toISOString()
      const id = `${ts}-${Math.random().toString(36).slice(2, 7)}`
      const tx = idb.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.put({ id, ts, motivo, assinatura, dados })
      // Poda: mantém só as MAX_SNAPSHOTS mais novas (a recém-salva incluída).
      for (const velho of existentes.slice(MAX_SNAPSHOTS - 1)) store.delete(velho.id)
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
      return id
    } finally { idb.close() }
  } catch (e) {
    console.warn('[segurança] Não foi possível guardar a cópia de segurança:', e)
    return null
  }
}

/** Lista (sem os dados) da mais nova para a mais antiga. */
export async function listarSnapshots() {
  try {
    const idb = await abrir()
    try {
      await migrarLegado(idb)
      return (await todos(idb))
        .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
        .map(({ id, ts, motivo }) => ({ id, ts, motivo }))
    } finally { idb.close() }
  } catch {
    return []
  }
}

export async function lerSnapshot(id) {
  const idb = await abrir()
  try {
    const tx = idb.transaction(STORE, 'readonly')
    return (await pedido(tx.objectStore(STORE).get(id))) || null
  } finally { idb.close() }
}

export async function apagarSnapshot(id) {
  try {
    const idb = await abrir()
    try {
      const tx = idb.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
    } finally { idb.close() }
  } catch { /* sem problema */ }
}

// ── Base do merge ──────────────────────────────────────────────────────────
// Cópia exata do que este aparelho e o Drive tinham em comum na última
// sincronização. Sem ela o merge não sabe distinguir "criado lá" de "apagado
// aqui". Vive só neste aparelho (nunca entra em backup).

export async function salvarBase(dados) {
  try {
    const idb = await abrir()
    try {
      const tx = idb.transaction(BASE_STORE, 'readwrite')
      tx.objectStore(BASE_STORE).put({ ts: new Date().toISOString(), dados }, BASE_KEY)
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
      return true
    } finally { idb.close() }
  } catch (e) {
    console.warn('[sync] Não foi possível guardar a base do merge:', e)
    return false
  }
}

/** { ts, dados } ou null. */
export async function lerBase() {
  try {
    const idb = await abrir()
    try {
      const tx = idb.transaction(BASE_STORE, 'readonly')
      return (await pedido(tx.objectStore(BASE_STORE).get(BASE_KEY))) || null
    } finally { idb.close() }
  } catch {
    return null
  }
}

export async function apagarBase() {
  try {
    const idb = await abrir()
    try {
      const tx = idb.transaction(BASE_STORE, 'readwrite')
      tx.objectStore(BASE_STORE).delete(BASE_KEY)
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
    } finally { idb.close() }
  } catch { /* sem problema */ }
}
