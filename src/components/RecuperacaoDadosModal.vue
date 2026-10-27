<template>
  <div class="recsh">
    <div class="rec-icon"><i class="fas fa-box-open"></i></div>
    <h1 class="rec-titulo">Não encontramos dados aqui</h1>
    <p class="rec-desc">
      Isso costuma acontecer depois de limpar os dados do app, reinstalar
      ou trocar de aparelho. Se você já usou o app antes, escolha
      abaixo de onde restaurar — senão, é só começar do zero.
    </p>

    <div class="rec-opcoes">
      <button class="rec-opcao" :disabled="s.recuperandoDados" @click="s.recuperarDeGoogleDrive">
        <div class="rec-opcao-icon"><i class="fab fa-google-drive"></i></div>
        <div class="rec-opcao-info">
          <div class="rec-opcao-nome">Restaurar do Google Drive</div>
          <div class="rec-opcao-desc">Se essa conta já foi conectada antes</div>
        </div>
        <i class="fas fa-chevron-right rec-opcao-seta"></i>
      </button>

      <button
        v-if="s.suportaPastaBackupLocal"
        class="rec-opcao"
        :disabled="s.recuperandoDados"
        @click="s.recuperarDaPastaLocal"
      >
        <div class="rec-opcao-icon"><i class="fas fa-folder-open"></i></div>
        <div class="rec-opcao-info">
          <div class="rec-opcao-nome">Restaurar de uma pasta local</div>
          <div class="rec-opcao-desc">Aponte pra pasta onde os backups automáticos ficavam</div>
        </div>
        <i class="fas fa-chevron-right rec-opcao-seta"></i>
      </button>

      <label class="rec-opcao" :class="{ 'is-disabled': s.recuperandoDados }">
        <div class="rec-opcao-icon"><i class="fas fa-file-code"></i></div>
        <div class="rec-opcao-info">
          <div class="rec-opcao-nome">Escolher um arquivo de backup</div>
          <div class="rec-opcao-desc">Um .json baixado antes, manual ou automático</div>
        </div>
        <i class="fas fa-chevron-right rec-opcao-seta"></i>
        <input
          type="file"
          hidden
          accept=".json"
          :disabled="s.recuperandoDados"
          @change="e => { s.recuperarDeArquivoLocal(e.target.files[0]); e.target.value = '' }"
        />
      </label>
    </div>

    <div v-if="s.recuperandoDados" class="rec-carregando">
      <div class="spinner-sm"></div> Restaurando…
    </div>

    <button class="rec-zero" :disabled="s.recuperandoDados" @click="s.comecarDoZero">
      Começar do zero, sem restaurar nada
    </button>
  </div>
</template>

<script setup>
import { useStore } from '../store.js'
const s = useStore()
</script>

<style scoped>
.recsh {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: var(--bg);
  padding: 32px 24px;
  text-align: center;
  overflow-y: auto;
}

.rec-icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: var(--gold-bg, rgba(217, 164, 65, .15));
  color: var(--gold, #d9a441);
  font-size: 26px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}

.rec-titulo {
  font-size: 19px;
  font-weight: 900;
  color: var(--brown-dark);
  font-family: var(--font);
  margin: 0;
}

.rec-desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  max-width: 360px;
  margin: 0 0 6px;
}

.rec-opcoes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 360px;
}

.rec-opcao {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: var(--font);
  transition: border-color var(--t), transform .1s;
}
.rec-opcao:active { transform: scale(.98); border-color: var(--brown-light); }
.rec-opcao:disabled, .rec-opcao.is-disabled { opacity: .55; pointer-events: none; }

.rec-opcao-icon {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: var(--bg);
  color: var(--brown);
  font-size: 15px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rec-opcao-info { flex: 1; min-width: 0; }
.rec-opcao-nome { font-size: 13.5px; font-weight: 800; color: var(--text); }
.rec-opcao-desc { font-size: 11px; color: var(--muted); margin-top: 1px; }
.rec-opcao-seta { color: var(--brown-light); font-size: 12px; flex-shrink: 0; }

.rec-carregando {
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px; font-weight: 700; color: var(--muted);
  margin-top: 2px;
}
.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--brown);
  border-radius: 50%;
  animation: rec-spin .7s linear infinite;
}
@keyframes rec-spin { to { transform: rotate(360deg); } }

.rec-zero {
  margin-top: 8px;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
  font-family: var(--font);
}
.rec-zero:disabled { opacity: .5; pointer-events: none; }
</style>
