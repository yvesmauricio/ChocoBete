// Cronômetro global de produção (estado persistido em 'active_timer').
import { ref, computed } from 'vue'
import { configSet } from '../db.js'
import { dataHoraBR } from '../utils.js'

export function criarCronometro({ producoes, atualizarLoteProducao }) {
  const now = ref(Date.now())
  let tickerId = null

  // ── Cronômetro Global ──────────────────────
  const timer = ref({
    isRunning: false,
    startTime: null, // Date.now()
    accumulatedMs: 0,
    activeLoteId: null, // ID do grupo (data_producao)
    dataInicioReal: null // Horário real (ISO) em que o timer foi acionado pela 1ª vez neste lote
  })

  const activeLoteName = computed(() => {
    if (!timer.value.activeLoteId) return null;
    // Encontra o primeiro item de produção no lote ativo
    const firstItemInLote = producoes.value.find(p => p.data_producao === timer.value.activeLoteId);
    if (firstItemInLote) {
      // Retorna o nome da receita do primeiro item, ou um genérico "Lote de [data]"
      return firstItemInLote.receita_nome || `Lote de ${dataHoraBR(timer.value.activeLoteId)}`;
    }
    // Fallback para exibir apenas a data/hora do lote se nenhuma receita for encontrada
    return `Lote de ${dataHoraBR(timer.value.activeLoteId)}`;
  });

  // ── Ações do Cronômetro ───────────────────
  function startTimer(loteId) {
    if (timer.value.activeLoteId !== loteId) {
      // Se mudou de lote, reseta o anterior
      timer.value.accumulatedMs = 0
      timer.value.dataInicioReal = null
    }
    // Só marca o "início real" na primeira vez que o play é acionado para este lote.
    // Pausas/retomadas seguintes não sobrescrevem esse horário.
    if (!timer.value.dataInicioReal) {
      timer.value.dataInicioReal = new Date().toISOString()
    }
    timer.value.activeLoteId = loteId
    timer.value.startTime = Date.now()
    timer.value.isRunning = true
    configSet('active_timer', timer.value)
    startTicker()
  }

  function startTicker() {
    if (tickerId) return
    tickerId = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  function pauseTimer() {
    if (!timer.value.isRunning) return
    timer.value.accumulatedMs += Date.now() - timer.value.startTime
    timer.value.isRunning = false
    configSet('active_timer', timer.value)
    clearInterval(tickerId); tickerId = null
  }

  async function stopTimer() {
    const totalMs = timer.value.isRunning
      ? timer.value.accumulatedMs + (Date.now() - timer.value.startTime)
      : timer.value.accumulatedMs

    const totalMin = Math.round(totalMs / 60000)
    const loteId = timer.value.activeLoteId

    if (loteId && totalMin > 0) {
      await atualizarLoteProducao(loteId, {
        data_inicio: timer.value.dataInicioReal || undefined,
        data_fim: new Date().toISOString(),
        tempo_real_min: totalMin
      })
    }

    resetTimer()
  }

  function resetTimer() {
    timer.value = { isRunning: false, startTime: null, accumulatedMs: 0, activeLoteId: null, dataInicioReal: null }
    configSet('active_timer', null)
    clearInterval(tickerId); tickerId = null
  }

  const timerDisplay = computed(() => {
    const _tick = now.value // Força re-cálculo a cada segundo
    if (!timer.value.activeLoteId && !timer.value.isRunning) return null

    let currentMs = timer.value.accumulatedMs
    if (timer.value.isRunning && timer.value.startTime) {
      currentMs += Date.now() - timer.value.startTime
    }

    const totalSeconds = Math.floor(currentMs / 1000)
    const totalMinutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (totalMinutes < 60) {
      // Menos de 1h: mostra MM:SS
      return `${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    } else {
      // 1h ou mais: mostra Xh YYmin
      const hours = Math.floor(totalMinutes / 60)
      const mins = totalMinutes % 60
      return mins > 0 ? `${hours}h ${String(mins).padStart(2, '0')}min` : `${hours}h`
    }
  })

  return {
    now,
    tickerId,
    timer,
    activeLoteName,
    startTimer,
    startTicker,
    pauseTimer,
    stopTimer,
    resetTimer,
    timerDisplay
  }
}
