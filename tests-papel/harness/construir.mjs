import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const aqui = path.dirname(fileURLToPath(import.meta.url))
const raiz = path.resolve(aqui, '../..')
export async function construir(saida) {
  await build({
    entryPoints: [path.join(aqui, 'device.mjs')], bundle: true, format: 'esm', platform: 'node', outfile: saida, logLevel: 'error',
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    plugins: [{
      name: 'falsos', setup(b) {
        const alvo = (re, arq) => b.onResolve({ filter: re }, () => ({ path: path.join(aqui, arq) }))
        alvo(/googleDriveBackup\.js$/, 'fake-drive.mjs')
        alvo(/composables\/useConfirm\.js$/, 'fake-confirm.mjs')
        alvo(/services\/localBackup\.js$/, 'fake-localbackup.mjs')
      }
    }],
    absWorkingDir: raiz,
  })
}
