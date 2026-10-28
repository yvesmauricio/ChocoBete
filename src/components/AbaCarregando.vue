<template>
  <div class="aba-carregando" role="status" aria-live="polite">
    <div class="aba-spinner"></div>
    <p>Abrindo…</p>
  </div>
</template>

<style scoped>
.aba-carregando {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 64px 16px; color: var(--brown-mid, #6b4423); font-size: .85rem;
}
.aba-spinner {
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid rgba(107, 68, 35, .2); border-top-color: var(--brown-dark, #2a1504);
  animation: aba-spin .7s linear infinite;
}
@keyframes aba-spin { to { transform: rotate(360deg); } }
</style>
