<template>
  <div class="aba-erro" role="alert">
    <i class="fas fa-triangle-exclamation"></i>
    <p>Não foi possível abrir esta tela.<br>Verifique a conexão e tente de novo.</p>
    <button type="button" @click="recarregar">Recarregar o app</button>
  </div>
</template>

<script setup>
// O navegador guarda a falha de um import() dinâmico até a página recarregar,
// então "tentar de novo" sem recarregar não resolve — recarregar é o caminho certo.
function recarregar() { location.reload() }
</script>

<style scoped>
.aba-erro {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 56px 20px; text-align: center; color: var(--brown-dark, #2a1504);
}
.aba-erro i { font-size: 1.6rem; color: #b45309; }
.aba-erro p { margin: 0; font-size: .9rem; line-height: 1.4; }
.aba-erro button {
  border: none; border-radius: 10px; padding: 10px 18px; font-weight: 700;
  background: var(--brown-dark, #2a1504); color: var(--cream, #fdf3e3); cursor: pointer;
}
</style>
