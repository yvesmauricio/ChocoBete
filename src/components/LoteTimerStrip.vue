<template>
  <div class="lote-timer" :class="{ 'is-paused': !running }" @click.stop>
    <i class="fas fa-stopwatch lote-timer-ico" :class="{ 'fa-beat-fade': running }"></i>
    <div class="lote-timer-txt">
      <span v-if="label" class="lote-timer-label">{{ label }}</span>
      <span class="lote-timer-val">{{ display }}</span>
      <span class="lote-timer-estado">{{ running ? 'em produção' : 'pausado' }}</span>
    </div>
    <div class="lote-timer-btns">
      <button v-if="running" class="lote-timer-btn tb-pause" title="Pausar" aria-label="Pausar o cronômetro" @click="$emit('pausar')">
        <i class="fas fa-pause"></i>
      </button>
      <button v-else class="lote-timer-btn tb-play" title="Retomar" aria-label="Retomar o cronômetro" @click="$emit('retomar')">
        <i class="fas fa-play"></i>
      </button>
      <button class="lote-timer-btn tb-stop" title="Parar e registrar o tempo" aria-label="Parar o cronômetro e registrar o tempo" @click="$emit('parar')">
        <i class="fas fa-stop"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
// Faixa do cronômetro de produção, fixada no card do lote (e, se o lote não está
// na lista — outro mês —, no topo da lista). Só mostra e emite; quem decide é o pai.
defineProps({
  display: { type: String, default: '' },
  running: { type: Boolean, default: false },
  label: { type: String, default: '' }
})
defineEmits(['pausar', 'retomar', 'parar'])
</script>

<style scoped>
.lote-timer { display: flex; align-items: center; gap: 10px; margin: 0 14px 12px; padding: 10px 12px; border-radius: 14px; background: var(--blue-bg); border: 1px solid var(--blue-dim); }
.lote-timer.is-paused { background: var(--gold-bg); border-color: rgba(200, 137, 10, .45); }
.lote-timer-ico { font-size: 1.15rem; color: var(--blue); flex-shrink: 0; }
.lote-timer.is-paused .lote-timer-ico { color: var(--gold-dark); }
.lote-timer-txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.lote-timer-label { font-size: .7rem; font-weight: 700; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lote-timer-val { font-family: var(--mono); font-weight: 800; font-size: 1.35rem; line-height: 1.1; color: var(--blue); font-variant-numeric: tabular-nums; white-space: nowrap; }
.lote-timer.is-paused .lote-timer-val { color: var(--gold-dark); }
.lote-timer-estado { font-size: .66rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.lote-timer-btns { display: flex; gap: 6px; flex-shrink: 0; }
.lote-timer-btn { width: 42px; height: 42px; padding: 0; border-radius: 50%; border: 1px solid transparent; font-size: .95rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: transform var(--t); }
.lote-timer-btn:active { transform: scale(.94); }
.lote-timer-btn:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }
.tb-pause { background: var(--surface); color: var(--blue); border-color: var(--blue-dim); }
.tb-play  { background: var(--green); color: #fff; }
.tb-stop  { background: var(--surface); color: var(--orange); border-color: var(--orange-dim); }
@media (max-width: 370px) { .lote-timer-val { font-size: 1.2rem; } }
</style>
