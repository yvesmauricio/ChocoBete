// Roda os testes do backup/sincronização: node tests-backup/run.mjs [filtro]
// Precisa de: npm i -D fake-indexeddb   (esbuild já vem com o vite)
import { build } from 'esbuild'
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const filtro = process.argv[2] || ''
let falhou = false
for (const arq of readdirSync(dir).filter(f => f.endsWith('.test.mjs') && f.includes(filtro))) {
  const out = path.join(dir, `.out-${arq}`)
  await build({
    entryPoints: [path.join(dir, arq)], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    define: { 'import.meta.env': '{"VITE_GOOGLE_CLIENT_ID":"teste"}' },
    banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
  })
  console.log(`\n▶ ${arq}`)
  const r = spawnSync('node', [out], { stdio: 'inherit' })
  if (r.status) falhou = true
}
process.exit(falhou ? 1 : 0)
