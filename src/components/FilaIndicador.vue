<template>
  <div v-if="visivel" class="fila-ind" :class="`fila-ind--${estado}`" role="status">
    <button class="fila-ind-btn" type="button" @click="aberto = !aberto" :aria-expanded="aberto">
      <i class="fas" :class="icone" aria-hidden="true"></i>
      <span>{{ texto }}</span>
    </button>
    <div v-if="aberto" class="fila-ind-painel">
      <p v-if="erroLeitura"><strong>{{ erroLeitura }}</strong> O que aparece na tela agora pode estar desatualizado (são os dados guardados neste aparelho).</p>
      <p v-if="pendentes">As alterações ficam guardadas neste aparelho e são enviadas assim que houver sinal.</p>
      <p v-if="precisaEntrar">
        Sua sessão venceu. <a class="fila-ind-link" href="/api/caderneta/eu" target="_blank" rel="noopener">Toque aqui para entrar de novo</a>,
        depois volte ao app: o envio recomeça sozinho.
      </p>
      <ul v-if="rejeitadas.length" class="fila-ind-lista">
        <li v-for="r in rejeitadas" :key="r.op_id">
          <strong>{{ rotulo(r.tipo) }}</strong> — {{ r.motivo }}
          <button type="button" class="fila-ind-ok" @click="dispensar(r.op_id)">Entendi</button>
        </li>
      </ul>
      <button v-if="pendentes" type="button" class="fila-ind-enviar" @click="enviarAgora()">Enviar agora</button>
      <p v-if="!pendentes && !rejeitadas.length && !erroLeitura">Tudo que foi lançado aqui já está salvo no servidor.</p>
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

const { estado, texto, pendentes, rejeitadas, enviarAgora, precisaEntrar, erroLeitura } = useFilaOps()
const aberto = ref(false)
const visivel = computed(() => cadernetaNoServidor())
const icone = computed(() => ({ saved: 'fa-cloud', pending: 'fa-clock', syncing: 'fa-rotate fa-spin', offline: 'fa-plug-circle-xmark', attention: 'fa-triangle-exclamation' }[estado.value] || 'fa-cloud'))
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
/* Mesmo vocabulário do app: pílula com fundo suave (como os avisos do Caderninho) e painel branco em cartão. */
.fila-ind { margin: 0 14px 8px; font-family: var(--font); font-size: .86rem; --fi-cor: var(--green); --fi-bg: var(--green-bg); --fi-borda: var(--green-dim); }
.fila-ind--pending, .fila-ind--syncing, .fila-ind--offline { --fi-cor: #8a4b00; --fi-bg: #fff4e0; --fi-borda: var(--orange-dim); }
.fila-ind--attention { --fi-cor: var(--red); --fi-bg: var(--red-bg); --fi-borda: var(--red-dim, #f5c2c2); }
.fila-ind-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--fi-borda); background: var(--fi-bg); color: var(--fi-cor); font-family: var(--font); font-size: .84rem; font-weight: 800; line-height: 1.2; text-align: left; cursor: pointer; }
.fila-ind-painel { margin-top: 8px; padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.fila-ind-painel p { margin: 0 0 8px; font-size: .84rem; line-height: 1.45; color: var(--text); }
.fila-ind-link { color: var(--brown-mid); font-weight: 700; text-decoration: underline; }
.fila-ind-lista { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 8px; font-size: .84rem; color: var(--text); }
.fila-ind-ok, .fila-ind-enviar { margin-left: 8px; min-height: 36px; padding: 0 12px; border-radius: var(--r-sm); border: 1px solid var(--border2, var(--border)); background: var(--cream, #faf6f0); color: var(--brown-dark); font-family: var(--font); font-size: .82rem; font-weight: 700; cursor: pointer; }
</style>
