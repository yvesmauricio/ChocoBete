<template>
  <div class="importador-wrap">
    <section class="hero-card" :class="bankKey">
      <div class="hero-icon">
        <template v-if="heroIcon">
          <img 
            v-if="heroIcon.includes('.') || heroIcon.startsWith('/')" 
            :src="heroIcon" 
            class="hero-img" 
            alt="Logo" 
          />
          <i v-else class="fas" :class="heroIcon"></i>
        </template>
      </div>
      <div class="hero-body">
        <h3>{{ heroTitle }}</h3>
        <p>{{ heroDesc }}</p>
      </div>
    </section>

    <section class="sheet-card">
      <div class="sheet-body">
        <div class="fg">
          <label class="label">Conta de destino</label>
          <select 
            :value="contaId" 
            @change="$emit('update:contaId', $event.target.value)" 
            class="input" 
            :disabled="loading"
          >
            <option value="">Selecione uma conta {{ bankLabel }}</option>
            <option v-for="conta in contas" :key="conta.id" :value="conta.id">
              {{ conta.nome }} · {{ conta.titular || 'Sem titular' }}
            </option>
          </select>
        </div>

        <label class="upload-card" :class="{ busy: loading, [bankKey]: true }">
          <input
            class="file-input"
            type="file"
            :accept="accept"
            :disabled="loading"
            @change="$emit('file-change', $event)"
          />
          <div class="upload-icon">
            <i class="fas" :class="loading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'"></i>
          </div>
          <div class="upload-copy">
            <strong>{{ loading ? 'Processando...' : `Escolher arquivo ${acceptLabel}` }}</strong>
            <span>{{ fileName || `Extrato ${bankLabel}` }}</span>
          </div>
          <i class="fas fa-chevron-right upload-chevron"></i>
        </label>

        <slot name="hint">
          <div class="hint-box">
            <i class="fas fa-circle-info"></i>
            <span>O extrato é importado e classificado automaticamente.</span>
          </div>
        </slot>
      </div>
    </section>

    <slot name="extra" />

    <Transition name="fade-in">
      <section v-if="resultado" class="sheet-card result-section">
        <div class="sheet-body">
          <div class="success-banner" :class="{ 'warning': resultado.importadosCount === 0 }">
            <div class="success-icon-circle">
              <i class="fas" :class="resultado.importadosCount > 0 ? 'fa-check' : 'fa-info'"></i>
            </div>
            <div class="success-text">
              <h4>{{ resultado.importadosCount > 0 ? 'Importação Concluída' : 'Nada para importar' }}</h4>
              <p v-if="resultado.importadosCount > 0">
                {{ resultado.importadosCount }} novos lançamentos foram registrados com sucesso.
              </p>
              <p v-else>
                Todos os lançamentos deste arquivo já estavam registrados no sistema.
              </p>
            </div>
          </div>

          <div class="section-head-alt">
            <h4>Resumo detalhado</h4>
          </div>

        <div class="result-grid">
          <div class="result-item"><span>Lidas</span><strong>{{ resultado.recebidos }}</strong></div>
          <div class="result-item"><span>Válidas</span><strong>{{ resultado.validos }}</strong></div>
          <div class="result-item"><span>Duplicadas</span><strong>{{ resultado.duplicados }}</strong></div>
          <div class="result-item"><span>Importados</span><strong class="c-green">{{ resultado.importadosCount }}</strong></div>
          <div class="result-item"><span>Receitas</span><strong class="c-green">{{ R$(resultado.receitasImportadas || 0) }}</strong></div>
          <div class="result-item"><span>Saídas</span><strong class="c-red">{{ R$(resultado.saidasImportadas || 0) }}</strong></div>
        </div>
      </div>
    </section>
    </Transition>

    <slot name="footer" />
  </div>
</template>

<script setup>
import { R$ } from '../utils.js'

defineProps({
  bankKey: String,
  bankLabel: String,
  heroTitle: String,
  heroDesc: String,
  heroIcon: String,
  accept: { type: String, default: '.csv' },
  acceptLabel: { type: String, default: 'CSV' },
  contas: Array,
  contaId: String,
  loading: Boolean,
  fileName: String,
  resultado: Object
})

defineEmits(['file-change', 'update:contaId'])
</script>

<style scoped>
.importador-wrap { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.hero-card { background: var(--surface); border: 1px solid var(--border); display: flex; gap: 12px; padding: 16px; border-radius: var(--r-lg); }
.hero-card.itau { background: linear-gradient(145deg, #eff6ff, var(--surface)); }
.hero-card.pagbank { background: linear-gradient(145deg, var(--gold-bg), var(--surface)); }
.hero-card.bb { background: linear-gradient(145deg, #fff7cc, var(--surface)); }
.hero-icon { width: 48px; height: 48px; border-radius: var(--r-md); background: rgba(30, 18, 8, 0.08); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
.itau .hero-icon { color: var(--blue); background: rgba(29, 78, 216, 0.12); }
.pagbank .hero-icon { color: var(--gold-dark); background: rgba(200, 137, 10, 0.16); }
.bb .hero-icon { background: rgba(243, 188, 0, 0.2); color: #0f4ea8; }
.hero-body h3 { font-size: .98rem; margin-bottom: 4px; }
.hero-img { width: 32px; height: 32px; object-fit: contain; }
.hero-body p { font-size: .82rem; color: var(--muted); line-height: 1.55; }
.upload-card { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1.5px dashed var(--border2); border-radius: var(--r-md); background: var(--cream); position: relative; cursor: pointer; }
.upload-icon { width: 42px; height: 42px; border-radius: var(--r-md); background: var(--surface); color: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.itau .upload-icon { color: var(--blue); }
.bb .upload-icon { background: #eaf1ff; color: #0f4ea8; }
.upload-copy { min-width: 0; display: flex; flex-direction: column; }
.upload-copy strong { font-size: .9rem; color: var(--brown-dark); }
.upload-copy span { font-size: .78rem; color: var(--muted); }
.file-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
:deep(.hint-box) { margin-top: 12px; display: flex; gap: 8px; align-items: flex-start; color: var(--muted); font-size: .78rem; }
.result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.result-item { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md); padding: 10px; }
.result-item span { display: block; font-size: .65rem; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 4px; }
.result-item strong { font-family: var(--mono); font-size: .95rem; }
.c-green { color: var(--green); }
.c-red { color: var(--red); }

/* ── Feedback de Sucesso ── */
.result-section { border-top: 3px solid var(--green); }
.success-banner { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 12px; background: var(--green-bg); border-radius: var(--r-md); }
.success-banner.warning { background: var(--gold-bg); border-color: var(--gold-dim); }
.success-banner.warning .success-icon-circle { background: var(--gold-bg); color: var(--gold-dark); border: 2px solid var(--gold-dim); }
.success-banner.warning .success-text h4 { color: var(--brown-dark); }

.success-icon-circle { width: 44px; height: 44px; background: var(--green); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.2); }
.success-text h4 { margin: 0; font-size: 1rem; color: var(--green); font-weight: 800; }
.success-text p { margin: 4px 0 0; font-size: 0.8rem; color: var(--muted); line-height: 1.4; }

.section-head-alt { margin-bottom: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
.section-head-alt h4 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin: 0; }

/* Animação de Entrada */
.fade-in-enter-active { transition: all 0.4s var(--t-spring); }
.fade-in-enter-from { opacity: 0; transform: translateY(10px) scale(0.98); }
</style>