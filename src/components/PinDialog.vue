<template>
  <Teleport to="body">
    <div class="pin-bg" @click.self="emit('cancelar')">
      <div class="pin-box" role="dialog" aria-modal="true" :aria-label="titulo">
        <div class="pin-icone"><i class="fas fa-lock"></i></div>
        <h3 class="pin-titulo">{{ titulo }}</h3>
        <p class="pin-sub">{{ subtitulo }}</p>

        <label class="pin-campo" :class="{ 'pin-campo--erro': !!erro }">
          <input
            ref="campo" v-model="valor"
            type="password" inputmode="numeric" autocomplete="off" maxlength="6"
            placeholder="••••" :disabled="ocupado"
            @input="aoDigitar" @keydown.enter.prevent="confirmar"
          >
        </label>

        <template v-if="modo === 'criar'">
          <label class="pin-campo pin-campo--2" :class="{ 'pin-campo--erro': !!erro }">
            <input
              v-model="repetir" type="password" inputmode="numeric" autocomplete="off" maxlength="6"
              placeholder="Repita o PIN" :disabled="ocupado"
              @input="aoDigitar" @keydown.enter.prevent="confirmar"
            >
          </label>
        </template>

        <div class="pin-erro" :class="{ 'pin-erro--on': !!erro }" role="alert">{{ erro }}</div>

        <div class="pin-btns">
          <button type="button" class="pin-btn pin-btn--sec" @click="emit('cancelar')">{{ rotuloCancelar }}</button>
          <button type="button" class="pin-btn pin-btn--pri" :disabled="!podeConfirmar || ocupado" @click="confirmar">
            {{ modo === 'criar' ? 'Salvar PIN' : 'Confirmar' }}
          </button>
        </div>
        <p v-if="modo === 'verificar'" class="pin-dica">
          Esqueceu? No aparelho Admin, abra Ajustes › Sistema › PIN do Admin e defina um novo.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { verificarPin, definirPin, pinValido, segundosTravado } from '../store/aparelho.js'

// modo 'verificar': pede o PIN e avisa `ok` quando confere.
// modo 'criar': pede o PIN duas vezes, grava e avisa `ok`.
const props = defineProps({
  modo: { type: String, default: 'verificar' },
  titulo: { type: String, default: 'PIN do Admin' },
  subtitulo: { type: String, default: 'Digite o PIN para continuar.' },
  rotuloCancelar: { type: String, default: 'Cancelar' }
})
const emit = defineEmits(['ok', 'cancelar'])

const campo = ref(null)
const valor = ref('')
const repetir = ref('')
const erro = ref('')
const ocupado = ref(false)

const podeConfirmar = computed(() =>
  props.modo === 'criar' ? pinValido(valor.value) && repetir.value.length >= 4 : valor.value.length >= 4
)

function aoDigitar() {
  valor.value = valor.value.replace(/\D/g, '')
  repetir.value = repetir.value.replace(/\D/g, '')
  erro.value = ''
}

async function confirmar() {
  if (!podeConfirmar.value || ocupado.value) return
  ocupado.value = true
  try {
    if (props.modo === 'criar') {
      if (valor.value !== repetir.value) { erro.value = 'Os dois PINs não são iguais.'; return }
      await definirPin(valor.value)
      emit('ok')
      return
    }
    if (await verificarPin(valor.value)) { emit('ok'); return }
    erro.value = 'PIN incorreto.'
    valor.value = ''
    campo.value?.focus()
  } catch (e) {
    erro.value = e?.message === 'PIN_TRAVADO'
      ? `Muitas tentativas. Aguarde ${segundosTravado()} s.`
      : 'Não foi possível validar o PIN neste aparelho.'
  } finally {
    ocupado.value = false
  }
}

onMounted(() => nextTick(() => campo.value?.focus()))
</script>

<style scoped>
.pin-bg {
  position: fixed; inset: 0; z-index: var(--z-critical, 9999);
  display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(30, 18, 8, .55); animation: pinFade .15s ease;
}
@keyframes pinFade { from { opacity: 0 } to { opacity: 1 } }
.pin-box {
  width: 100%; max-width: 340px; padding: 24px 20px 18px; text-align: center;
  background: var(--surface); border-radius: var(--r-xl); box-shadow: 0 20px 60px rgba(30, 18, 8, .35);
  font-family: var(--font);
}
.pin-icone {
  width: 52px; height: 52px; margin: 0 auto 10px; border-radius: 50%;
  background: var(--cream); color: var(--brown); font-size: 20px;
  display: flex; align-items: center; justify-content: center;
}
.pin-titulo { margin: 0 0 4px; font-size: 18px; font-weight: 800; color: var(--brown-dark); }
.pin-sub { margin: 0 0 16px; font-size: 13px; line-height: 1.4; color: var(--muted); }
.pin-campo {
  display: block; margin: 0 auto 10px; border-radius: var(--r-md);
  border: 1.5px solid var(--border); background: var(--cream); transition: border-color var(--t);
}
.pin-campo:focus-within { border-color: var(--brown); }
.pin-campo--erro { border-color: var(--red); }
.pin-campo input {
  width: 100%; height: 56px; border: 0; background: transparent; outline: none; text-align: center;
  font-family: var(--mono); font-size: 26px; font-weight: 800; letter-spacing: .35em; text-indent: .35em;
  color: var(--brown-dark);
}
.pin-campo--2 input { height: 48px; font-size: 18px; letter-spacing: .2em; }
.pin-campo input::placeholder { letter-spacing: .1em; font-size: 15px; font-weight: 700; color: var(--text-faint); }
.pin-erro { min-height: 18px; margin-bottom: 8px; font-size: 12.5px; font-weight: 700; color: var(--red); opacity: 0; transition: opacity var(--t); }
.pin-erro--on { opacity: 1; }
.pin-btns { display: flex; gap: 10px; }
.pin-btn {
  flex: 1; min-height: 48px; border-radius: var(--r-md); cursor: pointer;
  font-family: var(--font); font-size: 14px; font-weight: 800; transition: transform .1s, opacity var(--t);
}
.pin-btn:active { transform: scale(.97); }
.pin-btn--sec { background: var(--surface); border: 1.5px solid var(--border); color: var(--brown-mid); }
.pin-btn--pri { background: var(--brown); border: 1.5px solid var(--brown); color: #fff; }
.pin-btn:disabled { opacity: .45; cursor: default; }
.pin-dica { margin: 12px 0 0; font-size: 11.5px; line-height: 1.4; color: var(--muted); }
</style>
