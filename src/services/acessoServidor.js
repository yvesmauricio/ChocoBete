// Quem sou eu no servidor e o que posso fazer na Caderneta (perfil por PESSOA, vindo do login; ver functions/_lib/papeis.js).
// O app só usa isto para ESCONDER botões e avisar cedo. Quem decide é sempre o servidor: uma operação sem permissão
// é recusada, fica registrada e aparece no indicador com o motivo.
import { shallowRef } from 'vue'
import { filaDb, requisitar } from './filaOperacoes.js'

/** { usuario, papel: 'admin'|'vendas'|null, permissoes: [...], so_admin: [...], janela_desfazer_min } ou null (ainda não sabemos) */
export const acessoRef = shallowRef(null)

export async function carregarAcessoLocal() {
  try { acessoRef.value = (await filaDb.meta.get('acesso'))?.valor ?? null } catch { /* sem cache */ }
}

/** Pergunta ao servidor e guarda (vale offline até a próxima vez). Nunca lança. */
export async function atualizarAcesso() {
  try {
    const r = await requisitar('/api/caderneta/eu', { credentials: 'same-origin' })
    if (!r.ok) return acessoRef.value
    const a = await r.json()
    acessoRef.value = a
    await filaDb.meta.put({ chave: 'acesso', valor: a })
  } catch { /* offline: fica com o que já sabia */ }
  return acessoRef.value
}

const COM_JANELA = ['venda.cancelar', 'venda.corrigir']

/**
 * O botão desta ação deve aparecer? `fiado` só importa para cancelar/corrigir (exceção de desfazer a própria venda).
 * Sem saber o perfil ainda, vale o mais restrito.
 */
export function podeNoServidor(tipo, fiado = null, agora = Date.now(), a = acessoRef.value) {
  if (a?.papel === 'admin') return true
  if (a?.permissoes?.includes(tipo)) return true
  if (!a || a.papel !== 'vendas' || !COM_JANELA.includes(tipo) || !fiado) return false
  const janela = Number(a.janela_desfazer_min) * 60_000
  const criada = Date.parse(fiado.criadoEm)
  return janela > 0 && !!a.usuario && fiado.usuario === a.usuario && Number.isFinite(criada) && agora - criada <= janela
    && !(fiado.pagamentos || []).length
}
