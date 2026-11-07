// Drive falso (arquivo JSON compartilhado entre processos), fiel ao comportamento do real:
// modifiedTime muda a cada gravação; verificarContra → CONFLICT; historico guarda versões.
import fs from 'node:fs'
const F = process.env.DRIVE_FILE
const ler = () => (fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : null)
const gravar = (o) => fs.writeFileSync(F, JSON.stringify(o))
export const isGoogleDriveBackupConfigured = () => true
export const isGoogleDriveBackupConnected = () => true
export const lerContaGoogleEmCache = () => null
export async function lerEstadoRemoto() { const d = ler(); return d ? { id: 'f1', modifiedTime: d.modifiedTime } : null }
export async function restaurarBackupDoDriveComInfo() { const d = ler(); if (!d) throw new Error('Nenhum backup'); return { backup: JSON.parse(JSON.stringify(d.backup)), modifiedTime: d.modifiedTime } }
export async function salvarBackupNoDrive(backup, { verificarContra, forcar = false } = {}) {
  const d = ler()
  if (d && typeof verificarContra === 'string' && !forcar && d.modifiedTime !== verificarContra) { const e = new Error('CONFLICT'); throw e }
  const n = (d?.n || 0) + 1
  const novo = { n, modifiedTime: `2026-11-07T10:00:${String(n).padStart(2, '0')}.000Z`, backup: JSON.parse(JSON.stringify(backup)), historico: [...(d?.historico || []), ...(d ? [d.backup] : [])] }
  gravar(novo)
  return { modifiedTime: novo.modifiedTime }
}
export const conectarGoogleDriveBackup = async () => {}
export const desconectarGoogleDriveBackup = async () => {}
export const listarHistoricoDrive = async () => []
export const getInfoBackupDrive = async () => null
export const getContaGoogle = async () => null
export const restaurarVersaoHistoricoDrive = async () => { throw new Error('não usado no teste') }
export const restaurarBackupDoDrive = async () => (await restaurarBackupDoDriveComInfo()).backup
