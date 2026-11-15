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
        <div class="aj-row-titulo">{{ ligado ? 'Ligado neste aparelho' : 'Desligado neste aparelho' }}</div>
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
      const ok = await confirmar('A Caderneta deste aparelho vai passar a seguir o servidor. Confirme que os dados já foram importados e conferidos.', {
        title: 'Ligar a Caderneta no servidor?', type: 'warning', confirmLabel: 'Ligar', icon: 'fas fa-cloud',
      })
      if (!ok) return
      definirCadernetaNoServidor(true)
    } else {
      if (estadoFila.pendentes > 0) {
        await confirmar(`Há ${estadoFila.pendentes} alteração(ões) ainda não enviadas ao servidor. Conecte-se e aguarde o envio antes de desligar, senão elas não chegam ao servidor.`, {
          title: 'Ainda há envios pendentes', type: 'warning', confirmLabel: 'Entendi', cancelLabel: 'Fechar', icon: 'fas fa-clock',
        })
        return
      }
      const ok = await confirmar('A Caderneta deste aparelho volta a seguir o modo antigo (Drive). Só faça isso se o administrador mandou.', {
        title: 'Desligar a Caderneta no servidor?', type: 'danger', confirmLabel: 'Desligar',
      })
      if (!ok) return
      definirCadernetaNoServidor(false)
    }
    location.reload() // recarrega para o app iniciar (ou parar) a fila e a guarda
  } finally { trabalhando.value = false }
}
</script>
