<template>
  <div class="dsc">
    <button v-if="!aberto" type="button" class="dsc-add" @click="abrir">
      <i class="fas fa-percent"></i> Adicionar desconto
    </button>

    <div v-else class="dsc-card">
      <div class="dsc-topo">
        <span class="dsc-titulo"><i class="fas fa-percent"></i> Desconto</span>
        <button type="button" class="dsc-remover" @click="remover" aria-label="Remover desconto">
          <i class="fas fa-xmark"></i>
        </button>
      </div>
      <div class="dsc-linha">
        <div class="dsc-valor">
          <span>− R$</span>
          <input
            ref="inputValor"
            type="text" inputmode="numeric" placeholder="0,00"
            :value="valor" @input="onValor"
          >
        </div>
        <input
          class="dsc-motivo" type="text" maxlength="60"
          placeholder="Motivo (ex: trufa amassada)"
          :value="motivo" @input="motivo = $event.target.value"
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

// valor  → texto mascarado em pt-BR ("1,00"); o pai converte em número.
// motivo → texto livre, só pra consulta (não vai na mensagem do cliente).
const valor  = defineModel('valor',  { type: String, default: '' })
const motivo = defineModel('motivo', { type: String, default: '' })

// Já abre aberto se a venda tem desconto (edição ou "desfazer").
const aberto = ref(!!valor.value)
const inputValor = ref(null)

function abrir() {
  aberto.value = true
  nextTick(() => inputValor.value?.focus())
}

function remover() {
  valor.value = ''
  motivo.value = ''
  aberto.value = false
}

function onValor(e) {
  const d = e.target.value.replace(/\D/g, '')
  valor.value = d ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(d) / 100) : ''
  e.target.value = valor.value
}
</script>

<style scoped>
.dsc { margin-top: 10px; }
.dsc-add {
  width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; border: 1.5px dashed var(--border); border-radius: var(--r-md);
  color: var(--brown-mid); font-family: var(--font); font-size: 13px; font-weight: 800; cursor: pointer;
}
.dsc-add:active { transform: scale(.98); }
.dsc-card {
  padding: 12px 14px; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); box-shadow: var(--shadow);
}
.dsc-topo { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.dsc-titulo { font-size: 13px; font-weight: 800; color: var(--brown-mid); display: flex; gap: 6px; align-items: center; }
.dsc-remover {
  width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer;
  background: var(--red-bg); color: var(--red);
}
.dsc-linha { display: flex; flex-direction: column; gap: 8px; }
.dsc-valor {
  display: flex; align-items: center; gap: 8px; padding: 0 14px; min-height: 48px;
  border: 1.5px solid var(--border); border-radius: var(--r-sm); background: var(--surface);
}
.dsc-valor span { font-weight: 800; color: var(--red); font-family: var(--mono); }
.dsc-valor input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-size: 18px; font-weight: 800; font-family: var(--mono); color: var(--brown-dark);
}
.dsc-motivo {
  padding: 12px 14px; border: 1.5px solid var(--border); border-radius: var(--r-sm);
  font-size: 14px; color: var(--text); background: var(--surface); outline: none; font-family: var(--font);
}
</style>
