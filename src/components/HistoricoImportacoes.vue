<template>
  <section v-if="lotes.length" class="sheet-card hi">
    <div class="sheet-body">
      <div class="hi-tit">Histórico de importações</div>
      <div v-for="l in lotes" :key="l.id" class="hi-item" :class="{ 'is-desfeita': l.desfeito_em }">
        <div class="hi-info">
          <div class="hi-l1">{{ rotulo(l.banco) }}<span v-if="l.conta_nome"> · {{ l.conta_nome }}</span></div>
          <div class="hi-l2">{{ l.arquivo || 'arquivo sem nome' }}</div>
          <div class="hi-l3">
            {{ dataHora(l.quando) }} · {{ l.qtd }} lançamento(s)
            <template v-if="l.periodo?.ini"> · {{ data(l.periodo.ini) }} a {{ data(l.periodo.fim) }}</template>
          </div>
        </div>
        <span v-if="l.desfeito_em" class="hi-tag">Desfeita</span>
        <button v-else class="hi-btn" @click="desfazer(l)"><i class="fas fa-rotate-left"></i> Desfazer</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '../store.js'
import { useConfirm } from '../composables/useConfirm.js'
import { BANCOS_LEITORES } from '../services/extratoImport.js'

const s = useStore()
const confirmar = useConfirm()
const lotes = computed(() => (s.importacoesExtrato || []).slice(0, 10))
const rotulo = (b) => BANCOS_LEITORES[b]?.rotulo || b || 'Banco'
const data = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/')
const dataHora = (iso) => `${data(iso)} ${String(iso || '').slice(11, 16)}`

async function desfazer(l) {
  const ok = await confirmar.ask(
    `Remove os ${l.qtd} lançamentos importados de “${l.arquivo || 'este arquivo'}” (${dataHora(l.quando)}) e devolve as classificações que essa importação tinha alterado. Lançamentos de outras importações não são tocados.`,
    { title: 'Desfazer importação', icon: 'fas fa-rotate-left', confirmLabel: 'Desfazer', type: 'danger' }
  )
  if (ok) await s.desfazerImportacaoExtrato(l.id)
}
</script>

<style scoped>
.hi-tit { font-size: .64rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.hi-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.hi-item:last-child { border-bottom: 0; }
.hi-item.is-desfeita { opacity: .55; }
.hi-info { flex: 1; min-width: 0; }
.hi-l1 { font-weight: 800; font-size: .84rem; color: var(--brown-dark); }
.hi-l2 { font-size: .76rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hi-l3 { font-size: .7rem; color: var(--muted); }
.hi-btn { border: 1px solid var(--red-dim); background: var(--red-bg); color: var(--red); border-radius: 999px; padding: 8px 12px; font: inherit; font-size: .74rem; font-weight: 800; cursor: pointer; flex-shrink: 0; }
.hi-tag { font-size: .7rem; font-weight: 800; color: var(--muted); flex-shrink: 0; }
</style>
