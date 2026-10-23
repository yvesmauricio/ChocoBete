<template>
  <div class="tab-painel">

    <div class="tab-hdr">
      <!-- Linha única: título + segmented control -->
      <div class="tab-hdr-top">
        <h2 class="tab-title">
          <i class="fas fa-chart-pie"></i> Painel
        </h2>
        <div class="tab-actions">
          <div class="seg-control">
            <button class="seg-btn" :class="{ active: aba === 'painel' }" @click="aba = 'painel'">
              Resumo
            </button>
            <button class="seg-btn" :class="{ active: aba === 'lista' }" @click="abrirLista">
              Compras
              <span v-if="listaCompras.length - nChecked > 0" class="seg-badge">{{ listaCompras.length - nChecked }}</span>
            </button>
          </div>
          <button
            v-if="aba === 'painel'"
            class="btn-icon btn-icon-sm filtro-toggle-btn"
            :class="{ active: filtrosAbertos }"
            title="Filtrar por período"
            @click="filtrosAbertos = !filtrosAbertos"
          >
            <i class="fas fa-filter"></i>
            <span v-if="filtroPeriodoAtivo" class="filtro-toggle-dot"></span>
          </button>
        </div>
      </div>
      <!-- Filtro de período — só no painel, parte do mesmo bloco sticky -->
      <Transition name="slide-down">
      <div v-if="aba === 'painel' && filtrosAbertos" class="painel-filtros">
        <!-- Linha: chips de mês + botão datas -->
        <div class="filtro-linha">
          <div ref="periodoStripEl" class="painel-chips">
            <button
              v-for="p in periodosDisponiveis" :key="p.value"
              class="pchip"
              :ref="el => setPeriodoRef(el, p.value)"
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
        <!-- Calendário inline de seleção de intervalo -->
        <Transition name="slide-down">
          <div v-if="mostrarIntervalo" class="cal-wrap">

            <!-- Cabeçalho do calendário -->
            <div class="cal-header">
              <button class="cal-nav" @click="mesCalendario--"><i class="fas fa-chevron-left"></i></button>
              <span class="cal-titulo">{{ labelMesCalendario }}</span>
              <button class="cal-nav" @click="mesCalendario++"><i class="fas fa-chevron-right"></i></button>
            </div>

            <!-- Dias da semana -->
            <div class="cal-semana">
              <span v-for="d in ['D','S','T','Q','Q','S','S']" :key="d+'_'+Math.random()">{{ d }}</span>
            </div>

            <!-- Grid de dias -->
            <div class="cal-grid">
              <span v-for="_ in diasVaziosInicio" :key="'v'+_" class="cal-vazio"></span>
              <button
                v-for="dia in diasDoMes" :key="dia.iso"
                class="cal-dia"
                :class="{
                  'cal-inicio': dia.iso === dataIni,
                  'cal-fim':    dia.iso === dataFim,
                  'cal-entre':  diaNoIntervalo(dia.iso),
                  'cal-hoje':   dia.iso === hoje,
                  'cal-desabilitado': dia.futuro
                }"
                :disabled="dia.futuro"
                @click="selecionarDia(dia.iso)"
              >{{ dia.num }}</button>
            </div>

            <!-- Indicador de seleção / instrução -->
            <div class="cal-status">
              <template v-if="!dataIni">
                <i class="fas fa-hand-pointer"></i> Toque para marcar o início
              </template>
              <template v-else-if="!dataFim">
                <i class="fas fa-hand-pointer"></i> Toque para marcar o fim
                <button class="cal-limpar-mini" @click="dataIni = ''">Cancelar</button>
              </template>
              <template v-else>
                <span class="cal-range-label">
                  {{ fmtDataBR(dataIni) }} → {{ fmtDataBR(dataFim) }}
                </span>
                <button class="cal-limpar-mini" @click="limparIntervalo">Limpar</button>
              </template>
            </div>

          </div>
        </Transition>
      </div>
      </Transition>
    </div>

    <!-- ABA PAINEL -->
    <div v-if="aba === 'painel'" class="painel-content">
      <div v-if="s.loading" class="loading-box"><div class="spinner spinner-sm"></div></div>
      <template v-else>

        <!-- Período em foco (toque para mudar) -->
        <button class="pn-periodo" :aria-expanded="filtrosAbertos" @click="filtrosAbertos = !filtrosAbertos">
          <span class="pn-periodo-ico"><i class="fas fa-calendar-days"></i></span>
          <span class="pn-periodo-txt">
            <small>Mostrando<template v-if="periodoEhAtual"> · mês atual</template></small>
            <strong>{{ periodoTitulo }}</strong>
          </span>
          <span class="pn-periodo-acao">{{ filtrosAbertos ? 'Fechar' : 'Mudar' }} <i class="fas" :class="filtrosAbertos ? 'fa-chevron-up' : 'fa-chevron-down'"></i></span>
        </button>

        <!-- Entradas e saídas (extrato do banco) -->
        <section class="pn-card">
          <header class="pn-card-cab">
            <div class="pn-tile pn-tile--banco"><i class="fas fa-building-columns"></i></div>
            <div class="pn-card-tit">
              <h3>Entradas e saídas</h3>
              <p>Do extrato do banco</p>
            </div>
          </header>

          <template v-if="bancoPeriodo.quantidade">
            <div class="pn-hero" :class="bancoPeriodo.saldo >= 0 ? 'pn-hero--ok' : 'pn-hero--neg'">
              <span class="pn-hero-lbl">{{ bancoPeriodo.saldo >= 0 ? 'Sobrou no período' : 'Faltou no período' }}</span>
              <strong class="pn-hero-valor">{{ R$(bancoPeriodo.saldo) }}</strong>
            </div>

            <div class="pn-duo">
              <div class="pn-duo-item">
                <span class="pn-duo-lbl"><i class="fas fa-circle-arrow-down c-green"></i> Entradas</span>
                <strong class="c-green">{{ R$(bancoPeriodo.entradas) }}</strong>
              </div>
              <div class="pn-duo-item">
                <span class="pn-duo-lbl"><i class="fas fa-circle-arrow-up c-red"></i> Saídas</span>
                <strong class="c-red">{{ R$(bancoPeriodo.saidas) }}</strong>
              </div>
            </div>

            <div class="pn-linhas">
              <div class="pn-linha pn-linha--vendas">
                <span class="pn-linha-lbl">Total de vendas</span>
                <strong class="c-green">{{ R$(bancoPeriodo.vendas) }}</strong>
              </div>
              <div class="pn-linha">
                <span class="pn-linha-lbl">Despesas do negócio</span>
                <strong>{{ R$(bancoPeriodo.saidasOp) }}</strong>
              </div>
              <div class="pn-linha">
                <span class="pn-linha-lbl">Saídas pessoais</span>
                <strong>{{ R$(bancoPeriodo.saidasPes) }}</strong>
              </div>
            </div>
          </template>

          <div v-else class="pn-vazio">
            <i class="fas fa-file-import"></i>
            <strong>Nenhum lançamento neste período</strong>
            <span>Importe o extrato do banco para ver aqui o que entrou e o que saiu.</span>
            <button class="btn btn-secondary btn-sm" @click="s.setTab('financeiro')">Ir para o Financeiro</button>
          </div>
        </section>

        <!-- Produção -->
        <section class="pn-card">
          <header class="pn-card-cab">
            <div class="pn-tile pn-tile--prod"><i class="fas fa-cookie-bite"></i></div>
            <div class="pn-card-tit">
              <h3>Produção</h3>
              <p>{{ stats.totalQtd }} {{ stats.totalQtd === 1 ? 'unidade produzida' : 'unidades produzidas' }}</p>
            </div>
          </header>

          <template v-if="stats.totalQtd || stats.totalVenda">
            <div class="pn-duo">
              <div class="pn-duo-item">
                <span class="pn-duo-lbl">Valor produzido</span>
                <strong>{{ R$(stats.totalVenda) }}</strong>
                <small>a preço de venda</small>
              </div>
              <div class="pn-duo-item">
                <span class="pn-duo-lbl">Gasto para produzir</span>
                <strong class="c-orange">{{ R$(stats.totalCusto) }}</strong>
                <small>custo das receitas</small>
              </div>
            </div>
            <div class="pn-lucro" :class="stats.totalLucro >= 0 ? 'pn-lucro--ok' : 'pn-lucro--neg'">
              <div>
                <span class="pn-lucro-lbl">Lucro estimado</span>
                <small v-if="stats.totalVenda > 0">{{ Math.round((stats.totalLucro / stats.totalVenda) * 100) }}% de margem</small>
              </div>
              <strong>{{ R$(stats.totalLucro) }}</strong>
            </div>
            <p class="pn-nota">Estimativa com base no que foi produzido, não no dinheiro que entrou.</p>
          </template>
          <div v-else class="pn-vazio pn-vazio--leve">
            <span>Nenhuma produção registrada neste período.</span>
          </div>
        </section>

        <!-- Receitas mais produzidas -->
        <section class="pn-bloco">
          <header class="pn-bloco-cab">
            <h3>Receitas mais produzidas</h3>
          </header>
          <div class="pn-card pn-card--lista">
            <div v-if="!stats.topReceitas.length" class="pn-vazio pn-vazio--leve"><span>Sem produções no período.</span></div>
            <div v-for="(item, idx) in stats.topReceitas" :key="item.nome" class="pn-rank">
              <span class="pn-rank-pos" :class="['rp-1', 'rp-2', 'rp-3'][idx] || 'rp-n'">{{ idx + 1 }}</span>
              <div class="pn-rank-corpo">
                <div class="pn-rank-nome">{{ item.nome }}</div>
                <div class="pn-rank-barra">
                  <div class="pn-rank-fill" :style="{ width: Math.round((item.qtd / stats.topReceitas[0].qtd) * 100) + '%', background: margemColor(item) }"></div>
                </div>
              </div>
              <div class="pn-rank-nums">
                <span class="pn-rank-qtd">{{ item.qtd }} <small>{{ item.unidade }}</small></span>
                <span class="pn-rank-lucro" :class="item.lucroTotal >= 0 ? 'c-green' : 'c-red'">{{ R$(item.lucroTotal) }}</span>
              </div>
            </div>
          </div>
        </section>

      </template>
    </div>

    <!-- ABA LISTA DE COMPRAS -->
    <div v-else class="lista-wrap">
      <div v-if="loadingLista" class="loading-box"><div class="spinner spinner-sm"></div></div>
      <template v-else>

        <!-- Barra de contexto compacta -->
        <div class="lc-ctx">
          <div class="proj-badge" title="Ajusta na hora a quantidade dos itens ainda não marcados — o que você já comprou ou adicionou à mão não muda">
            <i class="fas fa-calendar-check"></i>
            <div class="proj-body">
              <span class="proj-label">Previsão</span>
              <div class="proj-trigger">
                <strong>{{ semanasProjecao === 4 ? '1 mês' : semanasProjecao + ' sem' }}</strong>
                <i class="fas fa-chevron-down"></i>
                <select v-model="semanasProjecao" class="proj-hidden-select">
                  <option :value="1">1 semana</option>
                  <option :value="2">2 semanas</option>
                  <option :value="4">1 mês (4 sem)</option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="totalEstimado > 0" class="lc-ctx-right">
            <span class="lc-ctx-lbl">{{ nChecked > 0 ? 'Selecionado' : 'Total est.' }}</span>
            <strong class="lc-ctx-val" :class="nChecked > 0 ? 'c-orange' : ''">
              {{ nChecked > 0 ? R$(totalSelecionado) : R$(totalEstimado) }}
            </strong>
          </div>
          <button class="btn-add-fab" @click="mostrarSeletorItem = true" title="Adicionar item">
            <i class="fas fa-plus"></i>
          </button>
        </div>

        <div v-if="mesesUsados < 2" class="lc-aviso">
          <i class="fas fa-triangle-exclamation"></i>
          Poucos dados — registre mais produções para melhorar a projeção.
        </div>

        <div class="lc-acoes">
          <button class="lc-acao-btn" @click="atualizarSugestoes">
            <i class="fas fa-rotate"></i> Atualizar sugestões
          </button>
          <button class="lc-acao-btn" :disabled="!nChecked" @click="limparComprados">
            <i class="fas fa-broom"></i> Limpar comprados{{ nChecked ? ` (${nChecked})` : '' }}
          </button>
        </div>
        <div v-if="snapshotAntesSugestao" class="lc-desfazer">
          <i class="fas fa-clock-rotate-left"></i>
          <span>Sugestões atualizadas.</span>
          <button @click="desfazerAtualizacao">Desfazer</button>
        </div>

        <div v-if="!listaCompras.length" class="empty-mini mt-16">
          Lista vazia. Toque em <strong>+</strong> para adicionar um item, ou em "Atualizar sugestões" pra puxar da sua produção recente.
        </div>

        <!-- Lista com swipe -->
        <div v-else class="lc-lista">
          <SwipeRow
            v-for="item in listaCompras"
            :key="item.id"
            :rowId="item.id"
            :width="item.origem === 'auto' ? 128 : 64"
          >
            <!-- Conteúdo principal -->
            <!-- Conteúdo principal -->
            <div
              class="lc-item" :class="{ 'lc-checked': item.checked }"
              @click="toggleItemComprado(item)"
              @touchstart.passive="lpStart($event, item)"
              @touchend="lpCancel"
              @touchmove.passive="lpCancel"
              @contextmenu="abrirPrecoComMouse($event, item)"
              title="Botão direito do mouse (ou segurar o dedo) para ajustar o preço"
            >
              <i :class="item.checked ? 'fas fa-circle-check lc-ico-on' : 'far fa-circle lc-ico-off'"></i>

              <div class="lc-item-body">
                <div class="lc-nome-row">
                  <span class="lc-nome" :class="{ riscado: item.checked }">{{ item.nome }}</span>
                  <span v-if="item.origem === 'critico'" class="lc-tag lc-tag-critico" title="Estoque baixo"><i class="fas fa-circle-exclamation"></i></span>
                  <span v-else-if="item.origem === 'manual'" class="lc-tag lc-tag-manual" title="Adicionado manualmente"><i class="fas fa-hand"></i></span>
                </div>
                <span v-if="item.origem === 'auto'" class="lc-sub">sugestão · {{ fmtQ(item.mediaMensal, item.unidade) }}/mês</span>
                <span v-else-if="item.origem === 'critico'" class="lc-sub">estoque baixo · atual {{ fmtQ(item.estoqueAtual, item.unidade) }}</span>
                <span v-else class="lc-sub">adicionado manualmente</span>
              </div>

              <!-- Direita: stepper + custo -->
              <div class="lc-right" @click.stop @touchstart.stop @touchend.stop>
                <template v-if="itemCompraPorValor(item)">
                  <div class="lc-stepper">
                    <button class="lc-step-btn" @click="ajustarValorCompra(item, -5)" :disabled="item.custoEstimado <= 5"><i class="fas fa-minus"></i></button>
                    <span class="lc-step-val">
                      {{ R$(item.custoEstimado) }}
                      <small>peça assim</small>
                    </span>
                    <button class="lc-step-btn" @click="ajustarValorCompra(item, +5)"><i class="fas fa-plus"></i></button>
                  </div>
                </template>
                <template v-else>
                  <div class="lc-stepper">
                    <button class="lc-step-btn" @click="ajustarEmbalagens(item, -1)" :disabled="item.embalagensFinal <= 1"><i class="fas fa-minus"></i></button>
                    <span class="lc-step-val">
                      {{ item.embalagensFinal > 0 ? item.embalagensFinal : 1 }}
                      <small>{{ item.embalagensFinal === 1 ? item.nomeEmb : item.nomeEmbPlural }}</small>
                    </span>
                    <button class="lc-step-btn" @click="ajustarEmbalagens(item, +1)"><i class="fas fa-plus"></i></button>
                  </div>
                  <span v-if="item.custoEstimado > 0" class="lc-custo-label">{{ R$(item.custoEstimado) }}</span>
                </template>
              </div>
            </div>

            <!-- Ações reveladas pelo swipe -->
            <template #actions>
              <button v-if="item.origem === 'auto'" class="sw-btn sw-btn-ignore" @click.stop="ignorarSugestao(item)">
                <i class="fas fa-eye-slash"></i>
                <span>Ocultar</span>
              </button>
              <button class="sw-btn sw-btn-remove" @click.stop="removerItemDaLista(item)">
                <i class="fas fa-trash-alt"></i>
                <span>Remover</span>
              </button>
            </template>
          </SwipeRow>
        </div>


        <!-- Modal: adicionar item manualmente -->
        <Teleport to="body">
        <div v-if="mostrarSeletorItem" class="bottom-sheet-overlay" @click.self="mostrarSeletorItem = false">
          <div class="lc-modal">
            <div class="lc-modal-hdr">
              <span class="lc-modal-titulo"><i class="fas fa-plus"></i> Adicionar item</span>
              <button class="lc-modal-close" @click="mostrarSeletorItem = false"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="lc-modal-body">
              <div class="seletor-busca">
                <i class="fas fa-search"></i>
                <input v-model="buscaSeletorItem" type="text" placeholder="Buscar insumo..." />
              </div>
              <div class="seletor-lista">
                <button v-for="p in produtosParaSeletor" :key="p.uuid" class="seletor-item" @click="adicionarItemNaLista(p)">
                  <span>{{ p.nome }}</span>
                  <i class="fas fa-plus"></i>
                </button>
                <p v-if="!produtosParaSeletor.length" class="hint" style="padding: 16px;">Nenhum insumo encontrado.</p>
              </div>
            </div>
          </div>
        </div>
        </Teleport>
        <ModalCompra
          :modal-preco="modalPreco"
          :fechar-modal-preco="fecharModalPreco"
          :on-preco-emb-input="onPrecoEmbInput"
          :on-frac-valor-input="onFracValorInput"
          :bloquear-letras="bloquearLetras"
          :calc-fracionado="calcFracionado"
          :confirmar-preco-emb="confirmarPrecoEmb"
          :confirmar-preco-frac="confirmarPrecoFrac"
          v-model:modo-preco="modoPreco"
          v-model:preco-emb-input="precoEmbInput"
          v-model:preco-emb-calculado="precoEmbCalculado"
          v-model:frac-valor="fracValor"
          v-model:frac-qtd="fracQtd"
          v-model:frac-resultado="fracResultado"
          v-model:qtd-entrada-input="qtdEntradaInput"
        />

        <!-- Modal historico de precos -->
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
                    <span class="lc-hist-kpi-val">{{ fmtPrecoBase(pbHist(historicoPrecos[historicoPrecos.length-1]), modalHistorico.unidade) }}</span>
                  </div>
                  <div class="lc-hist-kpi" v-if="historicoPrecos.length > 1">
                    <span class="lc-hist-kpi-lbl">Variação</span>
                    <span class="lc-hist-kpi-val" :class="variacaoPreco >= 0 ? 'c-red' : 'c-green'">
                      {{ variacaoPreco >= 0 ? '+' : '' }}{{ variacaoPreco.toFixed(1) }}%
                    </span>
                  </div>
                  <div class="lc-hist-kpi" v-if="historicoPrecos.length > 1">
                    <span class="lc-hist-kpi-lbl">Mínimo</span>
                    <span class="lc-hist-kpi-val">{{ fmtPrecoBase(Math.min(...historicoPrecos.map(pbHist)), modalHistorico.unidade) }}</span>
                  </div>
                  <div class="lc-hist-kpi" v-if="historicoPrecos.length > 1">
                    <span class="lc-hist-kpi-lbl">Máximo</span>
                    <span class="lc-hist-kpi-val">{{ fmtPrecoBase(Math.max(...historicoPrecos.map(pbHist)), modalHistorico.unidade) }}</span>
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
                        :y="90 - (pbHist(h) / maxPrecoHist) * 75"
                        :width="(300 / historicoPrecos.length) - 6"
                        :height="(pbHist(h) / maxPrecoHist) * 75"
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
                  <div v-for="(h, idx) in [...historicoPrecos].reverse()" :key="idx" class="lc-hist-row" style="flex-wrap:wrap;row-gap:3px">
                    <span class="lc-hist-data">{{ fmtDataHist(h.data) }}</span>
                    <span class="lc-hist-qtd" v-if="h.quantidade_comprada">+{{ fmtQ(h.quantidade_comprada, modalHistorico.unidade) }}</span>
                    <span class="lc-hist-preco">{{ fmtPrecoBase(pbHist(h), modalHistorico.unidade) }}</span>
                    <span v-if="idx < historicoPrecos.length - 1" class="lc-hist-delta"
                      :class="pbHist(historicoPrecos[historicoPrecos.length-1-idx]) > pbHist(historicoPrecos[historicoPrecos.length-2-idx]) ? 'c-red' : 'c-green'">
                      {{ pbHist(historicoPrecos[historicoPrecos.length-1-idx]) > pbHist(historicoPrecos[historicoPrecos.length-2-idx]) ? '▲' : '▼' }}
                    </span>
                    <span v-else class="lc-hist-delta" style="opacity:0">·</span>
                    <span style="flex-basis:100%;font-size:.72rem;color:var(--muted)">
                      <template v-if="h.valor_pago > 0">Pago {{ R$(h.valor_pago) }}<template v-if="h.estoque_apos != null"> · </template></template>
                      <template v-if="h.estoque_apos != null">Estoque ficou {{ fmtQ(h.estoque_apos, modalHistorico.unidade) }}</template>
                    </span>
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
        </div>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from '../store.js'
import CategoryFilter from '../components/CategoryFilter.vue'
import { R$, avatarColor, fmtQtd as fmtQ, getMesRef, normalizar, precoBaseHistorico, fmtPrecoBase } from '../utils.js'
import { useTabScroll } from '../composables/useTabScroll.js'
import SwipeRow from '../components/SwipeRow.vue'
import { useSwipe } from '../composables/useSwipe.js'
import ModalCompra from '../components/ModalCompra.vue'
import { montarItemLista, useModalCompra } from '../composables/useModalCompra.js'

const s = useStore()
const { openSwipeId } = useSwipe()
const aba = ref('painel')
const mesAtualRef = (() => {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
})()
const periodoAtivo = ref(mesAtualRef)
const { stripEl: periodoStripEl, setTabRef: setPeriodoRef } = useTabScroll(periodoAtivo)

// ── Calendário de intervalo ─────────────────────────────────
const mostrarIntervalo = ref(false)
const dataIni          = ref('')
const dataFim          = ref('')
const usandoIntervalo  = ref(false)

// ── Cabeçalho colapsável: filtro de período oculto por padrão ──
const filtrosAbertos = ref(false)
const filtroPeriodoAtivo = computed(() =>
  usandoIntervalo.value || periodoAtivo.value !== mesAtualRef
)
// Se já existe um filtro ativo (ex.: ao reabrir a aba), mantém o painel expandido
watch(filtroPeriodoAtivo, ativo => { if (ativo) filtrosAbertos.value = true }, { immediate: true })

const hoje = new Date().toISOString().slice(0, 10)
const mesCalendario = ref(0) // offset em meses a partir do mês atual

const labelMesCalendario = computed(() => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + mesCalendario.value)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
})

const diasVaziosInicio = computed(() => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + mesCalendario.value)
  return d.getDay() // 0=dom
})

const diasDoMes = computed(() => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + mesCalendario.value)
  const ano = d.getFullYear()
  const mes = d.getMonth()
  const total = new Date(ano, mes + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => {
    const num = i + 1
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(num).padStart(2, '0')}`
    return { num, iso, futuro: iso > hoje }
  })
})

function diaNoIntervalo(iso) {
  if (!dataIni.value || !dataFim.value) return false
  return iso > dataIni.value && iso < dataFim.value
}

function fmtDataBR(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function selecionarDia(iso) {
  if (!dataIni.value || (dataFim.value)) {
    // Primeiro clique (ou reinício)
    dataIni.value = iso
    dataFim.value = ''
    usandoIntervalo.value = false
  } else {
    // Segundo clique
    if (iso < dataIni.value) {
      dataFim.value = dataIni.value
      dataIni.value = iso
    } else {
      dataFim.value = iso
    }
    usandoIntervalo.value = true
  }
}

const toggleIntervalo = () => {
  mostrarIntervalo.value = !mostrarIntervalo.value
}

const selecionarPeriodo = (val) => {
  periodoAtivo.value = val
  usandoIntervalo.value = false
  dataIni.value = ''
  dataFim.value = ''
}

const limparIntervalo = () => {
  usandoIntervalo.value = false
  dataIni.value = ''
  dataFim.value = ''
  mostrarIntervalo.value = false
}

const periodosDisponiveis = computed(() => {
  const mesesSet = new Set([mesAtualRef]) // mês corrente sempre disponível, mesmo sem produção ainda
  s.producoes.forEach(p => { const m = getMesRef(p.data_producao); if (m) mesesSet.add(m) })
  const mesesOrd = Array.from(mesesSet).sort((a, b) => {
    const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/')
    return `${yb}${mb}`.localeCompare(`${ya}${ma}`)
  }).slice(0, 6)
  return [
    ...mesesOrd.map(m => ({ value: m, label: m === mesAtualRef ? `${m} (atual)` : m })),
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
// Carrega a lista de compras salva assim que o Painel abre, em segundo
// plano, sem trocar de aba — é o que faz o número aparecer no seletor sem
// precisar clicar em "Compras" antes.
onMounted(carregarListaSalva)

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

const producoesFinanceiras = computed(() =>
  producoesFiltradas.value.filter(p => p.gerar_financeiro !== false)
)

const stats = computed(() => {
  let totalQtd = 0, totalCusto = 0, totalVenda = 0
  const catMap = {}, recMap = {}

  producoesFinanceiras.value.forEach(p => {
    const r = s.receitas.find(rec => rec.uuid === p.receita_id)
    if (!r) return
    const qtd = p.quantidade_produzida || 0
    if (!r.eh_intermediaria) {
      totalQtd += qtd
    }
  })

  producoesFinanceiras.value.forEach(p => {
    const r = s.receitas.find(rec => rec.uuid === p.receita_id)
    if (!r) return
    const qtd = p.quantidade_produzida || 0
    const cu = p.custo_snapshot_version >= 2 && p.custo_unitario_snapshot != null
      ? p.custo_unitario_snapshot
      : s.getCustoProducaoReceita(r, qtd, p.tempo_real_min || null) / (qtd || 1)
    const pu = p.preco_unitario_snapshot ?? (r.preco_sugerido || 0)

    if (!r.eh_intermediaria) {
      totalCusto += cu * qtd; totalVenda += pu * qtd
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

// ── Entradas e saídas do banco no período escolhido ──
// Mesma regra do Financeiro › Mensal (resumoFinanceiroPorMes na loja), só que
// para qualquer período do filtro: mês, 7/30 dias, "Tudo" ou intervalo de datas.
const financeiroFiltrado = computed(() => {
  const todos = s.financeiro || []
  const dataDe = (item) => {
    const d = String(item.data || '')
    return new Date(d.length === 10 ? d + 'T00:00:00' : d)
  }
  if (usandoIntervalo.value && dataIni.value && dataFim.value) {
    const ini = new Date(dataIni.value + 'T00:00:00')
    const fim = new Date(dataFim.value + 'T23:59:59')
    return todos.filter(i => { const d = dataDe(i); return d >= ini && d <= fim })
  }
  const val = periodoAtivo.value
  if (val === 'total') return todos
  if (val === '7dias' || val === '30dias') {
    const limite = new Date()
    limite.setDate(limite.getDate() - (val === '7dias' ? 7 : 30))
    return todos.filter(i => dataDe(i) >= limite)
  }
  return todos.filter(i => (i.mes_ref || getMesRef(i.data)) === val)
})

const bancoPeriodo = computed(() => {
  let entradas = 0, vendas = 0, saidasOp = 0, saidasPes = 0, quantidade = 0
  financeiroFiltrado.value.forEach(item => {
    if (item.natureza === 'interna') return // transferência entre contas não conta
    const valor = Number(item.valor || 0)
    quantidade++
    if (item.natureza === 'entrada') {
      entradas += valor
      if (item.categoria !== 'Rendimento Financeiro') vendas += valor
    } else if (item.natureza === 'operacional') {
      saidasOp -= valor
    } else if (item.natureza === 'pessoal') {
      if (valor > 0) entradas += valor
      else saidasPes += Math.abs(valor)
    }
  })
  const saidas = saidasOp + saidasPes
  return { entradas, vendas, saidasOp, saidasPes, saidas, saldo: entradas - saidas, quantidade }
})

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const periodoTitulo = computed(() => {
  if (usandoIntervalo.value && dataIni.value && dataFim.value) return `${fmtDataBR(dataIni.value)} a ${fmtDataBR(dataFim.value)}`
  const v = periodoAtivo.value
  if (v === 'total') return 'Todo o período'
  if (v === '7dias') return 'Últimos 7 dias'
  if (v === '30dias') return 'Últimos 30 dias'
  const m = /^(\d{2})\/(\d{4})$/.exec(v)
  if (m) { const n = NOMES_MES[Number(m[1]) - 1] || m[1]; return `${n.charAt(0).toUpperCase() + n.slice(1)} de ${m[2]}` }
  return periodoLabel.value
})
const periodoEhAtual = computed(() => !usandoIntervalo.value && periodoAtivo.value === mesAtualRef)

// ── Meta de Retirada: mesma fonte de verdade do Financeiro (extrato bancário real) ──
// A meta é sempre calculada por mês fechado no banco. Se o período selecionado no
// Painel for um mês específico (MM/YYYY), usa ele; senão (Total, 7/30 dias, intervalo
// customizado) cai no mês atual, que é a referência mais útil pra "quanto posso tirar".
const mesRefMeta = computed(() =>
  /^\d{2}\/\d{4}$/.test(periodoAtivo.value) ? periodoAtivo.value : mesAtualRef
)

const dadosMesMeta = computed(() =>
  s.resumoProducaoPorMes.find(m => m.mes_ref === mesRefMeta.value) || null
)

const metaSalario = computed(() => s.metaSalarioEm(mesRefMeta.value))
const reservaGiroMeta = computed(() => s.reservaGiroEm(mesRefMeta.value))

const retiradaSegura = computed(() => {
  if (!dadosMesMeta.value) return 0
  return dadosMesMeta.value.receitas_reais_banco - dadosMesMeta.value.despesas_reais_banco - reservaGiroMeta.value
})

const metaPct = computed(() => {
  if (metaSalario.value <= 0) return 0
  return Math.max(0, (retiradaSegura.value / metaSalario.value) * 100)
})

const projecaoMes = computed(() => {
  // Só projeta pro mês atual em andamento (mês fechado não tem o que projetar)
  if (mesRefMeta.value !== mesAtualRef) return null

  const agora = new Date()
  const dia = agora.getDate()
  const totalDias = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()

  if (dia === 0 || retiradaSegura.value <= 0) return null
  return (retiradaSegura.value / dia) * totalDias
})

function margemColor(item) {
  if (item.margem >= 50) return 'var(--green)'
  if (item.margem >= 30) return 'var(--gold)'
  return 'var(--orange)'
}

// Lista de Compras
const IGNORED_KEY = 'lc_ignored_ids'
const ignoredIds = ref(new Set(JSON.parse(localStorage.getItem(IGNORED_KEY) || '[]')))

function ignorarSugestao(item) {
  openSwipeId.value = null
  ignoredIds.value.add(item.id)
  localStorage.setItem(IGNORED_KEY, JSON.stringify([...ignoredIds.value]))
  listaCompras.value = listaCompras.value.filter(i => i.id !== item.id)
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
  snapshotAntesSugestao.value = null
  persistirLista()
  s.notify(`"${item.nome}" não será mais sugerido`)
}

const loadingLista = ref(false)
const listaCompras = ref([])
const semanasProjecao = ref(2) // Default para 2 semanas, conforme sua estratégia
const mesesUsados = ref(0)
const totalEstimado = ref(0)
const nChecked = computed(() => listaCompras.value.filter(i => i.checked).length)
const totalSelecionado = computed(() => listaCompras.value.filter(i => i.checked).reduce((acc, i) => acc + i.custoEstimado, 0))

// ── Adicionar item manual / crítico à lista ───────────────────
const mostrarSeletorItem = ref(false)
const buscaSeletorItem = ref('')

const produtosParaSeletor = computed(() => {
  const idsNaLista = new Set(listaCompras.value.map(i => i.id))
  const termo = normalizar(buscaSeletorItem.value)
  return s.produtos
    .filter(p => !idsNaLista.has(p.uuid))
    .filter(p => !termo || normalizar(p.nome).includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome))
})

function adicionarItemNaLista(prod, origem = 'manual') {
  if (listaCompras.value.some(i => i.id === prod.uuid)) return
  const item = montarItemLista(prod, prod.fator_conversao || 1, origem, 0, s)
  listaCompras.value = [item, ...listaCompras.value]
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
  mostrarSeletorItem.value = false
  buscaSeletorItem.value = ''
  snapshotAntesSugestao.value = null
  persistirLista()
}

function removerItemDaLista(item) {
  openSwipeId.value = null
  listaCompras.value = listaCompras.value.filter(i => i.id !== item.id)
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
  snapshotAntesSugestao.value = null
  persistirLista()
}

// A Previsão ajusta na hora a quantidade/custo dos itens automáticos que
// ainda não foram marcados — sem tocar no que você já marcou ou adicionou
// à mão, e sem recarregar nada do banco (por isso não usa "Atualizar
// sugestões" aqui: aquele botão é só pra trazer ingredientes novos que
// ainda não estão na lista).
watch(semanasProjecao, () => {
  let mudou = false
  listaCompras.value = listaCompras.value.map(item => {
    if (item.origem !== 'auto' || item.checked || !item.mediaMensal) return item
    const prod = s.produtos.find(p => p.uuid === item.id)
    if (!prod) return item
    const qtdPorSemana = item.mediaMensal / 4.3
    const qtdSug = (qtdPorSemana * semanasProjecao.value) * 1.1
    mudou = true
    return montarItemLista(prod, qtdSug, 'auto', item.mediaMensal, s)
  })
  if (mudou) {
    totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
    persistirLista()
  }
})

const {
  modalPreco,
  modoPreco,
  precoEmbInput,
  precoEmbCalculado,
  fracValor,
  fracQtd,
  fracResultado,
  qtdEntradaInput,
  abrirModalPreco,
  fecharModalPreco,
  onPrecoEmbInput,
  onFracValorInput,
  bloquearLetras,
  calcFracionado,
  confirmarPrecoEmb,
  confirmarPrecoFrac,
} = useModalCompra({
  onCompraConfirmada: ({ item }) => {
    listaCompras.value = listaCompras.value.filter(i => i.id !== item.id)
    totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
    ignoredIds.value.add(item.id)
    localStorage.setItem(IGNORED_KEY, JSON.stringify([...ignoredIds.value]))
    snapshotAntesSugestao.value = null
    persistirLista()
  }
})

// ── Long press para abrir compra ─────────────────────────────
let _lpTimer = null

function abrirPrecoDoItem(item) {
  // Corrige na hora se o modo "compra por valor" do insumo mudou desde
  // que esse item entrou na lista (senão o modal abriria no modo errado).
  item.compraPorValor = itemCompraPorValor(item)
  persistirLista()
  abrirModalPreco(item)
}

let _ultimoToque = 0
function lpStart(e, item) {
  lpCancel()
  _ultimoToque = Date.now()
  _lpTimer = setTimeout(() => {
    _lpTimer = null
    abrirPrecoDoItem(item)
  }, 500)
}

// Desktop: botão direito faz o mesmo que o toque longo no celular. No
// Android, segurar o dedo também dispara "contextmenu" — por isso ignora se
// houve toque recente (o timer do toque longo já cuida desse caso).
function abrirPrecoComMouse(e, item) {
  if (Date.now() - _ultimoToque < 1500) return
  e.preventDefault()
  abrirPrecoDoItem(item)
}

function lpCancel() {
  if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null }
}

async function abrirLista() {
  aba.value = 'lista'
  // Se nunca gerou nada ainda (lista salva vazia/inexistente), gera a
  // primeira sugestão automaticamente pra não abrir em branco.
  if (!listaCompras.value.length) await atualizarSugestoes()
}

/** Carrega a lista salva (rápido, sem recalcular sugestões) — usado no boot
 *  do Painel só pra alimentar o número do badge. */
/** Sempre confere no cadastro atual do insumo se ele é "por valor" — não
 *  confia só no que ficou gravado no item quando ele entrou na lista, pra
 *  que mudar o insumo depois (Estoque → editar) reflita na hora, mesmo pra
 *  quem já está salvo na lista. */
function itemCompraPorValor(item) {
  const prod = s.produtos.find(p => p.uuid === item.id)
  return prod ? !!prod.compra_por_valor : !!item.compraPorValor
}

function carregarListaSalva() {
  const salva = s.listaComprasSalva
  listaCompras.value = Array.isArray(salva) ? JSON.parse(JSON.stringify(salva)) : []
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
}

/** Persiste o estado atual da lista (chamado depois de qualquer alteração:
 *  marcar, remover, ajustar valor, etc). */
function persistirLista() {
  s.salvarListaComprasLocal(JSON.parse(JSON.stringify(listaCompras.value)))
}

function toggleItemComprado(item) {
  item.checked = !item.checked
  snapshotAntesSugestao.value = null
  persistirLista()
}

// Guarda como a lista estava um passo atrás de "Atualizar sugestões", pra
// dar pra desfazer. Some assim que você mexe em qualquer outra coisa na
// lista (marcar, remover, ajustar) — pra não arriscar desfazer edição por
// cima de edição sem querer.
const snapshotAntesSugestao = ref(null)

function desfazerAtualizacao() {
  if (!snapshotAntesSugestao.value) return
  listaCompras.value = snapshotAntesSugestao.value
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
  persistirLista()
  snapshotAntesSugestao.value = null
  s.notify('Lista voltou ao que estava antes da atualização')
}

/** Recalcula as sugestões (com base na produção recente) e MESCLA na lista
 *  atual — sem apagar o que você já marcou ou ajustou. Isso é o que roda
 *  quando você clica em "Atualizar sugestões", e também na primeira vez que
 *  a lista é aberta (se ainda estiver vazia). */
async function atualizarSugestoes() {
  loadingLista.value = true
  const listaAntesDeAtualizar = JSON.parse(JSON.stringify(listaCompras.value))
  const modoEstoque = s.modoListaCompras === 'estoque'

  // Limpa ignoredIds: remove produtos deletados OU (só no modo estoque) cujo
  // estoque caiu novamente, para que reapareçam na lista. No modo lista quem
  // decide se o item some de vez é você, ao removê-lo — não tem estoque pra
  // "avisar" que acabou de novo.
  if (ignoredIds.value.size > 0) {
    let alterou = false
    for (const id of [...ignoredIds.value]) {
      const p = s.produtos.find(x => x.uuid === id)
      if (!p) { ignoredIds.value.delete(id); alterou = true; continue }
      if (!modoEstoque) continue
      const estoqueAtual = Number(p.estoque_atual || 0)
      const estoqueMinimo = Number(p.estoque_minimo || 0)
      // Libera se zerou ou se voltou abaixo/igual ao mínimo
      if (estoqueAtual <= 0 || (estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo)) {
        ignoredIds.value.delete(id)
        alterou = true
      }
    }
    if (alterou) localStorage.setItem(IGNORED_KEY, JSON.stringify([...ignoredIds.value]))
  }
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

  // Itens que já estão na lista atual (salva) — pra não duplicar nem perder
  // o que já foi marcado/ajustado manualmente.
  const idsJaNaLista = new Set(listaCompras.value.map(i => i.id))

  const nM = mesesComDados.size || 1
  const listaAuto = Object.values(mediaMap).map(ing => {
    const mediaMensal = ing.soma / nM
    const qtdPorSemana = mediaMensal / 4.3
    const qtdSug = (qtdPorSemana * semanasProjecao.value) * 1.1
    const prod = s.produtos.find(p => p.uuid === ing.id)
    if (!prod) return null
    // Não sugere se já foi comprado/ignorado neste ciclo, nem se já está
    // na lista atual (evita sobrescrever o que você já ajustou)
    if (ignoredIds.value.has(prod.uuid)) return null
    if (idsJaNaLista.has(prod.uuid)) return null
    if (!modoEstoque) {
      // Modo lista (padrão): não depende de quantidade em mãos — mostra
      // sempre o que a produção recente consome, pra planejamento e custo.
      return montarItemLista(prod, qtdSug, 'auto', mediaMensal, s)
    }
    // Modo estoque: só sugere o que falta considerando o que já tem guardado
    const estoqueAtual = Number(prod.estoque_atual || 0)
    if (estoqueAtual <= 0) return montarItemLista(prod, qtdSug, 'auto', mediaMensal, s)
    if (estoqueAtual >= qtdSug) return null
    return montarItemLista(prod, qtdSug, 'auto', mediaMensal, s)
  }).filter(Boolean)

  // Críticos: só existe no modo estoque (depende de estoque_atual/mínimo,
  // que no modo lista não é mantido em dia).
  const idsAuto = new Set(listaAuto.map(i => i.id))
  const criticos = !modoEstoque ? [] : s.produtos
    .filter(p => {
      if (idsJaNaLista.has(p.uuid)) return false
      const estoqueAtual = Number(p.estoque_atual || 0)
      const estoqueMinimo = Number(p.estoque_minimo || 0)
      const abaixoDoMinimo = estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo
      const estouZerado  = estoqueAtual <= 0
      return (abaixoDoMinimo || estouZerado) &&
             !idsAuto.has(p.uuid) &&
             !ignoredIds.value.has(p.uuid)
    })
    .map(p => {
      const item = montarItemLista(p, p.estoque_minimo || 1, 'critico', 0, s)
      item.estoqueAtual = p.estoque_atual || 0
      item.estoqueMinimo = p.estoque_minimo || 0
      return item
    })

  // Mescla: mantém tudo que já estava salvo (marcado ou não) + acrescenta
  // as novas sugestões que ainda não estavam na lista.
  const lista = [...listaCompras.value, ...criticos, ...listaAuto]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  listaCompras.value = lista
  totalEstimado.value = lista.reduce((acc, i) => acc + i.custoEstimado, 0)
  loadingLista.value = false
  persistirLista()
  // Só oferece desfazer se a atualização realmente trouxe algo novo
  snapshotAntesSugestao.value = (criticos.length + listaAuto.length) > 0 ? listaAntesDeAtualizar : null
  s.notify('Sugestões atualizadas')
}

/** Remove da lista os itens já marcados como comprados — pra "fechar" a
 *  compra depois de voltar do mercado e começar a próxima do zero. */
function limparComprados() {
  const qtd = listaCompras.value.filter(i => i.checked).length
  if (!qtd) { s.notify('Nenhum item marcado ainda'); return }
  listaCompras.value = listaCompras.value.filter(i => !i.checked)
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
  snapshotAntesSugestao.value = null
  persistirLista()
  s.notify(`${qtd} item(ns) comprado(s) removido(s) da lista`)
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
    item.custoEstimado = (item.custoPorEmbalagem || 0) > 0
      ? novo * item.custoPorEmbalagem
      : item.custoEstimado * (novo / (item.embalagens || 1))
  }
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
  snapshotAntesSugestao.value = null
  persistirLista()
}

// Ajuste pra itens "compra por valor" (ex.: "peça R$ 30 de banana passa") —
// aqui o que o usuário controla é o valor em reais, não a quantidade em
// gramas, então o stepper mexe direto no custoEstimado em passos de R$5.
function ajustarValorCompra(item, delta) {
  const novoValor = Math.max(5, Math.round((item.custoEstimado || 0) + delta))
  item.custoEstimado = novoValor
  totalEstimado.value = listaCompras.value.reduce((acc, i) => acc + i.custoEstimado, 0)
  snapshotAntesSugestao.value = null
  persistirLista()
}

// Histórico de preços
const modalHistorico = ref(null)
const historicoPrecos = ref([])
const loadingHistorico = ref(false)
// Preço por unidade-base (R$/g → exibido como R$/kg) — comparável entre compras
const pbHist = (h) => precoBaseHistorico(h, modalHistorico.value)
const variacaoPreco = computed(() => {
  if (historicoPrecos.value.length < 2) return 0
  const primeiro = pbHist(historicoPrecos.value[0])
  const ultimo = pbHist(historicoPrecos.value[historicoPrecos.value.length - 1])
  return primeiro > 0 ? ((ultimo - primeiro) / primeiro) * 100 : 0
})
const maxPrecoHist = computed(() =>
  Math.max(...historicoPrecos.value.map(pbHist), 0.000001)
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
</script>

<style scoped>
.tab-painel { display: flex; flex-direction: column; min-height: 100%; }

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

/* Cabeçalho, título e seletor pílula agora usam .tab-hdr/.tab-title/.seg-control
   globais (main.css) — mesmo padrão do resto do app. */

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
/* ── Calendário inline ─────────────────────────────── */
.cal-wrap {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 10px 12px 12px;
}
.cal-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.cal-nav {
  width: 34px; height: 34px; border: none; background: transparent;
  color: var(--brown-mid); font-size: .9rem; border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.cal-nav:active { background: var(--gold-bg); }
.cal-titulo {
  font-size: .82rem; font-weight: 700; color: var(--brown-dark);
  text-transform: capitalize;
}
.cal-semana {
  display: grid; grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.cal-semana span {
  text-align: center; font-size: .65rem; font-weight: 700;
  color: var(--muted); padding: 2px 0;
}
.cal-grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
}
.cal-vazio { aspect-ratio: 1; }
.cal-dia {
  aspect-ratio: 1; border: none; background: transparent;
  font-size: .8rem; font-weight: 500; color: var(--text);
  border-radius: 50%; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: background var(--t), color var(--t);
  position: relative; padding: 0;
}
.cal-dia:active { background: var(--gold-bg); }
.cal-hoje { font-weight: 800; color: var(--brown-mid); }
.cal-hoje::after {
  content: ''; position: absolute; bottom: 2px; left: 50%;
  transform: translateX(-50%); width: 4px; height: 4px;
  border-radius: 50%; background: var(--brown-mid);
}
.cal-entre { background: var(--gold-bg); border-radius: 0; }
.cal-inicio, .cal-fim {
  background: var(--brown-dark) !important;
  color: #fff !important; border-radius: 50% !important;
  font-weight: 700;
}
.cal-desabilitado { opacity: .25; cursor: default; }

.cal-status {
  margin-top: 10px; padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: .75rem; color: var(--muted);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.cal-range-label { font-weight: 600; color: var(--brown-dark); }
.cal-limpar-mini {
  border: none; background: transparent; color: var(--muted);
  font-size: .72rem; font-weight: 600; cursor: pointer;
  text-decoration: underline; padding: 0;
  white-space: nowrap;
}

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
.meta-equacao { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-size: .72rem; color: var(--muted); font-weight: 600; }
.meta-equacao strong { font-family: var(--mono); font-weight: 800; }

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



.rp-1 { color: #c9920c; }
.rp-2 { color: #9e9e9e; }
.rp-3 { color: #a0673a; }
.rp-n { color: var(--muted); }



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

/* ── Barra de ações: atualizar sugestões / limpar comprados ── */
.lc-acoes { display: flex; gap: 8px; margin-top: 10px; }
.lc-acao-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 10px; border: 1.5px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface); color: var(--brown-mid); font-size: .74rem; font-weight: 700;
  cursor: pointer;
}
.lc-acao-btn:active:not(:disabled) { background: var(--cream); }
.lc-acao-btn:disabled { opacity: .45; cursor: default; }

.lc-desfazer {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
  padding: 8px 12px; background: var(--gold-bg); border: 1px solid #e8d5a0; border-radius: var(--r-sm);
  font-size: .76rem; color: var(--brown-mid);
}
.lc-desfazer i { color: var(--brown); flex-shrink: 0; }
.lc-desfazer span { flex: 1; }
.lc-desfazer button {
  background: none; border: none; color: var(--brown-dark); font-weight: 800;
  font-size: .76rem; text-decoration: underline; cursor: pointer; padding: 2px 4px; flex-shrink: 0;
}

/* ── Botão + no ctx bar ── */
.btn-add-fab {
  width: 32px; height: 32px; border-radius: 50%; border: none; flex-shrink: 0;
  background: var(--brown-dark); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: .85rem; cursor: pointer; transition: background .15s;
}
.btn-add-fab:active { background: var(--brown); }

/* ── Lista ── */
.lc-aviso {
  display: flex; gap: 8px; margin: 8px 12px 0; padding: 10px 12px; background: var(--gold-bg);
  border: 1px solid #e8d5a0; border-radius: var(--r-sm); font-size: .72rem; color: var(--gold-dark); line-height: 1.4;
}
.lc-lista { display: flex; flex-direction: column; gap: 0; padding-top: 4px; }

/* Item: altura fixa, sem quebra de linha */
.lc-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; min-height: 56px;
  background: var(--surface); cursor: pointer;
  transition: opacity .15s;
}
.lc-checked { opacity: .4; }
.lc-ico-on { font-size: 1.05rem; color: var(--green); flex-shrink: 0; }
.lc-ico-off { font-size: 1.05rem; color: var(--border); flex-shrink: 0; }

/* Corpo: nome em 1 linha, sub em 1 linha */
.lc-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lc-nome-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
.lc-nome {
  font-size: .85rem; font-weight: 700; color: var(--brown-dark);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lc-nome.riscado { text-decoration: line-through; color: var(--muted); }
.lc-sub {
  font-size: .62rem; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Ícone de tag de origem (pequeno, sem texto) */
.lc-tag { font-size: .65rem; flex-shrink: 0; line-height: 1; }
.lc-tag-critico { color: #d9534f; }
.lc-tag-manual { color: var(--brown-light); }

/* Direita: stepper + botão de custo */
.lc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.lc-stepper { display: flex; align-items: center; gap: 3px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 2px 3px; }
.lc-step-btn { width: 22px; height: 22px; border-radius: 4px; border: none; background: transparent; color: var(--brown); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .6rem; flex-shrink: 0; transition: background .15s; }
.lc-step-btn:active { background: var(--brown); color: #fff; }
.lc-step-btn:disabled { opacity: .3; cursor: default; }
.lc-step-val { font-size: .75rem; font-weight: 800; font-family: var(--mono); color: var(--brown-dark); min-width: 38px; text-align: center; line-height: 1; }
.lc-step-val small { font-size: .52rem; font-weight: 400; color: var(--muted); display: block; }

/* Custo estimado (só leitura, compra via long press) */
.lc-custo-label {
  font-size: .68rem; font-weight: 700; color: var(--green); font-family: var(--mono);
  text-align: right;
}
/* Feedback visual de long press */
.lc-item:active { background: var(--gold-bg); }

/* Rodapé */
.qtd-entrada-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.lc-footer { margin: 4px 12px 0; padding: 10px 0 0; border-top: 1px solid var(--border); }
.lc-footer-top { display: flex; align-items: center; justify-content: space-between; }
.lc-prog-inline { font-size: .68rem; font-weight: 700; color: var(--muted); }
.btn-txt-sm { font-size: .7rem; color: var(--muted); background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 0; }
.btn-txt-sm:active { color: var(--brown); }

/* Botões de swipe */
.sw-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; width: 64px; border: none; cursor: pointer;
  font-size: .6rem; font-weight: 700; color: #fff; padding: 0;
}
.sw-btn i { font-size: .9rem; }
.sw-btn-remove { background: #d9534f; }
.sw-btn-ignore { background: var(--brown-mid); }
.sw-btn-remove:active { background: #b52b27; }
.sw-btn-ignore:active { background: var(--brown-dark); }

/* Modal seletor */
.seletor-busca { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: var(--r-md); margin-bottom: 10px; }
.seletor-busca i { color: var(--muted); font-size: .85rem; }
.seletor-busca input { border: none; outline: none; background: transparent; flex: 1; font-size: .85rem; color: var(--text); }
.seletor-lista { display: flex; flex-direction: column; max-height: 50vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.seletor-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 4px; border: none; border-bottom: 1px solid var(--border); background: transparent; text-align: left; font-size: .85rem; color: var(--text); }
.seletor-item:active { background: var(--gold-bg); }
.seletor-item i { color: var(--brown-mid); font-size: .8rem; flex-shrink: 0; }


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
.preco-label { font-size: .65rem; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.preco-label-sub { font-size: .65rem; color: var(--brown-mid); font-weight: 600; text-transform: none; letter-spacing: 0; }
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

/* ══ Painel › Resumo (classes pn-*) ══ */
.painel-content { gap: 16px; }
.pn-periodo { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); text-align: left; cursor: pointer; }
.pn-periodo:active { background: var(--cream); }
.pn-periodo-ico { width: 40px; height: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: var(--r-md); background: var(--cream); color: var(--brown-mid); }
.pn-periodo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.pn-periodo-txt small { font-size: .76rem; font-weight: 600; color: var(--muted); }
.pn-periodo-txt strong { font-size: 1.02rem; font-weight: 800; color: var(--brown-dark); }
.pn-periodo-acao { flex-shrink: 0; font-size: .82rem; font-weight: 700; color: var(--brown-mid); display: flex; align-items: center; gap: 5px; }
.pn-periodo-acao i { font-size: .65rem; }

.pn-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow-sm); padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; }
.pn-card--lista { padding: 4px 0; gap: 0; overflow: hidden; }
.pn-card-cab { display: flex; align-items: center; gap: 12px; }
.pn-tile { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 14px; font-size: 1.1rem; }
.pn-tile--banco { background: var(--blue-bg); color: var(--blue); }
.pn-tile--prod { background: var(--gold-bg); color: var(--gold-dark); }
.pn-card-tit h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--brown-dark); line-height: 1.25; }
.pn-card-tit p { margin: 1px 0 0; font-size: .82rem; color: var(--muted); }

.pn-hero { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 16px 12px; border-radius: 16px; text-align: center; }
.pn-hero--ok { background: var(--green-bg); color: var(--green); }
.pn-hero--neg { background: var(--red-bg); color: var(--red); }
.pn-hero-lbl { font-size: .86rem; font-weight: 700; }
.pn-hero-valor { font-family: var(--mono); font-size: 2rem; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }

.pn-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pn-duo-item { display: flex; flex-direction: column; gap: 3px; padding: 12px; background: var(--bg); border-radius: 14px; min-width: 0; }
.pn-duo-lbl { font-size: .8rem; font-weight: 700; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.pn-duo-item strong { font-family: var(--mono); font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pn-duo-item small { font-size: .74rem; color: var(--muted); }

.pn-linhas { display: flex; flex-direction: column; }
.pn-linha { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 46px; border-top: 1px solid var(--border); }
.pn-linha:first-child { border-top: none; }
.pn-linha-lbl { font-size: .92rem; font-weight: 600; color: var(--text); }
.pn-linha strong { font-family: var(--mono); font-size: .95rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.pn-linha--vendas .pn-linha-lbl { font-weight: 800; color: var(--brown-dark); }
.pn-linha--vendas strong { font-size: 1.02rem; }

.pn-lucro { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: 16px; }
.pn-lucro--ok { background: var(--green-bg); color: var(--green); }
.pn-lucro--neg { background: var(--red-bg); color: var(--red); }
.pn-lucro > div { display: flex; flex-direction: column; }
.pn-lucro-lbl { font-size: .9rem; font-weight: 800; }
.pn-lucro small { font-size: .76rem; font-weight: 600; opacity: .85; }
.pn-lucro strong { flex-shrink: 0; white-space: nowrap; font-family: var(--mono); font-size: 1.3rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.pn-nota { margin: 0; font-size: .78rem; line-height: 1.45; color: var(--muted); text-align: center; }

.pn-vazio { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 12px 8px; text-align: center; }
.pn-vazio i { font-size: 1.5rem; color: var(--muted); margin-bottom: 2px; }
.pn-vazio strong { font-size: .98rem; color: var(--brown-dark); }
.pn-vazio span { font-size: .84rem; line-height: 1.5; color: var(--muted); }
.pn-vazio .btn { margin-top: 8px; min-height: 44px; }
.pn-vazio--leve { padding: 14px 12px; }

.pn-bloco { display: flex; flex-direction: column; gap: 10px; }
.pn-bloco-cab { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 0 2px; }
.pn-bloco-cab h3 { margin: 0; font-size: 1.02rem; font-weight: 800; color: var(--brown-dark); }
.pn-bloco-cab span { font-size: .8rem; font-weight: 600; color: var(--muted); text-align: right; }

.pn-rank { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--border); }
.pn-rank:first-child { border-top: none; }
.pn-rank-pos { width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: .85rem; font-weight: 800; }
.pn-rank-pos.rp-1 { background: var(--gold); color: #fff; }
.pn-rank-pos.rp-2 { background: var(--border2); color: var(--brown-dark); }
.pn-rank-pos.rp-3 { background: var(--orange-bg); color: var(--orange); }
.pn-rank-pos.rp-n { background: var(--cream); color: var(--muted); }
.pn-rank-corpo { flex: 1; min-width: 0; }
.pn-rank-nome { font-size: .94rem; font-weight: 700; color: var(--brown-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pn-rank-barra { height: 6px; margin-top: 7px; background: var(--cream); border-radius: 3px; overflow: hidden; }
.pn-rank-fill { height: 100%; border-radius: 3px; transition: width .5s ease; }
.pn-rank-nums { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.pn-rank-qtd { font-family: var(--mono); font-size: .95rem; font-weight: 800; color: var(--brown-dark); }
.pn-rank-qtd small { font-family: var(--font); font-size: .72rem; font-weight: 600; color: var(--muted); }
.pn-rank-lucro { font-family: var(--mono); font-size: .8rem; font-weight: 700; }
.pn-periodo:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }

/* Filtro de período: alvos de toque maiores */
.pchip { padding: 0 16px; min-height: 40px; font-size: .84rem; display: inline-flex; align-items: center; }
.btn-intervalo { width: 40px; height: 40px; }
</style>