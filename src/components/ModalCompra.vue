<template>
  <Teleport to="body">
    <div v-if="modalPreco" class="bottom-sheet-overlay" @click.self="fecharModalPreco">
      <div class="lc-modal">
        <div class="lc-modal-hdr">
          <span class="lc-modal-titulo"><i class="fas fa-tag"></i> {{ modalPreco.nome }}</span>
          <button class="lc-modal-close" @click="fecharModalPreco"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="lc-modal-body">
          <div class="preco-mode-toggle">
            <button class="preco-mode-btn" :class="{ active: modoPreco === 'embalagem' }" @click="modoPreco = 'embalagem'">
              <i class="fas fa-box"></i> Preco da embalagem
            </button>
            <button class="preco-mode-btn" :class="{ active: modoPreco === 'fracionado' }" @click="modoPreco = 'fracionado'">
              <i class="fas fa-scale-balanced"></i> Compra a granel
            </button>
          </div>

          <div v-if="modoPreco === 'embalagem'" class="preco-form">
            <div class="preco-field">
              <label class="preco-label">
                Preco da embalagem
                <span v-if="modalPreco.fatorConv > 0" class="preco-label-sub">({{ fmtQ(modalPreco.fatorConv, modalPreco.unidade) }})</span>
              </label>
              <div class="preco-input-row">
                <span class="preco-prefix">R$</span>
                <input class="preco-input" type="text" inputmode="numeric" :value="precoEmbInput" @input="onPrecoEmbInput" @keydown="bloquearLetras" placeholder="0,00" />
              </div>
            </div>
            <div v-if="precoEmbCalculado > 0" class="preco-resultado">
              <i class="fas fa-calculator"></i>
              Custo/{{ modalPreco.unidade }}: <strong>{{ R$(precoEmbCalculado) }}</strong>
              <span v-if="modalPreco.unidade === 'g'">- {{ R$(precoEmbCalculado * 1000) }}/kg</span>
              <span v-if="modalPreco.unidade === 'ml'">- {{ R$(precoEmbCalculado * 1000) }}/L</span>
            </div>

            <div class="preco-field mt-12">
              <label class="preco-label">Qtd. recebida</label>
              <div class="qtd-entrada-row">
                <button class="qtd-e-btn" @click="qtdEntradaInput = String(Math.max(1, (parseFloat(qtdEntradaInput) || 1) - 1))">-</button>
                <input class="qtd-e-input" type="text" inputmode="numeric" :value="qtdEntradaInput" @input="e => qtdEntradaInput = e.target.value.replace(/\D/g, '')" @keydown="bloquearLetras" />
                <button class="qtd-e-btn" @click="qtdEntradaInput = String((parseFloat(qtdEntradaInput) || 0) + 1)">+</button>
                <span class="qtd-e-unid">{{ modalPreco.nomeEmbPlural || 'un' }}</span>
              </div>
            </div>

            <button class="btn btn-primary btn-sm mt-12" :disabled="!(parseMoney(precoEmbInput) > 0)" @click="confirmarPrecoEmb">
              <i class="fas fa-boxes-stacking"></i> Confirmar compra
            </button>
          </div>

          <div v-if="modoPreco === 'fracionado'" class="preco-form">
            <div class="preco-grid-2">
              <div class="preco-field">
                <label class="preco-label">Valor pago (R$)</label>
                <div class="preco-input-row">
                  <span class="preco-prefix">R$</span>
                  <input class="preco-input" type="text" inputmode="numeric" :value="fracValor" @input="onFracValorInput" @keydown="bloquearLetras" placeholder="5,00" />
                </div>
              </div>
              <div class="preco-field">
                <label class="preco-label">Qtd. ({{ modalPreco.unidade }})</label>
                <div class="preco-input-row">
                  <input class="preco-input" type="text" inputmode="numeric" :value="fracQtd" @input="e => { fracQtd = e.target.value.replace(/[^\d,.]/g, ''); calcFracionado() }" @keydown="bloquearLetras" :placeholder="modalPreco.unidade === 'g' ? '167' : '0'" />
                  <span class="preco-suffix">{{ modalPreco.unidade }}</span>
                </div>
              </div>
            </div>
            <div v-if="fracResultado > 0" class="preco-resultado">
              <i class="fas fa-calculator"></i>
              <span v-if="modalPreco.unidade === 'g'"><strong>{{ R$(fracResultado * 1000) }}/kg</strong></span>
              <span v-else-if="modalPreco.unidade === 'ml'"><strong>{{ R$(fracResultado * 1000) }}/L</strong></span>
              <span v-else>{{ R$(fracResultado) }}/{{ modalPreco.unidade }}</span>
            </div>
            <div v-if="fracResultado > 0 && modalPreco.fatorConv > 0" class="preco-resultado preco-resultado-sec">
              <i class="fas fa-box"></i>
              Embalagem de {{ fmtQ(modalPreco.fatorConv, modalPreco.unidade) }} custaria
              <strong>{{ R$(fracResultado * modalPreco.fatorConv) }}</strong>
            </div>

            <div class="preco-field mt-12">
              <label class="preco-label">Qtd. recebida</label>
              <div class="qtd-entrada-row">
                <button class="qtd-e-btn" @click="qtdEntradaInput = String(Math.max(1, (parseFloat(qtdEntradaInput) || 1) - 1))">-</button>
                <input class="qtd-e-input" type="text" inputmode="numeric" :value="qtdEntradaInput" @input="e => qtdEntradaInput = e.target.value.replace(/\D/g, '')" @keydown="bloquearLetras" />
                <button class="qtd-e-btn" @click="qtdEntradaInput = String((parseFloat(qtdEntradaInput) || 0) + 1)">+</button>
                <span class="qtd-e-unid">{{ modalPreco.nomeEmbPlural || 'un' }}</span>
              </div>
            </div>

            <button class="btn btn-primary btn-sm mt-12" :disabled="!(fracResultado > 0)" @click="confirmarPrecoFrac">
              <i class="fas fa-boxes-stacking"></i> Confirmar compra
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { R$, fmtQtd as fmtQ, parseMoney } from '../utils.js'

defineProps({
  modalPreco: { type: Object, default: null },
  fecharModalPreco: { type: Function, required: true },
  onPrecoEmbInput: { type: Function, required: true },
  onFracValorInput: { type: Function, required: true },
  bloquearLetras: { type: Function, required: true },
  calcFracionado: { type: Function, required: true },
  confirmarPrecoEmb: { type: Function, required: true },
  confirmarPrecoFrac: { type: Function, required: true },
})

const modoPreco = defineModel('modoPreco', { type: String, required: true })
const precoEmbInput = defineModel('precoEmbInput', { type: String, required: true })
const precoEmbCalculado = defineModel('precoEmbCalculado', { type: Number, required: true })
const fracValor = defineModel('fracValor', { type: String, required: true })
const fracQtd = defineModel('fracQtd', { type: String, required: true })
const fracResultado = defineModel('fracResultado', { type: Number, required: true })
const qtdEntradaInput = defineModel('qtdEntradaInput', { type: String, required: true })
</script>

<style scoped>
.preco-mode-toggle { display: flex; gap: 6px; }
.preco-mode-btn {
  flex: 1; padding: 8px 10px; border-radius: var(--r-sm);
  border: 1.5px solid var(--border); background: var(--bg);
  font-size: .73rem; font-weight: 700; color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all .15s;
}
.preco-mode-btn.active { background: var(--brown-dark); color: #fff; border-color: var(--brown-dark); }
.preco-form { display: flex; flex-direction: column; gap: 10px; }
.preco-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.preco-field { display: flex; flex-direction: column; gap: 4px; }
.preco-label {
  font-size: .65rem; font-weight: 800; text-transform: uppercase; letter-spacing: .4px;
  color: var(--muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
}
.preco-label-sub { font-size: .65rem; color: var(--brown-mid); font-weight: 600; text-transform: none; letter-spacing: 0; }
.preco-input-row {
  display: flex; align-items: center; background: var(--bg);
  border: 1.5px solid var(--border); border-radius: var(--r-sm);
  overflow: hidden; transition: border-color .15s;
}
.preco-input-row:focus-within { border-color: var(--brown); }
.preco-prefix,
.preco-suffix {
  padding: 0 8px; font-size: .72rem; font-weight: 700; color: var(--muted);
  background: var(--surface); border-right: 1px solid var(--border);
  white-space: nowrap; align-self: stretch; display: flex; align-items: center;
}
.preco-suffix { border-right: none; border-left: 1px solid var(--border); }
.preco-input {
  flex: 1; border: none; background: transparent; padding: 9px 10px;
  font-size: .88rem; font-weight: 700; font-family: var(--mono);
  color: var(--brown-dark); outline: none; width: 0;
}
.preco-resultado {
  font-size: .74rem; color: var(--brown); background: var(--cream);
  border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px;
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
}
.preco-resultado i { font-size: .7rem; flex-shrink: 0; }
.preco-resultado strong { color: var(--brown-dark); }
.preco-resultado-sec { background: var(--bg); color: var(--muted); }
.qtd-entrada-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.mt-12 { margin-top: 4px; }
</style>
