/**
 * Serviço para gerenciamento e extração de texto de arquivos PDF usando pdf.js
 */

async function getPdfJs() {
  if (window._pdfjsLib) return window._pdfjsLib
  if (!navigator.onLine) {
    throw new Error('Sem conexão para carregar o leitor de PDF.')
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      const lib = window.pdfjsLib
      lib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      window._pdfjsLib = lib
      resolve(lib)
    }
    script.onerror = () => {
      const msg = navigator.onLine ? 'Não foi possível carregar o leitor de PDF.' : 'Sem conexão para carregar o leitor de PDF.'
      reject(new Error(msg))
    }
    document.head.appendChild(script)
  })
}

export async function extrairTextoPdf(arquivo) {
  const pdfjsLib = await getPdfJs()
  const arrayBuffer = await arquivo.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    texto += pageText + '\n'
  }
  return texto
}