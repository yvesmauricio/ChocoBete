<template>
  <div v-if="visivel" class="fila-ind" :class="`fila-ind--${estado}`" role="status">
    <div class="fila-ind-card">
      <button class="fila-ind-btn" type="button" @click="aberto = !aberto" :aria-expanded="aberto">
        <span class="fila-ind-ico"><i class="fas" :class="icone" aria-hidden="true"></i></span>
        <span class="fila-ind-txt">
          <span class="fila-ind-l1">{{ texto }}</span>
          <span class="fila-ind-l2">{{ subtexto }}</span>
        </span>
        <i class="fas fa-chevron-down fila-ind-seta" :class="{ 'fila-ind-seta--aberta': aberto }" aria-hidden="true"></i>
      </button>

      <div v-if="aberto" class="fila-ind-painel">
        <p v-if="pendentes" class="fila-ind-p">As alterações ficam guardadas neste aparelho e são enviadas assim que houver sinal.</p>
        <p v-if="precisaEntrar" class="fila-ind-p">
          Sua sessão venceu. <a class="fila-ind-link" href="/api/caderneta/eu" target="_blank" rel="noopener">Toque aqui para entrar de novo</a>,
          depois volte ao app: o envio recomeça sozinho.
        </p>
        <ul v-if="rejeitadas.length" class="fila-ind-lista">
          <li v-for="r in rejeitadas" :key="r.op_id" class="fila-ind-item">
            <span class="fila-ind-item-txt"><strong>{{ rotulo(r.tipo) }}</strong> — {{ r.motivo }}</span>
            <button type="button" class="fila-ind-mini" @click="dispensar(r.op_id)">Entendi</button>
          </li>
        </ul>
        <p v-if="!pendentes && !rejeitadas.length" class="fila-ind-p fila-ind-p--ok">
          <i class="fas fa-circle-check" aria-hidden="true"></i> Tudo que foi lançado aqui já está salvo no servidor.
        </p>

        <div class="fila-ind-acoes">
          <button v-if="pendentes" type="button" class="fila-ind-acao fila-ind-acao--forte" @click="enviarAgora()">
            <i class="fas fa-paper-plane" aria-hidden="true"></i> Enviar agora
          </button>
          <button type="button" class="fila-ind-acao" @click="alternarCorrecoes">
            <i class="fas" :class="verCorrecoes ? 'fa-eye-slash' : 'fa-clock-rotate-left'" aria-hidden="true"></i>
            {{ verCorrecoes ? 'Esconder' : 'Ver' }} cancelamentos e estornos
          </button>
        </div>

        <ul v-if="verCorrecoes" class="fila-ind-lista">
          <li v-if="!correcoes.length" class="fila-ind-item fila-ind-item--vazio">Nada cancelado, corrigido ou estornado até agora.</li>
          <li v-for="(c, i) in correcoes" :key="i" class="fila-ind-item fila-ind-item--corr">
            <span class="fila-ind-tag" :class="`fila-ind-tag--${c.tipo}`">{{ ROTULO_CORRECAO[c.tipo] }}</span>
            <span class="fila-ind-item-txt">
              {{ c.cliente }}<span v-if="c.loja"> ({{ c.loja }})</span>
              <small>{{ dia(c.quando) }}<span v-if="c.motivo"> · {{ c.motivo }}</span></small>
            </span>
            <span class="fila-ind-val">R$ {{ moeda(c.valor) }}</span>
          </li>
        </ul>
      </div>
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

const { estado, texto, pendentes, rejeitadas, enviarAgora, precisaEntrar } = useFilaOps()
const aberto = ref(false)
const visivel = computed(() => cadernetaNoServidor())
const icone = computed(() => ({ saved: 'fa-cloud-check', pending: 'fa-clock', syncing: 'fa-rotate fa-spin', offline: 'fa-cloud-slash', attention: 'fa-triangle-exclamation' }[estado.value] || 'fa-cloud'))
const SUBTEXTOS = { saved: 'Conectado ao servidor · toque para detalhes', pending: 'Guardado neste aparelho · toque para detalhes', syncing: 'Enviando ao servidor…', offline: 'Sem conexão com o servidor · toque para detalhes', attention: 'O servidor não aceitou algo · toque para ver' }
const subtexto = computed(() => SUBTEXTOS[estado.value] || '')
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
/* Faixa colada ao cabeçalho (mesma superfície branca), com um cartão de estado no padrão dos avisos da Caderneta */
.fila-ind { --fi-cor: var(--green); --fi-bg: var(--green-bg); --fi-borda: var(--green-dim); padding: 0 16px 12px; background: var(--surface); font-family: var(--font); flex-shrink: 0; }
.fila-ind--pending, .fila-ind--syncing { --fi-cor: var(--gold-dark); --fi-bg: var(--gold-bg); --fi-borda: #f3dcae; }
.fila-ind--offline { --fi-cor: var(--orange); --fi-bg: var(--orange-bg); --fi-borda: var(--orange-dim); }
.fila-ind--attention { --fi-cor: var(--red); --fi-bg: var(--red-bg); --fi-borda: var(--red-dim); }

.fila-ind-card { background: var(--fi-bg); border: 1px solid var(--fi-borda); border-radius: var(--r-md); color: var(--fi-cor); overflow: hidden; }
.fila-ind-btn { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px 14px 8px 10px; border: none; background: transparent; color: inherit; font-family: var(--font); text-align: left; cursor: pointer; }
.fila-ind-btn:focus-visible, .fila-ind-acao:focus-visible, .fila-ind-mini:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: -3px; }

.fila-ind-ico { width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--surface); font-size: 1rem; box-shadow: var(--shadow-sm); }
.fila-ind-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.fila-ind-l1 { font-size: .9rem; font-weight: 800; line-height: 1.25; }
.fila-ind-l2 { font-size: .76rem; font-weight: 600; line-height: 1.3; opacity: .8; }
.fila-ind-seta { font-size: .72rem; opacity: .65; transition: transform var(--t); }
.fila-ind-seta--aberta { transform: rotate(180deg); }

.fila-ind-painel { padding: 12px 14px 14px; border-top: 1px solid var(--fi-borda); background: var(--surface); color: var(--text); display: flex; flex-direction: column; gap: 10px; }
.fila-ind-p { margin: 0; font-size: .84rem; font-weight: 600; line-height: 1.45; color: var(--muted); }
.fila-ind-p--ok { color: var(--green); display: flex; align-items: center; gap: 8px; }
.fila-ind-link { color: var(--brown-mid); font-weight: 800; text-decoration: underline; }

.fila-ind-acoes { display: flex; flex-wrap: wrap; gap: 8px; }
.fila-ind-acao { flex: 1 1 auto; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; border: 1px solid var(--border2); border-radius: var(--r-sm); background: var(--cream); color: var(--brown-mid); font-family: var(--font); font-size: .84rem; font-weight: 800; cursor: pointer; transition: background var(--t); }
.fila-ind-acao:active { background: var(--cream-deep); }
.fila-ind-acao--forte { background: var(--fi-cor); border-color: var(--fi-cor); color: #fff; }
.fila-ind-acao--forte:active { background: var(--fi-cor); filter: brightness(.9); }

.fila-ind-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.fila-ind-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--bg); border: 1px solid var(--border); font-size: .83rem; font-weight: 600; line-height: 1.35; }
.fila-ind-item--vazio { color: var(--muted); justify-content: center; text-align: center; }
.fila-ind-item-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fila-ind-item-txt small { font-size: .74rem; color: var(--muted); font-weight: 600; }
.fila-ind-val { flex-shrink: 0; font-weight: 800; color: var(--brown-dark); font-variant-numeric: tabular-nums; }
.fila-ind-mini { flex-shrink: 0; min-height: 36px; padding: 0 12px; border: none; border-radius: var(--r-sm); background: var(--red); color: #fff; font-family: var(--font); font-size: .78rem; font-weight: 800; cursor: pointer; }
.fila-ind-tag { flex-shrink: 0; padding: 3px 9px; border-radius: var(--r-full); font-size: .7rem; font-weight: 800; background: var(--cream-deep); color: var(--brown-mid); }
.fila-ind-tag--cancelada { background: var(--red-bg); color: var(--red); }
.fila-ind-tag--estorno { background: var(--orange-bg); color: var(--orange); }
.fila-ind-tag--corrigida { background: var(--blue-bg); color: var(--blue); }

@media (max-width: 380px) { .fila-ind { padding: 0 12px 10px; } .fila-ind-l2 { display: none; } }
@media (prefers-reduced-motion: reduce) { .fila-ind-seta, .fila-ind-acao { transition: none; } }
</style>