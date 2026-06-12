<template>
  <nav class="nav">
    <button v-for="n in nav" :key="n.id" class="nav-btn" :class="{ active: s.tab === n.id }" @click="s.setTab(n.id)">
      <i :class="n.icon"></i>
      <span>{{ n.label }}</span>
    </button>
  </nav>
</template>

<script setup>
import { useStore } from '../store.js'
const s = useStore()
const nav = [
  { id: 'painel', icon: 'fas fa-chart-pie', label: 'Painel' },
  { id: 'financeiro', icon: 'fas fa-money-check-dollar', label: 'Financeiro' },
  { id: 'insumos', icon: 'fas fa-boxes', label: 'Estoque' },
  { id: 'receitas', icon: 'fas fa-book-open', label: 'Receitas' },
  { id: 'cozinha', icon: 'fas fa-utensils', label: 'Cozinha' }
]
</script>
