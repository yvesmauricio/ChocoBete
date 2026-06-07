<template>
  <div>
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-book-open"></i> Receitas</h2>
        <div class="tab-actions">
          <button class="btn-icon" @click="s.setTab('insumos')" title="Ver Estoque"><i class="fas fa-boxes"></i></button>
          <button class="btn-icon" @click="gerarRelatorio" title="Gerar Relatório de Receitas"><i class="fas fa-file-pdf"></i></button>
          <button class="btn btn-primary btn-sm" @click="abrir(null)"><i class="fas fa-plus"></i> Nova</button>
        </div>
      </div>
      <div class="search-wrap">
        <i class="fas fa-search search-icon"></i>
        <input v-model="busca" class="search-input" type="search" placeholder="Buscar receita…" />
      </div>
      <CategoryFilter v-model="categoriaAtiva" :items="categoriasFiltro" />
    </div>

    <section class="tab-content">
      <div v-if="s.loading" class="loading-box"><div class="spinner spinner-sm"></div></div>

      <template v-else-if="listaFiltrada.length">
        <AppListRow
          v-for="r in listaFiltrada"
          :key="r.uuid"
          :id="r.uuid"
          @click="abrir(r)"
          :actions-width="280"
        >
          <template #icon>
            <div class="recipe-icon" :class="r.eh_intermediaria ? 'badge-blue' : 'badge-gold'">
              <i :class="r.eh_intermediaria ? 'fas fa-blender' : 'fas fa-cookie-bite'"></i>
            </div>
          </template>
          <template #title>{{ r.nome }}</template>
          <template #sub>
            <span class="recipe-price">Venda: {{ R$(r.preco_sugerido || 0) }}</span>
            <span class="ing-dot">•</span>
            <span class="recipe-profit" :class="{ 
              negative: s.getLucroInfo(r).valor < 0,
              'profit-low': s.getLucroInfo(r).percentual < 40 && s.getLucroInfo(r).valor >= 0,
              'profit-high': s.getLucroInfo(r).percentual > 65 }">
              Lucro: {{ R$(s.getLucroInfo(r).valor) }} ({{ s.getLucroInfo(r).percentual.toFixed(0) }}%)
            </span>
          </template>

          <!-- Ações de swipe -->
          <template #actions>
            <button class="swipe-btn edit" @click="abrir(r)">
              <i class="fas fa-pencil"></i>
              <span>Editar</span>
            </button>
            <button class="swipe-btn copy" @click="duplicarReceita(r)">
              <i class="fas fa-copy"></i>
              <span>Copiar</span>
            </button>
            <button class="swipe-btn share" @click="compartilharReceita(r)">
              <i class="fas fa-share-nodes"></i>
              <span>Enviar</span>
            </button>
            <button class="swipe-btn del" @click="excluirDireto(r)">
              <i class="fas fa-trash"></i>
              <span>Excluir</span>
            </button>
          </template>
        </AppListRow>
      </template>

      <div v-else class="empty">
        <i class="fas fa-book-open"></i>
        <h3>{{ busca ? 'Nenhum resultado' : 'Nenhuma receita ainda' }}</h3>
        <button v-if="!busca" class="btn btn-primary mt-12" @click="abrir(null)">
          <i class="fas fa-plus"></i> Nova Receita
        </button>
      </div>
    </section>

    <!-- ─── Modal Receita ──────────────────────────────────────── -->
    <BaseModal v-if="modal === 'receita'" :title="form.uuid ? 'Editar Receita' : 'Nova Receita'" @close="fecharModal">

      <!-- ── Seção: Identidade ── -->
      <div class="form-section">
        <div class="form-section-label sec-toggle" :class="{ closed: !secoesAbertas.has('identidade') }" @click="toggleSec('identidade')">
          <span><i class="fas fa-tag"></i> Identidade</span>
          <span class="sec-summary" v-if="!secoesAbertas.has('identidade') && form.nome">{{ form.nome }}</span>
          <i class="fas fa-chevron-down sec-chevron" :class="{ open: secoesAbertas.has('identidade') }"></i>
        </div>
        <div v-show="secoesAbertas.has('identidade')" class="sec-body">
          <div class="fg">
            <label class="label label-req">Nome da receita</label>
            <input v-model="form.nome" class="input" placeholder="Ex: Trufa Tradicional" autocomplete="off" />
          </div>

          <div class="fg">
            <label class="label">Texto da etiqueta <span class="label-opt">(opcional)</span></label>
            <input v-model="form.nome_etiqueta" class="input" placeholder="Ex: Tradicional" autocomplete="off" />
            <div class="hint">Se vazio, a etiqueta usa o nome da receita sem a categoria.</div>
          </div>

          <!-- Tipo: toggle visual -->
          <div class="fg">
            <label class="label">Tipo</label>
            <div class="option-grid option-grid-2">
              <button type="button" class="option-card" :class="{ active: Number(form.eh_intermediaria) === 0 }" @click="form.eh_intermediaria = 0">
                <i class="fas fa-cookie-bite option-ico"></i>
                <span class="option-label">Produto Final</span>
              </button>
              <button type="button" class="option-card" :class="{ active: Number(form.eh_intermediaria) === 1 }" @click="form.eh_intermediaria = 1">
                <i class="fas fa-blender option-ico"></i>
                <span class="option-label">Base / Recheio</span>
              </button>
            </div>
          </div>

          <!-- Categoria: chips horizontais -->
          <div class="fg">
            <label class="label">Categoria <span class="label-opt">(opcional)</span></label>
            <div class="chips chips-padded" style="margin: 0 -14px;">
              <button
                v-for="c in categoriasFiltro.filter(x => x !== 'Todas')"
                :key="c"
                type="button"
                class="chip"
                :class="{ active: form.categoria === c }"
                @click="form.categoria = form.categoria === c ? '' : c"
              >{{ c }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Seção: Rendimento ── -->
      <div class="form-section">
        <div class="form-section-label sec-toggle" :class="{ closed: !secoesAbertas.has('rendimento') }" @click="toggleSec('rendimento')">
          <span><i class="fas fa-layer-group"></i> Rendimento &amp; Preço</span>
          <span class="sec-summary" v-if="!secoesAbertas.has('rendimento') && form.rendimento">{{ form.rendimento }} {{ form.unidade_rendimento }}{{ form.preco_sugerido ? ' · R$ ' + maskMoney(form.preco_sugerido) : '' }}</span>
          <i class="fas fa-chevron-down sec-chevron" :class="{ open: secoesAbertas.has('rendimento') }"></i>
        </div>
        <div v-show="secoesAbertas.has('rendimento')" class="sec-body">
        <div class="render-row-slim">
          <div class="fg">
            <label class="label">Rendimento</label>
            <input v-model.number="form.rendimento" class="input" type="number" min="0" step="0.01" placeholder="10" inputmode="decimal" />
          </div>
          <div class="fg">
            <label class="label">Unidade</label>
            <div class="unit-pill-grid unit-pill-grid-5">
              <button v-for="u in ['un','g','kg','pct','cx']" 
                :key="u" type="button" class="unit-pill"
                :class="{ active: form.unidade_rendimento === u }"
                @click="form.unidade_rendimento = u">{{ u }}</button>
            </div>
          </div>
        </div>

        <div class="fg">
          <label class="label">Peso de 1 unidade <span class="label-opt">(opcional, em gramas)</span></label>
          <input v-model.number="form.peso_unitario" class="input" type="number" inputmode="decimal" placeholder="Ex: 30" />
        </div>

        <div class="fg">
          <label class="label">Tempo de Preparo Total (minutos)</label>
          <input v-model.number="form.tempo_preparo_min" class="input" type="number" inputmode="numeric" placeholder="Soma: Ativo + Passivo + Limpeza" />
          <div class="hint">Ex: 150 para 2h30. O custo da mão de obra será calculado sobre este tempo.</div>
        </div>
        <div v-if="mediaTempoRealProducao > 0 && Math.round(mediaTempoRealProducao) !== form.tempo_preparo_min" class="fg">
          <label class="label">Sugestão de Calibração</label>
          <button type="button" class="btn btn-secondary btn-sm" @click="form.tempo_preparo_min = Math.round(mediaTempoRealProducao)">
            <i class="fas fa-wand-magic-sparkles"></i> 
            Atualizar para {{ Math.round(mediaTempoRealProducao) }} min (Média Real)
          </button>
          <div class="hint">Baseado na média do tempo real das produções anteriores desta receita.</div>
        </div>

        <div class="fg" v-if="s.getCustoTotal(form) > 0">
          <label class="label">Sugerir preço por Markup (Inteligência de Lucro)</label>
          <div class="markup-grid">
            <button type="button" class="markup-btn" @click="form.preco_sugerido = arredondarPrecoSugerido((s.getCustoTotal(form) / (form.rendimento || 1)) * 2)">
              <span>2.0x</span><small>50% margem</small>
            </button>
            <button type="button" class="markup-btn" @click="form.preco_sugerido = arredondarPrecoSugerido((s.getCustoTotal(form) / (form.rendimento || 1)) * 3)">
              <span>3.0x</span><small>67% margem</small>
            </button>
            <button type="button" class="markup-btn highlight" @click="form.preco_sugerido = arredondarPrecoSugerido((s.getCustoTotal(form) / (form.rendimento || 1)) * 4)">
              <span>4.0x</span><small>75% margem</small>
            </button>
          </div>
        </div>

        <div class="fg">
          <label class="label">Preço de venda sugerido</label>
          <div class="input-with-prefix">
            <span class="input-prefix">R$</span>
            <input
              :value="maskMoney(form.preco_sugerido)"
              @input="e => form.preco_sugerido = parseMoney(e.target.value)"
              class="input input-prefixed" type="text" inputmode="numeric" placeholder="0,00"
            />
          </div>
        </div>

        <!-- Painel de lucratividade -->
        <div v-if="s.getCustoTotal(form) > 0" class="profit-panel">
          <div class="profit-row">
            <span class="profit-label">Custo Ingredientes (Total)</span>
            <span class="profit-val cost">{{ R$(s.getCustoTotal(form)) }}</span>
          </div>
          <div class="profit-row">
            <span class="profit-label">Ingredientes / {{ form.unidade_rendimento }}</span>
            <span class="profit-val cost">{{ R$(s.getCustoTotal(form) / (form.rendimento || 1)) }}</span>
          </div>
          <div class="profit-row" v-if="custoMaoDeObraTotal > 0">
            <span class="profit-label">Mão de obra ({{ form.tempo_preparo_min }} min)</span>
            <span class="profit-val">{{ R$(custoMaoDeObraTotal) }}</span>
          </div>
          <div v-if="totalIngredientesG > 0" class="profit-row">
            <span class="profit-label">Total ingredientes</span>
            <span class="profit-val">{{ totalIngredientesG.toFixed(0) }} g</span>
          </div>
          <div v-if="form.preco_sugerido" class="profit-divider"></div>
          <div class="profit-row" v-if="custoMaoDeObraTotal > 0">
            <span class="profit-label">Custo Total (Ingr. + M.O)</span>
            <span class="profit-val" style="color: var(--text)">{{ R$(s.getCustoTotal(form) + custoMaoDeObraTotal) }}</span>
          </div>
          <div v-if="form.preco_sugerido" class="profit-row profit-row-total">
            <span class="profit-label">Lucro (sobre ingredientes)</span>
            <span class="profit-val" :class="s.getLucroInfo(form).valor >= 0 ? 'gain' : 'loss'">
              {{ R$(s.getLucroInfo(form).valor) }}
            </span>
          </div>
        </div>
        </div><!-- /sec-body rendimento -->
      </div>

      <!-- ── Seção: Ingredientes ── -->
      <div class="form-section" id="section-ingredientes">
        <div class="form-section-label sec-toggle" :class="{ closed: !secoesAbertas.has('ingredientes') }" @click="toggleSec('ingredientes')">
          <span><i class="fas fa-list-ul"></i> Ingredientes</span>
          <span class="sec-summary" v-if="!secoesAbertas.has('ingredientes')">{{ form.ingredientes.length ? form.ingredientes.length + ' item(s)' : 'Nenhum' }}</span>
          <i class="fas fa-chevron-down sec-chevron" :class="{ open: secoesAbertas.has('ingredientes') }"></i>
        </div>
        <div v-show="secoesAbertas.has('ingredientes')" class="sec-body">

          <div v-if="!form.ingredientes.length" class="ing-empty-state">
            <i class="fas fa-plus-circle"></i>
            <span>Toque em <strong>+ Adicionar</strong> para incluir ingredientes ou bases de outras receitas</span>
          </div>

          <div v-for="(ing, i) in form.ingredientes" :key="ing._key" class="ing-row-slim">
            <div
              class="ing-row-content"
              :class="{
                'is-recipe': ing.tipo === 'receita',
                'is-invalid': ingredienteIncompleto(ing),
                'is-duplicate': ingredienteDuplicado(ing, i)
              }"
            >
              <!-- Nome -->
              <button class="ing-btn-name" @click="handleNomeClick(ing, i)">
                <span class="ing-ico-sm">{{ ing.tipo === 'receita' ? '🥣' : '📦' }}</span>
                <span class="ing-name-txt">{{ getNomeIng(ing) || 'Selecionar…' }}</span>
              </button>

              <!-- Stepper de quantidade -->
              <div class="ing-qty-stepper">
                <button type="button" class="ing-qty-btn" @click.stop="stepQty(ing, -1)">−</button>
                <input
                  :id="'ing-qty-' + i"
                  v-model.number="ing.quantidade"
                  type="number"
                  inputmode="decimal"
                  class="ing-input-slim"
                  placeholder="0"
                  @focus="$event.target.select()" />
                <span class="ing-unit-slim">{{ getUnidade(ing) }}</span>
                <button type="button" class="ing-qty-btn" @click.stop="stepQty(ing, +1)">+</button>
              </div>

              <!-- Ações -->
              <div class="ing-actions-slim">
                <button type="button" class="btn-action-slim" :class="{ active: ing.gera_peso !== false }"
                  @click="ing.gera_peso = ing.gera_peso === false ? true : false">
                  <i class="fas fa-balance-scale"></i>
                </button>
                <button type="button" class="btn-action-slim btn-del-slim" @click="removerIngrediente(i)">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div class="ing-row-meta">
              <span v-if="ingredienteIncompleto(ing)" class="ing-meta-chip warn">Selecione o item e informe a quantidade</span>
              <span v-else-if="ingredienteDuplicado(ing, i)" class="ing-meta-chip warn">Ingrediente repetido na receita</span>
              <span v-if="ing.id && Number(ing.quantidade || 0) > 0" class="ing-meta-chip cost">Custo: {{ R$(getCustoComposicao(ing)) }}</span>
            </div>
          </div>

          <button class="btn-add-ing" @click="addNovoItem">
            <i class="fas fa-plus"></i> Adicionar ingrediente
          </button>
          <button v-if="form.ingredientes.length" class="btn-ing-detail" @click="abrirModal('ingredientes-detalhes')">
            <i class="fas fa-table"></i> Ver custo detalhado
          </button>
        </div><!-- /sec-body ingredientes -->
      </div>

      <!-- ── Seção: Preparo ── -->
      <div class="form-section">
        <div class="form-section-label sec-toggle" :class="{ closed: !secoesAbertas.has('preparo') }" @click="toggleSec('preparo')">
          <span><i class="fas fa-utensils"></i> Modo de preparo <span class="label-opt">(opcional)</span></span>
          <span class="sec-summary" v-if="!secoesAbertas.has('preparo') && form.modo_preparo">Preenchido</span>
          <i class="fas fa-chevron-down sec-chevron" :class="{ open: secoesAbertas.has('preparo') }"></i>
        </div>
        <div v-show="secoesAbertas.has('preparo')" class="sec-body">
          <div class="fg">
            <textarea v-model="form.modo_preparo" class="input textarea-preparo" rows="4" placeholder="Descreva o passo a passo da receita…"></textarea>
          </div>
        </div>
      </div>

      <template #foot>
        <button v-if="form.uuid" class="btn btn-danger btn-icon-only" @click="excluir" title="Excluir receita">
          <i class="fas fa-trash"></i>
        </button>
        <button v-if="form.uuid" class="btn btn-secondary btn-icon-only" @click="compartilharReceita(form)" title="Compartilhar">
          <i class="fas fa-share-nodes"></i>
        </button>
        <div class="spacer"></div>
        <button class="btn btn-secondary" @click="fecharModal">Cancelar</button>
        <button class="btn btn-primary" :disabled="!form.nome || saving" @click="salvar">
          <i v-if="saving" class="fas fa-spinner fa-spin"></i>
          <span v-else>{{ form.uuid ? 'Salvar' : 'Criar' }}</span>
        </button>
      </template>
    </BaseModal>

   <!-- ─── Modal Histórico de Preços ──────────────────────────── -->
   <Teleport to="body">
    <div v-if="modalHistorico" class="bottom-sheet-overlay" @click.self="modalHistorico = null">
      <div class="lc-modal">
        <div class="lc-modal-hdr">
          <span class="lc-modal-titulo"><i class="fas fa-chart-line"></i> {{ modalHistorico.nome }}</span>
          <button class="lc-modal-close" @click="modalHistorico = null"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="lc-modal-body">
          <div v-if="loadingHistorico" class="loading-box"><div class="spinner spinner-sm"></div></div>
          <template v-else-if="historicoPrecos.length === 0">
            <div class="lc-hist-empty">
              <i class="fas fa-clock-rotate-left"></i>
              <p>Nenhum registro ainda.<br>O histórico é criado quando você altera o preço.</p>
            </div>
          </template>
          <template v-else>
            <div class="lc-hist-resumo">
              <div class="lc-hist-kpi">
                <span class="lc-hist-kpi-lbl">Atual</span>
                <span class="lc-hist-kpi-val">{{ R$(historicoPrecos[historicoPrecos.length-1].custo_por_unidade) }}</span>
              </div>
              <div class="lc-hist-kpi" v-if="historicoPrecos.length > 1">
                <span class="lc-hist-kpi-lbl">Variação</span>
                <span class="lc-hist-kpi-val" :class="variacaoPreco >= 0 ? 'c-red' : 'c-green'">
                  {{ variacaoPreco >= 0 ? '+' : '' }}{{ variacaoPreco.toFixed(1) }}%
                </span>
              </div>
            </div>
            <div class="lc-hist-chart-wrap">
              <svg class="lc-hist-svg" viewBox="0 0 300 90" preserveAspectRatio="none">
                <template v-for="(h, idx) in historicoPrecos" :key="idx">
                  <rect
                    :x="idx * (300 / historicoPrecos.length) + 3"
                    :y="90 - (h.custo_por_unidade / maxPrecoHist * 75)"
                    :width="(300 / historicoPrecos.length) - 6"
                    :height="(h.custo_por_unidade / maxPrecoHist * 75)"
                    rx="3" fill="var(--brown)" opacity="0.8"
                  />
                </template>
              </svg>
            </div>
            <div class="lc-hist-tabela">
              <div v-for="(h, idx) in [...historicoPrecos].reverse()" :key="idx" class="lc-hist-row">
                <span class="lc-hist-data">{{ new Date(h.data).toLocaleDateString('pt-BR') }}</span>
                <span class="lc-hist-preco">{{ R$(h.custo_por_unidade) }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- ─── Modal Picker de Ingredientes ──────────────────────── -->
    <!-- showPicker é independente do modal stack para não desmontar o modal de receita -->
    <BaseModal v-if="showPicker" title="Adicionar Ingrediente" @close="fecharPicker">
      <div class="modal-inner">
      <div class="search-wrap mt-8">
        <i class="fas fa-search search-icon"></i>
        <input v-model="pickerSearch" class="search-input" type="search" placeholder="Buscar ou digitar para criar…" autofocus />
      </div>
      <div class="chips mt-10">
        <button v-for="t in pickerTabs" :key="t.v" class="chip" :class="{ active: pickerTab === t.v }" @click="pickerTab = t.v">{{ t.l }}</button>
      </div>
      <div class="picker-list mt-10">
        <div v-if="podeCriarNovo" class="picker-row picker-criar" @click="criarNovoInsumo">
          <span class="picker-criar-icon"><i class="fas fa-plus"></i></span>
          <div class="picker-row-info">
            <div class="picker-row-nome">Criar "{{ pickerSearch.trim() }}" como ingrediente</div>
            <div class="picker-row-sub">Será cadastrado em gramas automaticamente</div>
          </div>
        </div>
        <template v-if="pickerTab !== 'insumos' && pickerBases.length">
          <div class="picker-grupo-label">🥣 Bases/Recheios (de outra receita)</div>
          <div v-for="item in pickerBases" :key="item.key" class="picker-row picker-row-base" @click="selecionarItem(item)">
            <span class="picker-tipo-badge">🥣</span>
            <div class="picker-row-info">
              <div class="picker-row-nome">{{ item.nome }}</div>
              <div class="picker-row-sub">Rende {{ item.rendimento }} {{ item.unidade }} • Base/Recheio</div>
            </div>
            <i class="fas fa-plus c-gold"></i>
          </div>
        </template>
        <template v-if="pickerTab !== 'bases' && pickerInsumos.length">
          <div class="picker-grupo-label">📦 Ingredientes</div>
          <div v-for="item in pickerInsumos" :key="item.key" class="picker-row" @click="selecionarItem(item)">
            <span class="picker-tipo-badge">📦</span>
            <div class="picker-row-info">
              <div class="picker-row-nome">{{ item.nome }}</div>
              <div class="picker-row-sub">{{ item.unidade }} • Ingrediente</div>
            </div>
            <i class="fas fa-plus c-gold"></i>
          </div>
        </template>
        <div v-if="!pickerBases.length && !pickerInsumos.length && !podeCriarNovo" class="picker-vazio">
          Nenhum item encontrado
        </div>
      </div>
      </div>
    </BaseModal>

    <BaseModal v-if="modal === 'ingredientes-detalhes'" title="Detalhes dos Ingredientes" @close="fecharModal">
      <div class="modal-inner">
      <div v-if="detalhesIngredientes.length" class="details-list">
        <div v-for="item in detalhesIngredientes" :key="item.key" class="details-row">
          <div class="details-main">
            <div class="details-name">{{ item.nome }}</div>
            <div class="details-sub">{{ item.quantidade }}</div>
          </div>
          <div class="details-value">{{ item.custo }}</div>
        </div>
        
        <!-- Mão de Obra no detalhamento -->
        <div v-if="custoMaoDeObraTotal > 0" class="details-row" style="border-color: var(--blue-bg); background: var(--blue-bg)">
          <div class="details-main">
            <div class="details-name">Mão de Obra (Tempo de Preparo)</div>
            <div class="details-sub">{{ form.tempo_preparo_min }} minutos</div>
          </div>
          <div class="details-value">{{ R$(custoMaoDeObraTotal) }}</div>
        </div>
      </div>
      <div v-else class="picker-vazio">Nenhum ingrediente adicionado</div>

      <div v-if="detalhesIngredientes.length" class="details-total">
        <span>Total Ingredientes</span>
        <strong>{{ R$(s.getCustoTotal(form)) }}</strong>
      </div>
      <div v-if="custoMaoDeObraTotal > 0" class="details-total" style="margin-top: 6px; background: var(--surface)">
        <span>Custo Final (com M.O)</span>
        <strong>{{ R$(s.getCustoTotal(form) + custoMaoDeObraTotal) }}</strong>
      </div>

      </div>
      <template #foot>
        <div class="spacer"></div>
        <button class="btn btn-secondary" @click="fecharModal">Fechar</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useStore } from '../store.js';
import { R$, normalizar, getNowLocal, maskMoney, parseMoney, isInsumoSemPeso } from '../utils.js';
import BaseModal from '../components/BaseModal.vue'
import AppListRow from '../components/AppListRow.vue'
import CategoryFilter from '../components/CategoryFilter.vue'
import { useModalStack } from '../composables/useModalStack.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useDeleteConfirm } from '../composables/useDeleteConfirm.js'
import { useListFilter } from '../composables/useListFilter.js'
import { gerarRelatorioReceitas } from '../composables/useGerarDocumento.js'

const s = useStore()
const { modal, abrirModal, fecharModal } = useModalStack()
const confirm = useConfirm()
const { confirmarExclusao } = useDeleteConfirm()

const saving = ref(false)

// ── Histórico de Preços ──
const modalHistorico = ref(null)
const historicoPrecos = ref([])
const loadingHistorico = ref(false)
const maxPrecoHist = computed(() => Math.max(...historicoPrecos.value.map(h => h.custo_por_unidade), 0.01))
const variacaoPreco = computed(() => {
  if (historicoPrecos.value.length < 2) return 0
  const p = historicoPrecos.value[0].custo_por_unidade
  const u = historicoPrecos.value[historicoPrecos.value.length - 1].custo_por_unidade
  return ((u - p) / p) * 100
})

async function abrirHistorico(item) {
  modalHistorico.value = item
  loadingHistorico.value = true
  try {
    historicoPrecos.value = await s.historicoPrecoProduto(item.uuid)
  } finally {
    loadingHistorico.value = false
  }
}

// ── Seções colapsáveis ──────────────────────────────────────────
// Começa com identidade + ingredientes abertos (fluxo mais comum)
const secoesAbertas = reactive(new Set(['identidade', 'ingredientes', 'rendimento', 'preparo']))

function toggleSec(nome) {
  if (secoesAbertas.has(nome)) secoesAbertas.delete(nome)
  else secoesAbertas.add(nome)
}

// Passo do stepper por unidade
function stepQty(ing, dir) {
  const u = getUnidade(ing)
  const step = (u === 'g' || u === 'ml') ? 5 : (u === 'kg' || u === 'L') ? 0.1 : 1
  const atual = Number(ing.quantidade || 0)
  ing.quantidade = Math.max(0, Math.round((atual + dir * step) * 1000) / 1000)
}

// ── Teclado Android: scroll automático do campo focado ─────────
function handleViewportResize() {
  const vv = window.visualViewport
  if (!vv) return
  const keyboardH = window.innerHeight - vv.height - vv.offsetTop
  // Adiciona padding no modal para o conteúdo não ficar atrás do teclado
  const body = document.querySelector('.modal-body')
  if (body) {
    body.style.paddingBottom = keyboardH > 80 ? `${keyboardH + 12}px` : ''
    if (keyboardH > 80) {
      const el = document.activeElement
      if (el && el !== document.body) {
        setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80)
      }
    }
  }
}
onMounted(() => window.visualViewport?.addEventListener('resize', handleViewportResize))
onUnmounted(() => window.visualViewport?.removeEventListener('resize', handleViewportResize))

const pickerSearch = ref('')
const pickerTab    = ref('todos')
const pickerIndex  = ref(null)
const showPicker   = ref(false)
const pickerTabs   = [{ v:'todos', l:'Tudo' }, { v:'insumos', l:'📦 Ingredientes' }, { v:'bases', l:'🥣 Bases' }]
const categoriasFiltro = ['Todas', 'Trufa', 'Cone', 'Barra', 'Brownie', 'Bolo', 'Ovo', 'Base']

// Mapeamos as categorias para a propriedade 'tipo' que o composable espera
const categoryMap = categoriasFiltro.reduce((acc, cat) => {
  if (cat !== 'Todas') acc[cat] = cat
  return acc
}, {})

const { busca, categoriaAtiva, listaFiltrada } = useListFilter(
  computed(() => s.receitas.map(r => ({ ...r, tipo: r.eh_intermediaria ? 'Base' : r.categoria }))),
  categoryMap,
  'Trufa'
)

const mediaTempoRealProducao = computed(() => {
  return form.uuid ? s.getMediaTempoReceita(form.uuid) : 0
})

const getEmptyForm = () => ({
  uuid: null,
  nome: '',
  nome_etiqueta: '',
  categoria: '',
  eh_intermediaria: 0,
  rendimento: null,
  unidade_rendimento: 'un',
  peso_unitario: null,
  preco_sugerido: null,
  modo_preparo: '',
  ingredientes: []
})

/* ── Gestão de Insumos de dentro da Receita ── */
const formInsumo = reactive({
  uuid: null, nome: '', tipo: 'insumo',
  unidade_compra: 'kg', unidade_base: 'g',
  fator_conversao: 1000, custo_por_unidade: 0,
  estoque_atual: 0, estoque_minimo: 0,
  peso_unitario: 0
})
const custoPorBaseInsumoContextual = computed(() => R$(s.getPrecoUnitarioInsumo(formInsumo)))
const custoPorBaseFmtInsumoContextual = computed(() => 'R$ ' + s.getPrecoUnitarioInsumo(formInsumo).toFixed(5).replace('.', ','))

function tipoBadgeInsumo(t) {
  return { insumo: 'badge-muted', embalagem: 'badge-orange' }[t] || 'badge-muted'
}
function tipoIconInsumo(t) {
  return { insumo: 'fas fa-mortar-pestle', embalagem: 'fas fa-box' }[t] || 'fas fa-cube'
}

const catAtivaInsumos = ref('Todas')
const categoriasInsumos = ['Todas', 'Ingrediente', 'Embalagem']
const tipoInsumoMap = {
  'Ingrediente': 'insumo',
  'Embalagem': 'embalagem'
}

const buscaInsumosGeral = ref('')
const insumosFiltradosGeral = computed(() => {
  const q = normalizar(buscaInsumosGeral.value)
  const tipoAlvo = tipoInsumoMap[catAtivaInsumos.value]
  
  return s.produtos.filter(p => {
    const matchBusca = !q || normalizar(p.nome).includes(q)
    const matchCat = catAtivaInsumos.value === 'Todas' || p.tipo === tipoAlvo
    return matchBusca && matchCat
  }).sort((a,b) => a.nome.localeCompare(b.nome))
})

function editarInsumoGeral(p) {
  Object.assign(formInsumo, JSON.parse(JSON.stringify(p)))
  abrirModal('insumo_detalhe')
}

function duplicarInsumo(p) {
  const clone = JSON.parse(JSON.stringify(p))
  clone.uuid = null // Força criação de novo registro
  clone.nome = `${clone.nome} (Cópia)`
  Object.assign(formInsumo, clone)
  abrirModal('insumo_detalhe')
}

function compartilharReceita(r) {
  const ingredientes = (r.ingredientes || []).map(ing => {
    const alvo = ing.tipo === 'receita' 
      ? s.receitas.find(x => x.uuid === ing.id) 
      : s.produtos.find(x => x.uuid === ing.id)
    const nome = alvo?.nome || 'Item removido'
    const unidade = ing.tipo === 'receita' ? alvo?.unidade_rendimento : alvo?.unidade_base
    return `• ${nome}: ${Number(ing.quantidade || 0).toLocaleString('pt-BR')} ${unidade || ''}`
  }).join('\n')

  const msg = `📖 *FICHA TÉCNICA: ${r.nome.toUpperCase()}*\n` +
              `--------------------------------\n` +
              `*Categoria:* ${r.categoria || 'Geral'}\n` +
              `*Rendimento:* ${r.rendimento || '-'} ${r.unidade_rendimento || ''}\n` +
              (r.peso_unitario ? `*Peso Unit:* ${r.peso_unitario}g\n` : '') +
              `--------------------------------\n` +
              `*Ingredientes:*\n${ingredientes}\n` +
              `--------------------------------\n` +
              (r.modo_preparo ? `*Modo de Preparo:*\n${r.modo_preparo}\n` : '') +
              `\n_Gerado por ${s.company.nome}_`

  if (navigator.share) {
    navigator.share({ title: `Receita: ${r.nome}`, text: msg }).catch(() => {})
  } else {
    navigator.clipboard.writeText(msg)
    s.notify('Texto da receita copiado!')
  }
}

function duplicarReceita(r) {
  const clone = JSON.parse(JSON.stringify(r))
  clone.uuid = null // Força criação de novo registro
  clone.nome = `${clone.nome} (Cópia)`
  if (clone.ingredientes) {
    clone.ingredientes.forEach(i => i._key = Math.random().toString(36).slice(2, 11))
  }
  Object.assign(form, clone)
  abrirModal('receita')
}

function criarInsumoRapido() {
  Object.assign(formInsumo, { uuid: null, nome: '', custo_por_unidade: 0, fator_conversao: 1000, unidade_base: 'g' })
  abrirModal('insumo_detalhe')
}

async function excluirInsumoContextual(item = null) {
  const alvo = item || formInsumo
  if (!alvo.uuid) return

  const ok = await confirm.ask(`Excluir permanentemente ${alvo.nome}?`, { type: 'danger' })
  if (ok) {
    try {
      await s.excluirProduto(alvo.uuid)
      if (!item) fecharModal() // Só fecha se estiver no modal de detalhe
    } catch (e) { /* s.notify já lida com erro de uso em receita */ }
  }
}

function handleNomeClick(ing, idx) {
  // Agora sempre abre o seletor para permitir escolher ou trocar o item facilmente
  abrirPicker(idx)
}

async function salvarInsumoContextual() {
  try {
    await s.salvarProduto({ ...formInsumo })
    // Após salvar o insumo, voltamos para o modal da receita
    // O store já atualizou o produto, os computados de custo da receita vão reagir
    fecharModal()
  } catch (e) {
    console.error(e)
  }
}

const custoMaoDeObraTotal = computed(() => {
  if (!form.tempo_preparo_min || s.company.custo_hora_trabalho <= 0) return 0
  return (form.tempo_preparo_min / 60) * s.company.custo_hora_trabalho
})

const form = reactive(getEmptyForm())

const pickerBases = computed(() => {
  const q = normalizar(pickerSearch.value)
  return s.receitas
    .filter(r => r.uuid !== form.uuid && (!q || normalizar(r.nome).includes(q)))
    .map(r => ({ id: r.uuid, nome: r.nome, tipo: 'receita', unidade: r.unidade_rendimento || 'g', rendimento: r.rendimento || '?', key: 'r' + r.uuid }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
})

const pickerInsumos = computed(() => {
  const q = normalizar(pickerSearch.value)
  return s.produtos
    .filter(p => !q || normalizar(p.nome).includes(q))
    .map(p => ({ 
      id: p.uuid, nome: p.nome, tipo: 'produto', 
      unidade: p.unidade_base || 'g', key: 'p' + p.uuid 
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
})

const podeCriarNovo = computed(() => {
  const nome = pickerSearch.value.trim()
  if (!nome) return false
  const q = normalizar(nome)
  return !s.produtos.some(p => normalizar(p.nome) === q) && !s.receitas.some(r => normalizar(r.nome) === q)
})

const detalhesIngredientes = computed(() =>
  form.ingredientes
    .filter(ing => ing?.id)
    .map(ing => ({
      key: ing._key,
      nome: getNomeIng(ing) || 'Item removido',
      quantidade: `${Number(ing.quantidade || 0)} ${getUnidade(ing)}`,
      custo: R$(getCustoComposicao(ing))
    }))
)

const totalIngredientesG = computed(() => s.getPesoTotal(form))
const lucro = computed(() => s.getLucroInfo(form))

const pesoEsperado  = computed(() => (!form.rendimento || !form.peso_unitario) ? null : form.rendimento * form.peso_unitario)
const diferencaPeso = computed(() => !pesoEsperado.value ? 0 : totalIngredientesG.value - pesoEsperado.value)

function arredondarPrecoSugerido(valor) {
  return Math.round(valor * 100) / 100
}

/* ── Watchers ─────────────────────────────────────────────────── */
watch(() => form.ingredientes, () => {
  if (!form.eh_intermediaria) return
  const total = totalIngredientesG.value // Recalcula o peso total dos ingredientes
  if (total > 0) {
    form.rendimento = total
    form.unidade_rendimento = 'g'
    if (form.unidade_rendimento === 'g' && !form.peso_unitario) form.peso_unitario = 1
  }
}, { deep: true })

watch(() => form.nome, (v) => {
  if (form.uuid || !v) return
  const n = normalizar(v)
  if      (n.includes('trufa'))   form.categoria = 'Trufa'
  else if (n.includes('cone'))    form.categoria = 'Cone'
  else if (n.includes('barra'))   form.categoria = 'Barra'
  else if (n.includes('brownie')) form.categoria = 'Brownie'
  else if (n.includes('bolo'))    form.categoria = 'Bolo'
  else if (n.includes('ovo'))     form.categoria = 'Ovo'
  else if (n.includes('recheio')) form.categoria = 'Base'

  if (!form.nome_etiqueta?.trim()) {
    form.nome_etiqueta = limparPrefixoCategoria(v)
  }
})
watch(() => form.eh_intermediaria, (val) => {
  if (!form.uuid && val === 1) form.categoria = 'Base'
})

/* ── Helpers ──────────────────────────────────────────────────── */
function getNomeIng(ing) {
  if (!ing.id) return ''
  const alvo = ing.tipo === 'receita' ? s.receitas.find(r => r.uuid === ing.id) : s.produtos.find(p => p.uuid === ing.id)
  return alvo?.nome || '⚠️ Removido'
}
function getUnidade(ing) {
  if (ing.tipo === 'receita') return s.receitas.find(r => r.uuid === ing.id)?.unidade_rendimento || 'g'
  return s.produtos.find(p => p.uuid === ing.id)?.unidade_base || 'g'
}
function getCustoComposicao(ing) {
  const qtd = Number(ing.quantidade || 0)
  if (qtd <= 0 || !ing.id) return 0
  if (ing.tipo === 'receita') {
    const sub = s.receitas.find(r => r.uuid === ing.id)
    if (!sub || !sub.rendimento) return 0
    return (s.getCustoTotal(sub) / (sub.rendimento || 1)) * qtd
  }
  const prod = s.produtos.find(p => p.uuid === ing.id)
  if (!prod || !prod.fator_conversao) return 0
  return ((prod.custo_por_unidade || 0) / (prod.fator_conversao || 1)) * qtd
}

function ingredienteIncompleto(ing) {
  return !ing?.id || Number(ing.quantidade || 0) <= 0
}

function ingredienteDuplicado(ing, idxAtual) {
  if (!ing?.id) return false
  return form.ingredientes.some((item, idx) =>
    idx !== idxAtual && item?.id === ing.id && item?.tipo === ing.tipo
  )
}

function limparPrefixoCategoria(nome) {
  return String(nome || '')
    .replace(/^\s*(trufa|cone|barra|brownie|bolo|ovo)\s+/i, '')
    .trim()
}

/* ── Ingredientes ─────────────────────────────────────────────── */
function addNovoItem() {
  form.ingredientes.push({ _key: Math.random().toString(36).slice(2, 11), id: '', tipo: 'produto', quantidade: null, gera_peso: true })
  abrirPicker(form.ingredientes.length - 1)
}

function abrirPicker(idx) {
  pickerIndex.value = idx; pickerSearch.value = ''; pickerTab.value = 'todos'
  showPicker.value = true
}

function fecharPicker() {
  showPicker.value = false
}
function removerIngrediente(idx) { form.ingredientes.splice(idx, 1) }
function selecionarItem(item) {
  const ing = form.ingredientes[pickerIndex.value]
  ing.id = item.id; ing.tipo = item.tipo
  // Define o padrão automaticamente: embalagens e itens com nomes específicos começam desativados
  ing.gera_peso = item.tipo !== 'embalagem' && !isInsumoSemPeso(item.nome)
  
  fecharPicker()
  restoreAndFocusIngrediente(pickerIndex.value)
}
async function criarNovoInsumo() {
  const nome = pickerSearch.value.trim()
  if (!nome) return
  const existente = s.produtos.find(p => normalizar(p.nome) === normalizar(nome))
  let produto = existente
  if (!produto) {
    const novo = { uuid: crypto.randomUUID(), nome, unidade_base: 'g' }
    await s.salvarProduto(novo)
    produto = novo
  }
  const ing = form.ingredientes[pickerIndex.value]
  ing.id = produto.uuid; ing.tipo = 'produto'
  fecharPicker()
  restoreAndFocusIngrediente(pickerIndex.value)
}

/**
 * UI/UX: Foca no campo de quantidade do ingrediente adicionado.
 * Como o modal de receita nunca é desmontado (showPicker é independente),
 * o scroll é preservado. Apenas scrollIntoView garante a visibilidade.
 */
function restoreAndFocusIngrediente(idx) {
  if (idx === null || idx === undefined) return
  nextTick(() => {
    const input = document.getElementById(`ing-qty-${idx}`)
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      input.focus({ preventScroll: true })
      if (typeof input.select === 'function') input.select()
    }
  })
}

/* ── Modal ────────────────────────────────────────────────────── */
function abrir(r) {
  Object.assign(form, getEmptyForm())
  if (r) Object.assign(form, {
    uuid: r.uuid, nome: r.nome, nome_etiqueta: r.nome_etiqueta || '', categoria: r.categoria, eh_intermediaria: r.eh_intermediaria,
    rendimento: r.rendimento, unidade_rendimento: r.unidade_rendimento, peso_unitario: r.peso_unitario,
    preco_sugerido: r.preco_sugerido, modo_preparo: r.modo_preparo, tempo_preparo_min: r.tempo_preparo_min,
    ingredientes: (r.ingredientes || []).map(i => ({ ...i, _key: i.id + Math.random() }))
  })
  // Automaticamente calibra o tempo de preparo se houver uma média real e o tempo atual for 0 ou null
  if (r && (form.tempo_preparo_min === null || form.tempo_preparo_min === 0) && mediaTempoRealProducao.value > 0) {
    form.tempo_preparo_min = Math.round(mediaTempoRealProducao.value)
  }
  
  abrirModal('receita')
}

function gerarRelatorio() {
  gerarRelatorioReceitas({
    empresa: s.company,
    receitas: listaFiltrada.value,
    produtos: s.produtos,
    todasReceitas: s.receitas
  })
}

/* ── Salvar / Excluir ─────────────────────────────────────────── */
async function salvar() {
  if (!form.eh_intermediaria && pesoEsperado.value && Math.abs(diferencaPeso.value) > 5) {
    const ok = await confirm.ask(
      `A soma dos ingredientes (${totalIngredientesG.value.toFixed(0)}g) difere do peso esperado (${pesoEsperado.value.toFixed(0)}g). Deseja salvar assim mesmo?`,
      { title: 'Divergência de Peso', type: 'warning', confirmLabel: 'Salvar mesmo assim' }
    )
    if (!ok) return 
  }

  // Alerta de Prejuízo: Se houver preço de venda e o lucro for negativo
  if (form.preco_sugerido > 0 && lucro.value.valor < 0) {
    const ok = await confirm.ask(
      `O preço de venda (${R$(form.preco_sugerido)}) está abaixo do custo de produção (${R$(lucro.value.custoUnit)}). Você terá um prejuízo de ${R$(Math.abs(lucro.value.valor))} por unidade. Deseja salvar assim mesmo?`,
      { title: 'Aviso de Prejuízo', type: 'danger', confirmLabel: 'Salvar com Prejuízo' }
    )
    if (!ok) return
  }

  saving.value = true
  try {
    const payload = { ...form }
    if (!payload.uuid) payload.uuid = crypto.randomUUID()
    payload.ingredientes = payload.ingredientes.map(({ _key, ...rest }) => rest)
    await s.salvarReceita(payload)
    fecharModal()
  } catch (error) {
    if (!error?.validation) console.error(error)
  } finally { saving.value = false }
}

// Excluir via botão dentro do modal (receita já aberta)
async function excluir() {
  if (!form.uuid) return
  await confirmarExclusao({
    nome: form.nome, entidade: 'receita',
    onConfirm: () => s.excluirReceita(form.uuid),
    onDone: fecharModal,
  })
}

// Excluir direto pelo swipe (sem modal aberto)
async function excluirDireto(r) {
  await confirmarExclusao({
    nome: r.nome, entidade: 'receita',
    onConfirm: () => s.excluirReceita(r.uuid),
  })
}
</script>

<style scoped>
.tab-content { padding-top: 12px; }

/* ── Accordion de seções ── */
.sec-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  margin-bottom: 0;
}
.sec-toggle:active { opacity: .75; }
.sec-summary {
  flex: 1;
  font-size: .72rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: none;
  letter-spacing: 0;
}
.sec-chevron {
  margin-left: auto;
  color: var(--muted);
  font-size: .7rem;
  transition: transform .22s ease;
  flex-shrink: 0;
}
.sec-chevron.open { transform: rotate(180deg); }
.sec-body {
  padding-top: 14px;
}
/* Quando seção está fechada, o form-section-label não tem margin-bottom */
.form-section-label.sec-toggle { margin-bottom: 0; }

/* stepper de ingredientes → main.css */
</style>
