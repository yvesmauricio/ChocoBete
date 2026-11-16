<template>
  <div class="aj-grupo">
    <div class="aj-grupo-cab">
      <h4 class="aj-grupo-titulo">Caderneta no servidor</h4>
      <p class="aj-grupo-desc">
        Com isto ligado, a Caderneta deste aparelho passa a seguir o <strong>servidor</strong>: o que você lança vai para uma fila e é enviado
        (mesmo sem sinal, depois), e o servidor confere as regras. Cada aparelho liga o seu.
      </p>
    </div>
    <article class="aj-card">
      <div class="aj-form">
        <div class="aj-row-titulo" :class="{ 'aj-row-titulo--on': ligado }">{{ ligado ? 'Ligado neste aparelho' : 'Desligado neste aparelho' }}</div>
        <template v-if="ligado">
          <p class="aj-nota">
            Seu perfil no servidor:
            <strong>{{ perfilTexto }}</strong><span v-if="acesso?.usuario"> · {{ acesso.usuario }}</span>.
            {{ pendentes ? `Há ${pendentes} alteração(ões) aguardando envio.` : 'Nada aguardando envio.' }}
          </p>
        </template>
        <p v-else class="aj-nota">Só ligue depois que o administrador importou os dados no servidor e conferiu os totais.</p>
        <button class="btn btn-secondary" :disabled="trabalhando" @click="alternar">{{ ligado ? 'Desligar neste aparelho' : 'Ligar neste aparelho' }}</button>
      </div>
    </article>
  </div>
</template>

<script setup>
// Liga/desliga o modo servidor da Caderneta NESTE aparelho (o mesmo interruptor do link ?caderneta=servidor).
// Existe porque um app instalado no celular não abre links por dentro; aqui o botão funciona em qualquer aparelho.
import { ref, computed } from 'vue'
import { cadernetaNoServidor, definirCadernetaNoServidor } from '../services/modoServidor.js'
import { estadoFila } from '../services/filaOperacoes.js'
import { acessoRef } from '../services/acessoServidor.js'
import { useConfirm } from '../composables/useConfirm.js'

const confirmar = useConfirm()
const ligado = ref(cadernetaNoServidor())
const trabalhando = ref(false)
const acesso = acessoRef
const pendentes = computed(() => estadoFila.pendentes)
const perfilTexto = computed(() => ({ admin: 'Administrador', vendas: 'Vendas' }[acessoRef.value?.papel] || 'ainda não conhecido (conecte-se)'))

async function alternar() {
  if (trabalhando.value) return
  trabalhando.value = true
  try {
    if (!ligado.value) {
      const ok = await confirmar.ask('A Caderneta deste aparelho vai passar a seguir o servidor. Confirme que os dados já foram importados e conferidos.', {
        title: 'Ligar a Caderneta no servidor?', type: 'warning', confirmLabel: 'Ligar', icon: 'fas fa-cloud',
      })
      if (!ok) return
      definirCadernetaNoServidor(true)
    } else {
      if (estadoFila.pendentes > 0) {
        await confirmar.ask(`Há ${estadoFila.pendentes} alteração(ões) ainda não enviadas ao servidor. Conecte-se e aguarde o envio antes de desligar, senão elas não chegam ao servidor.`, {
          title: 'Ainda há envios pendentes', type: 'warning', confirmLabel: 'Entendi', cancelLabel: 'Fechar', icon: 'fas fa-clock',
        })
        return
      }
      const ok = await confirmar.ask('A Caderneta deste aparelho volta a seguir o modo antigo (Drive). Só faça isso se o administrador mandou.', {
        title: 'Desligar a Caderneta no servidor?', type: 'danger', confirmLabel: 'Desligar',
      })
      if (!ok) return
      definirCadernetaNoServidor(false)
    }
    location.reload() // recarrega para o app iniciar (ou parar) a fila e a guarda
  } finally { trabalhando.value = false }
}
</script>

<style scoped>
/* Os estilos de TabAjustes são "scoped" e não alcançam o interior deste componente:
   por isso os mesmos tokens do Ajustes são repetidos aqui (cartão, título, nota, botão). */
.aj-grupo { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.aj-grupo-cab { padding: 0 2px; }
.aj-grupo-titulo { margin: 0; font-size: 1.02rem; font-weight: 800; line-height: 1.3; color: var(--brown-dark); }
.aj-grupo-desc { margin: 2px 0 0; font-size: .84rem; line-height: 1.45; color: var(--muted); }
.aj-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
.aj-form { display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.aj-form .btn { width: 100%; min-height: 46px; }
.aj-row-titulo { display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 800; line-height: 1.3; color: var(--brown-dark); }
.aj-row-titulo::before { content: ''; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--brown-light); }
.aj-row-titulo--on::before { background: var(--green); box-shadow: 0 0 0 3px var(--green-dim); }
.aj-nota { margin: 0; font-size: .82rem; line-height: 1.5; color: var(--muted); }
html.is-desktop .aj-grupo { display: block; margin-top: 0; }
</style>
