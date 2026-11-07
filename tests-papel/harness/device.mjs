// Um "aparelho": roda o store.js REAL com IndexedDB próprio e Drive falso. Comandos por stdin (JSON por linha).
import 'fake-indexeddb/auto'
import readline from 'node:readline'
import { createPinia, setActivePinia } from 'pinia'
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, userAgent: 'node' }, configurable: true })
globalThis.__perguntas = []; globalThis.__resposta = false
import { useStore } from '../../src/store.js'
import { db, exportarDados, importarDados } from '../../src/db.js'

setActivePinia(createPinia())
const s = useStore()
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const resumo = async () => { const d = await exportarDados(); const r = {}; for (const [k, v] of Object.entries(d)) r[k] = Array.isArray(v) ? v.length : 0; return r }

async function tratar(c) {
  switch (c.cmd) {
    case 'init': {
      await db.open()
      if (c.papel) { const { configSet } = await import('../../src/db.js'); await configSet('papel_aparelho', c.papel) }
      await s.init()
      return { papel: s.papelAparelho }
    }
    case 'dados': { // grava como o app grava (passa pelos hooks) e marca para sincronizar
      try { await new Function('db', 'exportarDados', 'importarDados', `return (async()=>{ ${c.codigo} })()`)(db, exportarDados, importarDados); s.agendarSync(); return { gravou: true } }
      catch (e) { return { gravou: false, erro: e.message } }
    }
    case 'sync': {
      globalThis.__resposta = c.confirmar === true
      globalThis.__perguntas.length = 0
      await s.syncImediato({ manual: c.manual === true })
      for (let i = 0; i < 50 && s.syncStatus === 'syncing'; i++) await new Promise(r => setTimeout(r, 20))
      return { status: s.syncStatus, alerta: s.syncAlerta, perguntas: globalThis.__perguntas.length, pendente: s.hasLocalChanges }
    }
    case 'ver': return { dados: await new Function('db', 'exportarDados', 'importarDados', `return (async()=>{ ${c.codigo} })()`)(db, exportarDados, importarDados) }
    case 'store': return { r: await new Function('s', 'db', `return (async()=>{ ${c.codigo} })()`)(s, db) }
    case 'resumo': return { resumo: await resumo() }
    case 'papel': return { papel: s.papelAparelho }
    case 'definirPapel': return { ok: await s.definirPapelAparelho(c.papel, c.nome) }
  }
  return { erro: 'comando desconhecido' }
}
const rl = readline.createInterface({ input: process.stdin })
rl.on('line', async (l) => { const c = JSON.parse(l); try { out({ id: c.id, ...(await tratar(c)) }) } catch (e) { out({ id: c.id, erroFatal: e.stack || String(e) }) } })
out({ pronto: true })
