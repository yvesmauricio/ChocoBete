<template>
  <nav class="nav">
    <button v-for="n in navPrincipal" :key="n.id"
      class="nav-btn" :class="{ active: s.tab === n.id }"
      @click="s.setTab(n.id); menuAberto = false">
      <i :class="n.icon"></i>
      <span>{{ n.label }}</span>
    </button>

    <!-- Botão "Mais" -->
    <button class="nav-btn" :class="{ active: menuAberto || navExtra.some(n => s.tab === n.id) }"
      @click="menuAberto = !menuAberto">
      <i class="fas fa-ellipsis"></i>
      <span>Mais</span>
    </button>

    <!-- Menu de overflow -->
    <Transition name="menu-pop">
      <div v-if="menuAberto" class="nav-overflow-menu" @click.stop>
        <button v-for="n in navExtra" :key="n.id"
          class="nav-overflow-item" :class="{ active: s.tab === n.id }"
          @click="s.setTab(n.id); menuAberto = false">
          <i :class="n.icon"></i>
          <span>{{ n.label }}</span>
        </button>
      </div>
    </Transition>

    <!-- Backdrop para fechar o menu -->
    <div v-if="menuAberto" class="nav-overflow-backdrop" @click="menuAberto = false" />
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useStore } from '../store.js'
const s = useStore()
<<<<<<< HEAD
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
  { id: 'ajustes',      icon: 'fas fa-cog',                label: 'Ajustes' },
=======
const nav = [
  { id: 'painel', icon: 'fas fa-chart-pie', label: 'Painel' },
  { id: 'financeiro', icon: 'fas fa-money-check-dollar', label: 'Financeiro' },
  { id: 'insumos', icon: 'fas fa-boxes', label: 'Estoque' },
  { id: 'receitas', icon: 'fas fa-book-open', label: 'Receitas' },
  { id: 'cozinha', icon: 'fas fa-utensils', label: 'Cozinha' }
>>>>>>> 5abf8dd2b401201a3b70ff07a10e101d2b6c7dd1
]
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
  inset: 0;
  z-index: calc(var(--z-header) + 9);
}

.menu-pop-enter-active { animation: menu-in .18s cubic-bezier(.34,1.56,.64,1); }
.menu-pop-leave-active { animation: menu-in .12s ease-in reverse; }
@keyframes menu-in {
  from { opacity: 0; transform: scale(.9) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
