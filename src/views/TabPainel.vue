<template>
  <div class="tab-painel">

    <div class="painel-hdr">
      <!-- Linha única: título + segmented control -->
      <div class="painel-hdr-row">
        <h2 class="painel-titulo">
          <i class="fas fa-chart-pie"></i> Painel
        </h2>
        <div class="seg-control">
          <button class="seg-btn" :class="{ active: aba === 'painel' }" @click="aba = 'painel'">
            Resumo
          </button>
          <button class="seg-btn" :class="{ active: aba === 'lista' }" @click="abrirLista">
            Compras
            <span v-if="listaCompras.length" class="seg-badge">{{ listaCompras.length }}</span>
          </button>
        </div>
      </div>
      <!-- Filtro de período — só no painel, parte do mesmo bloco sticky -->
      <div v-if="aba === 'painel'" class="painel-filtros">
        <!-- Linha: chips de mês + botão datas -->
        <div class="filtro-linha">
          <div class="painel-chips">
            <button
              v-for="p in periodosDisponiveis" :key="p.value"
              class="pchip"
              :class="{ active: periodoAtivo === p.value && !usandoIntervalo }"
              @click="selecionarPeriodo(p.value)"
            >{{ p.label }}</button>
          </div>
          <button
            class="btn-intervalo"
            :class="{ active: mostrarIntervalo }"
            @click="toggleIntervalo"
            title="Filtrar por intervalo de datas"
          >
            <i class="fas fa-calendar-days"></i>
            <span v-if="usandoIntervalo" class="intervalo-dot"></span>
          </button>
        </div>
        <!-- Filtro por intervalo de datas (colapsável) -->
        <Transition name="slide-down">
          <div v-if="mostrarIntervalo" class="filtro-datas">
            <div class="filtro-datas-row">
              <div class="filtro-campo">
                <label class="filtro-label">De</label>
                <input type="date" class="filtro-input" v-model="dataIni" />
              </div>
              <div class="filtro-campo">
                <label class="filtro-label">Até</label>
                <input type="date" class="filtro-input" v-model="dataFim" />
              </div>
              <button class="btn-aplicar" @click="aplicarIntervalo" :disabled="!dataIni || !dataFim">
                <i class="fas fa-check"></i>
              </button>
              <button v-if="usandoIntervalo" class="btn-limpar" @click="limparIntervalo">
                <i class="fas fa-xmark"></i>
              </button>
            </div>
            <p v-if="usandoIntervalo" class="filtro-aviso">
              <i class="fas fa-filter"></i> Exibindo: {{ dataIni }} → {{ dataFim }}
            </p>
          </div>
        </Transition>
      </div>
    </div>

    <!-- ABA PAINEL -->
    <div v-if="aba === 'painel'" class="painel-content">
      <div v-if="s.loading" class="loading-box"><div class="spinner spinner-sm"></div></div>
      <template v-else>

        <!-- 🚨 Alerta de Estoque Crítico -->
        <div v-if="s.insumosCriticos.length" class="bloco-titulo collapsible-trigger" style="color: var(--orange)" @click="estoqueAberto = !estoqueAberto">
          <span><i class="fas fa-triangle-exclamation"></i> Estoque em Alerta</span>
          <span class="bloco-periodo" v-if="!estoqueAberto">{{ s.insumosCriticos.length }} item(ns) abaixo do mínimo</span>
          <i class="fas fa-chevron-down sec-chevron" :class="{ open: estoqueAberto }"></i>
        </div>
        <div v-if="s.insumosCriticos.length" v-show="estoqueAberto" class="sheet-card" 
          style="border-color: var(--orange-dim); background: var(--orange-bg); margin-bottom: 16px">
          <div class="sheet-body p-0">
            <div v-for="p in s.insumosCriticos.slice(0, 3)" :key="p.uuid" class="list-row" style="background: transparent; min-height: 50px; padding: 10px 14px">
              <div class="row-info">
                <div class="row-name" style="font-size: .85rem">{{ p.nome }}</div>
                <div class="row-sub">Mínimo: {{ fmtQ(p.estoque_minimo, p.unidade_base) }}</div>
              </div>
              <div class="row-right">
                <span class="badge" :class="p.estoque_atual < 0 ? 'badge-red' : 'badge-orange'">
                  {{ fmtQ(p.estoque_atual, p.unidade_base) }}
                </span>
              </div>
            </div>
            <button class="btn-txt-sm" style="width: 100%; padding: 10px; border-top: 1px solid var(--orange-dim)" @click="s.setTab('insumos')">
              Ver todos os ingredientes
            </button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-lbl">Produção</span>
            <span class="kpi-val">{{ stats.totalQtd }}<small> un</small></span>
          </div>
          <div class="kpi-card">
            <span class="kpi-lbl">Faturamento</span>
            <span class="kpi-val c-green">{{ R$(stats.totalVenda) }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-lbl">Custo</span>
            <span class="kpi-val c-orange">{{ R$(stats.totalCusto) }}</span>
          </div>
          <div class="kpi-card kpi-destaque">
            <span class="kpi-lbl">Lucro est.</span>
            <span class="kpi-val" :class="stats.totalLucro >= 0 ? 'c-green' : 'c-red'">{{ R$(stats.totalLucro) }}</span>
          </div>
        </div>

        <!-- 🎯 Meta de Retirada Mensal -->
        <div v-if="metaSalario > 0" class="bloco-titulo" style="margin-top: 4px">
          <span><i class="fas fa-bullseye"></i> Meta de Retirada</span>
          <span class="bloco-periodo">{{ Math.round(metaPct) }}% da meta</span>
        </div>
        <div v-if="metaSalario > 0" class="sheet-card">
          <div class="sheet-body">
            <div class="meta-info">
              <span class="meta-atual" :class="metaPct >= 100 ? 'c-green' : metaPct >= 50 ? 'c-orange' : 'c-red'">
                {{ R$(stats.totalLucro) }}
              </span>
              <span class="meta-sep">/</span>
              <span class="meta-alvo">{{ R$(metaSalario) }}</span>
            </div>
            <div class="meta-bar-bg">
              <div class="meta-bar-fill" :style="{ 
                width: Math.min(100, metaPct) + '%', 
                background: metaPct >= 100 ? 'var(--green)' : metaPct >= 50 ? 'var(--orange)' : 'var(--red)' 
              }"></div>
            </div>
            <div v-if="projecaoMes > 0" class="projecao-tag">
              <i class="fas fa-arrow-trend-up"></i>
              Projeção para o fim do mês: <strong>{{ R$(projecaoMes) }}</strong>
            </div>
          </div>
        </div>

        <div class="bloco-titulo">
          <i class="fas fa-medal"></i> Top receitas
          <span class="bloco-periodo">{{ periodoLabel }}</span>
        </div>
        <div class="sheet-card mb-0">
          <div class="sheet-body p-0">
            <div v-if="!stats.topReceitas.length" class="empty-mini">Sem produções no período</div>
            <div v-for="(item, idx) in stats.topReceitas" :key="item.nome" class="rank-row">
              <span class="rank-pos" :class="['rp-1','rp-2','rp-3'][idx] || 'rp-n'">{{ idx + 1 }}</span>
              <div class="rank-body">
                <div class="rank-nome">{{ item.nome }}</div>
                <div class="rank-bar-bg">
                  <div class="rank-bar-fill"
                    :style="{ width: Math.round((item.qtd / stats.topReceitas[0].qtd) * 100) + '%', background: margemColor(item) }">
                  </div>
                </div>
              </div>
              <div class="rank-nums">
                <span class="rank-qtd">{{ item.qtd }} <small>{{ item.unidade }}</small></span>
                <span class="rank-lucro" :class="item.lucroTotal >= 0 ? 'c-green' : 'c-red'">{{ R$(item.lucroTotal) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="stats.porCategoria.length > 1" class="bloco-titulo">
          <i class="fas fa-layer-group"></i> Por categoria
        </div>
        <div v-if="stats.porCategoria.length > 1" class="sheet-card mb-0">
          <div class="sheet-body">
            <div v-for="cat in stats.porCategoria" :key="cat.nome" class="cat-row">
              <span class="cat-nome">{{ cat.nome }}</span>
              <div class="cat-bar-bg">
                <div class="cat-bar-fill" :style="{ width: cat.percent + '%', background: avatarColor(cat.nome) }"></div>
              </div>
              <span class="cat-val">{{ cat.qtd }} un</span>
            </div>
          </div>
        </div>

        <button class="atalho-inteligencia" @click="s.setTab('inteligencia')">
          <div class="ai-ico"><i class="fas fa-brain"></i></div>
          <div class="ai-body">
            <div class="ai-titulo">Inteligência de Vendas</div>
            <div class="ai-sub">Preço mínimo, combos e estratégias</div>
          </div>
          <i class="fas fa-chevron-right ai-arrow"></i>
        </button>

      </template>
    </div>

    <!-- ABA LISTA DE COMPRAS -->
    <div v-else class="lista-wrap">
      <div v-if="loadingLista" class="loading-box"><div class="spinner spinner-sm"></div></div>
      <template v-else>

        <div class="lc-ctx">
          <div class="lc-ctx-info">
            <div class="proj-badge">
              <i class="fas fa-calendar-check"></i>
              <div class="proj-body">
              <span class="proj-label">Previsão para:</span>
                <div class="proj-trigger">
                  <strong>{{ semanasProjecao === 4 ? '1 mês' : semanasProjecao + (semanasProjecao === 1 ? ' semana' : ' semanas') }}</strong>
                  <i class="fas fa-chevron-down"></i>
                  <select v-model="semanasProjecao" class="proj-hidden-select">
                <option :value="1">1 semana</option>
                <option :value="2">2 semanas</option>
                <option :value="4">1 mês (4 sem)</option>
              </select>
                </div>
              </div>
            </div>
          </div>
          <div v-if="totalEstimado > 0" class="lc-ctx-right">
            <span class="lc-ctx-lbl">{{ nChecked > 0 ? 'Selecionado' : 'Total estimado' }}</span>
            <strong class="lc-ctx-val" :class="nChecked > 0 ? 'c-orange' : ''">
              {{ nChecked > 0 ? R$(totalSelecionado) : R$(totalEstimado) }}
            </strong>
            <span v-if="nChecked > 0" class="lc-ctx-sub">de {{ R$(totalEstimado) }} total</span>
          </div>
        </div>

        <div v-if="mesesUsados < 2" class="lc-aviso">
          <i class="fas fa-triangle-exclamation"></i>
          Poucos dados. Registre mais produções para uma projeção mais precisa.
        </div>

        <div v-if="!listaCompras.length" class="empty-mini mt-16">
          Nenhuma produção nos últimos 3 meses.
        </div>

        <div v-else class="lc-lista">
          <div
            v-for="item in listaCompras" :key="item.id"
            class="lc-item" :class="{ 'lc-checked': item.checked }"
          >
            <!-- Checkbox -->
            <i
              :class="item.checked ? 'fas fa-circle-check lc-ico-on' : 'far fa-circle lc-ico-off'"
              @click="item.checked = !item.checked"
            ></i>

            <!-- Corpo -->
            <div class="lc-item-body" @click="item.checked = !item.checked">
              <div class="lc-nome-row">
                <span class="lc-nome" :class="{ riscado: item.checked }">{{ item.nome }}</span>
                <button class="lc-hist-btn" @click.stop="abrirHistorico(item)" title="Ver variação de preços">
                  <i class="fas fa-chart-line"></i>
                </button>
              </div>
              <div class="lc-sub-row">
                <span class="lc-sub">sugestão {{ fmtQ(item.qtdSugerida, item.unidade) }} · média {{ fmtQ(item.mediaMensal, item.unidade) }}/mês</span>
                <span v-if="item.embalagensFinal > 0 && item.fatorConv > 1" class="lc-emb">
                  <i class="fas fa-box-open"></i>
                  {{ item.embalagensFinal }} {{ item.embalagensFinal === 1 ? item.nomeEmb : item.nomeEmbPlural }}
                  de {{ fmtQ(item.fatorConv, item.unidade) }} cada
                </span>
              </div>
            </div>

            <!-- Lado direito: qtd ajustável + preço -->
            <div class="lc-right">
              <!-- Stepper de embalagens -->
              <div class="lc-stepper" @click.stop>
                <button class="lc-step-btn" @click="ajustarEmbalagens(item, -1)" :disabled="item.embalagensFinal <= 1">
                  <i class="fas fa-minus"></i>
                </button>
                <span class="lc-step-val">
                  {{ item.embalagensFinal > 0 ? item.embalagensFinal : 1 }}
                  <small>{{ item.embalagensFinal === 1 ? item.nomeEmb : item.nomeEmbPlural }}</small>
                </span>
                <button class="lc-step-btn" @click="ajustarEmbalagens(item, +1)">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <!-- Custo + editar preço -->
              <div class="lc-custo-row" @click.stop>
                <span class="lc-custo" v-if="item.custoEstimado > 0">{{ R$(item.custoEstimado) }}</span>
                <button class="lc-preco-btn" @click.stop="abrirModalPreco(item)" title="Atualizar preço">
                  <i class="fas fa-pencil"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal de atualização de preço -->
        <Teleport to="body">
        <div v-if="modalPreco" class="bottom-sheet-overlay" @click.self="modalPreco = null">
          <div class="lc-modal">
            <div class="lc-modal-hdr">
              <span class="lc-modal-titulo"><i class="fas fa-tag"></i> {{ modalPreco.nome }}</span>
              <button class="lc-modal-close" @click="modalPreco = null"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="lc-modal-body">

              <!-- Modo toggle -->
              <div class="preco-mode-toggle">
                <button class="preco-mode-btn" :class="{ active: modoPreco === 'embalagem' }" @click="modoPreco = 'embalagem'">
                  <i class="fas fa-box"></i> Preço da embalagem
                </button>
                <button class="preco-mode-btn" :class="{ active: modoPreco === 'fracionado' }" @click="modoPreco = 'fracionado'">
                  <i class="fas fa-scale-balanced"></i> Compra a granel
                </button>
              </div>

              <!-- MODO: Preço da embalagem inteira -->
              <div v-if="modoPreco === 'embalagem'" class="preco-form">
                <div class="preco-hint">
                  <i class="fas fa-circle-info"></i>
                  Informe o preço pago pela embalagem completa
                  <strong v-if="modalPreco.fatorConv > 0">({{ fmtQ(modalPreco.fatorConv, modalPreco.unidade) }})</strong>.
                </div>
                <div class="preco-field">
                  <label class="preco-label">Preço da embalagem</label>
                  <div class="preco-input-row">
                    <span class="preco-prefix">R$</span>
                    <input class="preco-input" type="text" inputmode="decimal"
                      v-model="precoEmbInput"
                      @input="calcPrecoEmb"
                      placeholder="0,00" />
                  </div>
                </div>
                <div v-if="precoEmbCalculado > 0" class="preco-resultado">
                  <i class="fas fa-calculator"></i>
                  Custo por {{ modalPreco.unidade }}: <strong>{{ R$(precoEmbCalculado) }}</strong>
                  <span v-if="modalPreco.unidade === 'g'">· R$ {{ (precoEmbCalculado * 1000).toFixed(2) }}/kg</span>
                  <span v-if="modalPreco.unidade === 'ml'">· R$ {{ (precoEmbCalculado * 1000).toFixed(2) }}/L</span>
                </div>
                <button class="btn btn-primary btn-sm mt-12" :disabled="!(parseFloat(precoEmbInput.replace(',','.')) > 0)" @click="confirmarPrecoEmb">
                  <i class="fas fa-check"></i> Atualizar preço
                </button>
              </div>

              <!-- MODO: Compra fracionada / a granel -->
              <div v-if="modoPreco === 'fracionado'" class="preco-form">
                <div class="preco-hint">
                  <i class="fas fa-circle-info"></i>
                  Informe quanto você pagou e quanto pesou. O sistema calcula o preço por {{ modalPreco.unidade === 'g' ? 'kg' : modalPreco.unidade === 'ml' ? 'L' : modalPreco.unidade }} automaticamente.
                </div>
                <div class="preco-grid-2">
                  <div class="preco-field">
                    <label class="preco-label">Quanto pagou</label>
                    <div class="preco-input-row">
                      <span class="preco-prefix">R$</span>
                      <input class="preco-input" type="text" inputmode="decimal"
                        v-model="fracValor"
                        @input="calcFracionado"
                        placeholder="5,00" />
                    </div>
                  </div>
                  <div class="preco-field">
                    <label class="preco-label">Quanto veio ({{ modalPreco.unidade }})</label>
                    <div class="preco-input-row">
                      <input class="preco-input" type="text" inputmode="decimal"
                        v-model="fracQtd"
                        @input="calcFracionado"
                        :placeholder="modalPreco.unidade === 'g' ? '167' : '0'" />
                      <span class="preco-suffix">{{ modalPreco.unidade }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="fracResultado > 0" class="preco-resultado">
                  <i class="fas fa-calculator"></i>
                  R$ {{ (fracResultado).toFixed(4) }}/{{ modalPreco.unidade }}
                  <span v-if="modalPreco.unidade === 'g'"> · <strong>R$ {{ (fracResultado * 1000).toFixed(2) }}/kg</strong></span>
                  <span v-if="modalPreco.unidade === 'ml'"> · <strong>R$ {{ (fracResultado * 1000).toFixed(2) }}/L</strong></span>
                </div>
                <div v-if="fracResultado > 0 && modalPreco.fatorConv > 0" class="preco-resultado preco-resultado-sec">
                  <i class="fas fa-box"></i>
                  Embalagem de {{ fmtQ(modalPreco.fatorConv, modalPreco.unidade) }} custaria
                  <strong>{{ R$(fracResultado * modalPreco.fatorConv) }}</strong>
                </div>
                <button class="btn btn-primary btn-sm mt-12"
                  :disabled="!(fracResultado > 0)"
                  @click="confirmarPrecoFrac">
                  <i class="fas fa-check"></i> Atualizar preço
                </button>
              </div>

            </div>
          </div>
        </div>
        </Teleport>

        <!-- Modal histórico de preços -->
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
                  <p>Nenhum registro ainda.<br>Edite o preço na lista de compras para começar a rastrear.</p>
                </div>
              </template>
              <template v-else>
                <!-- Resumo -->
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
                  <div class="lc-hist-kpi" v-if="historicoPrecos.length > 1">
                    <span class="lc-hist-kpi-lbl">Mínimo</span>
                    <span class="lc-hist-kpi-val">{{ R$(Math.min(...historicoPrecos.map(h=>h.custo_por_unidade))) }}</span>
                  </div>
                  <div class="lc-hist-kpi" v-if="historicoPrecos.length > 1">
                    <span class="lc-hist-kpi-lbl">Máximo</span>
                    <span class="lc-hist-kpi-val">{{ R$(Math.max(...historicoPrecos.map(h=>h.custo_por_unidade))) }}</span>
                  </div>
                </div>
                <!-- Gráfico de barras simples SVG -->
                <div class="lc-hist-chart-wrap">
                  <svg class="lc-hist-svg" viewBox="0 0 300 90" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--brown)" stop-opacity="0.9"/>
                        <stop offset="100%" stop-color="var(--brown)" stop-opacity="0.3"/>
                      </linearGradient>
                    </defs>
                    <template v-for="(h, idx) in historicoPrecos" :key="idx">
                      <rect
                        :x="idx * (300 / historicoPrecos.length) + 3"
                        :y="90 - (h.custo_por_unidade / maxPrecoHist) * 75"
                        :width="(300 / historicoPrecos.length) - 6"
                        :height="(h.custo_por_unidade / maxPrecoHist) * 75"
                        rx="3" fill="url(#barGrad)"
                      />
                      <text
                        :x="idx * (300 / historicoPrecos.length) + (300 / historicoPrecos.length) / 2"
                        y="88"
                        text-anchor="middle"
                        font-size="7"
                        fill="var(--muted)"
                      >{{ fmtDataCurta(h.data) }}</text>
                    </template>
                  </svg>
                </div>
                <!-- Tabela -->
                <div class="lc-hist-tabela">
                  <div v-for="(h, idx) in [...historicoPrecos].reverse()" :key="idx" class="lc-hist-row">
                    <span class="lc-hist-data">{{ fmtDataHist(h.data) }}</span>
                    <span class="lc-hist-preco">{{ R$(h.custo_por_unidade) }}</span>
                    <span v-if="idx < historicoPrecos.length - 1" class="lc-hist-delta"
                      :class="historicoPrecos[historicoPrecos.length-1-idx].custo_por_unidade > historicoPrecos[historicoPrecos.length-2-idx].custo_por_unidade ? 'c-red' : 'c-green'">
                      {{ historicoPrecos[historicoPrecos.length-1-idx].custo_por_unidade > historicoPrecos[historicoPrecos.length-2-idx].custo_por_unidade ? '▲' : '▼' }}
                    </span>
                    <span v-else class="lc-hist-delta" style="opacity:0">·</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
        </Teleport>

        <!-- Rodapé discreto: progresso inline + botões -->
        <div v-if="listaCompras.length" class="lc-footer">
          <div class="lc-footer-top">
            <span class="lc-prog-inline">
              <span class="lc-prog-dots">
                <span
                  v-for="(_, i) in listaCompras" :key="i"
                  class="lc-dot"
                  :class="{ 'lc-dot-on': i < nChecked }"
                ></span>
              </span>
              {{ nChecked }}/{{ listaCompras.length }}
            </span>
            <button class="btn-txt-sm" @click="desmarcarTodos">
              <i class="fas fa-rotate-left"></i> Limpar
            </button>
          </div>
          <div class="lc-share-btns">
            <button class="btn btn-secondary btn-sm" @click="compartilharListaCompras('pendentes')" :disabled="nChecked === listaCompras.length">
              <i class="fas fa-share-nodes"></i> Compartilhar pendentes
            </button>
            <button class="btn btn-primary btn-sm" @click="compartilharListaCompras('tudo')">
              <i class="fas fa-share-nodes"></i> Tudo
            </button>
          </div>
        </div>

      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from '../store.js'
import CategoryFilter from '../components/CategoryFilter.vue'
import { R$, avatarColor, fmtQtd as fmtQ, getMesRef } from '../utils.js'

const s = useStore()
const aba = ref('painel')
const periodoAtivo = ref('30dias')
const estoqueAberto = ref(false)

// ── Filtro por intervalo de datas ──────────────────────────────
const mostrarIntervalo = ref(false)
const dataIni = ref('')
const dataFim = ref('')
const usandoIntervalo = ref(false)

const toggleIntervalo = () => {
  mostrarIntervalo.value = !mostrarIntervalo.value
}

const selecionarPeriodo = (val) => {
  periodoAtivo.value = val
  usandoIntervalo.value = false
  dataIni.value = ''
  dataFim.value = ''
}

const aplicarIntervalo = () => {
  if (!dataIni.value || !dataFim.value) return
  usandoIntervalo.value = true
}

const limparIntervalo = () => {
  usandoIntervalo.value = false
  dataIni.value = ''
  dataFim.value = ''
  mostrarIntervalo.value = false
}

const periodosDisponiveis = computed(() => {
  const mesesSet = new Set()
  s.producoes.forEach(p => { const m = getMesRef(p.data_producao); if (m) mesesSet.add(m) })
  const mesesOrd = Array.from(mesesSet).sort((a, b) => {
    const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/')
    return `${yb}${mb}`.localeCompare(`${ya}${ma}`)
  }).slice(0, 6)
  return [
    { value: '7dias', label: 'Última Semana' },
    { value: '30dias', label: 'Últimos 30 dias' },
    ...mesesOrd.map(m => ({ value: m, label: m })),
    { value: 'total', label: 'Tudo' }
  ]
})

const periodoLabel = computed(() =>
  periodosDisponiveis.value.find(p => p.value === periodoAtivo.value)?.label || ''
)

const atualizarDados = () => {
  const dias = periodoAtivo.value === '7dias' ? 7 : periodoAtivo.value === '30dias' ? 30 : 0
  s.carregarProducoes(dias)
}
watch(periodoAtivo, atualizarDados)
onMounted(atualizarDados)

const producoesFiltradas = computed(() => {
  // Filtro por intervalo de datas tem prioridade
  if (usandoIntervalo.value && dataIni.value && dataFim.value) {
    const ini = new Date(dataIni.value + 'T00:00:00')
    const fim = new Date(dataFim.value + 'T23:59:59')
    return s.producoes.filter(p => {
      const d = new Date(p.data_producao)
      return d >= ini && d <= fim
    })
  }
  const val = periodoAtivo.value
  if (val === 'total') return s.producoes
  if (val === '7dias' || val === '30dias') {
    const limite = new Date()
    limite.setDate(limite.getDate() - (val === '7dias' ? 7 : 30))
    return s.producoes.filter(p => new Date(p.data_producao) >= limite)
  }
  return s.producoes.filter(p => getMesRef(p.data_producao) === val)
})

const stats = computed(() => {
  let totalQtd = 0, totalCusto = 0, totalVenda = 0
  const catMap = {}, recMap = {}

  producoesFiltradas.value.forEach(p => {
    const r = s.receitas.find(rec => rec.uuid === p.receita_id)
    if (!r) return
    const qtd = p.quantidade_produzida || 0
    const cu = p.custo_snapshot_version >= 2 && p.custo_unitario_snapshot != null
      ? p.custo_unitario_snapshot
      : s.getCustoProducaoReceita(r, qtd, p.tempo_real_min || null) / (qtd || 1)
    const pu = p.preco_unitario_snapshot ?? (r.preco_sugerido || 0)

    if (!r.eh_intermediaria) {
      totalQtd += qtd; totalCusto += cu * qtd; totalVenda += pu * qtd
      catMap[r.categoria || 'Outros'] = (catMap[r.categoria || 'Outros'] || 0) + qtd
    }
    if (!recMap[r.uuid]) recMap[r.uuid] = { nome: r.nome, qtd: 0, custo: 0, venda: 0, unidade: r.unidade_rendimento }
    recMap[r.uuid].qtd += qtd; recMap[r.uuid].custo += cu * qtd; recMap[r.uuid].venda += pu * qtd
  })

  const porCategoria = Object.entries(catMap)
    .map(([nome, qtd]) => ({ nome, qtd, percent: (qtd / (totalQtd || 1)) * 100 }))
    .sort((a, b) => b.qtd - a.qtd)

  const topReceitas = Object.values(recMap)
    .map(i => ({ ...i, lucroTotal: i.venda - i.custo, margem: i.venda > 0 ? (i.venda - i.custo) / i.venda * 100 : 0 }))
    .sort((a, b) => b.qtd - a.qtd).slice(0, 5)

  return { totalQtd, totalCusto, totalVenda, totalLucro: totalVenda - totalCusto, porCategoria, topReceitas }
})

const metaSalario = computed(() => s.company.meta_salario_mensal || 0)
const metaPct = computed(() => {
  if (metaSalario.value <= 0) return 0
  const val = (stats.value.totalLucro / metaSalario.value) * 100
  return Math.max(0, val)
})

const projecaoMes = computed(() => {
  const agora = new Date()
  const mesAtualRef = `${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`
  
  // Só projeta se o período selecionado for o mês atual ou os últimos 30 dias
  if (periodoAtivo.value !== mesAtualRef && periodoAtivo.value !== '30dias') return null
  
  const dia = agora.getDate()
  const totalDias = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
  
  if (dia === 0) return 0
  return (stats.value.totalLucro / dia) * totalDias
})

function margemColor(item) {
  if (item.margem >= 50) return 'var(--green)'
  if (item.margem >= 30) return 'var(--gold)'
  return 'var(--orange)'
}

// Lista de Compras
const loadingLista = ref(false)
const listaCompras = ref([])
const semanasProjecao = ref(2) // Default para 2 semanas, conforme sua estratégia
const mesesUsados = ref(0)
const totalEstimado = ref(0)
const nChecked = computed(() => listaCompras.value.filter(i => i.checked).length)
const totalSelecionado = computed(() => listaCompras.value.filter(i => i.checked).reduce((acc, i) => acc + i.custoEstimado, 0))

// Edição de preço inline na lista de compras
// ── Modal de atualização de preço ──
watch(semanasProjecao, () => {
  if (aba.value === 'lista') carregarListaCompras()
})

const modalPreco = ref(null)
const modoPreco = ref('embalagem')
const precoEmbInput = ref('')
const precoEmbCalculado = ref(0)
const fracValor = ref('')
const fracQtd = ref('')
const fracResultado = ref(0)

function abrirModalPreco(item) {
  modalPreco.value = item
  modoPreco.value = item.fatorConv > 1 ? 'embalagem' : 'fracionado'
  precoEmbInput.value = item.custoPorEmbalagem > 0 ? String(item.custoPorEmbalagem.toFixed(2)).replace('.', ',') : ''
  precoEmbCalculado.value = item.custoPorEmbalagem > 0 && item.fatorConv > 0 ? item.custoPorEmbalagem / item.fatorConv : 0
  fracValor.value = ''
  fracQtd.value = ''
  fracResultado.value = 0
}

function calcPrecoEmb() {
  const val = parseFloat(precoEmbInput.value.replace(',', '.'))
  const fator = modalPreco.value?.fatorConv || 1
  precoEmbCalculado.value = (!isNaN(val) && val > 0 && fator > 0) ? val / fator : 0
}

function calcFracionado() {
  const valor = parseFloat(fracValor.value.replace(',', '.'))
  const qtd = parseFloat(fracQtd.value.replace(',', '.'))
  fracResultado.value = (valor > 0 && qtd > 0) ? valor / qtd : 0
}

async function _aplicarNovoPrecoEmbalagem(item, novoCustoPorEmbalagem) {
  const prod = s.produtos.find(p => p.uuid === item.id)
  if (!prod) return
  await s.salvarProduto({ ...prod, custo_por_unidade: novoCustoPorEmbalagem })
  item.custoPorEmbalagem = novoCustoPorEmbalagem
  const emb = item.embalagensFinal || item.embalagens || 1
  item.custoEstimado = emb * novoCustoPorEmbalagem
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
}

async function confirmarPrecoEmb() {
  const val = parseFloat(precoEmbInput.value.replace(',', '.'))
  if (!isNaN(val) && val > 0) {
    await _aplicarNovoPrecoEmbalagem(modalPreco.value, val)
  }
  modalPreco.value = null
}

async function confirmarPrecoFrac() {
  // fracResultado = custo por unidade_base (ex: R$/g)
  // custo_por_unidade = custo da embalagem inteira = fracResultado * fatorConv
  const item = modalPreco.value
  const prod = s.produtos.find(p => p.uuid === item.id)
  if (!prod || fracResultado.value <= 0) return
  const novoCustoPorEmb = fracResultado.value * (prod.fator_conversao || 1)
  await _aplicarNovoPrecoEmbalagem(item, novoCustoPorEmb)
  modalPreco.value = null
}

async function abrirLista() {
  aba.value = 'lista'
  if (!listaCompras.value.length) await carregarListaCompras()
}

async function carregarListaCompras() {
  loadingLista.value = true
  listaCompras.value = []
  await s.carregarProducoes(0)
  const agora = new Date()
  const mesesAlvo = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    mesesAlvo.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
  }
  const prod3m = s.producoes.filter(p => mesesAlvo.includes(getMesRef(p.data_producao)))
  const mesesComDados = new Set(prod3m.map(p => getMesRef(p.data_producao)))
  mesesUsados.value = mesesComDados.size
  if (!prod3m.length) { loadingLista.value = false; return }
  const mapMes = {}
  mesesComDados.forEach(m => { mapMes[m] = {} })
  prod3m.forEach(p => {
    const r = s.receitas.find(rec => rec.uuid === p.receita_id)
    if (!r) return
    const qtd = p.quantidade_produzida || p.quantidade || 0
    if (!qtd) return
    s.expandirIngredientes(r.ingredientes || [], qtd / (r.rendimento || 1), mapMes[getMesRef(p.data_producao)])
  })
  const mediaMap = {}
  Object.values(mapMes).forEach(mm => {
    Object.values(mm).forEach(ing => {
      if (!mediaMap[ing.id]) mediaMap[ing.id] = { ...ing, soma: 0 }
      mediaMap[ing.id].soma += ing.total
    })
  })

  const nM = mesesComDados.size
  const lista = Object.values(mediaMap).map(ing => {
    const mediaMensal = ing.soma / nM
    const qtdPorSemana = mediaMensal / 4.3 // Média de semanas num mês
    const qtdSug = (qtdPorSemana * semanasProjecao.value) * 1.1 // +10% margem
    const prod = s.produtos.find(p => p.uuid === ing.id)

    // Campos do produto
    const fatorConv = prod?.fator_conversao || 0       // quantidade na embalagem (em unidade_base)
    const custoPorEmbalagem = prod?.custo_por_unidade || 0  // preço de 1 embalagem completa
    const unidCompra = prod?.unidade_compra || prod?.unidade_base || ing.unidade

    // Nome amigável da embalagem baseado na unidade de compra
    const nomeEmbMap = {
      'kg': ['pacote', 'pacotes'],
      'g':  ['pacote', 'pacotes'],
      'L':  ['frasco', 'frascos'],
      'l':  ['frasco', 'frascos'],
      'ml': ['frasco', 'frascos'],
      'cx': ['caixa', 'caixas'],
      'pct': ['pacote', 'pacotes'],
      'dz': ['dúzia', 'dúzias'],
      'un': ['unidade', 'unidades'],
    }
    const [nomeEmbDefault, nomeEmbPluralDefault] = nomeEmbMap[unidCompra] || ['unid.', 'unid.']

    let embalagens = 0
    let nomeEmb = nomeEmbDefault
    let nomeEmbPlural = nomeEmbPluralDefault
    let custo = 0

    if (ing.unidade === 'un') {
      // Ingrediente contado em unidades — cada unidade é 1 item comprado
      embalagens = Math.ceil(qtdSug)
      nomeEmb = 'unidade'; nomeEmbPlural = 'unidades'
      // Se tem embalagem com fatorConv (ex: pacote de 100un), usa isso
      if (fatorConv > 1) {
        embalagens = Math.ceil(qtdSug / fatorConv)
        nomeEmb = nomeEmbDefault; nomeEmbPlural = nomeEmbPluralDefault
      }
      custo = custoPorEmbalagem > 0
        ? embalagens * custoPorEmbalagem
        : s.getPrecoUnitarioInsumo(prod) * qtdSug
    } else if (fatorConv > 0) {
      // Ingrediente em g/ml/kg — calcular embalagens inteiras necessárias
      embalagens = Math.ceil(qtdSug / fatorConv)
      // Custo = número de embalagens inteiras × preço da embalagem
      custo = custoPorEmbalagem > 0
        ? embalagens * custoPorEmbalagem
        : s.getPrecoUnitarioInsumo(prod) * qtdSug
    } else {
      // Sem embalagem definida — fallback ao custo por unidade base
      custo = s.getPrecoUnitarioInsumo(prod) * qtdSug
    }

    return {
      id: ing.id, nome: ing.nome, unidade: ing.unidade,
      mediaMensal: mediaMensal, qtdSugerida: qtdSug, custoEstimado: custo,
      embalagens, embalagensFinal: embalagens || 1,
      nomeEmb, nomeEmbPlural, fatorConv, custoPorEmbalagem,
      checked: false
    }
  }).sort((a, b) => b.custoEstimado - a.custoEstimado || b.mediaMensal - a.mediaMensal)
  listaCompras.value = lista
  totalEstimado.value = lista.reduce((acc, i) => acc + i.custoEstimado, 0)
  loadingLista.value = false
}

// Ajuste de quantidade de embalagens pelo stepper
function ajustarEmbalagens(item, delta) {
  const atual = item.embalagensFinal || item.embalagens || 1
  const novo = Math.max(1, atual + delta)
  item.embalagensFinal = novo
  // Recalcular custo com a nova quantidade
  if (item.custoPorEmbalagem > 0) {
    item.custoEstimado = novo * item.custoPorEmbalagem
  } else if (item.fatorConv > 0) {
    const qtdReal = novo * item.fatorConv
    item.custoEstimado = (item.custoPorEmbalagem || 0) > 0
      ? novo * item.custoPorEmbalagem
      : item.custoEstimado * (novo / (item.embalagens || 1))
  }
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
}

// Histórico de preços
const modalHistorico = ref(null)
const historicoPrecos = ref([])
const loadingHistorico = ref(false)
const variacaoPreco = computed(() => {
  if (historicoPrecos.value.length < 2) return 0
  const primeiro = historicoPrecos.value[0].custo_por_unidade
  const ultimo = historicoPrecos.value[historicoPrecos.value.length - 1].custo_por_unidade
  return ((ultimo - primeiro) / primeiro) * 100
})
const maxPrecoHist = computed(() =>
  Math.max(...historicoPrecos.value.map(h => h.custo_por_unidade), 0.01)
)

async function abrirHistorico(item) {
  modalHistorico.value = item
  loadingHistorico.value = true
  historicoPrecos.value = []
  try {
    historicoPrecos.value = await s.historicoPrecoProduto(item.id)
  } finally {
    loadingHistorico.value = false
  }
}

function fmtDataHist(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtDataCurta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

function desmarcarTodos() { listaCompras.value.forEach(i => { i.checked = false }) }

function linhaItem(i) {
  const precisa = fmtQ(i.qtdSugerida, i.unidade)
  let embStr = ''
  if (i.embalagens > 0 && i.fatorConv > 1) {
    embStr = ` → ${i.embalagens} ${i.nomeEmbPlural} de ${fmtQ(i.fatorConv, i.unidade)} cada`
  } else if (i.embalagens > 0) {
    embStr = ` → ${i.embalagens} ${i.nomeEmbPlural}`
  }
  const custo = i.custoEstimado > 0 ? ` (${R$(i.custoEstimado)})` : ''
  return `${i.checked ? '✅' : '🛒'} *${i.nome}*: ${precisa}${embStr}${custo}`
}

function compartilharListaCompras(modo) {
  // modo: 'pendentes' = só os NÃO marcados | 'tudo' = todos
  const src = modo === 'pendentes'
    ? listaCompras.value.filter(i => !i.checked)
    : listaCompras.value

  if (!src.length) { s.notify('Nenhum item para compartilhar'); return }

  const header = modo === 'pendentes' ? 'LISTA DE COMPRAS — PENDENTES' : 'LISTA DE COMPRAS — COMPLETA'
  const itens = src.map(linhaItem).join('\n')
  const total = totalEstimado.value > 0 ? `\n\n💰 *Total estimado: ${R$(totalEstimado.value)}*` : ''
  const rodape = `\n_Média de ${mesesUsados.value} ${mesesUsados.value === 1 ? 'mês' : 'meses'} · chocobete_`
  const msg = `🛒 *${header}*\n\n${itens}${total}${rodape}`

  if (navigator.share) navigator.share({ title: 'Lista de Compras', text: msg }).catch(() => {})
  else { navigator.clipboard.writeText(msg); s.notify('Lista copiada!') }
}
</script>

<style scoped>
.tab-painel { display: flex; flex-direction: column; min-height: 100%; }

/* ── Header sticky unificado ── */
.painel-hdr {
  position: sticky; top: 0; z-index: 50;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(61,31,7,.05);
}

/* ── Estilos para o seletor de projeção (Combo) ── */
.proj-badge {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 12px; background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--r-md); transition: all var(--t);
}
.proj-badge:active { background: var(--gold-bg); border-color: var(--gold); }
.proj-badge i:first-child { color: var(--gold-dark); font-size: 0.9rem; }
.proj-body { display: flex; flex-direction: column; }
.proj-label { font-size: 0.55rem; text-transform: uppercase; font-weight: 800; color: var(--muted); letter-spacing: 0.5px; margin-bottom: -1px; }
.proj-trigger { display: flex; align-items: center; gap: 6px; position: relative; }
.proj-trigger strong { font-size: 0.82rem; color: var(--brown-dark); }
.proj-trigger .fa-chevron-down { font-size: 0.65rem; color: var(--brown-light); }

.proj-hidden-select {
  position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer;
}

.painel-hdr-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px 10px; gap: 12px;
}
.painel-titulo {
  font-size: .95rem; font-weight: 800;
  color: var(--brown-dark); display: flex; align-items: center; gap: 7px;
  flex-shrink: 0;
}
.painel-titulo i { color: var(--brown-mid); font-size: .88rem; }

/* Segmented control (pill) */
.seg-control {
  display: flex; background: var(--bg);
  border: 1px solid var(--border); border-radius: var(--r-full);
  padding: 3px; gap: 2px;
}
.seg-btn {
  padding: 5px 14px; border-radius: var(--r-full);
  font-size: .74rem; font-weight: 700; color: var(--muted);
  cursor: pointer; background: transparent; border: none;
  transition: all .18s; white-space: nowrap;
  display: flex; align-items: center; gap: 5px;
}
.seg-btn.active {
  background: var(--brown-dark); color: var(--cream);
  box-shadow: 0 1px 4px rgba(61,31,7,.25);
}
.seg-badge {
  background: var(--green); color: #fff;
  font-size: .58rem; font-weight: 800;
  border-radius: 10px; padding: 1px 5px; line-height: 1.4;
}

/* Chips de período — linha abaixo sem margem extra */
.painel-filtros { border-bottom: 1px solid var(--border); }

/* Linha com chips + botão de calendário */
.filtro-linha { display: flex; align-items: center; gap: 0; }

.painel-chips {
  display: flex; gap: 6px; overflow-x: auto;
  padding: 0 12px 10px 16px;
  scrollbar-width: none; flex: 1;
}
.painel-chips::-webkit-scrollbar { display: none; }
.pchip {
  flex-shrink: 0; padding: 5px 13px;
  border-radius: var(--r-full); border: 1.5px solid var(--border);
  background: var(--surface); font-size: .72rem; font-weight: 700;
  color: var(--muted); cursor: pointer; white-space: nowrap;
  transition: all .15s;
}
.pchip.active {
  background: var(--brown); color: #fff;
  border-color: var(--brown);
  box-shadow: 0 2px 6px rgba(61,31,7,.18);
}

/* Botão calendário */
.btn-intervalo {
  flex-shrink: 0; width: 36px; height: 36px; margin-right: 10px; margin-bottom: 10px;
  border-radius: var(--r-sm); border: 1.5px solid var(--border);
  background: var(--surface); color: var(--muted);
  display: flex; align-items: center; justify-content: center;
  font-size: .85rem; cursor: pointer; transition: all .15s;
  position: relative;
}
.btn-intervalo.active { border-color: var(--brown); color: var(--brown); background: var(--gold-bg); }
.intervalo-dot {
  position: absolute; top: 3px; right: 3px; width: 6px; height: 6px;
  border-radius: 50%; background: var(--brown);
}

/* Painel de filtro por datas */
.filtro-datas {
  padding: 10px 16px 14px;
  background: var(--bg);
  border-top: 1px solid var(--border);
}
.filtro-datas-row { display: flex; gap: 8px; align-items: flex-end; }
.filtro-campo { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.filtro-label { font-size: .65rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
.filtro-input {
  padding: 7px 10px; border-radius: var(--r-sm);
  border: 1.5px solid var(--border); background: var(--surface);
  color: var(--text); font-size: .78rem; font-weight: 600;
  width: 100%; outline: none; transition: border .15s;
}
.filtro-input:focus { border-color: var(--brown); }
.btn-aplicar {
  width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--r-sm);
  background: var(--brown); color: #fff; border: none;
  display: flex; align-items: center; justify-content: center;
  font-size: .85rem; cursor: pointer; transition: opacity .15s;
}
.btn-aplicar:disabled { opacity: .4; cursor: default; }
.btn-limpar {
  width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--r-sm);
  background: var(--bg); color: var(--muted);
  border: 1.5px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: .85rem; cursor: pointer;
}
.filtro-aviso {
  margin-top: 8px; font-size: .7rem; color: var(--brown-mid);
  font-weight: 600; display: flex; align-items: center; gap: 5px;
}

/* Transição slide-down */
.slide-down-enter-active, .slide-down-leave-active { transition: all .22s ease; overflow: hidden; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
.slide-down-enter-to, .slide-down-leave-from { opacity: 1; max-height: 200px; }

.painel-content { padding: 12px 16px 100px; display: flex; flex-direction: column; gap: 12px; }

/* ── Colapsável ── */
.collapsible-trigger { cursor: pointer; user-select: none; }
.collapsible-trigger:active { opacity: 0.7; }

.sec-chevron {
  margin-left: auto;
  color: var(--muted);
  font-size: .7rem;
  transition: transform .22s ease;
  flex-shrink: 0;
}
.sec-chevron.open { transform: rotate(180deg); }
/* ──────────────── */

.meta-info { display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px; }
.meta-atual { font-size: 1.15rem; font-weight: 800; font-family: var(--mono); }
.meta-sep { font-size: 0.8rem; color: var(--border2); font-weight: 500; }
.meta-alvo { font-size: 0.85rem; color: var(--muted); font-weight: 600; font-family: var(--mono); }
.meta-bar-bg { height: 10px; background: var(--bg); border-radius: 5px; overflow: hidden; border: 1px solid var(--border); }
.meta-bar-fill { height: 100%; border-radius: 5px; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

.projecao-tag {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--green-bg);
  border-radius: var(--r-sm);
  font-size: 0.72rem;
  color: var(--green);
  display: flex;
  align-items: center;
  gap: 6px;
}

.kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.kpi-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
  padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
}
.kpi-destaque { background: var(--gold-bg); border-color: var(--gold); }
.kpi-lbl { font-size: .62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: .5px; }
.kpi-val { font-size: 1.08rem; font-weight: 800; font-family: var(--mono); color: var(--brown-dark); }
.kpi-val small { font-size: .7rem; font-weight: 400; }

.bloco-titulo {
  font-size: .68rem; font-weight: 800; text-transform: uppercase;
  color: var(--muted); letter-spacing: .5px; display: flex; align-items: center; gap: 6px;
}
.bloco-periodo { font-weight: 400; font-size: .65rem; margin-left: auto; color: var(--muted); text-transform: none; letter-spacing: 0; }

.rank-row {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-bottom: 1px solid var(--border);
}
.rank-row:last-child { border-bottom: none; }
.rank-pos { width: 18px; text-align: center; font-size: .78rem; font-weight: 800; flex-shrink: 0; }
.rp-1 { color: #c9920c; }
.rp-2 { color: #9e9e9e; }
.rp-3 { color: #a0673a; }
.rp-n { color: var(--muted); }
.rank-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.rank-nome { font-size: .84rem; font-weight: 700; color: var(--brown-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-bar-bg { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.rank-bar-fill { height: 100%; border-radius: 2px; transition: width .5s ease; }
.rank-nums { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.rank-qtd { font-size: .7rem; color: var(--muted); font-weight: 600; }
.rank-lucro { font-size: .82rem; font-weight: 800; font-family: var(--mono); }

.cat-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.cat-row:last-child { margin-bottom: 0; }
.cat-nome { font-size: .78rem; font-weight: 700; color: var(--brown); width: 72px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cat-bar-bg { flex: 1; height: 7px; background: var(--border); border-radius: 4px; overflow: hidden; }
.cat-bar-fill { height: 100%; border-radius: 4px; transition: width .5s ease; }
.cat-val { font-size: .7rem; font-weight: 800; color: var(--muted); width: 38px; text-align: right; flex-shrink: 0; }

.atalho-inteligencia {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
  cursor: pointer; width: 100%; text-align: left; transition: background .15s;
}
.atalho-inteligencia:active { background: var(--bg); }
.ai-ico {
  width: 36px; height: 36px; border-radius: var(--r-sm); flex-shrink: 0;
  background: var(--brown-dark); color: var(--cream);
  display: flex; align-items: center; justify-content: center; font-size: .9rem;
}
.ai-body { flex: 1; }
.ai-titulo { font-size: .84rem; font-weight: 800; color: var(--brown-dark); }
.ai-sub { font-size: .68rem; color: var(--muted); margin-top: 1px; }
.ai-arrow { color: var(--muted); font-size: .8rem; }

.lista-wrap { padding: 12px 16px 100px; display: flex; flex-direction: column; gap: 10px; }

.lc-ctx {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
}
.lc-ctx-info { font-size: .74rem; color: var(--muted); display: flex; align-items: center; gap: 7px; flex: 1; }
.lc-ctx-info i { color: var(--brown-light); flex-shrink: 0; }
.lc-ctx-right { text-align: right; flex-shrink: 0; }
.lc-ctx-lbl { font-size: .58rem; text-transform: uppercase; font-weight: 800; color: var(--muted); letter-spacing: .4px; display: block; }
.lc-ctx-val { font-size: .95rem; font-weight: 800; color: var(--green); font-family: var(--mono); }
.lc-aviso {
  display: flex; gap: 8px; padding: 10px 12px; background: var(--gold-bg);
  border: 1px solid #e8d5a0; border-radius: var(--r-sm); font-size: .72rem; color: var(--gold-dark); line-height: 1.4;
}
.lc-lista { display: flex; flex-direction: column; gap: 6px; }
.lc-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
  cursor: pointer; transition: opacity .15s;
}
.lc-checked { opacity: .45; }
.lc-ico-on { font-size: 1.1rem; color: var(--green); flex-shrink: 0; }
.lc-ico-off { font-size: 1.1rem; color: var(--border); flex-shrink: 0; }
.lc-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.lc-nome { font-size: .87rem; font-weight: 700; color: var(--brown-dark); }
.lc-nome.riscado { text-decoration: line-through; }
.lc-sub { font-size: .63rem; color: var(--muted); }
.lc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.lc-qtd { font-size: .87rem; font-weight: 800; font-family: var(--mono); color: var(--brown-dark); }
.lc-custo { font-size: .68rem; font-weight: 700; color: var(--green); font-family: var(--mono); }
.lc-ctx-sub { font-size: .58rem; color: var(--muted); display: block; text-align: right; margin-top: 1px; }
.lc-custo-row { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.lc-preco-btn { background: none; border: none; cursor: pointer; color: var(--muted); font-size: .58rem; padding: 2px 3px; border-radius: 3px; opacity: 0; transition: opacity .15s; }
.lc-item:hover .lc-preco-btn { opacity: 1; }
.lc-preco-edit { display: flex; align-items: center; gap: 2px; background: var(--bg); border: 1.5px solid var(--brown); border-radius: var(--r-sm); padding: 2px 5px; }
.lc-preco-prefix { font-size: .65rem; color: var(--muted); font-weight: 700; }
.lc-preco-input { width: 52px; border: none; background: transparent; font-size: .75rem; font-weight: 800; font-family: var(--mono); color: var(--brown-dark); outline: none; text-align: right; }
.lc-preco-ok { background: var(--brown); color: #fff; border: none; border-radius: 3px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: .55rem; cursor: pointer; flex-shrink: 0; }
/* item embalagem */
.lc-sub-row { display: flex; flex-direction: column; gap: 2px; }
.lc-emb {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .65rem; font-weight: 700; color: var(--brown);
  background: var(--cream); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 1px 6px;
}
.lc-emb i { font-size: .6rem; color: var(--brown-light); }
.lc-emb-detalhe { font-weight: 400; color: var(--muted); }

/* Rodapé discreto */
.lc-footer {
  margin-top: 4px; padding: 10px 0 0;
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 8px;
}
.lc-footer-top {
  display: flex; align-items: center; justify-content: space-between;
}
.lc-prog-inline {
  display: flex; align-items: center; gap: 6px;
  font-size: .68rem; font-weight: 700; color: var(--muted);
}
.lc-prog-dots { display: flex; gap: 3px; align-items: center; }
.lc-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--border); transition: background .2s;
  flex-shrink: 0;
}
.lc-dot-on { background: var(--green); }
.btn-txt-sm {
  font-size: .7rem; color: var(--muted); background: none; border: none;
  cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 0;
}
.btn-txt-sm:hover { color: var(--brown); }
.lc-share-btns { display: flex; gap: 8px; }
.lc-share-btns .btn { flex: 1; font-size: .76rem; }

/* Nome row com botão de histórico */
.lc-nome-row { display: flex; align-items: center; gap: 5px; }
.lc-hist-btn { background: none; border: none; cursor: pointer; color: var(--muted); font-size: .6rem; padding: 2px 3px; border-radius: 3px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.lc-item:hover .lc-hist-btn { opacity: 1; }

/* Stepper */
.lc-stepper { display: flex; align-items: center; gap: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 3px 4px; }
.lc-step-btn { width: 20px; height: 20px; border-radius: 4px; border: none; background: var(--surface); color: var(--brown); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .6rem; flex-shrink: 0; transition: background .15s; }
.lc-step-btn:hover:not(:disabled) { background: var(--brown); color: #fff; }
.lc-step-btn:disabled { opacity: .3; cursor: default; }
.lc-step-val { font-size: .78rem; font-weight: 800; font-family: var(--mono); color: var(--brown-dark); min-width: 44px; text-align: center; line-height: 1; }
.lc-step-val small { font-size: .55rem; font-weight: 400; color: var(--muted); display: block; }

/* Modal de histórico de preços */
.lc-modal { background: var(--surface); border-radius: 18px 18px 0 0; width: 100%; max-width: 520px; max-height: 80vh; overflow-y: auto; box-shadow: 0 -4px 32px rgba(61,31,7,.18); }
.lc-modal-hdr { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 12px; border-bottom: 1px solid var(--border); }
.lc-modal-titulo { font-size: .9rem; font-weight: 800; color: var(--brown-dark); display: flex; align-items: center; gap: 8px; }
.lc-modal-titulo i { color: var(--brown); }
.lc-modal-close { background: none; border: none; font-size: 1rem; color: var(--muted); cursor: pointer; padding: 4px; }
.lc-modal-body { padding: 14px 18px 24px; display: flex; flex-direction: column; gap: 14px; }
.lc-hist-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 0; color: var(--muted); text-align: center; font-size: .8rem; }
.lc-hist-empty i { font-size: 1.8rem; opacity: .4; }
.lc-hist-resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.lc-hist-kpi { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.lc-hist-kpi-lbl { font-size: .58rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: .4px; }
.lc-hist-kpi-val { font-size: .84rem; font-weight: 800; font-family: var(--mono); color: var(--brown-dark); }
.lc-hist-chart-wrap { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 10px; }
.lc-hist-svg { width: 100%; height: 90px; display: block; }
.lc-hist-tabela { display: flex; flex-direction: column; gap: 4px; }
.lc-hist-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); }
.lc-hist-data { font-size: .72rem; color: var(--muted); flex: 1; }
.lc-hist-preco { font-size: .82rem; font-weight: 800; font-family: var(--mono); color: var(--brown-dark); }
.lc-hist-delta { font-size: .7rem; font-weight: 700; width: 14px; text-align: center; }

/* ── Modal de preço ── */
.preco-mode-toggle { display: flex; gap: 6px; }
.preco-mode-btn { flex: 1; padding: 8px 10px; border-radius: var(--r-sm); border: 1.5px solid var(--border); background: var(--bg); font-size: .73rem; font-weight: 700; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all .15s; }
.preco-mode-btn.active { background: var(--brown-dark); color: #fff; border-color: var(--brown-dark); }
.preco-form { display: flex; flex-direction: column; gap: 10px; }
.preco-hint { font-size: .72rem; color: var(--muted); background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px; display: flex; gap: 7px; align-items: flex-start; line-height: 1.4; }
.preco-hint i { color: var(--brown-light); flex-shrink: 0; margin-top: 1px; }
.preco-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.preco-field { display: flex; flex-direction: column; gap: 4px; }
.preco-label { font-size: .65rem; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); }
.preco-input-row { display: flex; align-items: center; background: var(--bg); border: 1.5px solid var(--border); border-radius: var(--r-sm); overflow: hidden; transition: border-color .15s; }
.preco-input-row:focus-within { border-color: var(--brown); }
.preco-prefix, .preco-suffix { padding: 0 8px; font-size: .72rem; font-weight: 700; color: var(--muted); background: var(--surface); border-right: 1px solid var(--border); white-space: nowrap; align-self: stretch; display: flex; align-items: center; }
.preco-suffix { border-right: none; border-left: 1px solid var(--border); }
.preco-input { flex: 1; border: none; background: transparent; padding: 9px 10px; font-size: .88rem; font-weight: 700; font-family: var(--mono); color: var(--brown-dark); outline: none; width: 0; }
.preco-resultado { font-size: .74rem; color: var(--brown); background: var(--cream); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.preco-resultado i { font-size: .7rem; flex-shrink: 0; }
.preco-resultado strong { color: var(--brown-dark); }
.preco-resultado-sec { background: var(--bg); color: var(--muted); }
.mt-12 { margin-top: 4px; }
</style>
