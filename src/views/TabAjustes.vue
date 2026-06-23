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
      <div ref="abaStripEl" class="ajustes-nav-wrap">
        <button v-for="m in menus" :key="m.id" class="aba-btn"
          :ref="el => setAbaRef(el, m.id)"
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

          <div class="section-label mt-24"><i class="fas fa-sack-dollar"></i> Metas e Parâmetros</div>
          <div class="form-grid mt-12">
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

          <div class="mt-24">
            <button class="btn btn-primary btn-full" @click="save">
              <i class="fas fa-save"></i> Salvar
            </button>
          </div>
        </div>
      </section>

      <!-- ── SEÇÃO: ETIQUETAS ── -->
      <section v-if="abaAtiva === 'etiquetas'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-tags"></i> Gerar Etiquetas</div>
          <p class="hint mt-4 mb-12">Escolha os sabores e quantidades para gerar uma folha de etiquetas Pimaco A5Q-1226 (77 por folha), sem precisar de uma produção registrada.</p>

          <!-- Contato exibido na etiqueta -->
          <div class="fg mb-12">
            <label class="label">Texto de contato na etiqueta</label>
            <input v-model="company.contato_etiqueta" class="input" placeholder="Ex: @chocobete · (11) 99999-9999" />
            <p class="hint">Aparece embaixo do sabor em cada etiqueta. Se vazio, usa o nome da empresa.</p>
          </div>

          <!-- Posição inicial -->
          <div class="fg mb-12">
            <label class="label">Próxima etiqueta livre na folha</label>
            <div class="input-with-icon">
              <i class="fas fa-tag"></i>
              <input v-model.number="company.posicao_etiqueta" type="number" class="input" min="1" max="77" />
            </div>
          </div>

          <div class="section-label mt-16"><i class="fas fa-list-check"></i> Sabores e quantidades</div>
          <div class="etq-receitas-list">
            <div v-for="r in receitasParaEtiqueta" :key="r._textoSabor" class="etq-receita-item" :class="{ ativa: etqQtds[r._textoSabor] > 0 }">
              <button class="etq-receita-nome" @click="etqQtds[r._textoSabor] = etqQtds[r._textoSabor] > 0 ? 0 : 1">
                <i class="fas" :class="etqQtds[r._textoSabor] > 0 ? 'fa-square-check' : 'fa-square'"></i>
                <span>{{ r._textoSabor }}</span>
              </button>
              <div v-if="etqQtds[r._textoSabor] > 0" class="etq-qtd-ctrl">
                <button class="qtd-e-btn" @click="etqQtds[r._textoSabor] = Math.max(1, etqQtds[r._textoSabor] - 1)">−</button>
                <input class="qtd-e-input" type="text" inputmode="numeric"
                  :value="String(etqQtds[r._textoSabor])"
                  @input="e => etqQtds[r._textoSabor] = parseInt(e.target.value.replace(/\D/g,'')) || 1" />
                <button class="qtd-e-btn" @click="etqQtds[r._textoSabor] = etqQtds[r._textoSabor] + 1">+</button>
              </div>
            </div>
            <p v-if="!receitasParaEtiqueta.length" class="hint">Nenhuma receita cadastrada ainda.</p>
          </div>

          <!-- ── Configurar filtro: o que entra/sai da lista ── -->
          <button class="etq-config-toggle" @click="mostrarConfigFiltro = !mostrarConfigFiltro">
            <i class="fas fa-filter"></i>
            <span>Configurar o que aparece na lista</span>
            <i class="fas" :class="mostrarConfigFiltro ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>

          <div v-if="mostrarConfigFiltro" class="etq-config-painel">

            <!-- Termos bloqueados -->
            <div class="section-label"><i class="fas fa-ban"></i> Palavras que escondem uma receita</div>
            <p class="hint mb-8">Qualquer receita cujo nome contenha uma dessas palavras não aparece na lista de sabores (ex: "recheio" esconde "Recheio Doce de Leite").</p>
            <div class="etq-termos-chips">
              <span v-for="termo in (company.etiquetas_termos_excluidos || [])" :key="termo" class="etq-termo-chip">
                {{ termo }}
                <button @click="removerTermoExcluido(termo)"><i class="fas fa-xmark"></i></button>
              </span>
              <p v-if="!(company.etiquetas_termos_excluidos || []).length" class="hint">Nenhuma palavra bloqueada.</p>
            </div>
            <div class="etq-termo-add">
              <input v-model="novoTermoExcluido" class="input" placeholder="Ex: trufa, ovo, mini..." @keyup.enter="adicionarTermoExcluido" />
              <button class="btn btn-secondary btn-sm" @click="adicionarTermoExcluido"><i class="fas fa-plus"></i></button>
            </div>

            <!-- Receitas escondidas — permite forçar inclusão -->
            <div v-if="receitasExcluidasEtiqueta.length" class="section-label mt-16"><i class="fas fa-eye-slash"></i> Receitas escondidas pelo filtro</div>
            <p v-if="receitasExcluidasEtiqueta.length" class="hint mb-8">Marque para forçar a aparecer na lista mesmo batendo numa palavra bloqueada.</p>
            <div v-if="receitasExcluidasEtiqueta.length" class="etq-receitas-list">
              <div v-for="r in receitasExcluidasEtiqueta" :key="r.uuid" class="etq-receita-item etq-receita-oculta">
                <button class="etq-receita-nome" @click="alternarExcecaoReceita(r)">
                  <i class="fas" :class="(company.etiquetas_excecoes_incluir || []).includes(r.uuid) ? 'fa-square-check' : 'fa-square'"></i>
                  <span>{{ r.nome }}</span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="totalEtiquetasSelecionadas > 0" class="etq-resumo">
            <i class="fas fa-circle-info"></i>
            {{ totalEtiquetasSelecionadas }} etiqueta{{ totalEtiquetasSelecionadas > 1 ? 's' : '' }} ·
            {{ totalFolhasEtiqueta }} folha{{ totalFolhasEtiqueta > 1 ? 's' : '' }}
          </div>

          <div class="etq-botoes-gerar mt-12">
            <button class="btn btn-primary" :disabled="!totalEtiquetasSelecionadas" @click="gerarEtiquetasAvulsas">
              <i class="fas fa-file-word"></i> Gerar .docx
            </button>
            <button class="btn btn-secondary" :disabled="!totalEtiquetasSelecionadas" @click="gerarPNGParaImprimir">
              <i class="fas fa-print"></i> Imprimir direto (PNG)
            </button>
          </div>
          <p class="hint mt-4">
            <i class="fas fa-circle-info"></i>
            "Imprimir direto" gera um PNG em 300 DPI — abra no HP Smart como <strong>Foto</strong> e selecione <strong>Tamanho real / 100%</strong> para o alinhamento ficar perfeito.
          </p>

          <!-- ── Preview visual da folha ── -->
          <div class="etq-preview-wrap">
            <div class="etq-preview-hdr">
              <span class="etq-preview-titulo"><i class="fas fa-eye"></i> Preview — Pimaco A5Q-1226</span>
              <div v-if="totalFolhasEtiqueta > 1" class="etq-preview-nav">
                <button class="etq-nav-btn" :disabled="folhaPreviewAtual <= 1" @click="folhaPreviewAtual--">‹</button>
                <span>Folha {{ folhaPreviewAtual }} / {{ totalFolhasEtiqueta }}</span>
                <button class="etq-nav-btn" :disabled="folhaPreviewAtual >= totalFolhasEtiqueta" @click="folhaPreviewAtual++">›</button>
              </div>
            </div>

            <!-- Legenda -->
            <div class="etq-preview-legenda">
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-usada"></span>já usada</span>
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-vazio"></span>vazia</span>
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-selecionada"></span>será impressa</span>
              <span class="etq-leg-item"><span class="etq-leg-dot etq-dot-inicio"></span>início</span>
            </div>

            <!-- Folha -->
            <div class="etq-folha">
              <div
                v-for="cel in celulasPreview" :key="cel.pos"
                class="etq-celula"
                :class="`etq-cel-${cel.estado}`"
                :title="`Posição ${cel.pos}${cel.texto ? ': ' + cel.texto : ''}`"
              >
                <span v-if="cel.texto" class="etq-cel-txt">{{ cel.texto }}</span>
              </div>
            </div>
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
          <div class="section-label mb-16"><i class="fas fa-gears"></i> Sistema</div>

          <div class="form-grid">
            <div class="fg">
              <label class="label">Nº de Pessoas na Família</label>
              <div class="input-with-icon">
                <i class="fas fa-users"></i>
                <input v-model.number="company.pessoas_familia" type="number" class="input" min="1" />
              </div>
              <p class="hint">Usado para cálculo de renda per capita nos relatórios.</p>
            </div>
          </div>

          <div class="mt-20">
            <button class="btn btn-primary btn-full" @click="save">
              <i class="fas fa-save"></i> Salvar
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
import { ref, reactive, watch, computed } from 'vue'
import { useStore } from '../store.js'
import { maskCpf, maskCnpj, maskCnae, normalizar, textoEtiquetaReceita } from '../utils.js'
import { useConfirm as useAppConfirm } from '../composables/useConfirm.js'
import { useTabScroll } from '../composables/useTabScroll.js'
import { gerarArquivoEtiquetas } from '../composables/useEtiquetas.js'
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

// ── Etiquetas avulsas ──────────────────────────────────────
const etqQtds = reactive({}) // { textoSabor: quantidade }

// Apenas produtos finais (não bases/intermediárias), deduplicados pelo texto que vai na etiqueta
function ehComponenteInterno(r) {
  if ((company.etiquetas_excecoes_incluir || []).includes(r.uuid)) return false // exceção forçada pelo usuário
  if (r.eh_intermediaria) return true
  const nome = normalizar(r.nome || '')
  const termos = company.etiquetas_termos_excluidos || []
  return termos.some(termo => termo.trim() && nome.includes(normalizar(termo)))
}

const receitasParaEtiqueta = computed(() => {
  const vistos = new Map() // texto do sabor -> primeira receita encontrada com esse texto
  const ordenadas = [...s.receitas]
    .filter(r => !ehComponenteInterno(r))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))

  for (const r of ordenadas) {
    const texto = textoEtiquetaReceita(r)
    if (!texto || vistos.has(texto)) continue
    vistos.set(texto, r)
  }

  return [...vistos.entries()]
    .map(([texto, r]) => ({ ...r, _textoSabor: texto }))
    .sort((a, b) => a._textoSabor.localeCompare(b._textoSabor))
})

// Receitas excluídas da lista de etiquetas (para revisão/exceções)
const receitasExcluidasEtiqueta = computed(() => {
  const vistas = new Set(receitasParaEtiqueta.value.map(r => r.uuid))
  return [...s.receitas]
    .filter(r => !vistas.has(r.uuid) && !r.eh_intermediaria) // bases puras nem entram aqui, já é óbvio
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
})

const novoTermoExcluido = ref('')
const mostrarConfigFiltro = ref(false)

function adicionarTermoExcluido() {
  const termo = novoTermoExcluido.value.trim().toLowerCase()
  if (!termo) return
  if (!company.etiquetas_termos_excluidos) company.etiquetas_termos_excluidos = []
  if (!company.etiquetas_termos_excluidos.includes(termo)) {
    company.etiquetas_termos_excluidos.push(termo)
    s.saveCompany({ ...company })
  }
  novoTermoExcluido.value = ''
}

function removerTermoExcluido(termo) {
  company.etiquetas_termos_excluidos = (company.etiquetas_termos_excluidos || []).filter(t => t !== termo)
  s.saveCompany({ ...company })
}

function alternarExcecaoReceita(r) {
  const lista = company.etiquetas_excecoes_incluir || []
  company.etiquetas_excecoes_incluir = lista.includes(r.uuid)
    ? lista.filter(id => id !== r.uuid)
    : [...lista, r.uuid]
  s.saveCompany({ ...company })
}

const totalEtiquetasSelecionadas = computed(() =>
  Object.values(etqQtds).reduce((acc, q) => acc + (Number(q) || 0), 0)
)

const totalFolhasEtiqueta = computed(() => {
  const startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  return Math.max(1, Math.ceil((startPos + totalEtiquetasSelecionadas.value) / 77))
})

const folhaPreviewAtual = ref(1)

// Monta o array de 77 células para a folha atual do preview
const celulasPreview = computed(() => {
  const startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  const folha = folhaPreviewAtual.value - 1 // 0-based

  // Expandir etiquetas selecionadas em ordem
  const etiquetas = []
  for (const r of receitasParaEtiqueta.value) {
    const qtd = Number(etqQtds[r._textoSabor] || 0)
    for (let i = 0; i < qtd; i++) etiquetas.push(r._textoSabor)
  }

  const celulas = []
  for (let i = 0; i < 77; i++) {
    const posGlobal = folha * 77 + i // posição global nesta célula
    const idxEtiqueta = posGlobal - startPos // índice no array de etiquetas

    let estado = 'vazio' // vazio por padrão
    let texto = ''

    if (posGlobal < startPos) {
      estado = 'usada' // já foi usada em impressão anterior
    } else if (idxEtiqueta >= 0 && idxEtiqueta < etiquetas.length) {
      estado = 'selecionada'
      texto = etiquetas[idxEtiqueta]
    } else if (posGlobal === startPos && etiquetas.length > 0) {
      estado = 'inicio'
    }

    // Primeira célula do lote nesta folha
    if (i === startPos && folha === 0 && etiquetas.length === 0) {
      estado = 'inicio'
    }

    celulas.push({ estado, texto, pos: i + 1 })
  }
  return celulas
})

watch([() => company.posicao_etiqueta, totalEtiquetasSelecionadas], () => {
  folhaPreviewAtual.value = 1
})

// ── Geração de PNG para impressão direta no Android ─────────────
// Layout: Pimaco A5Q-1226, paisagem, 300 DPI
// Folha: 2480 x 1754 px | Etiqueta: 307 x 142 px | 7×11 = 77 células
const ETQ_PX = {
  W: 2480, H: 1754,
  lW: 307, lH: 142,
  mL: 94, mT: 102, mR: 39, mB: 80,
  gH: 33, gV: 1,
  cols: 7, rows: 11
}

async function gerarPNGParaImprimir() {
  const startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)

  // Montar array de etiquetas
  const etiquetas = []
  for (const r of receitasParaEtiqueta.value) {
    const qtd = Number(etqQtds[r._textoSabor] || 0)
    for (let i = 0; i < qtd; i++) etiquetas.push(r._textoSabor)
  }

  const totalFolhas = Math.max(1, Math.ceil((startPos + etiquetas.length) / 77))
  const contato = company.contato_etiqueta?.trim() || company.nome || ''

  // Cores
  const COR_FUNDO    = '#ffffff'
  const COR_ETQ      = '#fdf5e8'     // creme do sistema
  const COR_USADA    = '#ede0d0'
  const COR_VAZIA    = '#ffffff'
  const COR_SELECIONADA = '#3d1f07'  // marrom do sistema
  const COR_TEXTO    = '#ffffff'
  const COR_CONTATO  = '#c9a87a'
  const COR_BORDA    = '#d0b090'

  // Gerar os PNGs de cada folha
  const downloads = []
  for (let folha = 0; folha < totalFolhas; folha++) {
    const canvas = document.createElement('canvas')
    canvas.width  = ETQ_PX.W
    canvas.height = ETQ_PX.H
    const ctx = canvas.getContext('2d')

    // Fundo branco
    ctx.fillStyle = COR_FUNDO
    ctx.fillRect(0, 0, ETQ_PX.W, ETQ_PX.H)

    for (let row = 0; row < ETQ_PX.rows; row++) {
      for (let col = 0; col < ETQ_PX.cols; col++) {
        const pos = row * ETQ_PX.cols + col      // 0-76
        const posGlobal = folha * 77 + pos
        const idxEtq = posGlobal - startPos

        const x = ETQ_PX.mL + col * (ETQ_PX.lW + ETQ_PX.gH)
        const y = ETQ_PX.mT + row * (ETQ_PX.lH + ETQ_PX.gV)

        const temConteudo = idxEtq >= 0 && idxEtq < etiquetas.length
        const jaUsada = posGlobal < startPos

        // Fundo da célula
        ctx.fillStyle = jaUsada ? COR_USADA : (temConteudo ? COR_SELECIONADA : COR_VAZIA)
        ctx.fillRect(x, y, ETQ_PX.lW, ETQ_PX.lH)

        // Borda sutil
        if (!temConteudo) {
          ctx.strokeStyle = COR_BORDA
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y + 0.5, ETQ_PX.lW - 1, ETQ_PX.lH - 1)
        }

        // Texto do sabor
        if (temConteudo) {
          const sabor = etiquetas[idxEtq]

          // Sabor (linha principal)
          ctx.fillStyle = COR_TEXTO
          ctx.font = `bold ${Math.round(ETQ_PX.lH * 0.38)}px "Liberation Sans", Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const saborY = contato ? y + ETQ_PX.lH * 0.38 : y + ETQ_PX.lH * 0.5
          ctx.fillText(sabor, x + ETQ_PX.lW / 2, saborY, ETQ_PX.lW - 8)

          // Contato (linha secundária)
          if (contato) {
            ctx.fillStyle = COR_CONTATO
            ctx.font = `${Math.round(ETQ_PX.lH * 0.25)}px "Liberation Sans", Arial, sans-serif`
            ctx.fillText(contato, x + ETQ_PX.lW / 2, y + ETQ_PX.lH * 0.72, ETQ_PX.lW - 8)
          }
        }
      }
    }

    // Converter para PNG e baixar
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = totalFolhas > 1
      ? `etiquetas-folha-${folha + 1}-de-${totalFolhas}.png`
      : 'etiquetas.png'
    downloads.push({ a, dataUrl })
  }

  // Baixar todos os arquivos (um por folha)
  for (const { a } of downloads) {
    a.click()
    await new Promise(r => setTimeout(r, 300))
  }

  // Atualizar posição na folha
  const novaPosicao = ((startPos + etiquetas.length) % 77) + 1
  company.posicao_etiqueta = novaPosicao
  s.saveCompany({ ...company })

  s.notify(`PNG gerado! Abra no HP Smart e imprima como foto em tamanho real.`)
}

async function gerarEtiquetasAvulsas() {
  const etiquetas = []
  for (const r of receitasParaEtiqueta.value) {
    const qtd = Number(etqQtds[r._textoSabor] || 0)
    if (qtd <= 0) continue
    for (let i = 0; i < qtd; i++) etiquetas.push(r._textoSabor)
  }
  if (!etiquetas.length) return

  let startPos = Math.max(0, (Number(company.posicao_etiqueta || 1) || 1) - 1)
  if (startPos > 0) {
    const continuar = await confirmar.ask(
      `A próxima etiqueta livre é a ${startPos + 1}. Toque em "Continuar" para reaproveitar a folha atual ou em "Nova folha" para recomeçar da primeira etiqueta.`,
      {
        title: 'Como deseja imprimir?',
        icon: 'fas fa-tags',
        type: 'primary',
        confirmLabel: 'Continuar',
        cancelLabel: 'Nova folha'
      }
    )
    startPos = continuar ? startPos : 0
  }

  s.loading = true
  const contato = company.contato_etiqueta?.trim() || company.nome || ''
  const resultado = await gerarArquivoEtiquetas(etiquetas, contato, startPos, 'etiquetas-avulsas')
  s.loading = false

  if (resultado.ok) {
    company.posicao_etiqueta = resultado.novaPosicao
    s.saveCompany({ ...company })
    s.notify(`Etiqueta gerada! ${resultado.totalFolhas} folha${resultado.totalFolhas > 1 ? 's' : ''}. Próxima posição: ${resultado.novaPosicao}.`)
    // Limpa seleção após gerar
    Object.keys(etqQtds).forEach(k => delete etqQtds[k])
  } else {
    s.notify(resultado.erro, 'error')
  }
}

// 🔄 Sincroniza o formulário local quando os dados são carregados do banco (Store Init)
// Isso evita que a tela mostre dados padrão caso o banco demore a responder
watch(() => s.company, (novoValor) => {
  if (novoValor) {
    // Copia os dados da store para o estado local do formulário
    Object.assign(company, JSON.parse(JSON.stringify(novoValor)))
  }
}, { deep: true, immediate: true })

const abaAtiva = ref('perfil')
const { stripEl: abaStripEl, setTabRef: setAbaRef } = useTabScroll(abaAtiva)
const menus = [
  { id: 'perfil',     label: 'Identidade',       icon: 'fas fa-id-card' },
  { id: 'financeiro', label: 'Financeiro',        icon: 'fas fa-university' },
  { id: 'etiquetas',  label: 'Etiquetas',         icon: 'fas fa-tags' },
  { id: 'caderneta',  label: 'Caderneta',         icon: 'fas fa-book' },
  { id: 'backup',     label: 'Backup',            icon: 'fas fa-cloud-arrow-up' },
  { id: 'sistema',    label: 'Sistema',           icon: 'fas fa-gears' }
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
.etq-receitas-list { display: flex; flex-direction: column; gap: 6px; max-height: 50vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.etq-receita-item {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--r-md);
  background: var(--surface); transition: border-color var(--t), background var(--t);
}
.etq-receita-item.ativa { border-color: var(--brown); background: var(--gold-bg); }
.etq-receita-nome { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; border: none; background: transparent; text-align: left; padding: 0; font-size: .85rem; font-weight: 500; color: var(--text); }
.etq-receita-nome i { color: var(--muted); font-size: 1rem; flex-shrink: 0; }
.etq-receita-item.ativa .etq-receita-nome i { color: var(--brown); }
.etq-receita-nome span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.etq-qtd-ctrl { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.etq-botoes-gerar { display: flex; gap: 8px; }
.etq-botoes-gerar .btn { flex: 1; }
.etq-resumo {
  margin-top: 12px; padding: 10px 12px; border-radius: var(--r-md);
  background: var(--cream); border: 1px solid var(--border);
  font-size: .8rem; color: var(--brown-dark); font-weight: 600;
  display: flex; align-items: center; gap: 8px;
}
.etq-resumo i { color: var(--gold-dark); }

/* ── Preview da folha de etiquetas ─────────────────────── */
.etq-preview-wrap {
  margin-top: 16px;
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.etq-preview-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.etq-preview-titulo { font-size: .75rem; font-weight: 700; color: var(--brown-dark); display: flex; align-items: center; gap: 6px; }
.etq-preview-nav { display: flex; align-items: center; gap: 6px; font-size: .72rem; color: var(--muted); }
.etq-nav-btn { border: none; background: transparent; color: var(--brown-mid); font-size: 1rem; padding: 2px 6px; cursor: pointer; }
.etq-nav-btn:disabled { opacity: .3; cursor: default; }

.etq-preview-legenda {
  display: flex; gap: 10px; flex-wrap: wrap;
  padding: 6px 12px; background: var(--cream);
  border-bottom: 1px solid var(--border);
}
.etq-leg-item { display: flex; align-items: center; gap: 4px; font-size: .65rem; color: var(--muted); }
.etq-leg-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.etq-dot-usada { background: #c8b8a8; border: 1px solid #b0a090; }
.etq-dot-vazio { background: var(--surface); border: 1px solid var(--border); }
.etq-dot-selecionada { background: var(--brown-dark); }
.etq-dot-inicio { background: var(--gold); border: 1px solid var(--gold-dark); }

/* Folha: proporção A5 = 148,5 × 210mm → escalada para caber na tela */
/* 7 cols × 11 rows, com margens de ~0.8mm cada lado */
.etq-folha {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1.5px;
  padding: 4px;
  background: var(--cream);
  aspect-ratio: 148.5 / 210; /* proporção real do A5 */
}
.etq-celula {
  border-radius: 2px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  transition: background .15s;
  min-height: 0;
}
.etq-cel-vazio {
  background: var(--surface);
  border: .5px solid var(--border);
}
.etq-cel-usada {
  background: #ddd5ca;
  border: .5px solid #c0b0a0;
}
.etq-cel-selecionada {
  background: var(--brown-dark);
  border: .5px solid var(--brown-dark);
}
.etq-cel-inicio {
  background: var(--gold);
  border: 1.5px solid var(--gold-dark);
}
.etq-cel-txt {
  font-size: 5px;
  color: #fff;
  text-align: center;
  line-height: 1.1;
  padding: 1px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

/* ── Configuração do filtro de etiquetas ── */
.etq-config-toggle {
  display: flex; align-items: center; gap: 8px; width: 100%;
  margin-top: 12px; padding: 10px 12px;
  border: 1px solid var(--border); border-radius: var(--r-md);
  background: var(--surface); color: var(--brown-dark);
  font-size: .8rem; font-weight: 600;
}
.etq-config-toggle i:first-child { color: var(--brown-mid); }
.etq-config-toggle span { flex: 1; text-align: left; }
.etq-config-toggle i:last-child { color: var(--muted); font-size: .7rem; }

.etq-config-painel {
  margin-top: 10px; padding: 12px; border: 1px solid var(--border);
  border-radius: var(--r-md); background: var(--cream);
}
.etq-termos-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.etq-termo-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 6px 5px 10px; border-radius: var(--r-full);
  background: var(--surface); border: 1px solid var(--border);
  font-size: .76rem; font-weight: 600; color: var(--text);
}
.etq-termo-chip button { color: var(--muted); font-size: .68rem; padding: 2px; }
.etq-termo-chip button:active { color: #a32d2d; }
.etq-termo-add { display: flex; gap: 6px; }
.etq-termo-add .input { flex: 1; }
.etq-receita-oculta { opacity: .85; }
.etq-receita-oculta .etq-receita-nome i { color: var(--muted); }

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
