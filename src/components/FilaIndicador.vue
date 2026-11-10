<template>
  <div v-if="visivel" class="fila-ind" :class="`fila-ind--${estado}`" role="status">
    <button class="fila-ind-btn" type="button" @click="aberto = !aberto" :aria-expanded="aberto">
      <i class="fas" :class="icone" aria-hidden="true"></i>
      <span>{{ texto }}</span>
    </button>
    <div v-if="aberto" class="fila-ind-painel">
      <p v-if="pendentes">As alterações ficam guardadas neste aparelho e são enviadas assim que houver sinal.</p>
      <ul v-if="rejeitadas.length" class="fila-ind-lista">
        <li v-for="r in rejeitadas" :key="r.op_id">
          <strong>{{ rotulo(r.tipo) }}</strong> — {{ r.motivo }}
          <button type="button" class="fila-ind-ok" @click="dispensar(r.op_id)">Entendi</button>
        </li>
      </ul>
      <button v-if="pendentes" type="button" class="fila-ind-enviar" @click="enviarAgora()">Enviar agora</button>
      <p v-if="!pendentes && !rejeitadas.length">Tudo que foi lançado aqui já está salvo no servidor.</p>
      <button type="button" class="fila-ind-enviar" style="margin-left:0" @click="alternarCorrecoes">
        {{ verCorrecoes ? 'Esconder' : 'Ver' }} cancelamentos, correções e estornos
      </button>
      <ul v-if="verCorrecoes" class="fila-ind-lista fila-ind-corr">
        <li v-if="!correcoes.length">Nada cancelado, corrigido ou estornado até agora.</li>
        <li v-for="(c, i) in correcoes" :key="i">
          <strong>{{ ROTULO_CORRECAO[c.tipo] }}</strong> · {{ c.cliente }}<span v-if="c.loja"> ({{ c.loja }})</span> · R$ {{ moeda(c.valor) }}
          <small> · {{ dia(c.quando) }}<span v-if="c.motivo"> · {{ c.motivo }}</span></small>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// Mostra "N alterações aguardando" (Caderneta no modo servidor) e as recusas do servidor, com o motivo.
import { ref, computed } from 'vue'
import { useFilaOps } from '../composables/useFilaOps.js'
import { dispensarRejeitada } from '../services/filaOperacoes.js'
import { cadernetaNoServidor } from '../services/modoServidor.js'
import { listarCorrecoes } from '../services/cadernetaServidor.js'

const { estado, texto, pendentes, rejeitadas, enviarAgora } = useFilaOps()
const aberto = ref(false)
const visivel = computed(() => cadernetaNoServidor())
const icone = computed(() => ({ saved: 'fa-cloud-check', pending: 'fa-clock', syncing: 'fa-rotate fa-spin', offline: 'fa-cloud-slash', attention: 'fa-triangle-exclamation' }[estado.value] || 'fa-cloud'))
const ROTULOS = { 'pagamento.registrar': 'Pagamento', 'pagamento.estornar': 'Estorno', 'recebimento.parcial': 'Recebimento', 'venda.vencimento': 'Vencimento', 'venda.criar': 'Venda' }
const rotulo = (t) => ROTULOS[t] || 'Alteração'
const dispensar = (id) => dispensarRejeitada(id)
const ROTULO_CORRECAO = { cancelada: 'Cancelada', corrigida: 'Corrigida', estorno: 'Estorno' }
const verCorrecoes = ref(false)
const correcoes = ref([])
const moeda = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const dia = (ms) => new Date(Number(ms)).toLocaleDateString('pt-BR')
async function alternarCorrecoes() {
  verCorrecoes.value = !verCorrecoes.value
  if (verCorrecoes.value) correcoes.value = await listarCorrecoes()
}
</script>

<style scoped>
.fila-ind { margin: 0 16px 8px; font-size: 0.9rem; }
.fila-ind-btn { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; border: 1px solid currentColor; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.fila-ind--saved { color: #2e7d32; }
.fila-ind--pending, .fila-ind--syncing, .fila-ind--offline { color: #b26a00; }
.fila-ind--attention { color: #c62828; }
.fila-ind-painel { margin-top: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(128, 128, 128, 0.35); color: inherit; }
.fila-ind-painel p { margin: 0 0 8px; opacity: 0.85; }
.fila-ind-lista { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 8px; }
.fila-ind-ok, .fila-ind-enviar { margin-left: 8px; padding: 4px 10px; border-radius: 8px; border: 1px solid currentColor; background: transparent; color: inherit; font: inherit; cursor: pointer; }
</style>
