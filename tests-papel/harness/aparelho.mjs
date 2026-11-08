// Utilitário de teste: sobe um "aparelho" (store.js real + IndexedDB próprio) por processo.
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import readline from 'node:readline'
import { construir } from './construir.mjs'

export async function criarAmbiente() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'amb-'))
  const bundle = path.join(tmp, 'device.bundle.mjs')
  await construir(bundle)
  const procs = []
  class Ap {
    // Cada aparelho tem o SEU Drive falso, salvo se um arquivo for passado (aí dois aparelhos o compartilham).
    // Antes todos dividiam um só e a sincronização automática de um teste contaminava o outro.
    constructor(driveFile) {
      this.p = spawn(process.execPath, [bundle], { env: { ...process.env, DRIVE_FILE: driveFile || path.join(fs.mkdtempSync(path.join(tmp, 'drv-')), 'd.json') }, stdio: ['pipe', 'pipe', 'inherit'] })
      this.w = new Map(); this.n = 0; this.pronto = new Promise(r => { this.r = r })
      readline.createInterface({ input: this.p.stdout }).on('line', l => { let m; try { m = JSON.parse(l) } catch { return } if (m.pronto) return this.r(); this.w.get(m.id)?.(m); this.w.delete(m.id) })
      procs.push(this.p)
    }
    async cmd(c) { await this.pronto; const id = ++this.n; const r = await new Promise(res => { this.w.set(id, res); this.p.stdin.write(JSON.stringify({ id, ...c }) + '\n') }); assert.ok(!r.erroFatal, r.erroFatal); return r }
    init(papel = 'admin') { return this.cmd({ cmd: 'init', papel }) }
    store(codigo) { return this.cmd({ cmd: 'store', codigo }).then(r => r.r) }
  }
  return { Ap, fechar: () => { procs.forEach(p => p.kill()); fs.rmSync(tmp, { recursive: true, force: true }) } }
}
