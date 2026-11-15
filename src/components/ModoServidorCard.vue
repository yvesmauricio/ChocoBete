<template>
  <div class="aj-grupo">
    <div class="aj-grupo-cab">
      <h4 class="aj-grupo-titulo">Caderneta no servidor</h4>
      <p class="aj-grupo-desc">
        Aqui você vê <strong>quem decide</strong> o que pode ser feito na Caderneta, o que o seu login permite agora e liga ou desliga o servidor.
        O modo é por aparelho; só o administrador altera.
      </p>
    </div>

    <article class="aj-card">
      <div class="aj-form">
        <div class="aj-row-titulo">{{ ligado ? 'Servidor ligado neste aparelho' : 'Servidor desligado neste aparelho (modo local)' }}</div>
        <p class="aj-nota">
          Aparelho: <strong>{{ resumo.aparelhoTexto }}</strong> ·
          Login: <strong>{{ resumo.usuario || 'não identificado' }}</strong> ({{ resumo.perfilTexto }}) ·
          Quem decide agora: <strong>{{ resumo.quemDecide }}</strong>
        </p>
        <p class="aj-nota">
          <template v-if="rejeitadas.length">O servidor recusou {{ rejeitadas.length }} alteração(ões): toque no indicador no topo da Caderneta.</template>
          <template v-else-if="pendentes">Há {{ pendentes }} alteração(ões) aguardando envio.</template>
          <template v-else-if="ligado">Nada aguardando envio.</template>
        </p>

        <div v-for="(a, i) in resumo.avisos" :key="i" class="ms-aviso" :class="`ms-aviso--${a.nivel}`" role="status">{{ a.texto }}</div>

        <details class="ms-det" open>
          <summary>O que posso fazer na Caderneta agora</summary>
          <ul class="ms-acoes">
            <li v-for="a in resumo.acoes" :key="a.tipo" :class="`ms-acao--${a.estado}`">
              <i class="fas" :class="{ sim: 'fa-check', nao: 'fa-xmark', janela: 'fa-clock' }[a.estado]" aria-hidden="true"></i>
              <span>{{ a.rotulo }}<small v-if="a.nota"> — {{ a.nota }}</small></span>
            </li>
          </ul>
        </details>

        <details class="ms-det">
          <summary>Qual a diferença entre local e servidor?</summary>
          <p class="ms-tit">Modo local (Drive)</p>
          <ul class="ms-lista"><li v-for="t in DIFERENCAS_POR_MODO.local" :key="t">{{ t }}</li></ul>
          <p class="ms-tit">Modo servidor</p>
          <ul class="ms-lista"><li v-for="t in DIFERENCAS_POR_MODO.servidor" :key="t">{{ t }}</li></ul>
        </details>

        <template v-if="admin.ok">
          <button class="btn btn-secondary" :disabled="conferindo" @click="conferir(true)">{{ conferindo ? 'Conferindo…' : 'Conferir o servidor agora' }}</button>
          <div v-if="conf" class="ms-aviso" :class="conf.erro || !conf.ok ? 'ms-aviso--alerta' : 'ms-aviso--ok'" role="status">
            <template v-if="conf.erro">{{ conf.erro }}</template>
            <template v-else>
              {{ conf.vendas }} vendas · saldo em aberto {{ conf.saldo }} ·
              {{ conf.ok ? 'sem inconsistências' : 'HÁ inconsistências, avise quem cuida do sistema' }}.
              {{ conf.comparacao }}
              <template v-if="conf.backup"> Último backup: {{ conf.backup }}.</template>
            </template>
          </div>
        </template>

        <button class="btn btn-secondary" :disabled="trabalhando || !admin.ok" @click="alternar">
          {{ ligado ? 'Desligar neste aparelho' : 'Ligar neste aparelho' }}
        </button>
        <p v-if="!admin.ok" class="aj-nota">{{ admin.motivo }}</p>
      </div>
    </article>
  </div>
</template>

<script setup>
// Liga/desliga o modo servidor da Caderneta NESTE aparelho (o mesmo interruptor do link ?caderneta=servidor) e explica,
// com as regras de src/services/resumoAcesso.js (testadas), quem decide o que cada um pode fazer.
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store.js'
import { cadernetaNoServidor, definirCadernetaNoServidor } from '../services/modoServidor.js'
import { requisitar, precisaLogin } from '../services/filaOperacoes.js'
import { acessoRef, atualizarAcesso } from '../services/acessoServidor.js'
import { useFilaOps } from '../composables/useFilaOps.js'
import { useConfirm } from '../composables/useConfirm.js'
import { getFiados } from '../composables/useCaderneta.js'
import { resumirAcesso, podeAlternarModo, travasDesligar, compararComServidor, saldoAbertoLocal, DIFERENCAS_POR_MODO } from '../services/resumoAcesso.js'

const s = useStore()
const confirmacao = useConfirm()
const { pendentes, rejeitadas, precisaEntrar } = useFilaOps()   // reativo (o objeto cru da fila não é)
const ligado = ref(cadernetaNoServidor())
const trabalhando = ref(false)
const conferindo = ref(false)
const conf = ref(null)

const resumo = computed(() => resumirAcesso({ noServidor: ligado.value, papelAparelho: s.papelAparelho, acesso: acessoRef.value }))
const admin = computed(() => podeAlternarModo({ papelAparelho: s.papelAparelho, acesso: acessoRef.value }))

onMounted(() => { atualizarAcesso() })   // confirma o perfil agora (vale offline até a próxima vez)

const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Pergunta ao servidor (só Admin) e compara com este aparelho. Devolve o que a tela mostra, ou { erro }. */
async function consultarServidor() {
  try {
    const r = await requisitar('/api/caderneta/conferencia', { credentials: 'same-origin', redirect: 'manual' })
    if (precisaLogin(r)) return { erro: 'Sua sessão venceu. Toque no indicador da Caderneta para entrar de novo.' }
    if (r.status === 403) return { erro: 'Este login não é de administrador no servidor.' }
    if (!r.ok) return { erro: 'O servidor não respondeu direito. Tente de novo em instantes.' }
    const c = await r.json()
    const cmp = compararComServidor({ saldoAbertoLocalCentavos: saldoAbertoLocal(await getFiados()) }, c)
    const b = c.backup
    return {
      ok: !!c.ok, vendas: c.contagens?.vendas ?? '?', saldo: reais(Number(c.saldo_aberto_centavos) || 0), cmp,
      comparacao: cmp.texto,
      backup: b?.ultimo ? `há ${b.horas_desde} h${b.atrasado ? ' (ATRASADO)' : ''}` : (b ? 'nenhum registrado (ATRASADO)' : ''),
    }
  } catch { return { erro: 'Sem conexão com o servidor.' } }
}

async function conferir(mostrar) {
  conferindo.value = true
  try { const c = await consultarServidor(); if (mostrar) conf.value = c; return c } finally { conferindo.value = false }
}

async function alternar() {
  if (trabalhando.value || !admin.value.ok) return
  trabalhando.value = true
  try {
    if (!ligado.value) {
      const c = await conferir(true)
      if (c.erro) { await confirmacao.ask(`Para ligar, o app precisa falar com o servidor e comparar os dados. ${c.erro}`, { title: 'Não deu para conferir', type: 'warning', confirmLabel: 'Entendi', cancelLabel: 'Fechar', icon: 'fas fa-cloud-slash' }); return }
      if (!c.ok) { await confirmacao.ask('O servidor está com inconsistências nos saldos. Não ligue agora: avise quem cuida do sistema.', { title: 'Servidor com inconsistências', type: 'danger', confirmLabel: 'Entendi', cancelLabel: 'Fechar' }); return }
      const igual = c.cmp?.comparavel && c.cmp.iguais
      const ok = await confirmacao.ask(
        `${c.cmp?.texto || ''} ${igual ? '' : 'ATENÇÃO: se algo só existe neste aparelho, ao ligar deixará de aparecer aqui. '}Ao ligar, este aparelho passa a seguir o servidor, e quem decide o que você pode fazer passa a ser o seu login.`.trim(),
        { title: igual ? 'Ligar a Caderneta no servidor?' : 'Os dados estão diferentes. Ligar mesmo assim?', type: igual ? 'warning' : 'danger', confirmLabel: 'Ligar', icon: 'fas fa-cloud' })
      if (!ok) return
      definirCadernetaNoServidor(true)
    } else {
      const t = travasDesligar({ pendentes: pendentes.value, rejeitadas: rejeitadas.value.length, semLogin: precisaEntrar.value, papelAparelho: s.papelAparelho })
      if (!t.ok) { await confirmacao.ask(t.motivo, { title: 'Não dá para desligar agora', type: 'warning', confirmLabel: 'Entendi', cancelLabel: 'Fechar', icon: 'fas fa-clock' }); return }
      const ok = await confirmacao.ask(
        `Ao desligar: ${t.consequencias.map((x, i) => `${i + 1}) ${x}`).join(' ')} Só faça isso em emergência ou ensaio.`,
        { title: 'Desligar a Caderneta no servidor?', type: 'danger', confirmLabel: 'Desligar mesmo assim' })
      if (!ok) return
      definirCadernetaNoServidor(false)
    }
    location.reload() // recarrega para o app iniciar (ou parar) a fila e a guarda
  } finally { trabalhando.value = false }
}
</script>

<style scoped>
.ms-aviso { padding: .6rem .75rem; border-radius: 8px; font-size: .85rem; line-height: 1.35; margin: .4rem 0; border: 1px solid; }
.ms-aviso--alerta { background: #fff4e5; border-color: #f0c27b; color: #7a4a00; }
.ms-aviso--info { background: #eef4ff; border-color: #c5d6f5; color: #27407a; }
.ms-aviso--ok { background: #edf8ee; border-color: #b7dfba; color: #1f5b27; }
.ms-det { margin: .5rem 0; }
.ms-det > summary { cursor: pointer; font-weight: 600; font-size: .9rem; padding: .35rem 0; }
.ms-acoes, .ms-lista { list-style: none; margin: .25rem 0; padding: 0; font-size: .88rem; }
.ms-acoes li { display: flex; gap: .55rem; align-items: baseline; padding: .2rem 0; }
.ms-acoes small { opacity: .75; }
.ms-acao--sim i { color: #2e7d32; } .ms-acao--nao i { color: #c62828; } .ms-acao--janela i { color: #b26a00; }
.ms-lista li { padding: .2rem 0 .2rem .9rem; position: relative; }
.ms-lista li::before { content: '•'; position: absolute; left: 0; }
.ms-tit { margin: .5rem 0 0; font-weight: 600; font-size: .85rem; }
</style>
