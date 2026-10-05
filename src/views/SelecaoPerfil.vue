<template>
  <div class="perfil-shell">

    <div class="perfil-logo">
      <div class="perfil-logo-icon">
        <img v-if="s.company.logo" :src="s.company.logo" alt="">
        <i v-else class="fas fa-cookie-bite"></i>
      </div>
      <div class="perfil-logo-nome">ChocoBete</div>
      <div class="perfil-logo-sub">Quem está usando?</div>
    </div>

    <div class="perfil-cards">
      <button v-for="p in cards" :key="p.id" class="perfil-card" @click="$emit('selecionar', p.id)">
        <div class="perfil-avatar" :style="{ background: p.cor }">{{ p.iniciais }}</div>
        <div class="perfil-info">
          <div class="perfil-nome">{{ p.nome }}</div>
          <div class="perfil-desc">{{ p.descricao }}</div>
        </div>
        <svg class="perfil-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>

    <!-- Recuperar dados — só aparece se ainda não há nenhum dado neste
         aparelho (instalação nova ou app recém-limpo). Evita ter que
         entrar como Admin e ir em Ajustes → Backup só pra restaurar. -->
    <div v-if="s.bancoVazio" class="perfil-recuperar">
      <button class="perfil-recuperar-toggle" @click="mostrarRecuperar = !mostrarRecuperar" :disabled="s.recuperandoDados">
        <i class="fas fa-clock-rotate-left"></i>
        Já usei o app antes? Restaurar dados
        <i class="fas fa-chevron-down perfil-recuperar-seta" :class="{ 'is-aberta': mostrarRecuperar }"></i>
      </button>

      <div v-if="mostrarRecuperar" class="perfil-recuperar-opcoes">
        <button class="perfil-recuperar-opcao" :disabled="s.recuperandoDados" @click="s.recuperarDeGoogleDrive">
          <i class="fab fa-google-drive"></i>
          <span>Restaurar do Google Drive</span>
        </button>

        <button
          v-if="s.suportaPastaBackupLocal"
          class="perfil-recuperar-opcao"
          :disabled="s.recuperandoDados"
          @click="s.recuperarDaPastaLocal"
        >
          <i class="fas fa-folder-open"></i>
          <span>Restaurar de uma pasta local</span>
        </button>

        <label class="perfil-recuperar-opcao" :class="{ 'is-disabled': s.recuperandoDados }">
          <i class="fas fa-file-code"></i>
          <span>Escolher um arquivo de backup (.json)</span>
          <input
            type="file"
            hidden
            accept=".json"
            :disabled="s.recuperandoDados"
            @change="e => { s.recuperarDeArquivoLocal(e.target.files[0]); e.target.value = '' }"
          />
        </label>

        <div v-if="s.recuperandoDados" class="perfil-recuperar-carregando">
          <div class="spinner-sm"></div> Restaurando…
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../store.js'
const s = useStore()
defineEmits(['selecionar'])
const props = defineProps({ config: { type: Object, required: true } })

const mostrarRecuperar = ref(false)

function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/)
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || partes[0]?.[1] || '')).toUpperCase()
}

// Monta a lista de cards a partir dos perfis fixos (Admin/Vendas) + todos
// os perfis extras que o usuário cadastrou em Ajustes → Perfis.
// Enquanto o banco estiver vazio, os extras (mesmo os que vêm de fábrica,
// como "Produção"/"Financeiro") ficam escondidos — só Admin e Vendas.
const cards = computed(() => {
  const fixos = [
    {
      id: 'ym',
      nome: props.config.ym.nome,
      descricao: props.config.ym.descricao,
      iniciais: iniciais(props.config.ym.nome) || 'AD',
      cor: 'linear-gradient(135deg, var(--brown-dark), var(--brown))'
    },
    {
      id: 'bete',
      nome: props.config.bete.nome,
      descricao: props.config.bete.descricao,
      iniciais: iniciais(props.config.bete.nome) || 'VE',
      cor: 'linear-gradient(135deg, var(--green), #15803d)'
    }
  ]
  if (s.bancoVazio) return fixos
  return [
    ...fixos,
    ...props.config.extras.map(e => ({
      id: e.id,
      nome: e.nome,
      descricao: e.descricao,
      iniciais: iniciais(e.nome) || '??',
      cor: e.cor
    }))
  ]
})
</script>

<style scoped>
.perfil-shell {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
  background: var(--bg);
  padding: 32px 24px;
  overflow-y: auto;
}

.perfil-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.perfil-logo-icon { font-size: 52px; line-height: 1; display: flex; align-items: center; justify-content: center; }
.perfil-logo-icon img { width: 84px; height: 84px; object-fit: contain; }
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
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,.15);
}
.perfil-info { flex: 1; min-width: 0; }
.perfil-nome { font-size: 17px; font-weight: 800; color: var(--text); margin-bottom: 2px; font-family: var(--font); }
.perfil-desc { font-size: 12px; color: var(--muted); font-weight: 500; font-family: var(--font); }

.perfil-chevron { color: var(--brown-light); flex-shrink: 0; }

/* ── Recuperar dados (só quando o banco está vazio) ─────────── */
.perfil-recuperar {
  width: 100%;
  max-width: 340px;
  margin-top: -18px;
}
.perfil-recuperar-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 700;
  font-family: var(--font);
  padding: 8px 4px;
  cursor: pointer;
}
.perfil-recuperar-toggle:disabled { opacity: .6; pointer-events: none; }
.perfil-recuperar-seta { margin-left: auto; font-size: .7rem; transition: transform .2s ease; }
.perfil-recuperar-seta.is-aberta { transform: rotate(180deg); }

.perfil-recuperar-opcoes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.perfil-recuperar-opcao {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  transition: border-color var(--t), transform .1s;
}
.perfil-recuperar-opcao i:first-child { color: var(--brown); width: 16px; text-align: center; }
.perfil-recuperar-opcao:active { transform: scale(.98); border-color: var(--brown-light); }
.perfil-recuperar-opcao:disabled, .perfil-recuperar-opcao.is-disabled { opacity: .55; pointer-events: none; }

.perfil-recuperar-carregando {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 700; color: var(--muted);
  margin-top: 2px; padding: 0 4px;
}
.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--brown);
  border-radius: 50%;
  animation: perfil-rec-spin .7s linear infinite;
}
@keyframes perfil-rec-spin { to { transform: rotate(360deg); } }
</style>
