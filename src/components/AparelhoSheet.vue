<template>
  <Teleport to="body">
    <div class="ap-ov" @click.self="emit('fechar')">
      <div class="ap-folha" role="dialog" aria-modal="true" aria-label="Este aparelho">
        <div class="ap-topo">
          <div class="ap-topo-txt">
            <div class="ap-rot">Este aparelho</div>
            <div class="ap-nome">{{ aparelho?.nome }}</div>
          </div>
          <span class="ap-papel"><i class="fas fa-book-open"></i> Vendedor</span>
          <button class="ap-x" aria-label="Fechar" @click="emit('fechar')"><i class="fas fa-xmark"></i></button>
        </div>

        <div class="ap-corpo">
          <!-- Nível seguro: o vendedor usa sozinho -->
          <div class="ap-card">
            <div class="ap-card-tit"><i class="fas fa-cloud"></i> Sincronização</div>
            <div class="ap-status" :class="`ap-status--${estado.tipo}`">
              <i class="fas" :class="estado.icone"></i>
              <div>
                <div class="ap-status-t">{{ estado.titulo }}</div>
                <div v-if="ultimaSync" class="ap-status-s">Última vez: {{ ultimaSync }}</div>
              </div>
            </div>

            <template v-if="s.googleDriveAvailable && !s.googleDriveConfigured">
              <p class="ap-txt">Conecte o Google Drive para que as vendas deste aparelho apareçam no Admin e fiquem guardadas.</p>
              <button class="ap-btn ap-btn--pri" :disabled="ocupado" @click="conectar"><i class="fab fa-google-drive"></i> Conectar Google Drive</button>
            </template>
            <button v-else-if="s.googleDriveConfigured" class="ap-btn ap-btn--pri" :disabled="ocupado || s.syncStatus === 'syncing'" @click="sincronizar">
              <i class="fas fa-rotate" :class="{ 'fa-spin': ocupado || s.syncStatus === 'syncing' }"></i> Sincronizar agora
            </button>
            <p class="ap-dica">Sincronizar junta o que está aqui com o que está no Drive. Nada é apagado.</p>
          </div>

          <!-- Nível de risco: só com o PIN do Admin -->
          <div class="ap-card ap-card--admin">
            <div class="ap-card-tit"><i class="fas fa-lock"></i> Área do Admin</div>

            <template v-if="!liberado">
              <p class="ap-txt">Restaurar dados, importar e mudar o tipo deste aparelho precisam do PIN do Admin.</p>
              <button class="ap-btn" :disabled="ocupado" @click="pedirPin"><i class="fas fa-key"></i> Digitar PIN</button>
            </template>

            <template v-else>
              <p v-if="!semPin" class="ap-txt ap-txt--ok"><i class="fas fa-lock-open"></i> Liberado enquanto esta tela estiver aberta.</p>
              <p v-else class="ap-txt ap-txt--alerta"><i class="fas fa-triangle-exclamation"></i> Nenhum PIN foi definido ainda. Defina um no aparelho Admin (Ajustes › Sistema).</p>

              <button class="ap-opcao" @click="emit('abrir-admin')">
                <span class="ap-opcao-ico"><i class="fas fa-gauge-high"></i></span>
                <span class="ap-opcao-txt">
                  <b>Abrir o modo Admin</b>
                  <small>Backup, restaurar dados e demais ajustes. Ao sair, volta para as vendas.</small>
                </span>
                <i class="fas fa-chevron-right"></i>
              </button>
              <button class="ap-opcao" @click="emit('editar-aparelho')">
                <span class="ap-opcao-ico"><i class="fas fa-pen"></i></span>
                <span class="ap-opcao-txt">
                  <b>Nome e tipo deste aparelho</b>
                  <small>Trocar o nome ou passar para Admin.</small>
                </span>
                <i class="fas fa-chevron-right"></i>
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <PinDialog v-if="pinAberto" titulo="PIN do Admin" subtitulo="Digite o PIN para abrir a Área do Admin." @ok="pinAberto = false; liberado = true" @cancelar="pinAberto = false" />
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store.js'
import PinDialog from './PinDialog.vue'
import { aparelho, temPin } from '../store/aparelho.js'

const emit = defineEmits(['fechar', 'abrir-admin', 'editar-aparelho'])
const s = useStore()

const liberado = ref(false)
const semPin = ref(false)
const pinAberto = ref(false)
const ocupado = ref(false)

onMounted(async () => { semPin.value = !(await temPin()) })

async function pedirPin() {
  if (!(await temPin())) { semPin.value = true; liberado.value = true; return }
  pinAberto.value = true
}

async function sincronizar() {
  ocupado.value = true
  try { await s.syncImediato({ manual: true }) } finally { ocupado.value = false }
}
async function conectar() {
  ocupado.value = true
  try { await s.conectarGoogleDrive() } finally { ocupado.value = false }
}

const estado = computed(() => {
  if (!s.googleDriveConfigured) return { tipo: 'off', icone: 'fa-cloud-slash', titulo: 'Drive não conectado' }
  if (s.syncStatus === 'conflict') return { tipo: 'erro', icone: 'fa-triangle-exclamation', titulo: 'Conflito: toque em Sincronizar para resolver' }
  if (s.syncStatus === 'error') return { tipo: 'erro', icone: 'fa-triangle-exclamation', titulo: 'Falha ao sincronizar' }
  if (s.syncStatus === 'syncing') return { tipo: 'sync', icone: 'fa-cloud-arrow-up fa-beat-fade', titulo: 'Sincronizando…' }
  if (s.hasLocalChanges) return { tipo: 'pend', icone: 'fa-cloud-arrow-up', titulo: 'Há vendas ainda não enviadas' }
  return { tipo: 'ok', icone: 'fa-cloud-check', titulo: 'Tudo salvo no Drive' }
})

const ultimaSync = computed(() => {
  if (!s.ultimoSyncTs) return ''
  const d = new Date(s.ultimoSyncTs)
  if (isNaN(d)) return ''
  const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `hoje, ${hh}` : `${d.toLocaleDateString('pt-BR')} ${hh}`
})
</script>

<style scoped>
.ap-ov {
  position: fixed; inset: 0; z-index: var(--z-modal); display: flex; align-items: flex-end; justify-content: center;
  background: rgba(30, 18, 8, .5); animation: ap-fade .15s ease;
}
@keyframes ap-fade { from { opacity: 0 } to { opacity: 1 } }
.ap-folha {
  width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; font-family: var(--font);
  background: var(--bg); border-radius: 22px 22px 0 0; box-shadow: 0 -10px 40px rgba(30, 18, 8, .25);
  animation: ap-sobe .22s cubic-bezier(.34, 1.3, .64, 1);
}
@keyframes ap-sobe { from { transform: translateY(40px); opacity: .6 } to { transform: none; opacity: 1 } }
@media (min-width: 700px) { .ap-ov { align-items: center; } .ap-folha { border-radius: 20px; } }

.ap-topo { display: flex; align-items: center; gap: 10px; padding: 16px 16px 10px 20px; }
.ap-topo-txt { flex: 1; min-width: 0; }
.ap-rot { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.ap-nome { font-size: 20px; font-weight: 900; color: var(--brown-dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-papel {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: var(--r-full);
  background: var(--green-bg); color: var(--green); font-size: 12px; font-weight: 800; white-space: nowrap;
}
.ap-x { width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--cream-deep); color: var(--brown-mid); font-size: 15px; cursor: pointer; }
.ap-corpo { overflow-y: auto; padding: 4px 16px max(24px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; }

.ap-card { padding: 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.ap-card-tit { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--brown-mid); }
.ap-status { display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 12px; border-radius: var(--r-sm); background: var(--cream); color: var(--brown-dark); }
.ap-status > i { font-size: 22px; }
.ap-status-t { font-size: 14.5px; font-weight: 800; }
.ap-status-s { margin-top: 1px; font-size: 12px; font-weight: 600; color: var(--muted); }
.ap-status--ok { background: var(--green-bg); color: var(--green); }
.ap-status--erro { background: var(--red-bg); color: var(--red); }
.ap-status--pend, .ap-status--sync { background: var(--gold-bg); color: var(--gold-dark); }
.ap-txt { margin: 0 0 12px; font-size: 13px; line-height: 1.45; color: var(--muted); font-weight: 600; }
.ap-txt i { margin-right: 6px; }
.ap-txt--ok { color: var(--green); }
.ap-txt--alerta { color: var(--orange); }
.ap-dica { margin: 10px 0 0; font-size: 11.5px; line-height: 1.4; color: var(--muted); }

.ap-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 50px;
  border-radius: var(--r-md); cursor: pointer; border: 1.5px solid var(--border); background: var(--surface); color: var(--brown-dark);
  font-family: var(--font); font-size: 14.5px; font-weight: 800; transition: transform .1s, opacity var(--t);
}
.ap-btn:active { transform: scale(.98); }
.ap-btn:disabled { opacity: .55; cursor: default; }
.ap-btn--pri { background: var(--brown); border-color: var(--brown); color: #fff; }

.ap-opcao {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; margin-top: 8px; text-align: left; cursor: pointer;
  background: var(--cream); border: 1.5px solid transparent; border-radius: var(--r-sm); font-family: var(--font); transition: transform .1s, border-color var(--t);
}
.ap-opcao:active { transform: scale(.985); border-color: var(--brown-light); }
.ap-opcao-ico { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; background: var(--brown); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; }
.ap-opcao-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ap-opcao-txt b { font-size: 14.5px; color: var(--brown-dark); }
.ap-opcao-txt small { font-size: 12px; line-height: 1.35; color: var(--muted); font-weight: 600; }
.ap-opcao > i { color: var(--brown-light); font-size: 13px; }
</style>
