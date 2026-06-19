import { useConfirm } from './useConfirm.js'
import { useSwipe } from './useSwipe.js'

/**
 * Encapsula o fluxo de exclusão com confirmação:
 *   1. Fecha qualquer SwipeRow aberto
 *   2. Exibe ConfirmDialog
 *   3. Chama a função de exclusão fornecida
 *
 * Uso:
 *   const { confirmarExclusao } = useDeleteConfirm()
 *
 *   // Dentro de um modal (fecha o modal após excluir):
 *   await confirmarExclusao({
 *     nome: 'Brigadeiro',
 *     entidade: 'receita',
 *     onConfirm: () => s.excluirReceita(form.uuid),
 *     onDone:    fecharModal,
 *   })
 *
 *   // Via swipe (sem modal aberto — onDone omitido):
 *   await confirmarExclusao({
 *     nome: item.nome,
 *     entidade: 'ingrediente',
 *     onConfirm: () => s.excluirProduto(item.uuid),
 *   })
 */
export function useDeleteConfirm() {
  const confirm = useConfirm()
  const { closeAll } = useSwipe()

  async function confirmarExclusao({ nome, entidade = 'item', onConfirm, onDone } = {}) {
    closeAll()

    const label = entidade.charAt(0).toUpperCase() + entidade.slice(1)
    const ok = await confirm.ask(
      `Deseja excluir ${entidade === 'item' ? 'o item' : `${entidade === 'receita' ? 'a' : 'o'} ${entidade}`} "${nome}"? Esta ação não pode ser desfeita.`,
      { title: `Excluir ${label}`, icon: 'fas fa-trash', confirmLabel: 'Excluir' }
    )
    if (!ok) return

    try {
      await onConfirm()
    } catch (error) {
      if (!error?.validation) console.error(error)
      return
    }
    onDone?.()
  }

  return { confirmarExclusao }
}
