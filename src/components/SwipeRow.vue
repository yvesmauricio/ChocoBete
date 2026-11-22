<template>
  <!--
    Linha com menu de ações.
    Antes: arrastar a linha para o lado revelava os botões (swipe).
    Agora: um botão "⋯" no fim da linha abre uma folha de ações (bottom sheet),
    o mesmo padrão das opções de ingrediente em Receitas. Os botões continuam
    sendo declarados pelas telas no slot `actions`, sem mudança de API.
    No desktop (com mouse) os botões seguem aparecendo ao passar o cursor.
  -->
  <div class="swipe-wrap">
    <div class="swipe-content">
      <slot />
      <button
        type="button"
        class="swipe-more"
        aria-label="Mais ações"
        aria-haspopup="dialog"
        :aria-expanded="isOpen"
        @click.stop="abrir"
      >
        <i class="fas fa-ellipsis"></i>
      </button>
    </div>

    <!-- Só desktop com mouse (hover): ver main.css -->
    <div class="swipe-btns">
      <slot name="actions" />
    </div>

    <Teleport to="body">
      <div v-if="isOpen" class="bottom-sheet-overlay" @click.self="fechar">
        <div class="lc-modal acoes-sheet" role="dialog" aria-modal="true" :aria-label="titulo || 'Ações'">
          <div class="lc-modal-hdr">
            <span class="lc-modal-titulo"><i class="fas fa-ellipsis"></i> {{ titulo || 'Ações' }}</span>
            <button type="button" class="lc-modal-close" aria-label="Fechar" @click="fechar"><i class="fas fa-xmark"></i></button>
          </div>
          <!-- Captura: fecha a folha mesmo quando o botão usa @click.stop -->
          <div class="acoes-lista" @click.capture="onListaClick">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { useSwipe } from '../composables/useSwipe.js'

const props = defineProps({
  rowId:  { type: String, required: true },
  // Título da folha de ações (nome do item da linha)
  titulo: { type: String, default: '' },
  // Legado do swipe: não é mais usado, mantido para não quebrar quem ainda passa.
  width:  { type: Number, default: 0 }
})

// Singleton: só uma folha aberta por vez (e quem chama closeAll() continua funcionando)
const { openSwipeId } = useSwipe()
const isOpen = computed(() => openSwipeId.value === props.rowId)

function abrir() { openSwipeId.value = props.rowId }
function fechar() { if (isOpen.value) openSwipeId.value = null }

// Toque em qualquer ação fecha a folha. Adiado para depois do handler do botão.
function onListaClick(e) {
  if (e.target.closest('button')) setTimeout(fechar, 0)
}

function onKey(e) { if (e.key === 'Escape') fechar() }
watch(isOpen, (aberto) => {
  if (aberto) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  fechar()
})
</script>

<style scoped>
.swipe-wrap {
  position: relative;
  overflow: hidden;
  background: var(--surface, #fff);
  margin: 0 12px 8px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--r-md, 10px);
  box-shadow: 0 1px 3px rgba(61,32,8,.05);
  isolation: isolate;
  transform: translateZ(0);
}

.swipe-content {
  position: relative;
  z-index: 1;
  width: 100%;
  background: var(--card, #fff);
  display: flex;
  align-items: stretch;
}
.swipe-content > :deep(*:first-child) {
  flex: 1;
  min-width: 0;
}

/* Botão ⋯ no fim da linha (mesmo visual do ⋯ dos ingredientes) */
.swipe-more {
  flex-shrink: 0;
  align-self: center;
  width: 44px;
  height: 44px;
  margin-right: 2px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--muted, #9b8b7a);
  font-size: 17px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.swipe-more:active { background: var(--cream-deep, #f0e8d8); }

/* Botões inline: escondidos no celular; o desktop com mouse os reexibe (main.css) */
.swipe-btns { display: none; }

/* A divisória precisa ficar no wrapper fixo */
:deep(.list-row) { border-bottom: none; }
</style>
