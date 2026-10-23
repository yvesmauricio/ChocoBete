// services/githubPublish.js
// Publica um arquivo estático (o HTML autossuficiente do cardápio interativo)
// direto no repositório GitHub do projeto, usando a API REST de "Contents".
// Como o Cloudflare Pages já está conectado ao repositório, cada publicação
// aqui gera um commit → o Cloudflare detecta o push e refaz o deploy sozinho.
// O link final fica sempre no mesmo endereço (o arquivo é sobrescrito a cada
// publicação, não é criado um novo a cada vez).
//
// Autenticação: um Personal Access Token "fine-grained" do GitHub, criado
// pela própria pessoa, com escopo travado nesse repositório e permissão
// apenas de "Contents: Read and write". Fica salvo só localmente (mesmo
// padrão do token do Google Drive em googleDriveBackup.js), nunca sai do
// navegador exceto para chamar api.github.com diretamente.

import { configGet, configSet } from '../db.js'

export const CHAVE_CONFIG_PUBLICACAO = 'github_publish_config'

// Owner/repo/branch/domínio não são segredo (o link publicado é público por
// natureza), então podem vir de .env como valor padrão — só pra não precisar
// preencher na mão na primeira vez. O TOKEN nunca vem daqui: ele dá permissão
// de escrita no repositório e só deve existir no que a pessoa digitar em
// Ajustes (salvo local, nunca no bundle publicado).
const CONFIG_DEFAULT = () => ({
  token: '',
  owner: import.meta.env.VITE_GH_OWNER || '',
  repo: import.meta.env.VITE_GH_REPO || '',
  branch: import.meta.env.VITE_GH_BRANCH || 'main',
  caminho: 'public/pedido.html', // arquivos em /public são copiados pro topo do site pelo Vite
  dominio: import.meta.env.VITE_GH_DOMINIO || '', // ex: https://chocobete.pages.dev (sem barra no final)
})

export async function carregarConfigPublicacao() {
  const salvo = await configGet(CHAVE_CONFIG_PUBLICACAO, null)
  const padrao = CONFIG_DEFAULT()
  return {
    ...padrao,
    ...(salvo || {}),
    // owner/repo/branch/dominio não são mais editáveis no app — sempre valem
    // o que está no .env, mesmo que exista uma configuração antiga salva no
    // IndexedDB (de uma versão anterior do app, quando eram editáveis ali).
    owner: padrao.owner,
    repo: padrao.repo,
    branch: padrao.branch,
    dominio: padrao.dominio,
  }
}

export async function salvarConfigPublicacao(config) {
  await configSet(CHAVE_CONFIG_PUBLICACAO, config)
  return config
}

async function buscarShaArquivo(config, caminhoApi) {
  const resp = await chamarGitHub(config, `${caminhoApi}?ref=${encodeURIComponent(config.branch)}`)
  if (resp.status === 200) {
    const atual = await resp.json()
    return atual.sha
  }

  if (resp.status === 401) {
    throw new Error('Token do GitHub inválido ou expirado.')
  }

  if (resp.status !== 404) {
    throw new Error(`Não foi possível checar o arquivo atual (HTTP ${resp.status}).`)
  }

  return null
}

export function publicacaoConfigurada(config) {
  return !!(config?.token && config?.owner && config?.repo && config?.branch && config?.caminho)
}

/** Monta a URL pública final a partir do domínio configurado + caminho do arquivo. */
export function urlPublicaFinal(config) {
  const dominio = String(config.dominio || '').trim().replace(/\/+$/, '')
  // Remove o prefixo "public/" (ou qualquer pasta antes dele) — o Vite copia
  // o conteúdo de /public pra raiz do site, então o arquivo não fica "dentro"
  // de uma pasta "public" no ar.
  const caminhoSite = String(config.caminho || '').replace(/^.*?public\//, '')
  if (!dominio) return caminhoSite
  return `${dominio}/${caminhoSite}`
}

/** Codifica uma string (com acentos etc.) em base64 do jeito que o navegador entende. */
function paraBase64Utf8(texto) {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

async function chamarGitHub(config, caminhoApi, opcoes = {}) {
  const resp = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${caminhoApi}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      ...(opcoes.headers || {}),
    },
  })
  return resp
}

const pendingPublicacoes = new Map()

// Guarda o SHA devolvido pela última publicação bem-sucedida de cada arquivo.
// Evita ter que perguntar pro GitHub "qual é o SHA atual?" antes de cada
// publicação — essa pergunta (GET) às vezes volta com a versão anterior ao
// commit mais recente (defasagem de leitura logo após escrever), o que fazia
// o app tentar publicar com um SHA já ultrapassado e tomar 409 em sequência,
// mesmo tentando de novo. Sabendo o SHA de antemão (porque fomos nós que
// publicamos por último), essa pergunta fica só como fallback pra primeira
// publicação de um arquivo (ou depois de reabrir o app).
const shaConhecido = new Map()

function aguardar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Publica (cria ou atualiza) o arquivo no repositório configurado.
 * Retorna { url } com o link público final.
 */
export async function publicarArquivoGitHub(conteudoTexto, configParcial = {}) {
  const config = { ...(await carregarConfigPublicacao()), ...configParcial }

  if (!publicacaoConfigurada(config)) {
    throw new Error('Publicação não configurada. Preencha o token em Ajustes → Sistema (e confira o repositório no .env).')
  }

  const caminhoApi = String(config.caminho).replace(/^\/+/, '')
  const chavePublicacao = `${config.owner}/${config.repo}@${config.branch}:${caminhoApi}`

  async function executarPublicacao() {
    const content = paraBase64Utf8(conteudoTexto)
    let respPut = null
    let corpoPut = null
    let tentativa = 0
    const maxTentativas = 6
    // Backoff crescente: a defasagem de leitura do GitHub costuma sumir em
    // 1-3s, então vale a pena esperar mais a cada tentativa em vez de bater
    // de novo imediatamente (que só repete o mesmo problema).
    const esperasMs = [400, 800, 1500, 2500, 4000]

    // Só busca o SHA por GET se ainda não sabemos o SHA desse arquivo (ex:
    // primeira publicação, ou app acabou de abrir). Depois da primeira vez,
    // usamos sempre o SHA que o próprio GitHub confirmou no commit anterior.
    let shaExistente = shaConhecido.has(chavePublicacao)
      ? shaConhecido.get(chavePublicacao)
      : await buscarShaArquivo(config, caminhoApi)

    while (tentativa < maxTentativas) {
      tentativa += 1

      const body = {
        message: `Publica cardápio interativo (${new Date().toLocaleString('pt-BR')})`,
        content,
        branch: config.branch,
        ...(shaExistente ? { sha: shaExistente } : {}),
      }

      respPut = await chamarGitHub(config, caminhoApi, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      corpoPut = await respPut.json().catch(() => null)

      if (respPut.ok) {
        // Guarda o SHA novo — é ele que vale a partir de agora, não precisa
        // mais perguntar pro GitHub na próxima publicação desse arquivo.
        const novoSha = corpoPut?.content?.sha
        if (novoSha) shaConhecido.set(chavePublicacao, novoSha)
        return { url: urlPublicaFinal(config) }
      }

      if (respPut.status !== 409) break

      // Conflito de verdade: espera um pouco (dando tempo pro GitHub
      // propagar a última escrita) e busca o SHA atual de novo antes de
      // tentar mais uma vez.
      if (tentativa < maxTentativas) {
        await aguardar(esperasMs[Math.min(tentativa - 1, esperasMs.length - 1)])
        shaExistente = await buscarShaArquivo(config, caminhoApi)
        continue
      }
    }

    // Esgotou as tentativas ou veio um erro que não é conflito — limpa o
    // cache desse arquivo pra próxima publicação partir de uma leitura
    // fresca em vez de repetir um SHA que já provou estar desatualizado.
    shaConhecido.delete(chavePublicacao)

    if (respPut?.status === 401) throw new Error('Token do GitHub inválido ou sem permissão nesse repositório.')
    if (respPut?.status === 404) throw new Error('Repositório, branch ou caminho não encontrados — confira os dados em Ajustes.')
    throw new Error(corpoPut?.message || `Falha ao publicar (HTTP ${respPut?.status || '??'}).`)
  }

  let publicacaoPromise
  if (pendingPublicacoes.has(chavePublicacao)) {
    const anterior = pendingPublicacoes.get(chavePublicacao)
    publicacaoPromise = anterior.then(() => executarPublicacao(), () => executarPublicacao())
  } else {
    publicacaoPromise = executarPublicacao()
  }

  pendingPublicacoes.set(chavePublicacao, publicacaoPromise)

  try {
    return await publicacaoPromise
  } finally {
    if (pendingPublicacoes.get(chavePublicacao) === publicacaoPromise) {
      pendingPublicacoes.delete(chavePublicacao)
    }
  }
}