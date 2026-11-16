<template>
  <div class="ca-shell">
    <div class="ca-conteudo">
      <div class="ca-topo">
        <div class="ca-logo">
          <img v-if="s.company.logo" :src="s.company.logo" alt="">
          <i v-else class="fas fa-cookie-bite"></i>
        </div>
        <h1 class="ca-titulo">{{ edicao ? 'Este aparelho' : 'Vamos configurar este aparelho' }}</h1>
        <p class="ca-sub">
          {{ edicao
            ? 'Mude o nome ou o tipo de uso. Isso vale só para este aparelho.'
            : 'Isso é feito uma vez só. Depois o app já abre direto no que este aparelho vai usar.' }}
        </p>
      </div>

      <label class="ca-label" for="ca-nome">Nome do aparelho</label>
      <input
        id="ca-nome" v-model="nome" class="ca-input" type="text" maxlength="30"
        placeholder="Ex.: Celular da Bete" autocomplete="off" @keydown.enter.prevent="continuar"
      >

      <div class="ca-label">Para que ele serve?</div>
      <div class="ca-papeis" role="radiogroup" aria-label="Tipo do aparelho">
        <button
          v-for="p in papeis" :key="p.id" type="button" role="radio" :aria-checked="papel === p.id"
          class="ca-papel" :class="{ sel: papel === p.id }" @click="papel = p.id"
        >
          <span class="ca-papel-ico" :style="{ background: p.cor }"><i :class="p.icone"></i></span>
          <span class="ca-papel-txt">
            <span class="ca-papel-nome">{{ p.nome }}</span>
            <span class="ca-papel-desc">{{ p.desc }}</span>
          </span>
          <i class="fas fa-circle-check ca-papel-ok"></i>
        </button>
      </div>

      <p v-if="papel === 'vendedor'" class="ca-nota">
        <i class="fas fa-shield-halved"></i>
        Este aparelho só abre a Caderneta de vendas. Para mudar o tipo depois, será preciso o PIN do Admin.
      </p>
      <p v-else-if="papel === 'admin'" class="ca-nota">
        <i class="fas fa-eye"></i>
        As vendas aparecem aqui só para consulta. Quem lança e recebe é o aparelho do vendedor.
      </p>

      <button type="button" class="ca-continuar" :disabled="!podeContinuar || salvando" @click="continuar">
        {{ edicao ? 'Salvar' : 'Continuar' }} <i class="fas fa-arrow-right"></i>
      </button>
      <button v-if="edicao" type="button" class="ca-cancelar" @click="emit('cancelar')">Cancelar</button>

      <!-- Instalação nova: dá pra trazer os dados de volta antes de começar. -->
      <div v-if="!edicao && s.bancoVazio" class="ca-recuperar">
        <button class="ca-recuperar-toggle" :disabled="s.recuperandoDados" @click="mostrarRecuperar = !mostrarRecuperar">
          <i class="fas fa-clock-rotate-left"></i> Já usei o app antes? Restaurar dados
          <i class="fas fa-chevron-down ca-seta" :class="{ aberta: mostrarRecuperar }"></i>
        </button>
        <div v-if="mostrarRecuperar" class="ca-recuperar-ops">
          <button class="ca-op" :disabled="s.recuperandoDados" @click="s.recuperarDeGoogleDrive">
            <i class="fab fa-google-drive"></i><span>Restaurar do Google Drive</span>
          </button>
          <button v-if="s.suportaPastaBackupLocal" class="ca-op" :disabled="s.recuperandoDados" @click="s.recuperarDaPastaLocal">
            <i class="fas fa-folder-open"></i><span>Restaurar de uma pasta local</span>
          </button>
          <label class="ca-op" :class="{ off: s.recuperandoDados }">
            <i class="fas fa-file-code"></i><span>Escolher um arquivo de backup (.json)</span>
            <input type="file" hidden accept=".json" :disabled="s.recuperandoDados"
              @change="e => { s.recuperarDeArquivoLocal(e.target.files[0]); e.target.value = '' }">
          </label>
          <div v-if="s.recuperandoDados" class="ca-carregando"><div class="ca-spin"></div> Restaurando…</div>
        </div>
      </div>
    </div>

    <!-- Escolher Admin num aparelho de um negócio que já tem PIN: confirma. -->
    <PinDialog
      v-if="pedindoPin === 'verificar'"
      titulo="PIN do Admin" subtitulo="Para usar este aparelho como Admin, digite o PIN."
      @ok="pedindoPin = null; gravar()" @cancelar="pedindoPin = null"
    />
    <!-- Primeiro Admin: convida a criar o PIN (pode pular). -->
    <PinDialog
      v-if="pedindoPin === 'criar'" modo="criar"
      titulo="Crie um PIN de Admin"
      subtitulo="Ele protege restaurar dados e trocar o tipo dos aparelhos. De 4 a 6 números."
      rotuloCancelar="Agora não"
      @ok="pedindoPin = null; gravar()" @cancelar="pedindoPin = null; gravar()"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store.js'
import PinDialog from '../components/PinDialog.vue'
import { aparelho, salvarAparelho, temPin } from '../store/aparelho.js'

const props = defineProps({ edicao: { type: Boolean, default: false } })
const emit = defineEmits(['pronto', 'cancelar'])
const s = useStore()

const papeis = [
  { id: 'vendedor', nome: 'Vendedor', desc: 'Lança vendas, recebe e controla clientes e lojas.', icone: 'fas fa-book-open', cor: 'linear-gradient(135deg, var(--green), #15803d)' },
  { id: 'admin', nome: 'Admin', desc: 'Produção, custos e financeiro. Vendas só para consulta.', icone: 'fas fa-gauge-high', cor: 'linear-gradient(135deg, var(--brown-dark), var(--brown))' }
]

const nome = ref('')
const papel = ref(null)
const salvando = ref(false)
const pedindoPin = ref(null)
const mostrarRecuperar = ref(false)
const papelOriginal = ref(null)

onMounted(() => {
  if (props.edicao && aparelho.value) {
    nome.value = aparelho.value.nome
    papel.value = aparelho.value.papel
    papelOriginal.value = aparelho.value.papel
  }
})

const podeContinuar = computed(() => nome.value.trim().length >= 2 && !!papel.value)

async function gravar() {
  salvando.value = true
  try {
    await salvarAparelho({ nome: nome.value, papel: papel.value })
    emit('pronto')
  } catch (e) {
    console.error(e)
    s.notify('Não foi possível salvar. Tente de novo.', 'error')
  } finally {
    salvando.value = false
  }
}

async function continuar() {
  if (!podeContinuar.value || salvando.value) return
  // Virar Admin (ou criar o primeiro) passa pelo PIN. Só renomear não pede nada.
  const virandoAdmin = papel.value === 'admin' && papelOriginal.value !== 'admin'
  if (virandoAdmin && !props.edicao) {
    pedindoPin.value = (await temPin()) ? 'verificar' : 'criar'
    return
  }
  gravar()
}
</script>

<style scoped>
.ca-shell {
  position: absolute; inset: 0; z-index: var(--z-overlay); overflow-y: auto;
  background: var(--bg); display: flex; justify-content: center; padding: 32px 24px;
  padding-bottom: max(32px, env(safe-area-inset-bottom)); font-family: var(--font);
}
.ca-conteudo { width: 100%; max-width: 380px; margin: auto 0; display: flex; flex-direction: column; }
.ca-topo { text-align: center; margin-bottom: 22px; }
.ca-logo { font-size: 44px; line-height: 1; height: 72px; display: flex; align-items: center; justify-content: center; }
.ca-logo img { width: 72px; height: 72px; object-fit: contain; }
.ca-titulo { margin: 6px 0 6px; font-size: 22px; font-weight: 900; letter-spacing: -.02em; color: var(--brown); }
.ca-sub { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--muted); }

.ca-label { margin: 16px 0 8px; font-size: 13px; font-weight: 800; color: var(--brown-dark); }
.ca-input {
  height: 54px; padding: 0 16px; font-family: var(--font); font-size: 17px; font-weight: 700; color: var(--brown-dark);
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); outline: none;
  box-shadow: var(--shadow); transition: border-color var(--t);
}
.ca-input:focus { border-color: var(--brown); }
.ca-input::placeholder { font-weight: 600; color: var(--text-faint); }

.ca-papeis { display: flex; flex-direction: column; gap: 10px; }
.ca-papel {
  display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px; text-align: left; cursor: pointer;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  box-shadow: var(--shadow); font-family: var(--font); transition: border-color var(--t), background var(--t), transform .1s;
}
.ca-papel:active { transform: scale(.98); }
.ca-papel.sel { border-color: var(--brown); background: var(--cream); }
.ca-papel-ico {
  width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0; color: #fff; font-size: 18px;
  display: flex; align-items: center; justify-content: center;
}
.ca-papel-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ca-papel-nome { font-size: 16px; font-weight: 800; color: var(--text); }
.ca-papel-desc { font-size: 12px; line-height: 1.35; color: var(--muted); }
.ca-papel-ok { font-size: 20px; color: var(--border2); transition: color var(--t); }
.ca-papel.sel .ca-papel-ok { color: var(--green); }

.ca-nota {
  display: flex; gap: 10px; align-items: flex-start; margin: 14px 0 0; padding: 11px 13px;
  font-size: 12.5px; line-height: 1.45; color: var(--brown-mid);
  background: var(--gold-bg); border-radius: var(--r-sm);
}
.ca-nota i { margin-top: 2px; color: var(--gold-dark); }

.ca-continuar {
  display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; min-height: 54px;
  border: 0; border-radius: var(--r-md); cursor: pointer; background: var(--brown); color: #fff;
  font-family: var(--font); font-size: 16px; font-weight: 800; transition: transform .1s, opacity var(--t);
}
.ca-continuar:active { transform: scale(.98); }
.ca-continuar:disabled { opacity: .4; cursor: default; }
.ca-cancelar {
  margin-top: 8px; min-height: 44px; border: 0; background: none; cursor: pointer;
  font-family: var(--font); font-size: 14px; font-weight: 700; color: var(--muted);
}

.ca-recuperar { margin-top: 22px; }
.ca-recuperar-toggle {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 4px; border: 0; background: none; cursor: pointer;
  font-family: var(--font); font-size: 12.5px; font-weight: 700; color: var(--muted);
}
.ca-recuperar-toggle:disabled { opacity: .6; pointer-events: none; }
.ca-seta { margin-left: auto; font-size: .7rem; transition: transform .2s ease; }
.ca-seta.aberta { transform: rotate(180deg); }
.ca-recuperar-ops { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.ca-op {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; text-align: left; cursor: pointer;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  font-family: var(--font); font-size: 13px; font-weight: 700; color: var(--text); transition: border-color var(--t), transform .1s;
}
.ca-op i:first-child { width: 16px; text-align: center; color: var(--brown); }
.ca-op:active { transform: scale(.98); border-color: var(--brown-light); }
.ca-op:disabled, .ca-op.off { opacity: .55; pointer-events: none; }
.ca-carregando { display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; font-weight: 700; color: var(--muted); }
.ca-spin { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--brown); border-radius: 50%; animation: ca-giro .7s linear infinite; }
@keyframes ca-giro { to { transform: rotate(360deg); } }
</style>
