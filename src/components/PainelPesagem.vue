<template>
  <!--
    Painel "Total para pesar" (consolidado do lote) — somente leitura.
    Usado em Produzir (Cozinha) e em Produções, para os dois terem o mesmo visual.
    Se `checklist` for passado (id → true/false), mostra o progresso da pesagem.
  -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="aberto" class="pp-overlay" @click.self="$emit('fechar')">
        <div class="pp-sheet" role="dialog" aria-modal="true" aria-label="Total para pesar">

          <header class="pp-hdr">
            <span class="pp-grab" aria-hidden="true"></span>
            <div class="pp-hdr-ico"><i class="fas fa-scale-balanced"></i></div>
            <div class="pp-hdr-txt">
              <h3>Total para pesar</h3>
              <p>Consolidado do lote · {{ ingredientes.length }} {{ ingredientes.length === 1 ? 'ingrediente' : 'ingredientes' }}</p>
            </div>
            <div v-if="timerDisplay" class="pp-timer">
              <i class="fas fa-stopwatch" :class="{ 'fa-beat-fade': timerRodando }"></i>
              {{ timerDisplay }}
            </div>
            <button type="button" class="pp-close" aria-label="Fechar" @click="$emit('fechar')">
              <i class="fas fa-xmark"></i>
            </button>
          </header>

          <div v-if="receitas.length" class="pp-receitas" aria-label="Receitas do lote">
            <span v-for="r in receitas" :key="r.id" class="pp-chip">
              <b>{{ r.qtd }}×</b> {{ r.nome }}<em v-if="r.formas"> · {{ r.formas }}</em>
            </span>
          </div>

          <div v-if="temChecklist && ingredientes.length" class="pp-prog">
            <div class="pp-prog-txt">
              <span><b>{{ pesados }}</b> de {{ ingredientes.length }} pesados</span>
              <span v-if="pesados === ingredientes.length" class="pp-prog-ok"><i class="fas fa-circle-check"></i> Tudo pesado</span>
            </div>
            <div class="pp-bar"><span :style="{ width: pct + '%' }"></span></div>
          </div>

          <ol class="pp-lista">
            <li
              v-for="(ing, idx) in ingredientes"
              :key="ing.id"
              class="pp-item"
              :class="{ 'pp-item--feito': feito(ing), 'pp-item--proximo': idx === proximo }"
            >
              <span class="pp-num" aria-hidden="true">
                <i v-if="feito(ing)" class="fas fa-check"></i>
                <template v-else>{{ idx + 1 }}</template>
              </span>
              <div class="pp-corpo">
                <div class="pp-linha">
                  <span class="pp-nome">
                    <i v-if="ing.tipo === 'receita'" class="fas fa-mortar-pestle pp-nome-ico"></i>{{ ing.nome }}
                  </span>
                  <span class="pp-qtd"><b>{{ fmtQ(ing.total) }}</b><small>{{ ing.unidade }}</small></span>
                </div>
                <SubComposicao :subs="ing.subIngredientes" class="pp-sub" />
              </div>
            </li>
          </ol>

          <div v-if="!ingredientes.length" class="pp-vazio">{{ vazio }}</div>

          <footer class="pp-foot">
            <span class="pp-nota"><i class="fas fa-eye"></i> {{ nota }}</span>
            <button type="button" class="pp-btn" @click="$emit('fechar')">Fechar</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { fmtQtd as fmtQ } from '../utils.js'
import SubComposicao from './SubComposicao.vue'

const props = defineProps({
  aberto:        { type: Boolean, default: false },
  // [{ id, nome, qtd, formas? }]
  receitas:      { type: Array,   default: () => [] },
  // [{ id, nome, total, unidade, tipo?, subIngredientes? }]
  ingredientes:  { type: Array,   default: () => [] },
  // { [ingredienteId]: true } — opcional; ativa o progresso e o "feito"
  checklist:     { type: Object,  default: null },
  timerDisplay:  { type: String,  default: '' },
  timerRodando:  { type: Boolean, default: false },
  nota:          { type: String,  default: 'Somente visualização' },
  vazio:         { type: String,  default: 'Nenhum ingrediente no lote ainda.' }
})
const emit = defineEmits(['fechar'])

const temChecklist = computed(() => !!props.checklist)
const feito = (ing) => !!props.checklist?.[ing.id]
const pesados = computed(() => props.ingredientes.filter(feito).length)
const pct = computed(() => props.ingredientes.length ? Math.round((pesados.value / props.ingredientes.length) * 100) : 0)
// Destaque: primeiro ingrediente ainda não pesado (ou o primeiro da lista, sem checklist)
const proximo = computed(() => props.ingredientes.findIndex(i => !feito(i)))

function onKey(e) { if (e.key === 'Escape') emit('fechar') }
watch(() => props.aberto, (v) => {
  if (v) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.pp-overlay {
  position: fixed; inset: 0;
  background: rgba(30,18,8,.55);
  z-index: calc(var(--z-modal) + 500);
  display: flex; align-items: flex-end; justify-content: center;
}
.pp-sheet {
  width: 100%; max-width: 560px; max-height: 92vh; max-height: 92dvh;
  background: var(--bg, #f7f3ee);
  border-radius: 22px 22px 0 0;
  display: flex; flex-direction: column;
  overflow: hidden;
  will-change: transform;
  animation: slideUp .25s var(--t-spring);
}

/* Cabeçalho */
.pp-hdr {
  position: relative; flex-shrink: 0;
  display: flex; align-items: center; gap: 12px;
  padding: 24px 16px 14px;
  background: linear-gradient(135deg, var(--brown-dark), var(--brown));
  color: #fff;
}
.pp-grab {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  width: 38px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.3);
}
.pp-hdr-ico {
  flex: none; width: 42px; height: 42px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.14); color: var(--gold-light, #f5c842); font-size: 1.1rem;
}
.pp-hdr-txt { flex: 1; min-width: 0; }
.pp-hdr-txt h3 { margin: 0; font-size: 1.05rem; font-weight: 800; line-height: 1.2; }
.pp-hdr-txt p  { margin: 2px 0 0; font-size: .74rem; font-weight: 600; color: rgba(255,255,255,.72); }
.pp-timer {
  flex: none; display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,.12);
  font-family: var(--mono); font-size: .82rem; font-weight: 700; color: var(--gold-light, #f5c842);
}
.pp-close {
  flex: none; width: 40px; height: 40px; border-radius: 50%; border: none;
  background: rgba(255,255,255,.14); color: #fff; font-size: 1rem;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.pp-close:active { background: rgba(255,255,255,.26); }

/* Receitas do lote: uma linha só, rolagem horizontal */
.pp-receitas {
  flex-shrink: 0; display: flex; gap: 8px; overflow-x: auto;
  padding: 12px 16px 4px; scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.pp-receitas::-webkit-scrollbar { display: none; }
.pp-chip {
  flex: none; white-space: nowrap;
  padding: 6px 12px; border-radius: 999px;
  background: #fff; border: 1px solid var(--border);
  font-size: .76rem; font-weight: 700; color: var(--brown-dark);
}
.pp-chip b  { color: var(--gold-dark); }
.pp-chip em { font-style: normal; font-weight: 600; color: var(--muted); }

/* Progresso */
.pp-prog { flex-shrink: 0; padding: 10px 16px 2px; }
.pp-prog-txt { display: flex; justify-content: space-between; align-items: center; font-size: .78rem; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
.pp-prog-txt b { color: var(--brown-dark); font-weight: 800; }
.pp-prog-ok { color: var(--green); font-weight: 800; display: inline-flex; align-items: center; gap: 5px; }
.pp-bar { height: 6px; border-radius: 6px; background: var(--cream-deep, #efe6d6); overflow: hidden; }
.pp-bar span { display: block; height: 100%; border-radius: 6px; background: var(--green); transition: width .25s ease; }

/* Lista */
.pp-lista {
  flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
  list-style: none; margin: 0; padding: 10px 16px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.pp-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 14px; background: #fff;
  border: 1px solid var(--border); border-radius: var(--r-md);
}
.pp-num {
  flex: none; width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--cream-deep, #efe6d6); color: var(--brown-mid);
  font-family: var(--mono); font-size: .8rem; font-weight: 800;
}
.pp-corpo  { flex: 1; min-width: 0; }
.pp-linha  { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 30px; }
.pp-nome   { min-width: 0; font-size: 1rem; font-weight: 700; line-height: 1.25; color: var(--brown); overflow-wrap: anywhere; }
.pp-nome-ico { font-size: .75rem; margin-right: 6px; color: var(--gold-dark); opacity: .85; }
.pp-qtd    { flex: none; display: inline-flex; align-items: baseline; gap: 4px; font-family: var(--mono); font-variant-numeric: tabular-nums; }
.pp-qtd b  { font-size: 1.25rem; font-weight: 800; color: var(--brown-dark); }
.pp-qtd small { font-size: .76rem; font-weight: 700; color: var(--muted); }

/* Composição (sub-ingredientes) com guia à esquerda */
.pp-sub { margin-top: 8px; padding-left: 10px; border-left: 2px solid var(--border); }
.pp-sub :deep(.c-brown) { display: none; }
.pp-sub :deep(.plan-sub-item) { font-size: .78rem; }

/* Próximo a pesar */
.pp-item--proximo { background: var(--gold-bg); border-color: var(--gold-dark); }
.pp-item--proximo .pp-num { background: var(--brown); color: #fff; }
.pp-item--proximo .pp-nome { font-weight: 800; color: var(--brown-dark); }
.pp-item--proximo .pp-qtd b { font-size: 1.4rem; }

/* Já pesado */
.pp-item--feito { opacity: .55; }
.pp-item--feito .pp-num { background: var(--green); color: #fff; }
.pp-item--feito .pp-nome { text-decoration: line-through; color: var(--muted); }

.pp-vazio { text-align: center; color: var(--muted); padding: 32px 20px; font-size: .85rem; }

/* Rodapé */
.pp-foot {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--surface); border-top: 1px solid var(--border);
}
.pp-nota { display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; color: var(--muted); min-width: 0; }
.pp-btn {
  flex: none; height: 44px; padding: 0 24px; border: none; border-radius: 999px;
  background: var(--brown); color: #fff; font-family: var(--font); font-size: .85rem; font-weight: 800; cursor: pointer;
}
.pp-btn:active { background: var(--brown-dark); }
</style>
