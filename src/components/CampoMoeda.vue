<template>
  <input
    type="text"
    inputmode="numeric"
    autocomplete="off"
    :value="texto"
    @input="onInput"
    @focus="selecionarTudo"
  >
</template>

<script setup>
import { ref, watch } from 'vue'

// Campo de valor em reais com máscara enquanto digita (mesma regra da Caderneta:
// digita 800 e aparece 8,00; digita 11000000 e aparece 110.000,00).
// v-model é um NÚMERO (reais, com centavos). Vazio = 0.
// Atributos (id, class, placeholder…) passam direto para o <input>.
const modelo = defineModel({ type: [Number, String], default: 0 })

const MAX_DIGITOS = 11 // até 999.999.999,99

const formatar = (n) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const paraNumero = (txt) => {
  const d = String(txt || '').replace(/\D/g, '')
  return d ? Number(d) / 100 : 0
}
const doModelo = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? formatar(n) : ''
}

const texto = ref(doModelo(modelo.value))

function onInput(e) {
  const digitos = e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITOS)
  const n = digitos ? Number(digitos) / 100 : 0
  texto.value = digitos ? formatar(n) : ''
  e.target.value = texto.value // mantém o campo mascarado mesmo se o texto não mudou
  modelo.value = n
}

// Se o valor mudar por fora (carregar dados, sincronizar), atualiza o texto.
watch(modelo, (v) => {
  if (Number(v || 0) !== paraNumero(texto.value)) texto.value = doModelo(v)
})

function selecionarTudo(e) {
  // facilita trocar o valor inteiro; no celular o toque seguinte posiciona o cursor
  requestAnimationFrame(() => { try { e.target.select() } catch { /* ignora */ } })
}
</script>
