<template>
  <BaseModal title="Estilo da etiqueta" @close="emit('close')">
    <div class="ee">

      <!-- Pré-visualização: fica fixa no topo enquanto você ajusta -->
      <div class="ee-topo">
        <EtiquetaPreview :sabores="[vizinhos[0], amostra, vizinhos[1]]" :contato="contatoPrev" :estilo="draft" />
        <div class="ee-aviso" :class="`ee-aviso--${aviso.tipo}`" role="status">
          <i :class="aviso.icone" aria-hidden="true"></i>
          <span>{{ aviso.texto }}</span>
        </div>
      </div>

      <div class="ee-grupo">
        <label class="label" for="ee-amostra">Testar com o nome</label>
        <select id="ee-amostra" v-model="amostra" class="input">
          <optgroup v-if="sabores.length" label="Seus sabores">
            <option v-for="n in sabores" :key="n" :value="n">{{ n }}</option>
          </optgroup>
          <optgroup label="Exemplos">
            <option v-for="n in EXEMPLOS" :key="n" :value="n">{{ n }}</option>
          </optgroup>
        </select>
        <p v-if="sabores.length && qtdReduzidos > 0" class="hint">
          <i class="fas fa-circle-info"></i>
          Com este estilo, {{ qtdReduzidos }} dos seus {{ sabores.length }} sabores precisam ser reduzidos para caber
          (ex.: {{ exemploReduzido }}).
        </p>
      </div>

      <div class="ee-grupo">
        <label class="label" for="ee-fonte">Fonte</label>
        <select id="ee-fonte" v-model="draft.fonte" class="input">
          <option v-for="f in listaFontes" :key="f.id" :value="f.id">{{ f.rotulo }}</option>
        </select>
        <p v-if="draft.fonte === 'manuscrita'" class="hint ee-nota">
          <i class="fas fa-triangle-exclamation"></i>
          O PDF só aceita as fontes básicas: nele a manuscrita sai em <strong>Times itálico</strong>.
          Na impressão direta e no Word ela usa uma fonte cursiva de verdade, se o aparelho tiver uma.
          Confira com uma folha de teste antes de imprimir muitas.
        </p>
      </div>

      <div class="ee-grupo">
        <span class="label">Alinhamento</span>
        <div class="ee-seg" role="group" aria-label="Alinhamento do texto">
          <button
            v-for="a in ALINHAMENTOS" :key="a.id" type="button" class="ee-seg-btn"
            :class="{ 'is-ativo': draft.alinhamento === a.id }"
            :aria-pressed="draft.alinhamento === a.id" :aria-label="a.nome"
            @click="draft.alinhamento = a.id"
          ><i :class="a.icone" aria-hidden="true"></i></button>
        </div>
      </div>

      <div class="ee-dupla">
        <div class="ee-grupo">
          <label class="label" for="ee-ts">Tamanho do sabor: <strong>{{ fmt(draft.tamSabor) }} pt</strong></label>
          <input id="ee-ts" v-model.number="draft.tamSabor" type="range" class="ee-range"
            :min="LIMITES.tamSabor.min" :max="LIMITES.tamSabor.max" :step="LIMITES.tamSabor.passo" />
        </div>
        <div class="ee-grupo">
          <label class="label" for="ee-tc">Tamanho do contato: <strong>{{ fmt(draft.tamContato) }} pt</strong></label>
          <input id="ee-tc" v-model.number="draft.tamContato" type="range" class="ee-range"
            :min="LIMITES.tamContato.min" :max="LIMITES.tamContato.max" :step="LIMITES.tamContato.passo"
            :disabled="!draft.mostrarContato" />
        </div>
      </div>

      <div class="ee-grupo">
        <span class="label">Cor do sabor</span>
        <div class="ee-cores" role="group" aria-label="Cor do sabor">
          <button
            v-for="c in CORES" :key="c.hex" type="button" class="ee-cor"
            :class="{ 'is-ativa': draft.corSabor === c.hex }" :style="{ background: c.hex }"
            :aria-label="c.nome" :aria-pressed="draft.corSabor === c.hex"
            @click="draft.corSabor = c.hex"
          ></button>
          <label class="ee-cor ee-cor--outra" :class="{ 'is-ativa': !corNaLista(draft.corSabor) }" title="Outra cor">
            <i class="fas fa-eye-dropper" aria-hidden="true"></i>
            <input type="color" :value="draft.corSabor" aria-label="Outra cor do sabor" @input="draft.corSabor = $event.target.value" />
          </label>
        </div>
      </div>

      <div class="ee-grupo" :class="{ 'ee-off': !draft.mostrarContato }">
        <span class="label">Cor do contato</span>
        <div class="ee-cores" role="group" aria-label="Cor do contato">
          <button
            v-for="c in CORES" :key="c.hex" type="button" class="ee-cor"
            :class="{ 'is-ativa': draft.corContato === c.hex }" :style="{ background: c.hex }"
            :aria-label="c.nome" :aria-pressed="draft.corContato === c.hex" :disabled="!draft.mostrarContato"
            @click="draft.corContato = c.hex"
          ></button>
          <label class="ee-cor ee-cor--outra" :class="{ 'is-ativa': !corNaLista(draft.corContato) }" title="Outra cor">
            <i class="fas fa-eye-dropper" aria-hidden="true"></i>
            <input type="color" :value="draft.corContato" :disabled="!draft.mostrarContato" aria-label="Outra cor do contato" @input="draft.corContato = $event.target.value" />
          </label>
        </div>
      </div>

      <div class="ee-dupla">
        <div class="ee-grupo">
          <label class="label" for="ee-dx">Deslocar na horizontal: <strong>{{ fmt(draft.dx) }} mm</strong></label>
          <input id="ee-dx" v-model.number="draft.dx" type="range" class="ee-range"
            :min="LIMITES.desloc.min" :max="LIMITES.desloc.max" :step="LIMITES.desloc.passo" />
        </div>
        <div class="ee-grupo">
          <label class="label" for="ee-dy">Deslocar na vertical: <strong>{{ fmt(draft.dy) }} mm</strong></label>
          <input id="ee-dy" v-model.number="draft.dy" type="range" class="ee-range"
            :min="LIMITES.desloc.min" :max="LIMITES.desloc.max" :step="LIMITES.desloc.passo" />
        </div>
      </div>
      <p class="hint ee-dica">Use o deslocamento se, na sua impressora, o texto sai um pouco para o lado ou para cima/baixo na etiqueta. Positivo = direita / para baixo.</p>

      <div class="ee-grupo ee-opcoes">
        <label class="ee-opcao"><input v-model="draft.negrito" type="checkbox" /> <span>Sabor em negrito</span></label>
        <label class="ee-opcao"><input v-model="draft.maiusculas" type="checkbox" /> <span>Sabor em MAIÚSCULAS</span></label>
        <label class="ee-opcao"><input v-model="draft.mostrarContato" type="checkbox" /> <span>Mostrar contato</span></label>
      </div>

      <p class="hint ee-dica">
        O texto de contato é o do campo da tela anterior. Este estilo vale para todos os aparelhos
        (fica no backup e na sincronização); o ajuste de impressão continua por aparelho.
      </p>
    </div>

    <template #foot>
      <button type="button" class="btn btn-secondary" :disabled="ehPadrao" @click="restaurar">
        <i class="fas fa-rotate-left"></i> Padrão
      </button>
      <button type="button" class="btn btn-primary ee-salvar" @click="salvar">
        <i class="fas fa-check"></i> Usar este estilo
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import EtiquetaPreview from './EtiquetaPreview.vue'
import { medirEncaixe } from '../composables/etiquetasPdfCore.js'
import {
  ESTILO_PADRAO, LIMITES, CORES, ALINHAMENTOS, FONTES,
  normalizarEstilo, estiloEhPadrao
} from '../composables/etiquetasEstilo.js'

const props = defineProps({
  estilo: { type: Object, default: null },           // estilo salvo (null = padrão)
  contato: { type: String, default: '' },            // texto de contato que vai na etiqueta
  sabores: { type: Array, default: () => [] }        // nomes reais das etiquetas, para testar
})
const emit = defineEmits(['close', 'salvar'])

const EXEMPLOS = ['Maracujá', 'Brigadeiro Gourmet com Castanha', 'Ninho com Nutella e Morango']
const listaFontes = Object.values(FONTES)
const fmt = (v) => String(v).replace('.', ',')
const corNaLista = (hex) => CORES.some(c => c.hex === hex)

const draft = reactive(normalizarEstilo(props.estilo))
const ehPadrao = computed(() => estiloEhPadrao(draft))

// ── Nome usado no teste: por padrão, o sabor mais comprido (o pior caso) ──
const saboresUnicos = computed(() => [...new Set(props.sabores.map(s => String(s).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)))
const maisLongo = props.sabores.length ? [...props.sabores].sort((a, b) => String(b).length - String(a).length)[0] : null
const amostra = ref(maisLongo || EXEMPLOS[0])
const vizinhos = computed(() => {
  const base = saboresUnicos.value.filter(n => n !== amostra.value)
  return [base[0] || 'Ninho', base[1] || 'Prestígio']
})
const contatoPrev = computed(() => props.contato?.trim() || 'Doces da Ana (21) 9 9999-0000')

// ── Aviso de encaixe (mesmo cálculo da impressão) ──
const aviso = computed(() => {
  const r = medirEncaixe(amostra.value, contatoPrev.value, draft)
  if (r.estoura) {
    return { tipo: 'erro', icone: 'fas fa-circle-xmark', texto: 'Mesmo no tamanho mínimo este nome não cabe e fica cortado. Use um nome de etiqueta mais curto na receita.' }
  }
  if (!r.cabe) {
    const partes = []
    if (r.tamS !== draft.tamSabor) partes.push(`sabor de ${fmt(draft.tamSabor)} para ${fmt(r.tamS)} pt`)
    if (draft.mostrarContato && r.tamC !== draft.tamContato) partes.push(`contato de ${fmt(draft.tamContato)} para ${fmt(r.tamC)} pt`)
    return { tipo: 'aviso', icone: 'fas fa-triangle-exclamation', texto: `Não cabe no tamanho escolhido: o sistema reduz sozinho (${partes.join('; ')}).` }
  }
  return { tipo: 'ok', icone: 'fas fa-circle-check', texto: 'Cabe na etiqueta de 12 mm de altura.' }
})

// Quantos dos sabores reais precisam encolher com o estilo atual
const reduzidos = computed(() => saboresUnicos.value.filter(n => !medirEncaixe(n, contatoPrev.value, draft).cabe))
const qtdReduzidos = computed(() => reduzidos.value.length)
const exemploReduzido = computed(() => reduzidos.value[0] || '')

function restaurar() { Object.assign(draft, ESTILO_PADRAO) }
function salvar() {
  const final = normalizarEstilo(draft)
  emit('salvar', estiloEhPadrao(final) ? null : final)
}
</script>

<style scoped>
.ee { padding: 0 16px 24px; }

.ee-topo {
  position: sticky; top: 0; z-index: 3;
  margin: 0 -16px 14px; padding: 12px 16px 10px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.ee-aviso {
  display: flex; align-items: flex-start; gap: 8px;
  margin-top: 8px; font-size: .8rem; line-height: 1.4; font-weight: 600;
}
.ee-aviso i { margin-top: 2px; }
.ee-aviso--ok { color: var(--green); }
.ee-aviso--aviso { color: var(--orange); }
.ee-aviso--erro { color: var(--red); }

.ee-grupo { margin-bottom: 14px; }
.ee-grupo .label { display: block; margin-bottom: 6px; }
.ee-grupo .label strong { color: var(--brown-mid); font-weight: 800; }
.ee-grupo .input { width: 100%; }
.ee-dupla { display: grid; grid-template-columns: 1fr; gap: 0; }
@media (min-width: 420px) { .ee-dupla { grid-template-columns: 1fr 1fr; gap: 0 16px; } }
.ee-off { opacity: .45; }
.ee-nota { margin-top: 8px; }
.ee-nota i { color: var(--orange); margin-right: 4px; }
.ee-dica { margin: -4px 0 14px; }

/* Alinhamento */
.ee-seg { display: flex; gap: 8px; }
.ee-seg-btn {
  flex: 1; min-height: 44px; border-radius: var(--r-sm);
  border: 1.5px solid var(--border2); background: var(--surface); color: var(--muted);
  font-size: 1rem; cursor: pointer; transition: all var(--t);
}
.ee-seg-btn.is-ativo { background: var(--gold-bg); border-color: var(--gold-dark); color: var(--gold-dark); }
.ee-seg-btn:active { transform: scale(.97); }

/* Faixas */
.ee-range { width: 100%; height: 32px; accent-color: var(--gold-dark); }
.ee-range:disabled { opacity: .4; }

/* Cores */
.ee-cores { display: flex; flex-wrap: wrap; gap: 10px; }
.ee-cor {
  position: relative; width: 38px; height: 38px; padding: 0; border-radius: 50%;
  border: 2px solid var(--surface); box-shadow: 0 0 0 1.5px var(--border2);
  cursor: pointer; transition: transform var(--t), box-shadow var(--t);
  display: inline-flex; align-items: center; justify-content: center;
}
.ee-cor:active { transform: scale(.92); }
.ee-cor.is-ativa { box-shadow: 0 0 0 3px var(--gold-dark); }
.ee-cor:disabled { cursor: default; }
.ee-cor--outra { background: conic-gradient(#e34948, #fab219, #5cb85c, #3b82f6, #827dbd, #e34948); color: #fff; overflow: hidden; }
.ee-cor--outra i { font-size: .8rem; filter: drop-shadow(0 0 2px rgba(0,0,0,.6)); pointer-events: none; }
.ee-cor--outra input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }

/* Opções */
.ee-opcoes { display: flex; flex-direction: column; gap: 4px; }
.ee-opcao {
  display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px;
  border: 1.5px solid var(--border); border-radius: var(--r-sm); background: var(--surface);
  font-size: .9rem; font-weight: 600; color: var(--text); cursor: pointer;
}
.ee-opcao input { width: 20px; height: 20px; accent-color: var(--gold-dark); flex-shrink: 0; }

.ee-salvar { flex: 1; }
</style>
