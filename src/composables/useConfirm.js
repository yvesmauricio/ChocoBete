import { reactive } from 'vue'
import { pushOverlayHistory, closeOverlayHistory } from './overlayHistory.js'

const state = reactive({
  visible: false,
  title: '',
  message: '',
  icon: 'fas fa-exclamation-circle',
  type: 'danger',          // 'danger' | 'warning' | 'primary'
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  resolve: null,
  historyToken: null
})

export function useConfirm() {
  function ask(message, opts = {}) {
    return new Promise(resolve => {
      state.visible     = true
      state.title       = opts.title        || 'Tem certeza?'
      state.message     = message
      state.icon        = opts.icon         || 'fas fa-exclamation-circle'
      state.type        = opts.type         || 'danger'
      state.confirmLabel = opts.confirmLabel || 'Confirmar'
      state.cancelLabel  = opts.cancelLabel  || 'Cancelar'
      state.resolve     = resolve
      state.historyToken = pushOverlayHistory(() => {
        state.historyToken = null
        respond(false, { fromHistory: true })
      })
    })
  }

  function respond(result, opts = {}) {
    const token = state.historyToken
    state.historyToken = null
    state.visible = false
    const res = state.resolve
    state.resolve = null

    if (token && !opts.fromHistory) {
      closeOverlayHistory(token)
    }

    if (res) res(result)
  }

  return { state, ask, respond }
}
