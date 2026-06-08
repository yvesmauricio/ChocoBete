<template>
  <div class="tab-ajustes">
    <!-- ── Topo fixo: título + barra de navegação ── -->
    <div class="ajustes-sticky-top">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <h2 class="tab-title"><i class="fas fa-sliders"></i> Configurações</h2>
        </div>
        <p class="tab-subtitle">Dados do negócio, gerenciamento de contas e segurança</p>
      </div>

      <!-- ── Navegação por Setores (Menus) ── -->
      <div class="ajustes-nav-wrap">
        <button v-for="m in menus" :key="m.id" class="aba-btn"
          :class="{ active: abaAtiva === m.id }"
          @click="abaAtiva = m.id">
          <i :class="m.icon"></i> {{ m.label }}
        </button>
      </div>
    </div>

    <div class="ajustes-content">
      <!-- ── SEÇÃO 1: PERFIL DO NEGÓCIO ── -->
      <section v-if="abaAtiva === 'perfil'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-store"></i> Identidade da Marca</div>
          <p class="hint mb-12">Esses dados aparecem nos cabeçalhos dos documentos e etiquetas.</p>
          <div class="form-grid mt-12">
            <div class="fg">
              <label class="label">Nome da Marca</label>
              <input v-model="company.nome" class="input" placeholder="Ex: ChocoBete" />
            </div>
            <div class="fg">
              <label class="label">Razão Social</label>
              <input v-model="company.razao_social" class="input" placeholder="Nome completo ou Razão Social" />
            </div>
            <div class="fg-row">
              <div class="fg fg-2">
                <label class="label">CNPJ</label>
                <input 
                  :value="company.cnpj" 
                  @input="e => company.cnpj = maskCnpj(e.target.value)"
                  class="input" 
                  placeholder="00.000.000/0001-00" 
                />
              </div>
              <div class="fg" style="flex: 1.5">
                <label class="label">CPF do Titular</label>
                <input 
                  :value="company.cpf" 
                  @input="e => company.cpf = maskCpf(e.target.value)"
                  class="input" placeholder="000.000.000-00" />
              </div>
            </div>
            <div class="fg-row">
              <div class="fg" style="flex: 2">
                <label class="label">Município</label>
                <input v-model="company.municipio" class="input" placeholder="Ex: Rio de Janeiro" />
              </div>
              <div class="fg fg-1">
                <label class="label">UF</label>
                <input v-model="company.uf" class="input" maxlength="2" placeholder="RJ" />
              </div>
            </div>
            <div class="fg">
              <label class="label">CNAE Principal</label>
              <input 
                :value="company.cnae" 
                @input="e => company.cnae = maskCnae(e.target.value)"
                class="input" placeholder="Ex: 1091-1/01" />
            </div>
          </div>

          <div class="mt-24">
            <button class="btn btn-primary btn-full" @click="save">
              <i class="fas fa-save"></i> Salvar Dados da Empresa
            </button>
          </div>
        </div>
      </section>

      <!-- ── SEÇÃO 2: CONTAS BANCÁRIAS ── -->
      <section v-if="abaAtiva === 'financeiro'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-university"></i> Contas Financeiras</div>
          <p class="hint mt-4 mb-12">Configure as contas para importar extratos do PagBank, Itaú ou BB.</p>
          
          <div class="contas-list">
            <div v-for="(conta, idx) in s.contasFinanceiras" :key="conta.id" class="conta-item">
              <div class="conta-icon" :class="conta.banco">
                <i class="fas" :class="conta.banco === 'itau' ? 'fa-landmark' : (conta.banco === 'bb' ? 'fa-university' : 'fa-mobile-screen')"></i>
              </div>
              <div class="conta-info">
                <strong>{{ conta.nome }}</strong>
                <span>{{ conta.banco.toUpperCase() }} · {{ conta.natureza }}</span>
              </div>
              <div class="conta-item-acts">
                <button class="btn-action-edit" title="Editar conta" @click="abrirModalConta(conta)"><i class="fas fa-pencil"></i></button>
                <button class="btn-action-del" title="Excluir conta" @click="removerConta(idx)"><i class="fas fa-trash-alt"></i></button>
              </div>
            </div>
            
            <button class="btn-add-outline mt-8" @click="abrirModalConta(null)">
              <i class="fas fa-plus"></i> Adicionar Conta
            </button>
          </div>
        </div>
      </section>

      <!-- ── SEÇÃO: CADERNETA (FIADOS DA BETE) ── -->
      <section v-if="abaAtiva === 'caderneta'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-cookie-bite"></i> Itens do Caderninho</div>
          <p class="hint mb-12">Configure os itens que a Bete vende e o preço nos fiados.</p>

          <div class="cad-prod-list">
            <div v-for="(p, idx) in produtosCaderneta" :key="p.id" class="cad-prod-edit-row">
              <input v-model="p.emoji" class="input cad-mini-input" maxlength="2" title="Emoji">
              <input v-model="p.nome" class="input" placeholder="Nome do produto" style="flex: 1">
              <div class="input-with-prefix" style="width: 100px">
                <span class="input-prefix">R$</span>
                <input v-model.number="p.preco" type="number" step="0.5" class="input input-prefixed" style="text-align: right">
              </div>
              <button class="btn-icon danger" @click="produtosCaderneta.splice(idx, 1)" style="min-width:44px">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
            
            <button class="btn-add-outline mt-8" @click="addProdutoCaderneta">
              <i class="fas fa-plus"></i> Adicionar Produto
            </button>
          </div>

          <div class="section-label mt-24"><i class="fas fa-credit-card"></i> Taxas da Máquina</div>
          <p class="hint mb-12">Taxas configuradas para a Caderneta da Bete.</p>
          <div class="grid-2">
            <div class="fg">
              <label class="label">Débito (%)</label>
              <input v-model.number="taxasCaderneta.debito" type="number" step="0.01" class="input" />
            </div>
            <div class="fg">
              <label class="label">Crédito Vista (%)</label>
              <input v-model.number="taxasCaderneta.credito_avista" type="number" step="0.01" class="input" />
            </div>
          </div>

          <div class="mt-24">
            <button class="btn btn-primary btn-full" @click="salvarCaderneta">
              <i class="fas fa-save"></i> Salvar Dados da Caderneta
            </button>
          </div>
        </div>
      </section>

      <!-- ── SEÇÃO 3: BACKUP E SEGURANÇA ── -->
      <section v-if="abaAtiva === 'backup'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-cloud-arrow-up"></i> Backup</div>
          <p class="hint mb-16">Salve e restaure seus dados manualmente sempre que quiser.</p>

          <div class="backup-stack">
            <!-- Google Drive -->
            <div class="backup-card" :class="{ 'is-connected': s.googleDriveConfigured }">
              <div class="backup-hdr">
                <div class="backup-icon">
                  <i class="fab fa-google-drive"></i>
                </div>
                <div class="backup-info">
                  <div class="backup-name">Google Drive</div>
                  <div class="backup-status" v-if="s.googleDriveConfigured">
                    <span class="dot-status dot-online"></span> Conectado
                  </div>
                  <div class="backup-status warn" v-else>
                    <span class="dot-status dot-offline"></span> Desconectado
                  </div>
                </div>
                <div class="backup-action-main">
                  <button v-if="!s.googleDriveConfigured" class="btn btn-primary btn-sm" @click="s.conectarGoogleDrive">
                    Conectar
                  </button>
                  <button v-else class="btn-icon-sm danger" title="Desconectar" @click="s.desconectarGoogleDrive">
                    <i class="fas fa-sign-out-alt"></i>
                  </button>
                </div>
              </div>

              <div class="backup-divider" v-if="s.googleDriveConfigured"></div>

              <div v-if="s.googleDriveConfigured" class="backup-slots">
                <div class="bslot-manual-btns">
                  <button class="btn btn-primary btn-sm" @click="s.backupGoogleDrive">
                    <i class="fas fa-cloud-arrow-up"></i> Salvar agora
                  </button>
                  <button class="btn btn-secondary btn-sm" @click="s.restaurarGoogleDrive">
                    <i class="fas fa-cloud-arrow-down"></i> Restaurar
                  </button>
                  <button class="btn btn-secondary btn-sm" @click="s.restaurarGoogleDriveBak">
                    <i class="fas fa-rotate-left"></i> Restaurar anterior
                  </button>
                </div>
                <div class="bslot-sync-hint">
                  <i class="fas fa-mobile-screen"></i>
                  Para sincronizar com o celular, abra o app no celular conectado à mesma conta Google e toque em <strong>Restaurar</strong>.
                </div>
              </div>
            </div>

            <!-- Backup local JSON -->
            <div class="backup-card local">
              <div class="backup-btns">
                <div class="backup-icon"><i class="fas fa-file-code"></i></div>
                <div class="backup-info">
                  <div class="backup-name">Arquivo Local</div>
                  <div class="backup-status">Backup manual via JSON</div>
                </div>
              </div>
              <div class="backup-footer">
                <button class="btn btn-secondary btn-sm" @click="s.backupGeral">Exportar dados</button>
                <label class="btn btn-secondary btn-sm">
                  Importar arquivo
                  <input type="file" hidden accept=".json" @change="e => s.restaurarGeral(e.target.files[0])" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── SEÇÃO 4: PREFERÊNCIAS DO SISTEMA ── -->
      <section v-if="abaAtiva === 'sistema'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label mb-16"><i class="fas fa-gears"></i> Preferências do Sistema</div>
          
          <div class="setup-group">
            <div class="setup-header"><i class="fas fa-sack-dollar"></i> Financeiro & Metas</div>
            <div class="form-grid">
              <div class="fg">
                <label class="label">Valor da sua Hora de Trabalho</label>
                <div class="input-with-prefix">
                  <span class="input-prefix">R$</span>
                  <input v-model.number="company.custo_hora_trabalho" type="number" class="input" placeholder="Ex: 25.00" />
                </div>
                <p class="hint">Calcula o custo de mão de obra nas receitas.</p>
              </div>
              <div class="fg">
                <label class="label">Meta de Retirada Mensal (Salário)</label>
                <div class="input-with-prefix">
                  <span class="input-prefix">R$</span>
                  <input v-model.number="company.meta_salario_mensal" type="number" class="input" placeholder="Ex: 1500.00" />
                </div>
                <p class="hint">Define o preço mínimo e metas de venda na Inteligência.</p>
              </div>
              <div class="fg">
                <label class="label">Giro de Segurança Fixo <span class="label-opt">(opcional)</span></label>
                <div class="input-with-prefix">
                  <span class="input-prefix">R$</span>
                  <input v-model.number="company.reserva_operacional_fixa" type="number" class="input" placeholder="Ex: 600.00" />
                </div>
                <p class="hint">Valor reservado para compras (ex: R$ 600 p/ 2 semanas).</p>
              </div>
              <div class="fg">
                <label class="label">Teto de Faturamento MEI Anual</label>
                <div class="input-with-icon">
                  <i class="fas fa-arrow-up-wide-short"></i>
                  <input v-model.number="company.teto_mei_anual" type="number" class="input" />
                </div>
              </div>
            </div>
          </div>

          <div class="setup-group mt-20">
            <div class="setup-header"><i class="fas fa-sliders"></i> Operacional</div>
            <div class="form-grid">
              <div class="fg">
                <label class="label">Próxima etiqueta livre</label>
                <div class="input-with-icon">
                  <i class="fas fa-tag"></i>
                  <input v-model.number="company.posicao_etiqueta" type="number" class="input" min="1" max="77" />
                </div>
                <p class="hint">Posição (1 a 77) para reaproveitar folhas de etiquetas.</p>
              </div>
              <div class="fg">
                <label class="label">Nº de Pessoas na Família</label>
                <div class="input-with-icon">
                  <i class="fas fa-users"></i>
                  <input v-model.number="company.pessoas_familia" type="number" class="input" min="1" />
                </div>
                <p class="hint">Usado para cálculo de renda per capita nos relatórios.</p>
              </div>
            </div>
          </div>

          <div class="mt-24">
            <button class="btn btn-primary btn-full" @click="save">
              <i class="fas fa-save"></i> Salvar Preferências
            </button>
          </div>

          <div class="maintenance-zone mt-24">
            <p class="section-label-sm">Manutenção de Dados</p>
            <div class="maintenance-grid mt-8">
              <button class="btn btn-secondary btn-sm" @click="reclassificarLancamentos">
                <i class="fas fa-wand-magic-sparkles"></i> Reclassificar Extratos
              </button>
              <p class="hint">Aplica as regras automáticas de categorias em todos os lançamentos não editados manualmente.</p>
            </div>
          </div>

          <div class="danger-zone mt-32">
            <p class="danger-title">Zona Crítica</p>
            <div class="maintenance-grid">
              <button class="btn-danger-outline" @click="zerarDados">
                <i class="fas fa-trash-can"></i> Apagar tudo
              </button>
              <p class="hint">Remove permanentemente receitas, produtos e histórico financeiro.</p>
            </div>
          </div>
        </div>
      </section>

      <div class="version-info">chocobete v3.2 · Local Storage & IndexedDB</div>
    </div>

    <!-- ── Modal de Conta Bancária ── -->
    <BaseModal v-if="modalConta" :title="formConta.id ? 'Editar Conta' : 'Nova Conta'" @close="modalConta = false">
      <div class="form-section">
        <div class="fg">
          <label class="label">Nome da Conta</label>
          <input v-model="formConta.nome" class="input" placeholder="Ex: PagBank Empresa" />
        </div>
        <div class="fg">
          <label class="label">Banco</label>
          <select v-model="formConta.banco" class="input">
            <option value="pagbank">PagBank</option>
            <option value="itau">Itaú</option>
            <option value="bb">Banco do Brasil</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div class="fg">
          <label class="label">Titular</label>
          <input v-model="formConta.titular" class="input" placeholder="Ex: Elisabete" />
        </div>
        <div class="fg">
          <label class="label">Natureza</label>
          <select v-model="formConta.natureza" class="input">
            <option value="empresarial">Empresarial</option>
            <option value="pessoal">Pessoal</option>
          </select>
        </div>
        <div class="fg">
          <label class="label">Papel da Conta</label>
          <input v-model="formConta.papel" class="input" placeholder="Ex: Recebimento de vendas" />
        </div>
      </div>
      <template #foot>
        <div class="spacer"></div>
        <button class="btn btn-secondary" @click="modalConta = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="!formConta.nome" @click="salvarConta">Salvar</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useStore } from '../store.js'
import { maskCpf, maskCnpj, maskCnae } from '../utils.js'
import { useConfirm as useAppConfirm } from '../composables/useConfirm.js'
import { 
  getProdutosCaderneta, 
  salvarProdutosCaderneta, 
  getTaxas, 
  salvarTaxas 
} from '../composables/useCaderneta.js'
import BaseModal from '../components/BaseModal.vue'

const s = useStore()
const confirmar = useAppConfirm()
const company = reactive({ ...s.company })

// 🔄 Sincroniza o formulário local quando os dados são carregados do banco (Store Init)
// Isso evita que a tela mostre dados padrão caso o banco demore a responder
watch(() => s.company, (novoValor) => {
  if (novoValor) {
    // Copia os dados da store para o estado local do formulário
    Object.assign(company, JSON.parse(JSON.stringify(novoValor)))
  }
}, { deep: true, immediate: true })

const abaAtiva = ref('perfil')
const menus = [
  { id: 'perfil',     label: 'Identidade', icon: 'fas fa-id-card' },
  { id: 'financeiro', label: 'Financeiro', icon: 'fas fa-university' },
  { id: 'caderneta',  label: 'Caderneta',  icon: 'fas fa-book' },
  { id: 'backup',     label: 'Backup',     icon: 'fas fa-cloud-arrow-up' },
  { id: 'sistema',    label: 'Sistema',    icon: 'fas fa-gears' }
]

// ── Gerenciamento de Contas ──
const modalConta = ref(false)
const formConta = reactive({ id: null, nome: '', banco: 'pagbank', titular: '', natureza: 'pessoal', papel: '' })

function abrirModalConta(conta = null) {
  if (conta) {
    Object.assign(formConta, JSON.parse(JSON.stringify(conta)))
  } else {
    Object.assign(formConta, { id: null, nome: '', banco: 'pagbank', titular: '', natureza: 'pessoal', papel: '' })
  }
  modalConta.value = true
}

function salvarConta() {
  const lista = [...s.contasFinanceiras]
  if (formConta.id) {
    const idx = lista.findIndex(c => c.id === formConta.id)
    if (idx !== -1) lista[idx] = { ...formConta }
  } else {
    lista.push({ ...formConta, id: `cta-${Date.now()}` })
  }
  s.saveContasFinanceiras(lista)
  modalConta.value = false
  s.notify('Conta salva com sucesso!')
}

// ── Configurações da Caderneta ──
const produtosCaderneta = ref([])
const taxasCaderneta = reactive({ debito: 0, credito_avista: 0 })

async function carregarDadosCaderneta() {
  produtosCaderneta.value = JSON.parse(JSON.stringify(await getProdutosCaderneta()))
  const t = await getTaxas()
  Object.assign(taxasCaderneta, t)
}

watch(abaAtiva, (val) => {
  if (val === 'caderneta') carregarDadosCaderneta()
})

async function salvarCaderneta() {
  await salvarProdutosCaderneta(produtosCaderneta.value.filter(p => p.nome.trim()))
  await salvarTaxas({ ...taxasCaderneta })
  s.notify('Configurações da Caderneta salvas!')
}

function save() {
  s.saveCompany({ ...company })
  s.notify('Alterações salvas com sucesso!')
}

async function removerConta(idx) {
  const ok = await confirmar.ask('Deseja remover esta conta bancária? Lançamentos vinculados a ela não serão apagados.', {
    title: 'Remover Conta',
    confirmLabel: 'Remover',
    type: 'danger'
  })
  if (ok) {
    const novas = [...s.contasFinanceiras]
    novas.splice(idx, 1)
    s.saveContasFinanceiras(novas)
    s.notify('Conta removida!')
  }
}

async function reclassificarLancamentos() {
  s.loading = true
  try {
    const total = await s.reclassificarTodosFinanceiro()
    if (total > 0) s.notify(`${total} lançamentos atualizados!`)
  } finally {
    s.loading = false
  }
}

async function zerarDados() {
  const ok = await confirmar.ask('ATENÇÃO: Todos os produtos, receitas, produções e dados financeiros serão apagados permanentemente. Deseja continuar?', {
    title: 'Zerar Banco de Dados',
    confirmLabel: 'Apagar tudo',
    type: 'danger'
  })
  if (ok) {
    s.notify('Função de reset total bloqueada nesta versão por segurança.', 'warning')
  }
}

function addProdutoCaderneta() {
  produtosCaderneta.value.push({ id: `prod_${Date.now()}`, nome: '', emoji: '📦', preco: 0 })
}
</script>

<style scoped>
.tab-ajustes { padding-bottom: 120px; background: var(--bg); }
/* ── Topo unificado sticky ── */
.ajustes-sticky-top { position: sticky; top: 0; z-index: 50; background: var(--surface); box-shadow: 0 2px 8px rgba(61,31,7,.06); }
.tab-ajustes .tab-hdr { position: static; box-shadow: none; border-bottom: none; }
.ajustes-nav-wrap { background: var(--surface); border-bottom: 1px solid var(--border); display: flex; padding: 0 16px; overflow-x: auto; scrollbar-width: none; position: static; }
.ajustes-nav-wrap::-webkit-scrollbar { display: none; }
.aba-btn { flex: 1; padding: 14px 10px; border: none; background: transparent; color: var(--muted); font-size: .78rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; border-bottom: 3px solid transparent; transition: all var(--t); }
.aba-btn i { font-size: 1rem; }
.aba-btn.active { color: var(--brown); border-bottom-color: var(--brown); background: var(--gold-bg); }

.ajustes-content { padding: 16px; display: flex; flex-direction: column; gap: 16px; }

.fade-in { animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

.form-grid { display: flex; flex-direction: column; gap: 14px; }
.fg-row { display: flex; gap: 12px; }
.input-with-prefix { display: flex; align-items: stretch; border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; background: var(--surface); }
.input-prefix { display: flex; align-items: center; padding: 0 12px; background: var(--bg); border-right: 1px solid var(--border); color: var(--muted); font-size: .82rem; font-weight: 700; }
.input-with-prefix .input { border: none !important; border-radius: 0 !important; flex: 1; height: 42px; }
.input-with-icon { position: relative; }
.input-with-icon i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .85rem; }
.input-with-icon .input { padding-left: 34px; }

.contas-list { display: flex; flex-direction: column; gap: 8px; }
.conta-item { display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md); }
.conta-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: .9rem; }
.conta-icon.pagbank { background: var(--gold); color: #000; }
.conta-icon.itau { background: var(--orange); }
.conta-icon.bb { background: var(--gold); color: var(--blue); }
.conta-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.conta-info strong { font-size: .85rem; color: var(--text); }
.conta-info span { font-size: .7rem; color: var(--muted); font-weight: 600; }
.conta-item-acts { display: flex; gap: 4px; }
.btn-action-del { width: 32px; height: 32px; background: transparent; border: none; color: var(--red); font-size: .85rem; }
.btn-action-edit { width: 32px; height: 32px; background: transparent; border: none; color: var(--brown-mid); font-size: .85rem; }

/* ── Caderneta Config UI ── */
.cad-prod-edit-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.cad-mini-input { width: 48px; text-align: center; flex-shrink: 0; padding: 10px 4px !important; }

/* ── Backup UI ── */
.backup-stack { display: flex; flex-direction: column; gap: 12px; }
.backup-card { 
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-lg); 
  padding: 16px; transition: all 0.3s ease; 
}
.backup-card.is-connected { border-color: var(--green); background: var(--green-bg); }
.backup-card.local { border-style: dashed; }
.backup-hdr { display: flex; align-items: center; gap: 12px; }
.backup-icon { 
  width: 44px; height: 44px; border-radius: 12px; background: var(--bg); 
  display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: var(--muted);
}
.is-connected .backup-icon { background: var(--green); color: #fff; }
.backup-info { flex: 1; }
.backup-name { font-weight: 800; color: var(--brown-dark); font-size: 1rem; }
.backup-status { font-size: .72rem; font-weight: 700; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.dot-status { width: 6px; height: 6px; border-radius: 50%; }
.dot-online { background: var(--green); box-shadow: 0 0 5px var(--green); }
.dot-offline { background: var(--muted); }
.backup-divider { height: 1px; background: var(--border); margin: 12px 0; opacity: 0.5; }
.backup-footer { display: flex; gap: 8px; }
.backup-footer .btn { flex: 1; font-size: .75rem; }

/* ── Backup slots (atual + anterior) ── */
.backup-slots { display: flex; flex-direction: column; gap: 10px; }
.bslot {
  padding: 10px 12px; border-radius: var(--r-sm);
  display: flex; flex-direction: column; gap: 8px;
}
.bslot-current { background: var(--bg); border: 1px solid var(--border); }
.bslot-bak { background: var(--gold-bg); border: 1px solid #e8d5a0; }
.bslot-info { display: flex; align-items: flex-start; gap: 10px; }
.bslot-info > i { margin-top: 2px; font-size: .9rem; flex-shrink: 0; }
.bslot-label { font-size: .78rem; font-weight: 800; color: var(--brown-dark); }
.bslot-sub { font-size: .65rem; color: var(--muted); margin-top: 1px; }
.bslot-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.bslot-actions .btn { font-size: .72rem; padding: 5px 10px; }
.bslot-sync-hint {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 8px 10px; border-radius: var(--r-sm);
  background: #eff6ff; border: 1px solid #bfdbfe;
  font-size: .68rem; color: var(--blue); line-height: 1.4;
}
.bslot-sync-hint i { margin-top: 1px; flex-shrink: 0; }
.bslot-manual-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.bslot-manual-btns .btn { flex: 1; font-size: .76rem; min-width: 100px; }

.btn-icon-sm.danger { 
  width: 32px; height: 32px; border-radius: 8px; border: none; 
  background: var(--red-bg); color: var(--red); cursor: pointer;
}

/* ── Grupos de Setup ── */
.setup-group { 
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md); 
  padding: 14px; 
}
.setup-header { 
  display: flex; align-items: center; gap: 8px; 
  font-size: .75rem; font-weight: 800; text-transform: uppercase; 
  color: var(--brown-mid); margin-bottom: 14px; letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border); padding-bottom: 8px;
}
.setup-header i { color: var(--gold-dark); }

.danger-zone { border-top: 1px solid var(--border); padding-top: 16px; }
.danger-title { font-size: .7rem; font-weight: 800; color: var(--red); text-transform: uppercase; margin-bottom: 8px; }

.version-info { text-align: center; font-size: .7rem; color: var(--muted); font-weight: 600; margin-top: 20px; }
</style>
