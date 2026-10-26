<template>
  <nav class="nav">
    <button v-for="n in itensBarra" :key="n.id"
      class="nav-btn" :class="{ active: s.tab === n.id, 'nav-btn--extra-first': n.extra === 'primeiro' }"
      :title="n.label"
      @click="s.setTab(n.id); menuAberto = false">
      <i :class="n.icon"></i>
      <span>{{ n.label }}</span>
    </button>

    <!-- Botão "Mais" — só no celular. No desktop o menu lateral já lista
         todos os módulos, então não precisa de overflow. -->
    <button v-if="!isDesktop" class="nav-btn" :class="{ active: menuAberto || navExtraVisiveis.some(n => s.tab === n.id) }"
      @click="menuAberto = !menuAberto">
      <i class="fas fa-ellipsis"></i>
      <span>Mais</span>
    </button>

    <!-- Menu de overflow e backdrop são levados pro <body>: a .nav cria a própria camada
         (z-index 100), então, dentro dela, o menu ficava SOB qualquer barra fixa de tela
         (ex.: "Voltar/Continuar" das Etiquetas, z-index 101). Fora dela, o z-index do menu
         (110) passa a valer de verdade e ele fica acima dessas barras. -->
    <Teleport to="body">
      <Transition name="menu-pop">
        <div v-if="menuAberto && !isDesktop" class="nav-overflow-menu" @click.stop>
          <button v-for="n in navExtraVisiveis" :key="n.id"
            class="nav-overflow-item" :class="{ active: s.tab === n.id }"
            @click="s.setTab(n.id); menuAberto = false">
            <i :class="n.icon"></i>
            <span>{{ n.label }}</span>
          </button>
        </div>
      </Transition>

      <!-- Backdrop para fechar o menu -->
      <div v-if="menuAberto && !isDesktop" class="nav-overflow-backdrop" @click="menuAberto = false" />
    </Teleport>
  </nav>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from '../store.js'
import { useLayoutMode } from '../composables/useLayoutMode.js'
const s = useStore()
const { isDesktop } = useLayoutMode()
// 'modulos' é a lista de ids de tela que este perfil pode ver — funciona
// tanto para o Admin/Vendas (padrão) quanto para qualquer perfil extra
// criado em Ajustes → Perfis.
const props = defineProps({ modulos: { type: Array, default: () => [] } })
const menuAberto = ref(false)

const navPrincipal = [
  { id: 'painel',     icon: 'fas fa-chart-pie',           label: 'Painel' },
  { id: 'cozinha',    icon: 'fas fa-utensils',             label: 'Cozinha' },
  { id: 'receitas',   icon: 'fas fa-book-open',            label: 'Receitas' },
  { id: 'insumos',    icon: 'fas fa-boxes',                label: 'Estoque' },
  { id: 'financeiro', icon: 'fas fa-money-check-dollar',   label: 'Financeiro' },
]

const navExtra = [
  { id: 'producao',     icon: 'fas fa-clock-rotate-left',  label: 'Histórico' },
  { id: 'inteligencia', icon: 'fas fa-brain',              label: 'Inteligência' },
  { id: 'etiquetas',    icon: 'fas fa-tags',               label: 'Etiquetas' },
  { id: 'cardapio',     icon: 'fas fa-book-bookmark',      label: 'Cardápio' },
  { id: 'ajustes',      icon: 'fas fa-cog',                label: 'Ajustes' },
]

const navPrincipalVisiveis = computed(() => navPrincipal.filter(n => props.modulos.includes(n.id)))
const navExtraVisiveis = computed(() => navExtra.filter(n => props.modulos.includes(n.id)))

// Celular: só os 5 principais na barra (o resto fica em "Mais").
// Desktop: menu lateral com todos os módulos do perfil, os extras separados
// por uma linha (a marca `extra` é usada pelo CSS pra desenhar o divisor).
const itensBarra = computed(() => {
  if (!isDesktop.value) return navPrincipalVisiveis.value
  const extras = navExtraVisiveis.value.map((n, i) => ({ ...n, extra: i === 0 ? 'primeiro' : true }))
  return [...navPrincipalVisiveis.value, ...extras]
})
</script>

<style scoped>
.nav-overflow-menu {
  position: fixed;
  bottom: calc(64px + env(safe-area-inset-bottom));
  right: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 -4px 24px rgba(61,31,7,.14);
  display: flex;
  flex-direction: column;
  min-width: 160px;
  z-index: calc(var(--z-header) + 10);
  overflow: hidden;
  padding: 6px;
  gap: 2px;
}
.nav-overflow-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: .88rem;
  font-weight: 700;
  border-radius: 10px;
  width: 100%;
  text-align: left;
  transition: background var(--t), color var(--t);
}
.nav-overflow-item i { font-size: 1.05rem; width: 18px; text-align: center; }
.nav-overflow-item:active,
.nav-overflow-item.active { background: var(--gold-bg); color: var(--brown); }

.nav-overflow-backdrop {
  position: fixed;
  inset: 0 0 calc(64px + env(safe-area-inset-bottom)) 0; /* deixa a barra de baixo livre */  z-index: calc(var(--z-header) + 9);
}

.menu-pop-enter-active { animation: menu-in .18s cubic-bezier(.34,1.56,.64,1); }
.menu-pop-leave-active { animation: menu-in .12s ease-in reverse; }
@keyframes menu-in {
  from { opacity: 0; transform: scale(.9) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
</style>