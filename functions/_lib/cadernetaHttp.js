// Peças comuns das rotas /api/caderneta/*: login, perfil e processamento do lote de operações.
import { json } from './util.js'
import { autenticar } from './acesso.js'
import { aplicarOperacao } from './caderneta.js'
import { papelDoUsuario, autorizarOperacao, PAPEL_ADMIN } from './papeis.js'

/** Login + perfil. Retorna { quem, papel } ou { erro: Response }. 401 = sem login · 403 = logado, mas sem perfil. */
export async function exigirPerfil(request, env, { soAdmin = false } = {}) {
  const quem = await autenticar(request, env)
  if (!quem.ok) return { erro: json({ erro: 'Não autorizado' }, 401) }
  const papel = papelDoUsuario(quem, env)
  if (!papel) return { erro: json({ erro: 'Seu login não tem perfil para usar a Caderneta. Peça ao administrador para liberar.', codigo: 'SEM_PERFIL' }, 403) }
  if (soAdmin && papel !== PAPEL_ADMIN) return { erro: json({ erro: 'Somente o administrador.', codigo: 'SO_ADMIN' }, 403) }
  return { quem, papel }
}

/** Aplica o lote em ordem; cada operação passa pela checagem de perfil antes de qualquer gravação. */
export async function processarOps({ DB, quem, papel, env, corpo, agora }) {
  const ops = Array.isArray(corpo?.ops) ? corpo.ops : null
  if (!ops || !ops.length || ops.length > 50) return { status: 400, corpo: { erro: 'Envie de 1 a 50 operações' } }
  const resultados = []
  for (const op of ops) {
    try {
      const r = await aplicarOperacao(DB, op, {
        usuario: quem.usuario, papel, aparelho: String(corpo.aparelho || '').slice(0, 60), ...(agora ? { agora } : {}),
        autorizar: (o) => autorizarOperacao({ papel, usuario: quem.usuario, op: o, DB, env, ...(agora ? { agora } : {}) }),
      })
      resultados.push(r)
      if (r.status === 'tentar_de_novo') break
    } catch {
      return { status: 503, corpo: { resultados, erro: 'Falha temporária no servidor' } } // as já aplicadas constam; o resto segue na fila
    }
  }
  return { status: 200, corpo: { resultados } }
}
