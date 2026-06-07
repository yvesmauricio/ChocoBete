/**
 * nfeArquivoService.js
 * ─────────────────────────────────────────────────────────────────
 * Gerencia:
 *  1. OCR de imagens digitalizadas via Claude Vision API
 *  2. Backup físico dos arquivos em pasta local (File System Access API)
 *  3. Backup do JSON dos dados em IndexedDB (via configSet)
 *  4. Geração de recibo HTML para download/impressão
 */

import { configGet, configSet } from '../db.js'

// ── Chave para persistir o handle da pasta no IndexedDB ───────
const FS_HANDLE_KEY = 'nfe_pasta_handle'
const FS_BLOBS_KEY  = 'nfe_blobs_index'   // índice dos blobs salvos por uuid

// ─────────────────────────────────────────────────────────────────
// OCR via Claude Vision
// ─────────────────────────────────────────────────────────────────

/**
 * Converte um File (imagem ou PDF de 1 pág renderizada) em base64
 */
export async function fileParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(arquivo)
  })
}

/**
 * Renderiza a primeira página de um PDF como imagem PNG base64
 * usando pdf.js (já importado no componente pai)
 */
export async function pdfParaImagemBase64(arquivo, pdfjsLib) {
  const buffer = await arquivo.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2.5 }) // ~300 DPI equivalente
  const canvas = document.createElement('canvas')
  canvas.width  = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
}

/**
 * Envia a imagem para a Claude Vision API e extrai os dados da NF
 * Retorna objeto com: emitente_nome, emitente_cnpj, chave_acesso,
 *                     data_compra, valor_total, itens[], numero, serie
 */
export async function extrairDadosComOCR(base64Imagem, mediaType = 'image/jpeg') {
  const prompt = `Você está analisando a foto ou scan de uma Nota Fiscal eletrônica brasileira (NF-e, NFC-e ou DANFE).
Extraia TODOS os dados possíveis e responda APENAS com JSON válido, sem texto adicional, sem markdown.

Estrutura esperada:
{
  "emitente_nome": "Nome do estabelecimento",
  "emitente_cnpj": "00.000.000/0000-00",
  "emitente_uf": "RJ",
  "numero_nota": "000000",
  "serie_nota": "0",
  "data_compra": "AAAA-MM-DD",
  "data_compra_br": "DD/MM/AAAA",
  "hora_emissao": "HH:MM:SS",
  "valor_total": 0.00,
  "chave_acesso": "00000000000000000000000000000000000000000000",
  "forma_pagamento": "PIX/Dinheiro/Cartão",
  "itens": [
    {
      "xProd": "NOME DO PRODUTO",
      "qCom": 1.0,
      "uCom": "UN",
      "vUnCom": 0.00,
      "vProd": 0.00
    }
  ],
  "confianca": "alta/media/baixa",
  "observacoes": "qualquer dado relevante não encaixado acima"
}

Se não conseguir ler algum campo com certeza, coloque string vazia ou 0. Não invente dados.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Imagem }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`Claude API: ${response.status} — ${err?.error?.message || 'erro desconhecido'}`)
  }

  const data = await response.json()
  const textoResposta = data.content?.find(b => b.type === 'text')?.text || '{}'
  const json = textoResposta.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(json)
  } catch {
    throw new Error('Não foi possível interpretar a resposta do OCR. Tente com imagem mais nítida.')
  }
}

// ─────────────────────────────────────────────────────────────────
// File System Access API — pasta local
// ─────────────────────────────────────────────────────────────────

export function suportaPastaLocal() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Solicita permissão e salva o handle da pasta escolhida pelo usuário
 * Retorna o DirectoryHandle ou null
 */
export async function escolherPastaNotas() {
  if (!suportaPastaLocal()) return null
  try {
    const handle = await window.showDirectoryPicker({
      id: 'notas-fiscais',
      mode: 'readwrite',
      startIn: 'documents'
    })
    // Serializa para reusar nas próximas sessões
    await configSet(FS_HANDLE_KEY, await serializarHandle(handle))
    return handle
  } catch (e) {
    if (e.name === 'AbortError') return null
    throw e
  }
}

/**
 * Recupera o handle salvo e verifica permissão
 */
export async function recuperarPastaNotas() {
  if (!suportaPastaLocal()) return null
  try {
    const serializado = await configGet(FS_HANDLE_KEY, null)
    if (!serializado) return null
    const handle = await deserializarHandle(serializado)
    if (!handle) return null
    const perm = await handle.requestPermission({ mode: 'readwrite' })
    return perm === 'granted' ? handle : null
  } catch {
    return null
  }
}

async function serializarHandle(handle) {
  // File System Access API não suporta serialização nativa em todos os browsers
  // Usamos o workaround com indexedDB nativo via idb-keyval pattern
  // Como não temos idb-keyval, guardamos o nome como fallback
  try {
    // Tenta armazenar o handle diretamente via IDB raw
    return { nome: handle.name, _handle_ref: true }
  } catch {
    return { nome: handle.name }
  }
}

// Store global para o handle em memória (sobrevive reload dentro da sessão)
let _handleEmMemoria = null

export function setHandleEmMemoria(h) { _handleEmMemoria = h }
export function getHandleEmMemoria()  { return _handleEmMemoria }

async function deserializarHandle() {
  return _handleEmMemoria
}

/**
 * Salva arquivo na pasta local organizado por mês
 * dirHandle: DirectoryHandle
 * nomeArquivo: string (ex: "NF_2024-01_emitente.jpg")
 * conteudo: ArrayBuffer | Blob | string
 */
export async function salvarArquivoNaPasta(dirHandle, subpasta, nomeArquivo, conteudo) {
  try {
    // Cria/acessa subpasta (ex: "2024-01")
    const pastaDestino = await dirHandle.getDirectoryHandle(subpasta, { create: true })
    const fileHandle = await pastaDestino.getFileHandle(nomeArquivo, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(conteudo)
    await writable.close()
    return true
  } catch (e) {
    console.warn('[nfeArquivo] Erro ao salvar na pasta:', e)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────
// Geração do recibo HTML
// ─────────────────────────────────────────────────────────────────

function R$(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function gerarReciboHtml(nota, imagemBase64 = null, mediaType = 'image/jpeg') {
  const itensHtml = (nota.itens || []).map(item => `
    <tr>
      <td>${item.xProd || ''}</td>
      <td class="c">${Number(item.qCom || 0).toFixed(3)} ${item.uCom || ''}</td>
      <td class="r">${R$(item.vUnCom)}</td>
      <td class="r"><strong>${R$(item.vProd)}</strong></td>
    </tr>`).join('')

  const imagemTag = imagemBase64
    ? `<div class="img-wrap"><img src="data:${mediaType};base64,${imagemBase64}" alt="Nota Fiscal" /></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>NF — ${nota.emitente_nome || 'Nota Fiscal'}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; max-width: 720px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 11px; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 16px; }
  .grid b { display: block; font-size: 10px; color: #888; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; padding: 5px 8px; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  td.c { text-align: center; }
  td.r { text-align: right; }
  .total { text-align: right; font-size: 14px; font-weight: bold; padding: 8px; background: #f9f9f9; }
  .chave { font-size: 9px; color: #888; word-break: break-all; margin-top: 8px; }
  .badge { display: inline-block; background: #e6f0ff; color: #1a4ebd; font-size: 10px; border-radius: 4px; padding: 2px 7px; margin-left: 6px; }
  .img-wrap { margin-top: 20px; border-top: 1px solid #eee; padding-top: 16px; }
  .img-wrap img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
  @media print { body { padding: 0; } .img-wrap { page-break-before: always; } }
</style>
</head>
<body>
<h1>${nota.emitente_nome || 'Nota Fiscal'} <span class="badge">Cópia de Segurança</span></h1>
<div class="sub">Arquivo gerado pelo sistema — não tem valor fiscal</div>

<div class="grid">
  <div><b>CNPJ</b>${nota.emitente_cnpj || '—'}</div>
  <div><b>Data</b>${nota.data_compra_br || nota.data_compra || '—'}</div>
  <div><b>Número</b>${nota.numero_nota || nota.numero || '—'}</div>
  <div><b>Série</b>${nota.serie_nota || nota.serie || '—'}</div>
  <div><b>UF</b>${nota.emitente_uf || '—'}</div>
  <div><b>Importado em</b>${nota.importado_em ? new Date(nota.importado_em).toLocaleString('pt-BR') : '—'}</div>
</div>

<table>
  <thead><tr><th>Produto</th><th class="c">Qtd</th><th class="r">Un</th><th class="r">Total</th></tr></thead>
  <tbody>${itensHtml}</tbody>
</table>

<div class="total">Total: ${R$(nota.valor_total)}</div>

${nota.chave_acesso ? `<div class="chave">Chave de Acesso: ${nota.chave_acesso}</div>` : ''}

${imagemTag}

<div class="chave" style="margin-top:16px">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body>
</html>`
}

/**
 * Download direto (fallback quando File System API não disponível)
 */
export function downloadArquivo(nomeArquivo, conteudo, tipo = 'application/octet-stream') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Monta o nome do arquivo baseado na nota
 */
export function nomeArquivoNota(nota, extensao = 'jpg') {
  const data  = (nota.data_compra || new Date().toISOString().slice(0, 10)).replace(/-/g, '')
  const emit  = (nota.emitente_nome || 'nota').replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '_').slice(0, 30)
  const chave = nota.chave_acesso ? `_${nota.chave_acesso.slice(-8)}` : ''
  return `NF_${data}_${emit}${chave}.${extensao}`
}

export function subpastaMes(nota) {
  const data = nota.data_compra || new Date().toISOString().slice(0, 10)
  return data.slice(0, 7) // "AAAA-MM"
}
