<template>
  <BaseModal title="Conferir antes de importar" persistent @close="$emit('cancelar')">
    <div class="ip">
      <section class="ip-origem">
        <div class="ip-linha"><span>Arquivo</span><strong>{{ previa.arquivo }}</strong></div>
        <div class="ip-linha"><span>Banco</span><strong>{{ previa.analise.rotulo }}</strong></div>
        <div class="ip-linha"><span>Conta de destino</span><strong>{{ previa.conta ? previa.conta.nome : '—' }}</strong></div>
      </section>

      <!-- Bloqueios: o arquivo não pode ser importado -->
      <section v-if="previa.analise.bloqueios.length" class="ip-caixa ip-bloqueio" role="alert">
        <div class="ip-caixa-tit"><i class="fas fa-ban"></i> Não vou importar este arquivo</div>
        <ul><li v-for="b in previa.analise.bloqueios" :key="b.codigo + b.msg">{{ b.msg }}</li></ul>
        <p class="ip-nota">Nada foi gravado. Confira se você escolheu o banco e o arquivo certos.</p>
      </section>

      <template v-else>
        <section class="ip-grade">
          <div class="ip-card"><span>Período</span><strong>{{ data(r.ini) }} a {{ data(r.fim) }}</strong></div>
          <div class="ip-card"><span>Entram agora</span><strong class="c-green">{{ previa.simulacao.novos }}</strong></div>
          <div class="ip-card"><span>Já existiam</span><strong>{{ previa.simulacao.duplicados }}</strong></div>
          <div class="ip-card"><span>Entradas</span><strong class="c-green">{{ R$(r.entradas) }}</strong></div>
          <div class="ip-card"><span>Saídas</span><strong class="c-red">{{ R$(r.saidas) }}</strong></div>
        </section>

        <section v-if="previa.analise.avisos.length" class="ip-caixa ip-aviso">
          <div class="ip-caixa-tit"><i class="fas fa-triangle-exclamation"></i> Atenção</div>
          <ul><li v-for="a in previa.analise.avisos" :key="a.codigo">{{ a.msg }}</li></ul>
        </section>

        <section class="ip-amostra">
          <div class="ip-amostra-tit">Primeiros lançamentos do arquivo</div>
          <div v-for="(l, i) in previa.amostra" :key="i" class="ip-item">
            <span class="ip-item-data">{{ data(l.data) }}</span>
            <span class="ip-item-desc">{{ l.descricao }}</span>
            <span class="ip-item-valor" :class="l.valor < 0 ? 'c-red' : 'c-green'">{{ R$(l.valor) }}</span>
          </div>
          <div v-if="r.qtd > previa.amostra.length" class="ip-mais">… e mais {{ r.qtd - previa.amostra.length }}</div>
        </section>

        <label v-if="previa.analise.reforcada" class="ip-reforco">
          <input v-model="confirmouOrigem" type="checkbox" />
          <span>Confirmo que este arquivo é um extrato do <b>{{ previa.analise.rotulo }}</b>, conta <b>{{ previa.conta ? previa.conta.nome : '' }}</b>.</span>
        </label>
      </template>
    </div>

    <template #foot>
      <div class="ip-botoes">
        <button class="btn btn-secondary" :disabled="confirmando" @click="$emit('cancelar')">
          {{ previa.analise.bloqueios.length ? 'Fechar' : 'Cancelar' }}
        </button>
        <button v-if="!previa.analise.bloqueios.length" class="btn btn-primary" :disabled="!podeImportar" @click="$emit('confirmar')">
          <i class="fas" :class="confirmando ? 'fa-spinner fa-spin' : 'fa-file-import'"></i>
          {{ previa.simulacao.novos ? `Importar ${previa.simulacao.novos} lançamento(s)` : 'Nada novo para importar' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { R$ } from '../utils.js'

const props = defineProps({ previa: { type: Object, required: true }, confirmando: Boolean })
defineEmits(['confirmar', 'cancelar'])

const confirmouOrigem = ref(false)
const r = computed(() => props.previa.analise.resumo)
const data = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/')
const podeImportar = computed(() =>
  !props.confirmando &&
  props.previa.simulacao?.novos > 0 &&
  (!props.previa.analise.reforcada || confirmouOrigem.value)
)
</script>

<style scoped>
.ip { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.ip-origem { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 4px 12px; }
.ip-linha { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: .82rem; }
.ip-linha:last-child { border-bottom: 0; }
.ip-linha span { color: var(--muted); font-weight: 700; }
.ip-linha strong { color: var(--brown-dark); text-align: right; word-break: break-all; }
.ip-grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ip-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ip-card:first-child { grid-column: span 2; }
.ip-card span { font-size: .64rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.ip-card strong { font-family: var(--mono); font-size: .86rem; color: var(--brown-dark); }
.ip-caixa { border-radius: var(--r-md); padding: 12px; font-size: .82rem; }
.ip-caixa-tit { font-weight: 800; margin-bottom: 6px; display: flex; gap: 8px; align-items: center; }
.ip-caixa ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
.ip-bloqueio { background: var(--red-bg); border: 1px solid var(--red-dim); color: var(--red); }
.ip-aviso { background: var(--gold-bg); border: 1px solid rgba(200, 137, 10, .45); color: var(--gold-dark); }
.ip-nota { margin: 8px 0 0; font-weight: 700; }
.ip-amostra { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 8px 12px; }
.ip-amostra-tit { font-size: .64rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
.ip-item { display: grid; grid-template-columns: 84px 1fr auto; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: .76rem; align-items: baseline; }
.ip-item:last-of-type { border-bottom: 0; }
.ip-item-data { color: var(--muted); font-family: var(--mono); }
.ip-item-desc { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ip-item-valor { font-family: var(--mono); font-weight: 800; }
.ip-mais { font-size: .72rem; color: var(--muted); padding-top: 6px; }
.ip-reforco { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--gold); font-size: .82rem; cursor: pointer; }
.ip-reforco input { margin-top: 3px; width: 18px; height: 18px; flex-shrink: 0; }
.ip-botoes { display: flex; gap: 10px; padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); }
.ip-botoes .btn { flex: 1; }
.ip-botoes .btn:first-child { flex: 0 0 auto; }
.c-green { color: var(--green); } .c-red { color: var(--red); }
</style>
