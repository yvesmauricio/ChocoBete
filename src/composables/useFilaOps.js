// Texto e estado do indicador "N alterações aguardando" (Caderneta).
//   saved    tudo no servidor            pending  N alterações aguardando envio (guardadas neste aparelho)
//   syncing  enviando agora              attention  o servidor recusou N alterações (toque para ver o motivo)
//   offline  sem login/conexão e há pendências
import { reactive, computed, onMounted, onUnmounted } from 'vue'
import { estadoFila, aoMudarFila, recontar, descarregar } from '../services/filaOperacoes.js'

export function useFilaOps() {
  const s = reactive({ ...estadoFila })
  let parar = null
  onMounted(() => { parar = aoMudarFila(novo => Object.assign(s, novo)); recontar() })
  onUnmounted(() => parar?.())

  const estado = computed(() => {
    if (s.rejeitadas.length) return 'attention'
    if (s.enviando && s.pendentes) return 'syncing'
    if (s.pendentes && (s.semLogin || s.semPerfil || s.ultimoErro)) return 'offline'
    if (s.pendentes) return 'pending'
    return 'saved'
  })
  const texto = computed(() => {
    const n = s.pendentes, r = s.rejeitadas.length
    if (r) return `${r} ${r === 1 ? 'alteração recusada' : 'alterações recusadas'} — toque para ver`
    if (estado.value === 'syncing') return 'Enviando…'
    if (n) return `${n} ${n === 1 ? 'alteração aguardando' : 'alterações aguardando'}${s.semPerfil ? ' — sem perfil no servidor' : s.semLogin ? ' — faça login' : ''}`
    return 'Tudo salvo no servidor'
  })
  return { estado, texto, pendentes: computed(() => s.pendentes), rejeitadas: computed(() => s.rejeitadas), enviarAgora: descarregar }
}
