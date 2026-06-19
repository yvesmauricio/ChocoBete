<template>
  <div class="perfil-shell">

    <div class="perfil-logo">
      <div class="perfil-logo-icon">🍫</div>
      <div class="perfil-logo-nome">ChocoBete</div>
      <div class="perfil-logo-sub">Quem está usando?</div>
    </div>

    <div class="perfil-cards">
      <button class="perfil-card" @click="$emit('selecionar', 'ym')">
        <div class="perfil-avatar ym">YM</div>
        <div class="perfil-info">
          <div class="perfil-nome">Yves</div>
          <div class="perfil-desc">Produção, custos, financeiro</div>
        </div>
        <svg class="perfil-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      <button class="perfil-card" @click="$emit('selecionar', 'bete')">
        <div class="perfil-avatar bete">BE</div>
        <div class="perfil-info">
          <div class="perfil-nome">Bete</div>
          <div class="perfil-desc">Fiados, clientes, entregas</div>
        </div>
        <svg class="perfil-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>

  </div>
</template>

<script setup>
defineEmits(['selecionar'])
</script>

<style scoped>
.perfil-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
  background: var(--bg);
  padding: 32px 24px;
}

.perfil-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.perfil-logo-icon { font-size: 52px; line-height: 1; }
.perfil-logo-nome {
  font-size: 26px;
  font-weight: 900;
  color: var(--brown);
  letter-spacing: -.02em;
  font-family: var(--font);
}
.perfil-logo-sub {
  font-size: 14px;
  color: var(--muted);
  font-weight: 600;
  font-family: var(--font);
}

.perfil-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 340px;
}

.perfil-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 16px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: border-color var(--t), box-shadow var(--t), transform .1s;
  font-family: var(--font);
  text-align: left;
  width: 100%;
}
.perfil-card:active {
  transform: scale(.98);
  border-color: var(--brown-light);
  box-shadow: var(--shadow-md);
}

.perfil-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  font-size: 17px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: -.02em;
  font-family: var(--font);
}
.perfil-avatar.ym   { background: linear-gradient(135deg, var(--brown-dark), var(--brown)); color: #fff; }
.perfil-avatar.bete { background: linear-gradient(135deg, var(--green), #15803d); color: #fff; }

.perfil-info { flex: 1; min-width: 0; }
.perfil-nome { font-size: 17px; font-weight: 800; color: var(--text); margin-bottom: 2px; font-family: var(--font); }
.perfil-desc { font-size: 12px; color: var(--muted); font-weight: 500; font-family: var(--font); }

.perfil-chevron { color: var(--brown-light); flex-shrink: 0; }
</style>
