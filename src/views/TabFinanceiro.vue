<template>
  <div class="tab-financeiro">

    <!-- ── Cabeçalho ───────────────────────────────────── -->
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-money-check-dollar"></i> Financeiro</h2>
        <div class="hdr-actions"></div>
      </div>
      <p class="tab-subtitle">
        Extratos bancários, resumo do negócio e documentos MEI
      </p>

      <!-- ── Navegação de abas ────────────────────────── -->
      <div class="aba-nav">
        <button v-for="aba in abas" :key="aba.id" class="aba-btn"
          :class="{ active: abaAtiva === aba.id }"
          :data-id="aba.id"
          @click="abaAtiva = aba.id">
          <i :class="aba.icon"></i> {{ aba.label }}
        </button>
      </div>
    </div>

    <!-- ═══ ABA: IMPORTAR ═══ -->
    <template v-if="abaAtiva === 'importar'">
      <div class="relatorio-wrap">
        <section class="sheet-card importar-card">
          <div class="sheet-body">
            <div class="section-head">
              <h4><i class="fas fa-file-import"></i> Importar extrato</h4>
              <span class="badge badge-muted">{{ bancosImportacaoDisponiveis.length }} banco(s)</span>
            </div>

            <div v-if="!temAlgumBancoConfigurado" class="empty-mini">
              Cadastre uma conta bancária em Ajustes para importar extratos.
            </div>

            <template v-else>
              <div class="banco-tabs">
                <button v-if="temContasPagbank" class="banco-tab" :class="{ active: bancoImport === 'pagbank' }" @click="bancoImport = 'pagbank'">
                  <i class="fas fa-file-csv"></i> PagBank CSV
                </button>
                <button v-if="temContasItau" class="banco-tab" :class="{ active: bancoImport === 'itau' }" @click="bancoImport = 'itau'">
                  <i class="fas fa-file-pdf"></i> Itaú PDF
                </button>
                <button v-if="temContasBb" class="banco-tab" :class="{ active: bancoImport === 'bb' }" @click="bancoImport = 'bb'">
                  <i class="fas fa-file-csv"></i> BB CSV
                </button>
              </div>
              <div class="importador-panel">
                <ImportadorExtrato v-if="bancoImport === 'pagbank'" @editar-lancamento="abrirModalEdicao" />
                <ImportadorItau v-else-if="bancoImport === 'itau'" />
                <ImportadorBancoBrasil v-else-if="bancoImport === 'bb'" />
              </div>
            </template>

            <div v-if="s.financeiro.length" class="extratos-admin">
              <button class="extratos-admin-toggle" :class="{ active: mostrarExcluirBanco }" @click="mostrarExcluirBanco = !mostrarExcluirBanco">
                <span><i class="fas fa-gear"></i> Gerenciar extratos importados</span>
                <i class="fas" :class="mostrarExcluirBanco ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
              </button>
              <Transition name="fade-slide">
                <div v-if="mostrarExcluirBanco" class="excluir-banco-panel">
                  <div class="excluir-banco-titulo"><i class="fas fa-trash-can"></i> Excluir extrato por banco</div>
                  <div class="excluir-banco-list">
                    <button v-for="b in bancosComLancamentos" :key="b.id" class="excluir-banco-btn" @click="handleExcluirPorBanco(b.id)">
                      <span class="eb-nome">{{ b.label }}</span>
                      <span class="eb-count">{{ b.count }} lançamento(s)</span>
                      <i class="fas fa-chevron-right eb-arrow"></i>
                    </button>
                    <button class="excluir-banco-btn excluir-todos" @click="handleExcluirPorBanco('todos')">
                      <span class="eb-nome">Excluir tudo</span>
                      <span class="eb-count">{{ s.financeiro.length }} lançamento(s)</span>
                      <i class="fas fa-chevron-right eb-arrow"></i>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </section>
      </div>
    </template>

    <template v-else-if="abaAtiva === 'lancamentos'">

      <!-- ── Resumo fixo no topo ── -->
      <div class="resumo-modern" v-if="lancamentosFiltrados.length">
        <div class="rm-item">
          <span class="rm-lbl">Entradas</span>
          <span class="rm-val c-green">{{ R$(totalEntradas) }}</span>
        </div>
        <div class="rm-sep"></div>
        <div class="rm-item">
          <span class="rm-lbl">Saídas</span>
          <span class="rm-val c-red">{{ R$(totalSaidas) }}</span>
        </div>
        <div class="rm-sep"></div>
        <div class="rm-item">
          <span class="rm-lbl">Saldo</span>
          <span class="rm-val" :class="saldoFiltrado >= 0 ? 'c-green' : 'c-red'">{{ R$(saldoFiltrado) }}</span>
        </div>
      </div>

      <!-- ── Barra única: busca + período + filtros ── -->
      <div class="filtros-modern sheet-card">
        <div class="fm-top fm-top-compact">
          <!-- Busca -->
          <div class="fbusca-wrap">
            <i class="fas fa-search fbusca-icon"></i>
            <input v-model.trim="buscaDescricao" class="fbusca-input" type="search" placeholder="Buscar..." />
          </div>

          <!-- Período inline -->
          <div v-if="mesesDisponiveis.length" class="periodo-inline">
            <button class="pnav-mini-btn" :disabled="!temMesMaisNovo" @click="irParaMesMaisNovo"><i class="fas fa-chevron-left"></i></button>
            <div class="pnav-mini-centro">
              <select v-model="filtroMes"><option value="">Todos</option><option v-for="m in mesesDisponiveis" :key="m" :value="m">{{ m }}</option></select>
              <span>{{ filtroMes || 'Todos' }}</span>
            </div>
            <button class="pnav-mini-btn" :disabled="!temMesMaisAntigo" @click="irParaMesMaisAntigo"><i class="fas fa-chevron-right"></i></button>
          </div>

          <!-- Botão filtros avançados -->
          <button class="btn-toggle-filtros" :class="{ active: mostrarFiltrosAvancados }" @click="mostrarFiltrosAvancados = !mostrarFiltrosAvancados">
            <i class="fas fa-sliders"></i>
            <span v-if="filtrosAtivosCount" class="filtros-badge">{{ filtrosAtivosCount }}</span>
          </button>
        </div>

        <!-- Filtros Avançados Colapsáveis (inalterados) -->
        <Transition name="fade-slide">
          <div v-if="mostrarFiltrosAvancados" class="filtros-avancados-sheet">
            <div class="fsec">
              <span class="fsec-lbl">Bancos</span>
              <div class="fchips">
                <button v-for="b in filtrosBanco" :key="b.id" class="fchip" :class="{ active: filtroBanco === b.id }" @click="filtroBanco = b.id">{{ b.label }}</button>
              </div>
            </div>
            <div class="fsec">
              <span class="fsec-lbl">Tipo de Gasto</span>
              <div class="fchips">
                <button class="fchip" :class="{ active: filtroNatureza === 'entrada' }" @click="selecionarNatureza('entrada')">Receitas</button>
                <button class="fchip" :class="{ active: filtroNatureza === 'operacional' }" @click="selecionarNatureza('operacional')">Custos</button>
                <button class="fchip" :class="{ active: filtroNatureza === 'pessoal' }" @click="selecionarNatureza('pessoal')">Pessoal</button>
              </div>
            </div>
            <div class="fsec">
              <span class="fsec-lbl">Categoria</span>
              <button class="fcat-trigger" :class="{ ativo: filtroCategoria }" @click="mostrarFiltroCategorias = !mostrarFiltroCategorias">
                <i class="fas fa-layer-group"></i> {{ filtroCategoria || 'Todas as categorias' }}
              </button>
            </div>
          </div>
        </Transition>

        <!-- Painel de categorias -->
        <Transition name="fade-slide">
          <div v-if="mostrarFiltroCategorias" class="filtro-categoria-sheet">
            <button class="cat-btn cat-btn-todas" :class="{ selected: !filtroCategoria }" @click="selecionarCategoria('')">
              <i class="fas fa-layer-group"></i> <span>Todas</span>
            </button>
            <div v-for="grupo in gruposCategoriasFiltro" :key="grupo.nome" class="grupo">
              <div class="grupo-titulo">{{ grupo.nome }}</div>
              <div class="categoria-grid">
                <button v-for="cat in grupo.categorias" :key="cat.nome" class="cat-btn" :class="{ selected: filtroCategoria === cat.nome }" @click="selecionarCategoria(cat.nome)">
                  <i class="fas" :class="cat.icon"></i> <span>{{ cat.nome }}</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Limpar filtros -->
        <div v-if="filtrosAtivosCount" class="fm-status-bar sheet-card-foot">
          <span class="fm-count">{{ lancamentosFiltrados.length }} lançamentos</span>
          <button class="btn-limpar-modern" @click="limparFiltros">Limpar</button>
        </div>
      </div>

      <!-- Barra de seleção em lote (só aparece quando ativa) -->
      <div v-if="modoSelecao" class="selecao-bar">
        <button class="sel-all-btn" @click="toggleSelecionarTodos">
          <i class="fas" :class="todosSelecionados ? 'fa-square-check' : 'fa-square'"></i>
          {{ todosSelecionados ? 'Desmarcar' : `Todos (${lancamentosFiltrados.length})` }}
        </button>
        <span v-if="selecionados.size" class="sel-count">{{ selecionados.size }} sel.</span>
        <button class="sel-fechar-btn" @click="toggleSelecao"><i class="fas fa-xmark"></i></button>
      </div>

      <!-- Transferências internas: linha discreta, não ocupa espaço grande -->
      <button v-if="transInternasCount && !filtroCategoria"
        class="trans-interna-hint"
        @click="selecionarCategoria('Transferência Interna')">
        <i class="fas fa-arrow-right-arrow-left"></i>
        {{ transInternasCount }} transferência(s) interna(s) oculta(s) — toque para ver
      </button>

      <!-- Vazio -->
      <div v-if="!lancamentosFiltrados.length" class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>Nenhum lançamento encontrado.</p>
        <button v-if="temAlgumBancoConfigurado" class="btn-abrir-import" @click="abaAtiva = 'importar'">
          <i class="fas fa-file-import"></i> Importar extrato
        </button>
      </div>

      <!-- Lista simplificada -->
      <div v-else class="lancamentos-list">
        <FinanceListRow v-for="item in lancamentosFiltrados" :key="item.id"
          :variant="item.natureza"
          :selected="selecionados.has(item.id)"
          :muted="item.natureza === 'interna'"
          class="lancamento-row"
          :class="{
            'row-interna': item.natureza === 'interna',
            'row-operacional': item.natureza === 'operacional',
            'row-pessoal': item.natureza === 'pessoal',
            'row-entrada': item.natureza === 'entrada',
            'row-selected': selecionados.has(item.id)
          }"
          @click="modoSelecao ? toggleItem(item.id) : abrirModalEdicao(item)">

          <!-- Checkbox modo seleção -->
          <div v-if="modoSelecao" class="row-check">
            <i class="fas" :class="selecionados.has(item.id) ? 'fa-square-check' : 'fa-square'"></i>
          </div>

          <div class="row-left">
            <div class="row-title">{{ capitalizarDescricao(item.descricao) }}</div>
            <div class="row-subtitle">
              {{ formatarData(item.data) }}
              <span class="badge">{{ item.categoria }}</span>
              · {{ item.banco === 'itau' ? 'IT' : item.banco === 'bb' ? 'BB' : 'PB' }}
            </div>
          </div>
          <div class="row-right" :class="item.valor >= 0 ? 'green' : 'red'">
            {{ item.valor >= 0 ? '+' : '−' }}{{ R$(Math.abs(item.valor)) }}
          </div>
        </FinanceListRow>
      </div>
    </template>

    <!-- ═══ ABA: MENSAL ═══ -->
    <template v-else-if="abaAtiva === 'mensal'">
      <div class="relatorio-wrap">
        
        <!-- ── Seletor de Período Consolidado Unificado (Linha Única) ── -->
        <div class="filtros-modern sheet-card filtros-mensal-ajuste" style="margin-top:0; margin-bottom:14px">
          <div class="fm-unified-nav">
            <!-- Parte do Ano -->
            <div class="pnav-mini-centro ano-width">
              <select v-model="anoFiltroMensal">
                <option v-for="a in anosDisponiveis" :key="a" :value="a">{{ a }}</option>
              </select>
              <span>{{ anoFiltroMensal }}</span>
            </div>

            <div class="nav-divider"></div>

            <!-- Navegação de Mês -->
            <div class="nav-month-group" v-if="mesesParaFiltroMensal.length">
              <button class="pnav-mini-btn" :disabled="idxMesMensal === 0" @click="irParaMesNovoMensal"><i class="fas fa-chevron-left"></i></button>
              <div class="pnav-mini-centro">
                <select v-model="mesFiltroMensal">
                  <option value="">Ano Inteiro</option>
                  <option v-for="m in mesesParaFiltroMensal" :key="m" :value="m">{{ m }}</option>
                </select>
                <span>{{ mesFiltroMensal || 'Mês' }}</span>
              </div>
              <button class="pnav-mini-btn" :disabled="idxMesMensal === mesesParaFiltroMensal.length - 1" @click="irParaMesAntigoMensal"><i class="fas fa-chevron-right"></i></button>
            </div>
          </div>
        </div>

        <!-- Resumo por banco -->
        <section class="sheet-card">
          <div class="sheet-body">
            <div class="section-head">
              <h4><i class="fas fa-university"></i> Resumo {{ mesFiltroMensal || 'Geral' }}</h4>
            </div>
            <div class="banco-resumo-grid">
              <div class="banco-resumo-card pagbank">
                <div class="banco-nome"><i class="fas fa-mobile-alt"></i> PagBank</div>
                <div class="banco-linha"><span>Receitas PIX</span><strong class="c-green">{{ R$(resumoBancoPagbank.receitas) }}</strong></div>
                <div class="banco-linha"><span>Saídas</span><strong class="c-red">{{ R$(resumoBancoPagbank.saidas) }}</strong></div>
                <div class="banco-linha total"><span>Saldo</span><strong :class="resumoBancoPagbank.saldo >= 0 ? 'c-green' : 'c-red'">{{ R$(resumoBancoPagbank.saldo) }}</strong></div>
              </div>
              <div class="banco-resumo-card itau">
                <div class="banco-nome"><i class="fas fa-landmark"></i> Itaú</div>
                <div class="banco-linha"><span>Receitas PIX</span><strong class="c-green">{{ R$(resumoBancoItau.receitas) }}</strong></div>
                <div class="banco-linha"><span>Saídas</span><strong class="c-red">{{ R$(resumoBancoItau.saidas) }}</strong></div>
                <div class="banco-linha total"><span>Saldo</span><strong :class="resumoBancoItau.saldo >= 0 ? 'c-green' : 'c-red'">{{ R$(resumoBancoItau.saldo) }}</strong></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Cards mensais -->
        <section class="sheet-card" v-if="relatorioMensalFiltrado.length">
          <div class="sheet-body">
            <div class="section-head">
              <h4><i class="fas fa-calendar-days"></i> {{ mesFiltroMensal ? 'Detalhes de ' + mesFiltroMensal : 'Mês a mês · ' + anoFiltroMensal }}</h4>
              <span class="badge badge-muted">{{ relatorioMensalFiltrado.length }} meses</span>
            </div>
            <div class="mei-grid">
              <article v-for="item in relatorioMensalFiltrado" :key="item.mes_ref" class="mei-card">
                <div class="mei-head">
                  <h4>{{ item.mes_ref }}</h4>
                  <span class="badge badge-muted">{{ item.quantidade }}</span>
                </div>
                <div class="mei-line"><span>Receita MEI (Vendas)</span><strong class="c-green">{{ R$(item.receitas_mei) }}</strong></div>
                <div class="mei-line renda-pessoal" v-if="item.outras_entradas_nao_mei">
                  <span><i class="fas fa-hand-holding-heart" style="font-size:.7rem;color:var(--purple)"></i> Outras entradas (não-MEI)</span>
                  <strong class="c-purple">{{ R$(item.outras_entradas_nao_mei) }}</strong>
                </div>
                <div class="mei-line"><span>Rendimento</span><strong>{{ R$(item.rendimento_financeiro) }}</strong></div>
                <div class="mei-line">
                  <span>Entrada Bruta (Banco)</span>
                  <strong class="c-blue">{{ R$(item.entradas) }}</strong>
                </div>
                <div class="mei-line"><span>Despesas operacionais</span><strong class="c-red">{{ R$(item.saidas_operacionais) }}</strong></div>
                <div class="mei-line">
                  <span>Saldo do negócio</span>
                  <strong :class="item.saldo_operacional >= 0 ? 'c-green' : 'c-red'">{{ R$(item.saldo_operacional) }}</strong>
                </div>
                <div class="mei-line highlight-per-capita">
                  <span>Renda Per Capita ({{ s.company.pessoas_familia }} pess.)</span>
                  <strong :class="item.renda_per_capita <= 218 ? 'c-green' : 'c-blue'">{{ R$(item.renda_per_capita) }}</strong>
                </div>
                <div class="mei-line"><span>Retiradas pessoais</span><strong class="c-red">{{ R$(item.saidas_pessoais) }}</strong></div>
                <div class="mei-line total">
                  <span>Sobrou no mês</span>
                  <strong :class="item.saldo_mes >= 0 ? 'c-green' : 'c-red'">{{ R$(item.saldo_mes) }}</strong>
                </div>
              </article>
            </div>
          </div>
        </section>

        <!-- Categorias no ano -->
        <section class="sheet-card">
          <div class="sheet-body">
            <div class="section-head">
              <h4><i class="fas fa-tags"></i> Por categoria · {{ mesFiltroMensal || anoFiltroMensal }}</h4>
              <span class="badge badge-gold">{{ categoriasPorAno.length }}</span>
            </div>
            <div v-if="!categoriasPorAno.length" class="empty-mini">Sem dados para o período.</div>
            <div v-else class="report-list">
              <div v-for="item in categoriasPorAno" :key="item.categoria" class="report-row">
                <div>
                  <div class="report-month">{{ item.categoria }}</div>
                  <div class="report-sub">{{ item.quantidade }} lançamento(s) · {{ item.natureza }}</div>
                </div>
                <strong class="report-value" :class="item.natureza === 'entrada' ? 'c-green' : 'c-red'">{{ R$(item.total) }}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- ═══ ABA: META DE RETIRADA ═══ -->
    <template v-else-if="abaAtiva === 'mao-de-obra'">
      <div class="relatorio-wrap">
        <section class="sheet-card">
          <div class="sheet-body">

            <!-- Cabeçalho: meta + provisão -->
            <div class="mtr-header">
              <div class="mtr-meta-bloco">
                <span class="mtr-label">Meta de retirada</span>
                <strong class="mtr-valor">{{ R$(s.company.meta_salario_mensal) }}</strong>
              </div>
              <div class="mtr-sep"></div>
              <div class="mtr-prov-bloco">
                <span class="mtr-label">Giro de Segurança</span>
                <strong class="mtr-valor c-orange">{{ R$(s.sugestaoProvisionamentoSemanal) }}</strong>
                <span class="mtr-sub">Valor p/ próxima compra de insumos</span>
              </div>
            </div>

            <!-- Lista de meses -->
            <div v-if="s.resumoProducaoPorMes.length" class="mtr-lista">
              <div v-for="mes in s.resumoProducaoPorMes" :key="mes.mes_ref" class="mtr-card">

                <!-- Linha topo: mês + valor de retirada segura -->
                <div class="mtr-card-topo">
                  <span class="mtr-card-mes">{{ mes.mes_ref }}</span>
                  <strong class="mtr-card-retirada" :class="retirSegura(mes) >= (s.company.meta_salario_mensal || 0) ? 'c-green' : retirSegura(mes) > 0 ? 'c-orange' : 'c-red'">
                    {{ R$(Math.max(0, retirSegura(mes))) }}
                  </strong>
                </div>

                <!-- Barra de progresso em relação à meta -->
                <div class="mtr-bar-bg">
                  <div class="mtr-bar-fill"
                    :style="{
                      width: s.company.meta_salario_mensal
                        ? Math.min(100, Math.max(0, retirSegura(mes)) / s.company.meta_salario_mensal * 100) + '%'
                        : '0%',
                      background: retirSegura(mes) >= (s.company.meta_salario_mensal || 0) ? 'var(--green)' : 'var(--accent)'
                    }">
                  </div>
                </div>
                <div class="mtr-bar-pct">
                  {{ s.company.meta_salario_mensal ? Math.round(Math.min(100, Math.max(0, retirSegura(mes)) / s.company.meta_salario_mensal * 100)) : 0 }}% da meta
                </div>

                <!-- Detalhes: equação da retirada -->
                <div class="mtr-equacao">
                  <div class="mtr-eq-item">
                    <span class="mtr-eq-lbl">Vendas</span>
                    <strong class="c-green">{{ R$(mes.receitas_reais_banco) }}</strong>
                  </div>
                  <span class="mtr-eq-op">−</span>
                  <div class="mtr-eq-item">
                    <span class="mtr-eq-lbl">Despesas</span>
                    <strong class="c-red">{{ R$(mes.despesas_reais_banco) }}</strong>
                  </div>
                  <span class="mtr-eq-op">−</span>
                  <div class="mtr-eq-item">
                    <span class="mtr-eq-lbl">Reserva</span>
                    <strong class="c-orange">{{ R$(s.sugestaoProvisionamentoSemanal) }}</strong>
                  </div>
                  <span class="mtr-eq-op">=</span>
                  <div class="mtr-eq-item mtr-eq-result">
                    <span class="mtr-eq-lbl">Retirada segura</span>
                    <strong :class="retirSegura(mes) >= 0 ? 'c-green' : 'c-red'">{{ R$(retirSegura(mes)) }}</strong>
                  </div>
                </div>

                <!-- Indicador de mão de obra (só aparece se horas foram registradas) -->
                <div v-if="mes.total_tempo_horas > 0" class="mtr-labor">
                  <i class="fas fa-clock"></i>
                  <span>{{ mes.total_tempo_horas.toFixed(1) }}h registradas</span>
                  <span class="mtr-labor-sep">·</span>
                  <span :class="mes.valor_hora_real >= s.company.custo_hora_trabalho ? 'c-green' : 'c-red'">
                    {{ R$(mes.valor_hora_real) }}/h real
                  </span>
                  <span class="mtr-labor-meta">(meta {{ R$(s.company.custo_hora_trabalho) }}/h)</span>
                </div>

              </div>
            </div>
            <div v-else class="empty-mini">Nenhum dado financeiro ainda.</div>

            <!-- Explicação do tempo de produção -->
            <div class="mtr-explainer">
              <div class="mtr-exp-title"><i class="fas fa-lightbulb"></i> Para que serve registrar o tempo de produção?</div>
              <div class="mtr-exp-item">
                <strong>Planejar o mês</strong>
                <span>Sabendo quantos minutos cada receita leva, você consegue estimar quantas unidades é possível fazer em um dia ou semana — e se vai dar conta do volume necessário para atingir a meta.</span>
              </div>
              <div class="mtr-exp-item">
                <strong>Medir a saúde do negócio</strong>
                <span>O <em>R$/h real</em> mostra quanto cada hora trabalhada gerou de lucro real (sobra no banco). Se ficar abaixo da sua meta, o volume de vendas precisa subir ou os custos de insumos precisam ser revistos.</span>
              </div>
              <div class="mtr-exp-aviso">
                <i class="fas fa-triangle-exclamation"></i>
                Como nem toda produção é cronometrada, o R$/h real costuma ser maior do que aparece — o que é positivo. A referência principal para retirada sempre é o saldo do banco, não a estimativa de produção.
              </div>
            </div>

          </div>
        </section>
      </div>
    </template>

    <!-- ═══ ABA: ANUAL ═══ -->
    <template v-else-if="abaAtiva === 'anual'">
      <div class="relatorio-wrap">
        <!-- Seletor de ano -->
        <div class="ano-selector-inline">
          <button v-for="a in anosDisponiveis" :key="a" class="ano-btn"
            :class="{ active: anoRelAnual === a }" @click="anoRelAnual = a">{{ a }}</button>
        </div>

        <!-- Totais -->
        <section class="sheet-card">
          <div class="sheet-body">
            <div class="section-head"><h4><i class="fas fa-chart-bar"></i> Resumo {{ anoRelAnual }}</h4></div>
            <div class="anual-totais">
              <div class="anual-item">
                <div class="anual-label">Receita Total MEI</div>
                <div class="anual-valor c-green">{{ R$(totalAnual.receitas) }}</div>
                <div class="anual-sub">PIX de clientes (excl. renda pessoal)</div>
              </div>
              <div class="anual-item" v-if="totalAnual.outras_entradas" style="border-color:var(--purple-bg); background:var(--purple-bg);">
                <div class="anual-label" style="color:var(--purple)">Entradas Não-MEI</div>
                <div class="anual-valor c-purple">{{ R$(totalAnual.outras_entradas) }}</div>
                <div class="anual-sub">Renda pessoal, rendimentos (não conta no faturamento MEI)</div>
              </div>
              <div class="anual-item">
                <div class="anual-label">Despesas Operacionais</div>
                <div class="anual-valor c-red">{{ R$(totalAnual.operacional) }}</div>
                <div class="anual-sub">Insumos, mercado, serviços</div>
              </div>
              <div class="anual-item">
                <div class="anual-label">Saídas Pessoais</div>
                <div class="anual-valor">{{ R$(totalAnual.pessoal) }}</div>
                <div class="anual-sub">Moradia, transferências</div>
              </div>
              <div class="anual-item destaque" :class="totalAnual.saldo >= 0 ? 'positivo' : 'negativo'">
                <div class="anual-label">Saldo Operacional</div>
                <div class="anual-valor" :class="totalAnual.saldo >= 0 ? 'c-green' : 'c-red'">{{ R$(totalAnual.saldo) }}</div>
                <div class="anual-sub">Receita MEI − despesas operacionais</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Gráfico barras CSS -->
        <section class="sheet-card" v-if="relatorioAnualMeses.length">
          <div class="sheet-body">
            <div class="section-head"><h4><i class="fas fa-chart-simple"></i> Evolução mensal</h4></div>
            <div class="grafico-barras">
              <div v-for="item in relatorioAnualMeses" :key="item.mes_ref" class="barra-grupo">
                <div class="barra-labels">
                  <div class="barra entrada" :style="{ height: barraAltura(item.receitas_mei) + 'px' }" :title="'Receita: ' + R$(item.receitas_mei)"></div>
                  <div class="barra saida" :style="{ height: barraAltura(item.saidas_operacionais) + 'px' }" :title="'Saída: ' + R$(item.saidas_operacionais)"></div>
                </div>
                <div class="barra-mes">{{ item.mes_ref.split('/')[0] }}/{{ item.mes_ref.split('/')[1].slice(2) }}</div>
              </div>
            </div>
            <div class="grafico-legenda">
              <span class="leg-entrada"><i class="fas fa-square"></i> Receita MEI</span>
              <span class="leg-saida"><i class="fas fa-square"></i> Saída operacional</span>
            </div>
          </div>
        </section>

        <!-- Tabela mensal -->
        <section class="sheet-card" v-if="relatorioAnualMeses.length">
          <div class="sheet-body">
            <div class="section-head"><h4><i class="fas fa-table"></i> Detalhamento mensal</h4></div>
            <div class="tabela-anual">
              <div class="ta-hdr">
                <span>Mês</span><span>Receita MEI</span><span>Saldo op.</span>
              </div>
              <div v-for="item in relatorioAnualMeses" :key="item.mes_ref" class="ta-row">
                <span class="ta-mes">{{ item.mes_ref }}</span>
                <span class="c-green">{{ R$(item.receitas_mei) }}</span>
                <span :class="item.saldo_operacional >= 0 ? 'c-green' : 'c-red'">{{ R$(item.saldo_operacional) }}</span>
              </div>
            </div>
          </div>
        </section>

        <div v-if="!relatorioAnualMeses.length" class="empty-state">
          <i class="fas fa-chart-bar"></i>
          <p>Sem dados para {{ anoRelAnual }}.</p>
          <button class="btn-abrir-import" @click="abaAtiva = 'importar'">
            <i class="fas fa-file-import"></i> Importar extrato
          </button>
        </div>
      </div>
    </template>

    <!-- ═══ ABA: RELATÓRIOS ═══ -->
    <template v-else-if="abaAtiva === 'relatorios'">
      <div class="relatorio-wrap">

        <!-- ── Seletor tipo relatório ── -->
        <div class="rel-tipo-nav">
          <button class="rel-tipo-btn" :class="{ active: relTipo === 'mensal' }" @click="relTipo = 'mensal'">
            <i class="fas fa-calendar-days"></i> Livro Caixa Mensal
          </button>
          <button class="rel-tipo-btn" :class="{ active: relTipo === 'anual' }" @click="relTipo = 'anual'">
            <i class="fas fa-file-invoice-dollar"></i> Declaração Anual
          </button>
        </div>

        <!-- ══ BARRA TETO MEI ════════════════════════════ -->
        <section class="sheet-card teto-card">
          <div class="sheet-body">
            <div class="teto-header">
              <div>
                <div class="teto-titulo">Faturamento MEI · {{ anoRelatorioAtual }}</div>
                <div class="teto-sub">Limite anual: {{ R$(TETO_MEI_ANUAL) }}</div>
              </div>
              <div class="teto-valor-wrap">
                <div class="teto-valor" :class="percentualTeto >= 90 ? 'c-red' : percentualTeto >= 70 ? 'c-orange' : 'c-green'">
                  {{ R$(faturamentoAnoRel) }}
                </div>
                <div class="teto-pct">{{ percentualTeto.toFixed(1) }}% do teto</div>
              </div>
            </div>
            <div class="teto-barra-wrap">
              <div class="teto-barra-bg">
                <div class="teto-barra-fill"
                  :style="{ width: Math.min(100, percentualTeto) + '%' }"
                  :class="percentualTeto >= 90 ? 'danger' : percentualTeto >= 70 ? 'warning' : 'ok'">
                </div>
                <div class="teto-barra-mark" v-if="percentualTeto < 100" :title="'Faltam ' + R$(TETO_MEI_ANUAL - faturamentoAnoRel)">
                  <span class="teto-falta">Faltam {{ R$(Math.max(0, TETO_MEI_ANUAL - faturamentoAnoRel)) }}</span>
                </div>
              </div>
            </div>
            <div class="teto-alertas" v-if="percentualTeto >= 70">
              <div class="teto-alerta" :class="percentualTeto >= 90 ? 'alerta-danger' : 'alerta-warning'">
                <i class="fas" :class="percentualTeto >= 90 ? 'fa-triangle-exclamation' : 'fa-circle-info'"></i>
                <span v-if="percentualTeto >= 100">Teto MEI atingido. Consulte um contador para regularização.</span>
                <span v-else-if="percentualTeto >= 90">Atenção: mais de 90% do teto atingido. Monitore os próximos recebimentos.</span>
                <span v-else>Mais de 70% do teto utilizado. Fique atento ao limite.</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ══ RELATÓRIO MENSAL — LIVRO CAIXA ══════════════ -->
        <template v-if="relTipo === 'mensal'">
          <section class="sheet-card">
            <div class="sheet-body">
              <div class="section-head">
                <h4><i class="fas fa-calendar-days"></i> Livro Caixa MEI · Mensal</h4>
              </div>

              <div class="report-config-box">
                <div class="report-config-grid">
                  <div class="fg" style="margin:0">
                    <label class="label">Competência</label>
                    <select class="input sm" v-model="relMensalMesRef">
                      <option v-for="m in mesesRelatorio" :key="m.value" :value="m.value">{{ m.label }}</option>
                    </select>
                  </div>
                  <div class="fg" style="margin:0; display: flex; align-items: center">
                    <label class="incluir-pessoal-toggle-modern">
                      <input type="checkbox" v-model="incluirRendasPessoais" />
                      <span>Incluir rendas pessoais</span>
                    </label>
                  </div>
                </div>
                <button class="btn-gerar-large" @click="gerarDocLivroCaixa">
                  <i class="fas fa-file-pdf"></i> Gerar Livro Caixa (PDF)
                </button>
              </div>

              <!-- Cabeçalho formal -->
              <div class="lc-cabecalho" v-if="dadosRelMensal">
                <div class="lc-cb-linha"><span>Contribuinte (MEI):</span><strong>{{ nomeContribuinte }}</strong></div>
                <div class="lc-cb-linha"><span>Competência:</span><strong>{{ relMensalMesRef }}</strong></div>
                <div class="lc-cb-linha"><span>Atividade:</span><strong>Produção e venda de alimentos artesanais</strong></div>
              </div>

              <div v-if="!dadosRelMensal" class="empty-mini">Sem dados para este mês.</div>
              <template v-else>

                <!-- Tabela Receitas -->
                <div class="lc-section-label entrada">↑ RECEITAS / ENTRADAS</div>
                <div class="lc-tabela">
                  <FinanceListRow v-for="item in lancMensalEntradas" :key="item.id" class="lc-row entrada-row" variant="entrada" :interactive="false">
                    <div class="lc-col-top">
                      <span class="lc-badge lc-entrada">{{ item.categoria }}</span>
                      <span class="lc-col-val c-green">{{ R$(item.valor) }}</span>
                    </div>
                    <div class="lc-col-desc">{{ item.descricao }}</div>
                    <div class="lc-col-data">{{ formatarData(item.data) }}</div>
                  </FinanceListRow>
                  <div v-if="!lancMensalEntradas.length" class="lc-vazio">Nenhuma receita neste mês.</div>
                  <div class="lc-total">
                    <span class="lc-total-label">Total Receita MEI (faturamento)</span>
                    <strong class="c-green">{{ R$(dadosRelMensal.receitas_mei) }}</strong>
                  </div>
                </div>

                <!-- Entradas não-MEI (informativo) -->
                <template v-if="lancMensalNaoMei.length">
                  <div class="lc-section-label pessoal">↑ OUTRAS ENTRADAS (não compõem faturamento MEI)</div>
                  <div class="lc-tabela">
                    <FinanceListRow v-for="item in lancMensalNaoMei" :key="item.id" class="lc-row pessoal-row" variant="pessoal" :interactive="false">
                      <div class="lc-col-top">
                        <span class="lc-badge lc-pessoal">{{ item.categoria }}</span>
                        <span class="lc-col-val c-purple">{{ R$(item.valor) }}</span>
                      </div>
                      <div class="lc-col-desc">{{ item.descricao }}</div>
                      <div class="lc-col-data">{{ formatarData(item.data) }}</div>
                    </FinanceListRow>
                    <div class="lc-total pessoal-total">
                      <span class="lc-total-label">Total Outras Entradas</span>
                      <strong class="c-purple">{{ R$(dadosRelMensal.outras_entradas_nao_mei) }}</strong>
                    </div>
                  </div>
                </template>

                <!-- Tabela Despesas Operacionais -->
                <div class="lc-section-label saida">↓ DESPESAS OPERACIONAIS</div>
                <div class="lc-tabela">
                  <FinanceListRow v-for="item in lancMensalSaidasParaDoc" :key="item.id" class="lc-row saida-row" variant="saida" :interactive="false">
                    <div class="lc-col-top">
                      <span class="lc-badge lc-saida">{{ item.categoria }}</span>
                      <span class="lc-col-val c-red">{{ R$(Math.abs(item.valor)) }}</span>
                    </div>
                    <div class="lc-col-desc">{{ item.descricao }}</div>
                    <div class="lc-col-data">{{ formatarData(item.data) }}</div>
                  </FinanceListRow>
                  <div v-if="!lancMensalSaidasParaDoc.length" class="lc-vazio">Nenhuma despesa operacional.</div>
                  <div class="lc-total">
                    <span class="lc-total-label">Total Despesas Operacionais</span>
                    <strong class="c-red">{{ R$(dadosRelMensal.saidas_operacionais) }}</strong>
                  </div>
                </div>

                <!-- Resumo do mês -->
                <div class="lc-resumo">
                  <div class="lc-resumo-linha">
                    <span>Receita MEI bruta</span>
                    <strong class="c-green">{{ R$(dadosRelMensal.receitas_mei) }}</strong>
                  </div>
                  <div class="lc-resumo-linha" v-if="dadosRelMensal.outras_entradas_nao_mei">
                    <span>Outras entradas (não-MEI)</span>
                    <strong class="c-purple">{{ R$(dadosRelMensal.outras_entradas_nao_mei) }}</strong>
                  </div>
                  <div class="lc-resumo-linha">
                    <span>( − ) Despesas operacionais</span>
                    <strong class="c-red">{{ R$(dadosRelMensal.saidas_operacionais) }}</strong>
                  </div>
                  <div class="lc-resumo-linha destaque">
                    <span>= Resultado operacional MEI</span>
                    <strong :class="dadosRelMensal.saldo_operacional >= 0 ? 'c-green' : 'c-red'">
                      {{ R$(dadosRelMensal.saldo_operacional) }}
                    </strong>
                  </div>
                  <div class="lc-resumo-linha sub">
                    <span>Rendimentos financeiros</span>
                    <strong>{{ R$(dadosRelMensal.rendimento_financeiro) }}</strong>
                  </div>
                  <div class="lc-resumo-linha sub">
                    <span>Retiradas pessoais / Pró-labore</span>
                    <strong class="c-red">{{ R$(dadosRelMensal.saidas_pessoais) }}</strong>
                  </div>
                </div>

                <!-- Acumulado do ano -->
                <div class="lc-acumulado">
                  <div class="lc-acum-titulo">Acumulado {{ anoRelatorioAtual }} até {{ relMensalMesRef }}</div>
                  <div class="lc-acum-grid">
                    <div class="lc-acum-item">
                      <span>Faturamento MEI</span>
                      <strong class="c-green">{{ R$(acumuladoAteMes.receitas_mei) }}</strong>
                    </div>
                    <div class="lc-acum-item">
                      <span>Despesas operacionais</span>
                      <strong class="c-red">{{ R$(acumuladoAteMes.saidas_operacionais) }}</strong>
                    </div>
                    <div class="lc-acum-item">
                      <span>Resultado acumulado</span>
                      <strong :class="acumuladoAteMes.saldo_operacional >= 0 ? 'c-green' : 'c-red'">
                        {{ R$(acumuladoAteMes.saldo_operacional) }}
                      </strong>
                    </div>
                    <div class="lc-acum-item">
                      <span>% do teto MEI</span>
                      <strong :class="acumuladoAteMes.pct_teto >= 90 ? 'c-red' : acumuladoAteMes.pct_teto >= 70 ? 'c-orange' : 'c-green'">
                        {{ acumuladoAteMes.pct_teto.toFixed(1) }}%
                      </strong>
                    </div>
                  </div>
                </div>

              </template>
            </div>
          </section>
        </template>

        <!-- ══ RELATÓRIO ANUAL — DASN-SIMEI ═══════════════ -->
        <template v-if="relTipo === 'anual'">
          <section class="sheet-card">
            <div class="sheet-body">
              <div class="section-head">
                <h4><i class="fas fa-file-invoice-dollar"></i> Declaração Anual · DASN-SIMEI</h4>
              </div>

              <div class="report-config-box">
                <div class="report-config-grid">
                  <div class="fg" style="margin:0">
                    <label class="label">Ano-calendário</label>
                    <select class="input sm" v-model="anoRelAnual">
                      <option v-for="a in anosDisponiveis" :key="a" :value="a">{{ a }}</option>
                    </select>
                  </div>
                  <div class="fg" style="margin:0; display: flex; align-items: center">
                    <label class="incluir-pessoal-toggle-modern">
                      <input type="checkbox" v-model="incluirRendasPessoais" />
                      <span>Incluir rendas pessoais</span>
                    </label>
                  </div>
                </div>
                <button class="btn-gerar-large" @click="gerarDocDASN">
                  <i class="fas fa-file-arrow-down"></i> Gerar DASN-SIMEI Oficial
                </button>
              </div>

              <div class="lc-cabecalho">
                <div class="lc-cb-linha"><span>Contribuinte (MEI):</span><strong>{{ nomeContribuinte }}</strong></div>
                <div class="lc-cb-linha"><span>Ano-calendário:</span><strong>{{ anoRelAnual }}</strong></div>
                <div class="lc-cb-linha"><span>Documento:</span><strong>DASN-SIMEI — Declaração Anual do Simples Nacional MEI</strong></div>
              </div>

              <!-- Quadro 1: Receita Bruta MEI -->
              <div class="lc-section-label entrada">QUADRO 1 — RECEITA BRUTA MEI</div>
              <div class="lc-quadro">
                <div class="lc-q-linha hdr">
                  <span>Mês</span>
                  <span>Receita MEI</span>
                  <span>Acumulado</span>
                </div>
                <div v-for="(item, idx) in relatorioAnualMeses" :key="item.mes_ref" class="lc-q-linha">
                  <span class="lc-q-mes">{{ item.mes_ref }}</span>
                  <span class="c-green">{{ R$(item.receitas_mei) }}</span>
                  <span class="c-green">{{ R$(relatorioAnualMeses.slice(0, idx+1).reduce((a,i)=>a+i.receitas_mei,0)) }}</span>
                </div>
                <div v-if="!relatorioAnualMeses.length" class="lc-vazio">Sem dados para o ano.</div>
                <div class="lc-q-linha total">
                  <span>TOTAL</span>
                  <span class="c-green fw700">{{ R$(totalAnual.receitas) }}</span>
                  <span class="c-green fw700">{{ R$(totalAnual.receitas) }}</span>
                </div>
              </div>

              <!-- Quadro 2: Outras entradas (informativo) -->
              <div class="lc-section-label pessoal" v-if="incluirRendasPessoais && totalAnual.outras_entradas">
                INFORMATIVO — ENTRADAS NÃO-MEI
              </div>
              <div class="lc-quadro" v-if="incluirRendasPessoais && totalAnual.outras_entradas">
                <div class="lc-q-linha hdr">
                  <span>Tipo</span>
                  <span>Total {{ anoRelAnual }}</span>
                </div>
                <div class="lc-q-linha">
                  <span class="lc-q-mes">Renda pessoal</span>
                  <span class="c-purple fw700">{{ R$(totalAnual.outras_entradas) }}</span>
                </div>
              </div>

              <!-- Quadro 3: Despesas operacionais -->
              <div class="lc-section-label saida">QUADRO 2 — DESPESAS DO EXERCÍCIO</div>
              <div class="lc-quadro">
                <div class="lc-q-linha hdr">
                  <span>Mês</span>
                  <span>Op.</span>
                  <span>Pessoal</span>
                </div>
                <div v-for="item in relatorioAnualMeses" :key="item.mes_ref" class="lc-q-linha">
                  <span class="lc-q-mes">{{ item.mes_ref }}</span>
                  <span class="c-red">{{ R$(item.saidas_operacionais) }}</span>
                  <span>{{ R$(item.saidas_pessoais) }}</span>
                </div>
                <div class="lc-q-linha total">
                  <span>TOTAL</span>
                  <span class="c-red fw700">{{ R$(totalAnual.operacional) }}</span>
                  <span class="fw700">{{ R$(totalAnual.pessoal) }}</span>
                </div>
              </div>

              <!-- Quadro resumo final -->
              <div class="lc-section-label">RESULTADO DO EXERCÍCIO {{ anoRelAnual }}</div>
              <div class="lc-resumo-anual">
                <div class="lra-linha">
                  <span>Receita Bruta MEI (faturamento tributável)</span>
                  <strong class="c-green">{{ R$(totalAnual.receitas) }}</strong>
                </div>
                <div class="lra-linha" v-if="incluirRendasPessoais && totalAnual.outras_entradas">
                  <span>Outras entradas não-MEI (informativo)</span>
                  <strong class="c-purple">{{ R$(totalAnual.outras_entradas) }}</strong>
                </div>
                <div class="lra-linha">
                  <span>( − ) Total de despesas operacionais</span>
                  <strong class="c-red">{{ R$(totalAnual.operacional) }}</strong>
                </div>
                <div class="lra-linha destaque">
                  <span>= Resultado líquido do negócio</span>
                  <strong :class="totalAnual.saldo >= 0 ? 'c-green' : 'c-red'">{{ R$(totalAnual.saldo) }}</strong>
                </div>
                <div class="lra-linha sub">
                  <span>Retiradas pessoais (Pró-labore)</span>
                  <strong>{{ R$(totalAnual.pessoal) }}</strong>
                </div>
                <div class="lra-verificacao">
                  <i class="fas" :class="totalAnual.receitas <= TETO_MEI_ANUAL ? 'fa-circle-check' : 'fa-triangle-exclamation'"></i>
                  <span v-if="totalAnual.receitas <= TETO_MEI_ANUAL">
                    Dentro do teto MEI ({{ R$(totalAnual.receitas) }} de {{ R$(TETO_MEI_ANUAL) }})
                  </span>
                  <span v-else>
                    Faturamento ACIMA do teto MEI — verificar obrigações com contador
                  </span>
                </div>
              </div>

            </div>
          </section>
        </template>

        <!-- Nota de rodapé -->
        <div class="rel-nota">
          <i class="fas fa-circle-info"></i>
          Teto MEI {{ anoRelatorioAtual }}: {{ R$(TETO_MEI_ANUAL) }}/ano · Dados gerados com base nos lançamentos importados.
          A DASN-SIMEI deve ser entregue até 31/05 do ano seguinte via portal gov.br/mei.
        </div>

      </div>
    </template>
    <!-- ── Barra flutuante de ações em lote ── -->
    <Transition name="barra-lote">
      <div v-if="modoSelecao && selecionados.size" class="barra-lote">
        <div class="barra-lote-info">
          <strong>{{ selecionados.size }}</strong>
          <span>selecionado{{ selecionados.size > 1 ? 's' : '' }}</span>
        </div>
        <button class="barra-btn cancel" @click="limparSelecao">
          <i class="fas fa-xmark"></i> Limpar
        </button>
        <button class="barra-btn primary" @click="abrirModalLote">
          <i class="fas fa-tag"></i> Categorizar
        </button>
      </div>
    </Transition>

    <!-- ── Modal edição unitária ── -->
    <EditarCategoriaModal
      v-if="lancamentoEmEdicao"
      :lancamento="lancamentoEmEdicao"
      @close="lancamentoEmEdicao = null"
      @salvo="lancamentoEmEdicao = null"
    />

    <!-- ── Modal edição em lote ── -->
    <EditarCategoriaModal
      v-if="modalLoteAberto"
      :ids="[...selecionados]"
      @close="modalLoteAberto = false"
      @salvo="onLoteSalvo"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import ImportadorExtrato from '../components/ImportadorExtrato.vue'
import ImportadorItau from '../components/ImportadorItau.vue'
import ImportadorBancoBrasil from '../components/ImportadorBancoBrasil.vue'

import FinanceListRow from '../components/FinanceListRow.vue'
import EditarCategoriaModal from '../components/EditarCategoriaModal.vue'
import { useStore } from '../store.js'
import { R$, formatarData, normalizar } from '../utils.js'
import { useConfirm as useAppConfirm } from '../composables/useConfirm.js'
import { gerarLivroCaixa, gerarDASNSIMEI } from '../composables/useGerarDocumento.js'
import { useTabScroll } from '../composables/useTabScroll.js'

const s = useStore()
const confirmar = useAppConfirm()
const lancamentoEmEdicao = ref(null)
const bancoImport = ref('pagbank')
const mostrarExcluirBanco = ref(false)
const mostrarFiltrosAvancados = ref(false)

const filtrosAtivosCount = computed(() => {
  let count = 0
  if (filtroBanco.value) count++
  if (filtroCategoria.value) count++
  if (filtroNatureza.value) count++
  if (buscaDescricao.value) count++
  return count
})

// ── Lógica de visibilidade dos importadores baseada em contas configuradas ──
const temContasPagbank = computed(() => s.getContasFinanceirasPorBanco('pagbank').length > 0)
const temContasItau = computed(() => s.getContasFinanceirasPorBanco('itau').length > 0)
const temContasBb = computed(() => s.getContasFinanceirasPorBanco('bb').length > 0)
const temAlgumBancoConfigurado = computed(() => temContasPagbank.value || temContasItau.value || temContasBb.value)
const bancosImportacaoDisponiveis = computed(() => [
  { id: 'pagbank', tem: temContasPagbank.value },
  { id: 'itau', tem: temContasItau.value },
  { id: 'bb', tem: temContasBb.value }
].filter(b => b.tem))

function selecionarBancoImportacaoDisponivel() {
  const atualDisponivel = bancosImportacaoDisponiveis.value.some(b => b.id === bancoImport.value)
  if (!atualDisponivel && bancosImportacaoDisponiveis.value.length) {
    bancoImport.value = bancosImportacaoDisponiveis.value[0].id
  }
}

const abas = [
  { id: 'lancamentos', label: 'Lançamentos',    icon: 'fas fa-list',          grupo: 'diaadia' },
  { id: 'importar',    label: 'Importar',       icon: 'fas fa-file-import',   grupo: 'diaadia' },
  { id: 'mensal',      label: 'Resumo Mensal',  icon: 'fas fa-calendar',      grupo: 'diaadia' },
  { id: 'anual',       label: 'Resumo Anual',   icon: 'fas fa-chart-bar',     grupo: 'mei' },
  { id: 'relatorios',  label: 'Documentos MEI', icon: 'fas fa-file-invoice',  grupo: 'mei' },
  { id: 'mao-de-obra', label: 'Meta de Retirada', icon: 'fas fa-bullseye',    grupo: 'mei' }
]
const abasVisiveis = computed(() => abas.filter(a => a.grupo === grupoAtivo.value))
const abaAtiva = ref('lancamentos')

watch([abaAtiva, bancosImportacaoDisponiveis], () => {
  if (abaAtiva.value === 'importar') selecionarBancoImportacaoDisponivel()
}, { immediate: true })

// ── Filtros ──
const filtroBanco     = ref('')
const filtroMes       = ref('')
const filtroNatureza  = ref('')
const filtroCategoria = ref('')
const mostrarFiltroCategorias = ref(false)
const buscaDescricao = ref('')
const buscaNoExtratoInteiro = ref(false)

const filtrosBanco = [
  { id: '',        label: 'Todos' },
  { id: 'pagbank', label: 'PagBank' },
  { id: 'itau',    label: 'Itaú' },
  { id: 'bb',      label: 'BB' }
]

function capitalizarDescricao(txt) {
  if (!txt) return ''
  return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
}

function limparFiltros() {
  filtroBanco.value = filtroCategoria.value = filtroNatureza.value = ''
  buscaDescricao.value = ''
  buscaNoExtratoInteiro.value = false
  mostrarFiltroCategorias.value = false
}

const mesNavegacaoInicializada = ref(false)

const lancamentosBaseFiltrados = computed(() =>
  s.financeiro.filter(item => {
    if (filtroBanco.value && (item.banco || 'pagbank') !== filtroBanco.value) return false
    if (filtroMes.value && (item.mes_ref || '') !== filtroMes.value) return false
    if (filtroCategoria.value && item.categoria !== filtroCategoria.value) return false
    if (filtroNatureza.value && item.natureza !== filtroNatureza.value) return false
    return true
  })
)

const lancamentosFiltrados = computed(() => {
  const buscaNormalizada = normalizar(buscaDescricao.value)
  const base = buscaNoExtratoInteiro.value && buscaNormalizada
    ? s.financeiro
    : lancamentosBaseFiltrados.value

  if (!buscaNormalizada) return base

  return base.filter(item => normalizar(item.descricao).includes(buscaNormalizada))
})

const transInternasCount = computed(() =>
  lancamentosFiltrados.value.filter(i => i.natureza === 'interna').length
)

const totalEntradas  = computed(() =>
  lancamentosFiltrados.value
    .filter(i => (i.natureza === 'entrada' || (i.natureza === 'pessoal' && i.valor > 0)) && i.natureza !== 'interna')
    .reduce((a, i) => a + i.valor, 0)
)

const totalSaidas    = computed(() =>
  lancamentosFiltrados.value
    .filter(i => (i.natureza === 'operacional' || (i.natureza === 'pessoal' && i.valor < 0)) && i.natureza !== 'interna')
    .reduce((a, i) => a - i.valor, 0)
)

const saldoFiltrado  = computed(() =>
  lancamentosFiltrados.value
    .filter(i => i.natureza !== 'interna')
    .reduce((a, i) => a + i.valor, 0)
)

const mesesDisponiveis = computed(() => {
  const set = new Set(s.financeiro.map(i => i.mes_ref).filter(Boolean))
  return [...set].sort((a, b) => {
    const [ma, aa] = a.split('/'), [mb, ab] = b.split('/')
    return `${ab}${mb}`.localeCompare(`${aa}${ma}`)
  })
})

const indiceMesAtual = computed(() => mesesDisponiveis.value.indexOf(filtroMes.value))
const temMesMaisNovo = computed(() => indiceMesAtual.value > 0)
const temMesMaisAntigo = computed(() =>
  indiceMesAtual.value >= 0 && indiceMesAtual.value < (mesesDisponiveis.value.length - 1)
)

watch(mesesDisponiveis, (meses) => {
  if (!meses.length) return
  if (!mesNavegacaoInicializada.value) {
    filtroMes.value = meses[0]
    mesNavegacaoInicializada.value = true
    return
  }
  if (filtroMes.value && !meses.includes(filtroMes.value)) {
    filtroMes.value = meses[0]
  }
}, { immediate: true })

function irParaMesMaisNovo() {
  if (!temMesMaisNovo.value) return
  filtroMes.value = mesesDisponiveis.value[indiceMesAtual.value - 1]
}

function irParaMesMaisAntigo() {
  if (!temMesMaisAntigo.value) return
  filtroMes.value = mesesDisponiveis.value[indiceMesAtual.value + 1]
}

function mostrarTodosPeriodos() {
  filtroMes.value = ''
}

const gruposCategoriasFiltro = computed(() => {
  const map = new Map()
  for (const cat of s.CATEGORIAS_MEI) {
    if (!map.has(cat.grupo)) map.set(cat.grupo, { nome: cat.grupo, natureza: cat.natureza, categorias: [] })
    map.get(cat.grupo).categorias.push(cat)
  }
  return [...map.values()]
})

const anosDisponiveis = computed(() => {
  const set = new Set(s.financeiro.map(i => (i.data || '').slice(0, 4)).filter(Boolean))
  return [...set].sort((a, b) => b.localeCompare(a))
})

// ── Mensal ──
const anoFiltroMensal = ref(String(new Date().getFullYear()))
const mesFiltroMensal = ref('')

const mesesParaFiltroMensal = computed(() => 
  mesesDisponiveis.value.filter(m => m.endsWith(`/${anoFiltroMensal.value}`))
)

const idxMesMensal = computed(() => mesesParaFiltroMensal.value.indexOf(mesFiltroMensal.value))

function irParaMesNovoMensal() {
  if (idxMesMensal.value > 0) mesFiltroMensal.value = mesesParaFiltroMensal.value[idxMesMensal.value - 1]
  else if (idxMesMensal.value === -1 && mesesParaFiltroMensal.value.length) mesFiltroMensal.value = mesesParaFiltroMensal.value[0]
}

function irParaMesAntigoMensal() {
  if (idxMesMensal.value >= 0 && idxMesMensal.value < mesesParaFiltroMensal.value.length - 1) {
    mesFiltroMensal.value = mesesParaFiltroMensal.value[idxMesMensal.value + 1]
  }
}

watch(anoFiltroMensal, () => { mesFiltroMensal.value = '' })

const relatorioMensalFiltrado = computed(() => {
  const base = s.relatorioMensalMei.filter(item => item.mes_ref.endsWith(`/${anoFiltroMensal.value}`))
  if (mesFiltroMensal.value) return base.filter(item => item.mes_ref === mesFiltroMensal.value)
  return base
})

function resumoBancoPorPeriodo(banco, ano, mes = '') {
  const items = s.financeiro.filter(i => {
    const isBanco = (i.banco || 'pagbank') === banco
    const isAno = (i.data || '').startsWith(ano)
    const isMes = mes ? i.mes_ref === mes : true
    return isBanco && isAno && isMes
  })
  const receitas = items.filter(i => i.valor > 0 && i.natureza === 'entrada').reduce((a, i) => a + i.valor, 0)
  const saidas   = items.filter(i => i.valor < 0).reduce((a, i) => a + Math.abs(i.valor), 0)
  return { receitas, saidas, saldo: receitas - saidas }
}

const resumoBancoPagbank = computed(() => resumoBancoPorPeriodo('pagbank', anoFiltroMensal.value, mesFiltroMensal.value))
const resumoBancoItau    = computed(() => resumoBancoPorPeriodo('itau',    anoFiltroMensal.value, mesFiltroMensal.value))

const categoriasPorAno = computed(() => {
  const map = new Map()
  s.financeiro
    .filter(i => {
      const aMatch = (i.data || '').startsWith(anoFiltroMensal.value)
      const mMatch = mesFiltroMensal.value ? i.mes_ref === mesFiltroMensal.value : true
      return aMatch && mMatch
    })
    .forEach(i => {
      const chave = i.categoria || 'Sem categoria'
      if (!map.has(chave)) map.set(chave, { categoria: chave, total: 0, quantidade: 0, natureza: i.natureza || '' })
      const a = map.get(chave)
      a.total += Math.abs(i.valor)
      a.quantidade += 1
    })
  return [...map.values()].sort((a, b) => b.total - a.total)
})

// ── Anual ──
const anoRelAnual = ref(String(new Date().getFullYear()))

const relatorioAnualMeses = computed(() =>
  s.relatorioMensalMei
    .filter(i => i.mes_ref.endsWith(`/${anoRelAnual.value}`))
    .sort((a, b) => Number(a.mes_ref.split('/')[0]) - Number(b.mes_ref.split('/')[0]))
)

const totalAnual = computed(() => {
  const m = relatorioAnualMeses.value
  return {
    receitas:       m.reduce((a, i) => a + i.receitas_mei, 0),
    outras_entradas: m.reduce((a, i) => a + (i.outras_entradas_nao_mei || 0), 0),
    operacional:    m.reduce((a, i) => a + i.saidas_operacionais, 0),
    pessoal:        m.reduce((a, i) => a + i.saidas_pessoais, 0),
    saldo:          m.reduce((a, i) => a + i.saldo_operacional, 0)
  }
})

const maxBarraValor = computed(() =>
  Math.max(1, ...relatorioAnualMeses.value.flatMap(i => [i.receitas_mei, i.saidas_operacionais]))
)

function barraAltura(valor) {
  return Math.max(2, Math.round((valor / maxBarraValor.value) * 60))
}

function labelNatureza(n) {
  return { entrada: '↑ Receita', operacional: '↓ Operacional', pessoal: '↓ Pessoal', interna: '⇄ Interna' }[n] || n
}

function selecionarCategoria(categoria) {
  filtroCategoria.value = categoria
  filtroNatureza.value = '' // Limpa o filtro de natureza ao selecionar uma categoria específica
  mostrarFiltroCategorias.value = false
}

function selecionarNatureza(natureza) {
  filtroNatureza.value = filtroNatureza.value === natureza ? '' : natureza
  filtroCategoria.value = '' // Limpa o filtro de categoria ao selecionar uma natureza
}

// ── Multi-seleção ──
const modoSelecao    = ref(false)
const selecionados   = ref(new Set())
const modalLoteAberto = ref(false)

function toggleSelecao() {
  modoSelecao.value = !modoSelecao.value
  if (!modoSelecao.value) selecionados.value = new Set()
}

function toggleItem(id) {
  const novo = new Set(selecionados.value)
  novo.has(id) ? novo.delete(id) : novo.add(id)
  selecionados.value = novo
}

const todosSelecionados = computed(() =>
  lancamentosFiltrados.value.length > 0 &&
  lancamentosFiltrados.value.every(i => selecionados.value.has(i.id))
)

function toggleSelecionarTodos() {
  if (todosSelecionados.value) {
    selecionados.value = new Set()
  } else {
    selecionados.value = new Set(lancamentosFiltrados.value.map(i => i.id))
  }
}

function limparSelecao() { selecionados.value = new Set() }

function abrirModalLote() { modalLoteAberto.value = true }

function abrirModalEdicao(item) {
  lancamentoEmEdicao.value = item
}

function onLoteSalvo() {
  modalLoteAberto.value = false
  selecionados.value = new Set()
  modoSelecao.value = false
}

async function handleLimparFinanceiro() {
  const ok = await confirmar.ask(
    'Isso irá apagar permanentemente todos os lançamentos de todos os bancos. Deseja continuar?',
    { title: 'Zerar Extratos', icon: 'fas fa-trash-can', confirmLabel: 'Apagar tudo', type: 'danger' }
  )
  if (ok) await s.limparFinanceiro()
}

const bancosComLancamentos = computed(() => {
  const config = [
    { id: 'pagbank', label: 'PagBank' },
    { id: 'itau',    label: 'Itaú' },
    { id: 'bb',      label: 'BB' }
  ]
  return config
    .map(b => ({ ...b, count: s.financeiro.filter(i => (i.banco || 'pagbank') === b.id).length }))
    .filter(b => b.count > 0)
})

async function handleExcluirPorBanco(banco) {
  const labels = { pagbank: 'PagBank', itau: 'Itaú', bb: 'BB', todos: 'todos os bancos' }
  const count = banco === 'todos'
    ? s.financeiro.length
    : s.financeiro.filter(i => (i.banco || 'pagbank') === banco).length
  const ok = await confirmar.ask(
    `Isso irá apagar permanentemente ${count} lançamento(s) de ${labels[banco] || banco}. Deseja continuar?`,
    { title: 'Excluir Extrato', icon: 'fas fa-trash-can', confirmLabel: 'Apagar', type: 'danger' }
  )
  if (ok) {
    await s.limparFinanceiroPorBanco(banco)
    mostrarExcluirBanco.value = false
  }
}

// ── Helpers ──
// ── Relatórios ──────────────────────────────────────────────
const TETO_MEI_ANUAL = computed(() => s.company.teto_mei_anual || 81000)
const nomeContribuinte = 'MEI — Conta PagBank / Itaú'

const relTipo = ref('mensal')
const anoRelatorioAtual = computed(() => anoRelAnual.value)
const incluirRendasPessoais = ref(false)

// Meses disponíveis como { value, label } para o select do relatório mensal
const mesesRelatorio = computed(() =>
  mesesDisponiveis.value.map(m => ({ value: m, label: m }))
)

// Mês selecionado no relatório mensal (default: mês mais recente disponível)
const relMensalMesRef = ref('')
watch(mesesDisponiveis, (meses) => {
  if (meses.length && !relMensalMesRef.value) relMensalMesRef.value = meses[0]
}, { immediate: true })

// Dados do mês selecionado no relatório mensal
const dadosRelMensal = computed(() =>
  s.relatorioMensalMei.find(i => i.mes_ref === relMensalMesRef.value) || null
)

// Lançamentos do mês selecionado — MEI (entradas)
const lancMensalEntradas = computed(() => {
  if (!relMensalMesRef.value) return []
  return s.financeiro.filter(i =>
    i.mes_ref === relMensalMesRef.value &&
    i.natureza === 'entrada' &&
    i.categoria !== 'Rendimento Financeiro' &&
    i.valor > 0
  )
})

// Lançamentos do mês — entradas não-MEI (pessoal positivo, ex: Renda Pessoal)
const lancMensalNaoMei = computed(() => {
  if (!relMensalMesRef.value) return []
  return s.financeiro.filter(i =>
    i.mes_ref === relMensalMesRef.value &&
    i.natureza === 'pessoal' &&
    i.valor > 0
  )
})

// Lançamentos do mês — despesas (operacionais + pessoais se solicitado)
const lancMensalSaidasParaDoc = computed(() => {
  if (!relMensalMesRef.value) return []
  return s.financeiro.filter(i =>
    i.mes_ref === relMensalMesRef.value &&
    (i.natureza === 'operacional' || (incluirRendasPessoais.value && i.natureza === 'pessoal' && i.valor < 0))
  )
})

// Faturamento MEI do ano do relatório
const faturamentoAnoRel = computed(() =>
  s.relatorioMensalMei
    .filter(i => i.mes_ref.endsWith(`/${anoRelAnual.value}`))
    .reduce((a, i) => a + (i.receitas_mei || 0), 0)
)

const percentualTeto = computed(() =>
  TETO_MEI_ANUAL.value > 0 ? (faturamentoAnoRel.value / TETO_MEI_ANUAL.value) * 100 : 0
)

// Acumulado do ano até o mês selecionado no relatório mensal
const acumuladoAteMes = computed(() => {
  const [mesAtual, anoAtual] = (relMensalMesRef.value || '').split('/')
  if (!mesAtual || !anoAtual) return { receitas_mei: 0, saidas_operacionais: 0, saldo_operacional: 0, pct_teto: 0 }
  const mesesDoAno = s.relatorioMensalMei.filter(i => {
    const [m, a] = i.mes_ref.split('/')
    return a === anoAtual && Number(m) <= Number(mesAtual)
  })
  const receitas_mei = mesesDoAno.reduce((a, i) => a + (i.receitas_mei || 0), 0)
  const saidas_operacionais = mesesDoAno.reduce((a, i) => a + (i.saidas_operacionais || 0), 0)
  return {
    receitas_mei,
    saidas_operacionais,
    saldo_operacional: receitas_mei - saidas_operacionais,
    pct_teto: TETO_MEI_ANUAL.value > 0 ? (receitas_mei / TETO_MEI_ANUAL.value) * 100 : 0
  }
})

// ── Geração de documentos oficiais ──────────────────────────────
function gerarDocLivroCaixa() {
  gerarLivroCaixa({
    mes_ref:  relMensalMesRef.value,
    empresa:  s.company,
    entradas: lancMensalEntradas.value,
    naoMei:   lancMensalNaoMei.value,
    saidas:   lancMensalSaidasParaDoc.value,
    totais:   dadosRelMensal.value || {},
    acumulado: acumuladoAteMes.value,
    incluirNaoMei: incluirRendasPessoais.value
  })
}

function gerarDocDASN() {
  gerarDASNSIMEI({
    ano:      anoRelAnual.value,
    empresa:  s.company,
    meses:    relatorioAnualMeses.value,
    totais:   totalAnual.value,
    tetoAnual: TETO_MEI_ANUAL.value,
    pctTeto:  percentualTeto.value,
    incluirNaoMei: incluirRendasPessoais.value
  })
}

function retirSegura(mes) {
  const saldoNoBanco = mes.total_gerado_retirada || 0
  const reservaGiro = s.sugestaoProvisionamentoSemanal || 0
  return saldoNoBanco - reservaGiro
}

onMounted(() => s.carregarFinanceiro())
</script>

<style scoped>
.grupo-nav { display:flex; gap:8px; margin: 6px 0 2px; }
.grupo-btn {
  flex:1; padding:10px 8px; border-radius: var(--r-md);
  border:1px solid var(--border); background: var(--surface);
  color: var(--muted); font-size:.82rem; font-weight:800;
  display:flex; align-items:center; justify-content:center; gap:6px;
  transition: background var(--t), color var(--t), border-color var(--t);
}
.grupo-btn.active { background: var(--brown-dark); color:#fff; border-color: var(--brown-dark); }
/* ── Painel excluir por banco ─────────────────────────────── */
.excluir-banco-panel {
  background: var(--red-bg);
  border-bottom: 1px solid var(--red-dim);
  padding: 10px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.excluir-banco-titulo {
  font-size: .7rem;
  font-weight: 800;
  color: var(--red);
  text-transform: uppercase;
  letter-spacing: .5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.excluir-banco-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.excluir-banco-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--red-dim);
  border-radius: var(--r-md);
  background: var(--surface);
  color: var(--text);
  text-align: left;
  transition: all var(--t);
}
.excluir-banco-btn:active { background: var(--red-bg); }
.excluir-banco-btn.excluir-todos {
  border-color: var(--red);
  background: var(--red-bg);
  color: var(--red);
}
.excluir-banco-btn.excluir-todos:active { background: var(--red-bg); }
.eb-nome { flex: 1; font-size: .84rem; font-weight: 700; }
.eb-count { font-size: .72rem; color: var(--muted); font-weight: 500; }
.excluir-banco-btn.excluir-todos .eb-count { color: var(--red); opacity: .75; }
.eb-arrow { font-size: .65rem; color: var(--muted); flex-shrink: 0; }

/* Transição painel excluir */
.fade-slide-enter-active, .fade-slide-leave-active { transition: all .18s ease; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateY(-6px); }

/* ── Barra discreta de ações da lista ─── */
.lista-acoes-bar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 16px 4px;
  background: transparent;
}
.btn-selecionar-sutil {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-full);
  background: transparent;
  color: var(--muted);
  font-size: .72rem;
  font-weight: 700;
  transition: all var(--t);
}
.btn-selecionar-sutil:active {
  background: var(--cream-deep);
  color: var(--brown-mid);
  border-color: var(--brown-mid);
}
.btn-selecionar-sutil i { font-size: .7rem; }

/* ── Botão fechar seleção ─── */
.sel-fechar-btn {
  background: rgba(255,255,255,.12);
  border: none;
  color: rgba(255,255,255,.7);
  width: 28px;
  height: 28px;
  border-radius: var(--r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
  flex-shrink: 0;
  margin-left: auto;
}
.sel-fechar-btn:active { background: rgba(255,255,255,.22); }

/* ── Cabeçalho ─── */
.tab-hdr { 
  padding: 14px 16px 0; background: var(--surface); border-bottom: 1px solid var(--border); 
  flex-shrink: 0; 
  position: sticky; top: 0; z-index: var(--z-header);
}

.hdr-actions { display: flex; gap: 6px; }
.tab-financeiro .aba-btn { flex: 0 0 auto; padding-left: 12px; padding-right: 12px; }

/* ── Importadores ─── */
.importar-card .sheet-body { padding-bottom: 0; }
.banco-tabs { display: flex; gap: 8px; margin-bottom: 12px; overflow-x: auto; scrollbar-width: none; }
.banco-tabs::-webkit-scrollbar { display: none; }
.banco-tab { flex: 1 0 112px; padding: 9px 10px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--bg); color: var(--muted); font-size: .8rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all var(--t); }
.banco-tab.active { background: var(--brown); color: #fff; border-color: var(--brown); }
.importador-panel { margin: 0 -14px; border-top: 1px solid var(--border); background: var(--bg); }
.extratos-admin { margin: 14px -14px 0; padding: 12px 14px 14px; border-top: 1px solid var(--border); background: var(--cream); }
.extratos-admin-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--muted); font-size: .8rem; font-weight: 800; text-align: left; }
.extratos-admin-toggle span { display: flex; align-items: center; gap: 8px; min-width: 0; }
.extratos-admin-toggle.active { border-color: var(--red-dim); background: var(--red-bg); color: var(--red); }
.extratos-admin .excluir-banco-panel { margin-top: 10px; border: 1px solid var(--red-dim); border-radius: var(--r-md); border-bottom: 1px solid var(--red-dim); }

/* Filtro categoria sheet (dropdown) */
.filtro-categoria-sheet { padding: 12px 16px; border-top: 1px solid var(--border); background: var(--cream); display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--border); }
.grupo { margin-bottom: 4px; }
.grupo-titulo { font-size: .72rem; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.grupo-natureza { padding: 2px 7px; border-radius: var(--r-full); font-size: .65rem; font-weight: 800; }
.nat-entrada { background: var(--green-bg); color: var(--green); }
.nat-operacional { background: var(--red-bg); color: var(--red); }
.nat-pessoal { background: var(--gold-bg); color: var(--orange); }
.filtro-select { padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--bg); color: var(--text); font-size: .82rem; appearance: none; }
.filtro-select.sm { width: auto; min-width: 80px; }
.nat-interna { background: var(--blue-bg); color: var(--blue); }
.categoria-grid { display: flex; flex-direction: column; gap: 6px; }
.cat-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--r-md); background: var(--bg); color: var(--text); text-align: left; transition: all var(--t); }
.cat-btn i:first-child { width: 20px; text-align: center; color: var(--muted); font-size: .85rem; flex-shrink: 0; }
.cat-btn span { flex: 1; font-size: .85rem; font-weight: 500; }
.cat-btn.selected { border-color: var(--brown); background: var(--gold-bg); color: var(--brown-dark); }
.cat-btn.selected i:first-child { color: var(--gold-dark); }
.cat-btn-todas { background: var(--surface); }
.check-icon { color: var(--brown) !important; font-size: .75rem !important; width: auto !important; }
.cat-btn:active { transform: scale(.98); }

/* ── Estilos Filtros Modernos Consolidados ── */
.filtros-modern { margin: 12px 16px 0; overflow: hidden; }
.fm-top { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.fm-top-compact { padding: 8px 10px; gap: 6px; align-items: center; }
.fm-top-compact .fbusca-wrap { flex: 1; min-width: 0; }

/* Alinhamento para que o card de filtro tenha o mesmo tamanho dos cards de baixo no relatório */
.filtros-mensal-ajuste { margin-left: 0; margin-right: 0; }

/* Estilos para a navegação unificada em linha única */
.fm-unified-nav { display: flex; align-items: center; gap: 6px; padding: 11px 10px; background: var(--surface); height: 60px; }
.fm-unified-nav .pnav-mini-centro.ano-width { flex: 0 0 80px; } /* Especificidade maior remove a necessidade de !important */
.nav-divider { width: 1px; height: 24px; background: var(--border); }
.nav-month-group { flex: 1; display: flex; align-items: center; gap: 6px; }
.fbusca-wrap { position: relative; flex: 1; }
.fbusca-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .85rem; }
.fbusca-input { width: 100%; padding: 10px 12px 10px 34px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--bg); font-size: .88rem; }
.btn-toggle-filtros { width: 42px; height: 42px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--bg); color: var(--muted); position: relative; transition: all var(--t); }
.btn-toggle-filtros.active { border-color: var(--brown); color: var(--brown); background: var(--gold-bg); }
.filtros-badge { position: absolute; top: -6px; right: -6px; background: var(--brown); color: #fff; font-size: 10px; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 800; }

.periodo-mini-nav { display: flex; align-items: center; gap: 8px; padding: 11px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
.periodo-inline { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.pnav-mini-btn { width: 38px; height: 40px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-size: .75rem; color: var(--brown-mid); flex-shrink: 0; }
.pnav-mini-centro { flex: 1; position: relative; height: 40px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--cream); display: flex; align-items: center; justify-content: center; min-width: 0; overflow: hidden; }
.pnav-mini-centro select { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
.pnav-mini-centro span { font-size: .82rem; font-weight: 700; color: var(--brown-dark); }

.filtros-avancados-sheet { padding: 12px 16px; display: flex; flex-direction: column; gap: 14px; border-bottom: 1px solid var(--border); background: var(--bg); }
.fsec-lbl { font-size: .62rem; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; display: block; letter-spacing: .5px; }
.fchips { display: flex; gap: 6px; flex-wrap: wrap; }
.fchip { padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--r-full); background: var(--surface); color: var(--muted); font-size: .75rem; font-weight: 700; transition: all var(--t); }
.fchip.active { background: var(--brown); color: #fff; border-color: var(--brown); }

.fcat-trigger { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--text); font-size: .82rem; width: 100%; font-weight: 600; }
.fcat-trigger.ativo { border-color: var(--brown); background: var(--gold-bg); }

.resumo-modern { 
  display: flex; 
  align-items: center; 
  background: var(--surface); 
  border: .5px solid var(--border);
  border-radius: var(--r-md);
  margin: 12px 16px 0;
  padding: 10px 16px; 
  justify-content: space-between;
}
.rm-item { display: flex; flex-direction: column; flex: 1; align-items: center; gap: 2px; }
.rm-lbl { font-size: .6rem; color: var(--muted); text-transform: uppercase; font-weight: 800; letter-spacing: .3px; }
.rm-val { font-family: var(--mono); font-size: .88rem; font-weight: 800; }
.rm-sep { width: 1px; height: 24px; background: var(--border); margin: 0 4px; }

.fm-status-bar { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 8px 16px; 
  background: var(--cream); 
  border-top: 1px solid var(--border); 
  border-radius: 0 0 var(--r-lg) var(--r-lg); 
}
.fm-count { font-size: .72rem; color: var(--muted); font-weight: 600; }
.btn-limpar-modern { border: none; background: transparent; color: var(--red); font-size: .72rem; font-weight: 800; text-decoration: underline; text-underline-offset: 2px; }

/* Transições */
.fade-slide-enter-active, .fade-slide-leave-active { 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
  max-height: 400px; 
  overflow: hidden; 
}
.fade-slide-enter-from, .fade-slide-leave-to { 
  opacity: 0; 
  max-height: 0; 
  transform: translateY(-10px); 
}

/* ── Aviso transferência interna ─── */
.trans-interna-hint {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 6px 16px;
  background: none; border: none; border-top: 1px solid var(--border);
  font-size: .72rem; font-weight: 600; color: var(--gold-dark);
  cursor: pointer; text-align: left;
}
.trans-interna-hint i { font-size: .7rem; }

/* ── Barra de seleção em lote ─── */
.selecao-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: var(--brown-dark); color: #fff; flex-shrink: 0; }
.sel-all-btn { background: none; border: none; color: rgba(255,255,255,.85); font-size: .8rem; font-weight: 600; display: flex; align-items: center; gap: 7px; }
.sel-all-btn i { font-size: .9rem; color: var(--gold-light); }
.sel-count { font-size: .78rem; font-weight: 700; color: var(--gold-light); }

/* ── Lista ─── */
.lancamentos-list { padding-bottom: max(96px, calc(72px + env(safe-area-inset-bottom))); }
.lancamento-row { margin: 0 16px 8px; }

.row-operacional { border-left-color: var(--red); }
.row-operacional 

.row-pessoal { border-left-color: var(--purple); }
.row-pessoal 

.row-entrada { border-left-color: var(--green); }
.row-entrada 

.row-interna { opacity: .65; background: var(--gold-bg); border-left-color: var(--gold); }
.row-interna:active { background: var(--gold-bg); }

.row-selected { background: var(--gold-bg) !important; }

/* Checkbox de seleção */
.row-check { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.row-check i { font-size: 1.1rem; color: var(--muted); transition: color var(--t); }
.row-selected .row-check i { color: var(--brown); }

/* ── Barra flutuante de lote ─── */
.barra-lote {
  position: fixed;
  bottom: max(80px, calc(72px + env(safe-area-inset-bottom)));
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 448px;
  background: var(--brown-dark);
  border-radius: var(--r-xl);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 32px rgba(30,18,8,.35);
  z-index: var(--z-overlay);
}
.barra-lote-info { display: flex; align-items: baseline; gap: 4px; flex: 1; }
.barra-lote-info strong { color: var(--gold-light); font-size: 1rem; font-weight: 800; }
.barra-lote-info span  { color: rgba(255,255,255,.65); font-size: .78rem; }

.barra-btn { padding: 8px 14px; border: none; border-radius: var(--r-full); font-size: .82rem; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: all var(--t); white-space: nowrap; }
.barra-btn.cancel  { background: rgba(255,255,255,.12); color: rgba(255,255,255,.8); }
.barra-btn.cancel:active  { background: rgba(255,255,255,.22); }
.barra-btn.primary { background: var(--gold); color: var(--brown-dark); }
.barra-btn.primary:active { background: var(--gold-light); }

/* Transição barra lote */
.barra-lote-enter-active, .barra-lote-leave-active { transition: all .22s var(--t-spring); }
.barra-lote-enter-from, .barra-lote-leave-to { opacity: 0; transform: translateX(-50%) translateY(16px) scale(.95); }
.row-banco-badge { width: 26px; height: 26px; border-radius: 6px; font-size: .65rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.row-banco-badge.pagbank { background: var(--gold-bg); color: var(--gold-dark); }
.row-banco-badge.itau    { background: var(--blue-bg); color: var(--blue); }
.row-banco-badge.bb      { background: var(--gold-bg); color: var(--blue); }
.row-left { flex: 1; min-width: 0; }
.row-title { font-size: .9rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-subtitle { font-size: .75rem; color: var(--muted); display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 2px; }

/* ── Empty ─── */
.empty-state { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; gap: 12px; color: var(--muted); text-align: center; }
.empty-state i { font-size: 2.5rem; opacity: .3; }
.empty-state p { font-size: .9rem; }
.btn-abrir-import { padding: 10px 20px; background: var(--brown); color: #fff; border: none; border-radius: var(--r-full); font-size: .85rem; font-weight: 700; display: flex; align-items: center; gap: 8px; transition: background var(--t); }
.btn-abrir-import:active { background: var(--brown-dark); }

/* ── Relatório ─── */
.relatorio-wrap { padding: 14px 16px max(96px, calc(72px + env(safe-area-inset-bottom))); display: flex; flex-direction: column; gap: 14px; }

/* Banco grid */
.banco-resumo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.banco-resumo-card { border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.banco-resumo-card.pagbank { background: var(--gold-bg); }
.banco-resumo-card.itau    { background: var(--blue-bg); }
.banco-nome { font-size: .8rem; font-weight: 800; color: var(--brown-dark); margin-bottom: 4px; display: flex; align-items: center; gap: 5px; }
.banco-linha { display: flex; align-items: center; justify-content: space-between; font-size: .78rem; }
.banco-linha span { color: var(--muted); }
.banco-linha.total { border-top: 1px solid var(--border); padding-top: 6px; margin-top: 2px; font-weight: 700; }
.banco-linha strong { font-family: var(--mono); font-size: .85rem; }

/* Mei cards */
.mei-grid { display: flex; flex-direction: column; gap: 10px; }
.mei-card { border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; background: var(--cream); }
.mei-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mei-head h4 { font-size: .9rem; font-weight: 700; color: var(--brown-dark); }
.mei-line { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; font-size: .82rem; border-bottom: 1px solid rgba(0,0,0,.04); }
.mei-line:last-child { border-bottom: none; }
.mei-line span { color: var(--muted); }
.mei-line strong { font-family: var(--mono); font-size: .88rem; }
.mei-line.total { border-top: 1px solid var(--border2); margin-top: 4px; padding-top: 8px; font-weight: 700; border-bottom: none; }
.highlight-per-capita { background: var(--teal-bg); margin: 2px -6px; padding: 6px; border-radius: 6px; border-bottom: none !important; }

/* Report list */
.report-list { display: flex; flex-direction: column; }
.report-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.report-row:last-child { border-bottom: none; }
.report-month { font-size: .88rem; font-weight: 700; color: var(--text); }
.report-sub { font-size: .75rem; color: var(--muted); margin-top: 2px; }
.report-value { font-family: var(--mono); font-size: .92rem; flex-shrink: 0; }

/* Anual */
.ano-selector-inline { display: flex; gap: 8px; flex-wrap: wrap; }
.ano-btn { padding: 6px 16px; border: 1px solid var(--border); border-radius: var(--r-full); background: var(--bg); color: var(--muted); font-size: .82rem; font-weight: 700; transition: all var(--t); }
.ano-btn.active { background: var(--brown); color: #fff; border-color: var(--brown); }
.anual-totais { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.anual-item { border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; background: var(--bg); }
.anual-item.destaque { border-width: 2px; }
.anual-item.positivo { border-color: var(--green-dim); background: var(--green-bg); }
.anual-item.negativo { border-color: var(--red); background: var(--red-bg); }
.anual-label { font-size: .7rem; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px; }
.anual-valor { font-family: var(--mono); font-size: 1.05rem; font-weight: 700; color: var(--brown); margin-bottom: 4px; }
.anual-sub { font-size: .7rem; color: var(--muted); line-height: 1.4; }

/* Gráfico */
.grafico-barras { display: flex; align-items: flex-end; gap: 6px; height: 80px; padding-bottom: 4px; overflow-x: auto; }
.barra-grupo { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 36px; flex-shrink: 0; }
.barra-labels { display: flex; align-items: flex-end; gap: 2px; height: 64px; }
.barra { width: 14px; border-radius: 3px 3px 0 0; transition: height 0.4s ease; }
.barra.entrada { background: var(--green); }
.barra.saida   { background: var(--red); opacity: .75; }
.barra-mes { font-size: .6rem; color: var(--muted); font-weight: 600; white-space: nowrap; }
.grafico-legenda { display: flex; gap: 16px; margin-top: 8px; font-size: .75rem; color: var(--muted); font-weight: 600; }
.leg-entrada i { color: var(--green); }
.leg-saida   i { color: var(--red); }

/* Tabela anual */
.tabela-anual { display: flex; flex-direction: column; }
.ta-hdr { display: grid; grid-template-columns: 58px 1fr 1fr; gap: 4px; padding: 6px 0 8px; font-size: .66rem; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid var(--border); }
.ta-row { display: grid; grid-template-columns: 58px 1fr 1fr; gap: 4px; padding: 8px 0; font-size: .8rem; border-bottom: 1px solid var(--border); }
.ta-row:last-child { border-bottom: none; }
.ta-mes { font-weight: 600; color: var(--text); font-family: var(--font); font-size: .75rem; }
.ta-row span { font-family: var(--mono); font-size: .76rem; }

.renda-pessoal { background: var(--purple-bg); border-radius: 4px; padding-left: 4px; padding-right: 4px; }

/* ── Aba Relatórios ─────────────────────────────────────── */
.rel-tipo-nav {
  display: flex;
  gap: 8px;
  padding: 0 0 4px;
}
.rel-tipo-btn {
  flex: 1;
  padding: 9px 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg);
  color: var(--muted);
  font-size: .78rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all var(--t);
}
.rel-tipo-btn.active {
  background: var(--brown);
  color: #fff;
  border-color: var(--brown);
}

/* ── Barra de teto ── */
.teto-card { border-left: 3px solid var(--brown); }
.teto-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
.teto-titulo { font-size: .88rem; font-weight: 800; color: var(--brown-dark); }
.teto-sub { font-size: .72rem; color: var(--muted); margin-top: 2px; }
.teto-valor-wrap { text-align: right; flex-shrink: 0; }
.teto-valor { font-family: var(--mono); font-size: 1.1rem; font-weight: 800; }
.teto-pct { font-size: .7rem; color: var(--muted); margin-top: 2px; }

.teto-barra-wrap { margin-bottom: 6px; }
.teto-barra-bg {
  position: relative;
  height: 12px;
  background: var(--cream-deep);
  border-radius: 99px;
  overflow: hidden;
}
.teto-barra-fill {
  height: 100%;
  border-radius: 99px;
  transition: width .6s ease;
}
.teto-barra-fill.ok      { background: var(--green); }
.teto-barra-fill.warning { background: var(--orange); }
.teto-barra-fill.danger  { background: var(--red); }
.teto-barra-mark { margin-top: 5px; text-align: right; padding-right: 2px; }
.teto-falta { font-size: .68rem; color: var(--muted); font-weight: 600; display: inline-block; }

.teto-alertas { margin-top: 4px; }
.teto-alerta {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--r-md);
  font-size: .78rem;
  font-weight: 600;
}
.teto-alerta.alerta-warning { background: var(--gold-bg); color: var(--orange); }
.teto-alerta.alerta-danger  { background: var(--red-bg); color: var(--red); }
.teto-alerta i { flex-shrink: 0; margin-top: 1px; }

/* ── Livro Caixa ── */
.lc-cabecalho {
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 8px 10px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-cb-linha {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: .76rem;
}
.lc-cb-linha span { color: var(--muted); font-size: .64rem; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
.lc-cb-linha strong { color: var(--text); font-size: .78rem; word-break: break-word; line-height: 1.3; }

.lc-section-label {
  font-size: .65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .6px;
  padding: 8px 10px;
  margin: 16px 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
}
.lc-section-label.entrada { background: var(--green-bg); color: var(--green); }
.lc-section-label.saida   { background: var(--red-bg); color: var(--red); }
.lc-section-label.pessoal { background: var(--purple-bg); color: var(--purple); }
.lc-section-label:not(.entrada):not(.saida):not(.pessoal) { background: var(--cream); color: var(--brown-mid); }

.lc-tabela {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lc-hdr { display: none; } /* hidden — using card layout instead */
.lc-row { flex-direction: column; align-items: stretch; gap: 4px; }
/* top line: badge + valor */
.lc-row .lc-col-cat  { order: 1; }
.lc-row .lc-col-val  { order: 1; }
.lc-row .lc-col-desc { order: 2; color: var(--text); font-size: .8rem; word-break: break-word; line-height: 1.35; }
.lc-row .lc-col-data { order: 3; color: var(--muted); font-size: .68rem; font-weight: 600; }
/* use flexbox row for first line via pseudo wrapper — handle in template instead */
.lc-col-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.lc-col-data { color: var(--muted); font-size: .68rem; font-weight: 600; }
.lc-col-desc { color: var(--text); word-break: break-word; line-height: 1.35; font-size: .8rem; }
.lc-col-cat  {  }
.lc-col-val  { font-family: var(--mono); font-size: .86rem; font-weight: 700; flex-shrink: 0; }
.lc-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: .64rem;
  font-weight: 700;
  white-space: nowrap;
}
.lc-entrada { background: var(--green-bg); color: var(--green); }
.lc-saida   { background: var(--red-bg); color: var(--red); }
.lc-pessoal { background: var(--purple-bg); color: var(--purple); }

.lc-vazio { font-size: .78rem; color: var(--muted); padding: 8px 0; }

.lc-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--cream);
  font-size: .8rem;
  font-weight: 700;
}
.lc-total-label { color: var(--text); }
.lc-total strong { font-family: var(--mono); font-size: .88rem; }
.pessoal-total { border-top-color: var(--purple-bg); }

/* Resumo do mês */
.lc-resumo {
  margin-top: 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
}
.lc-resumo-linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: .8rem;
  border-bottom: 1px solid var(--border);
}
.lc-resumo-linha:last-child { border-bottom: none; }
.lc-resumo-linha span { color: var(--muted); }
.lc-resumo-linha strong { font-family: var(--mono); font-size: .84rem; }
.lc-resumo-linha.destaque { background: var(--cream); font-weight: 700; }
.lc-resumo-linha.destaque span { color: var(--text); font-weight: 700; }
.lc-resumo-linha.sub { background: var(--bg); opacity: .8; }

/* Acumulado */
.lc-acumulado {
  margin-top: 14px;
  background: var(--gold-bg);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 10px 12px;
}
.lc-acum-titulo {
  font-size: .72rem;
  font-weight: 800;
  color: var(--brown-mid);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 10px;
}
.lc-acum-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lc-acum-item {
  background: var(--surface);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  border: 1px solid var(--border);
}
.lc-acum-item span { display: block; font-size: .66rem; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 4px; }
.lc-acum-item strong { font-family: var(--mono); font-size: .88rem; font-weight: 800; }

/* Quadro anual */
.lc-quadro {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-x: auto;
}
.lc-q-linha {
  display: grid;
  grid-template-columns: 62px 1fr 1fr;
  gap: 8px;
  padding: 10px 12px;
  font-size: .76rem;
  border: 1px solid var(--border);
  border-left: 5px solid var(--brown-light);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  align-items: center;
}
.lc-q-linha.hdr {
  font-size: .62rem;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .4px;
  border-left-color: transparent;
  box-shadow: none;
  background: transparent;
}
.lc-q-linha.total {
  font-weight: 700;
  border-color: var(--border);
  border-left-color: var(--gold);
  background: var(--cream);
}
.lc-q-mes { color: var(--text); font-weight: 600; }
.lc-q-linha span { font-family: var(--mono); }
.lc-q-linha span:first-child { font-family: var(--font); }

/* Resumo anual */
.lc-resumo-anual {
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
}
.lra-linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  font-size: .8rem;
  border-bottom: 1px solid var(--border);
}
.lra-linha span { color: var(--muted); }
.lra-linha strong { font-family: var(--mono); font-size: .86rem; }
.lra-linha.destaque { background: var(--cream); font-weight: 700; }
.lra-linha.destaque span { color: var(--text); font-weight: 700; }
.lra-linha.sub { background: var(--bg); opacity: .8; font-size: .76rem; }
.lra-verificacao {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: .76rem;
  font-weight: 700;
  background: var(--green-bg);
  color: var(--green);
  border-top: 1px solid var(--border);
}
.lra-verificacao i { font-size: .85rem; }

/* Nota rodapé */
.rel-nota {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: .72rem;
  color: var(--muted);
  line-height: 1.5;
  padding: 10px 4px 4px;
}
.rel-nota i { flex-shrink: 0; color: var(--brown-light); margin-top: 1px; }

/* ── Meta de Retirada (aba simplificada) ── */
.mtr-header {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 14px; background: var(--bg); border-radius: var(--r-md);
  border: 1px solid var(--border); margin-bottom: 16px;
}
.mtr-sep { width: 1px; background: var(--border); align-self: stretch; flex-shrink: 0; }
.mtr-meta-bloco, .mtr-prov-bloco { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.mtr-prov-bloco { padding-left: 16px; }
.mtr-label { font-size: .65rem; text-transform: uppercase; font-weight: 800; color: var(--muted); letter-spacing: .5px; }
.mtr-valor { font-size: 1.1rem; font-weight: 800; color: var(--brown-dark); font-family: var(--mono); }
.mtr-sub { font-size: .6rem; color: var(--muted); margin-top: 1px; }

.mtr-lista { display: flex; flex-direction: column; gap: 10px; }

.mtr-card {
  border: 1px solid var(--border); border-radius: var(--r-md);
  padding: 14px; background: var(--surface);
  display: flex; flex-direction: column; gap: 8px;
}

.mtr-card-topo { display: flex; align-items: center; justify-content: space-between; }
.mtr-card-mes { font-weight: 800; font-size: .9rem; color: var(--brown-dark); }
.mtr-card-retirada { font-size: 1.15rem; font-weight: 800; font-family: var(--mono); }

.mtr-bar-bg { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.mtr-bar-fill { height: 100%; border-radius: 4px; transition: width .6s ease; }
.mtr-bar-pct { font-size: .65rem; color: var(--muted); font-weight: 700; text-align: right; }

.mtr-equacao {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  padding: 10px; background: var(--bg); border-radius: var(--r-sm);
}
.mtr-eq-item { display: flex; flex-direction: column; gap: 1px; align-items: center; }
.mtr-eq-lbl { font-size: .58rem; text-transform: uppercase; color: var(--muted); font-weight: 700; letter-spacing: .3px; }
.mtr-eq-item strong { font-size: .85rem; font-family: var(--mono); font-weight: 800; }
.mtr-eq-op { font-size: 1rem; font-weight: 700; color: var(--muted); padding: 0 2px; margin-top: 10px; }
.mtr-eq-result { padding: 4px 8px; background: var(--cream); border-radius: var(--r-sm); border: 1px solid var(--border); }

.mtr-labor {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  font-size: .72rem; color: var(--muted); padding-top: 4px; border-top: 1px solid var(--border);
}
.mtr-labor i { color: var(--brown-light); }
.mtr-labor-sep { opacity: .4; }
.mtr-labor-meta { opacity: .5; }

.mtr-explainer {
  margin-top: 20px; padding: 14px; border-radius: var(--r-md);
  background: var(--blue-bg); border: 1px solid var(--blue-dim, #bfdbfe);
  display: flex; flex-direction: column; gap: 10px;
}
.mtr-exp-title { font-size: .8rem; font-weight: 800; color: var(--blue); display: flex; gap: 6px; align-items: center; }
.mtr-exp-item { display: flex; flex-direction: column; gap: 3px; }
.mtr-exp-item strong { font-size: .75rem; color: var(--brown-dark); }
.mtr-exp-item span { font-size: .72rem; color: var(--brown); line-height: 1.4; }
.mtr-exp-aviso {
  display: flex; gap: 8px; padding: 8px; border-radius: var(--r-sm);
  background: var(--gold-bg); color: var(--gold-dark); font-size: .7rem; line-height: 1.4;
}
.mtr-exp-aviso i { flex-shrink: 0; margin-top: 1px; }

@media (min-width: 420px) {
  .mei-grid { display: grid; grid-template-columns: repeat(2, 1fr); }
}

/* ════════════════════════════════════════════════════════════
   FIXES SAMSUNG A22 — tela estreita (≤ 380px)
   ════════════════════════════════════════════════════════════ */

/* 1 ── Cards de banco: empilhar em coluna única */
@media (max-width: 380px) {
  .banco-resumo-grid { grid-template-columns: 1fr; }
}

/* 2 ── Livro Caixa: layout mobile — descrição + valor na linha 1, data + tipo na linha 2 */
@media (max-width: 380px) {
  .lc-hdr { display: none; }
  .lc-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 0;
    padding: 9px 0;
  }
  .lc-col-desc {
    order: 0;
    flex: 1 1 calc(100% - 76px);
    min-width: 0;
    font-size: .78rem;
    font-weight: 600;
    color: var(--text);
    padding-right: 6px;
    word-break: break-word;
    line-height: 1.35;
  }
  .lc-col-val {
    order: 1;
    flex: 0 0 auto;
    min-width: 72px;
    font-size: .78rem;
    text-align: right;
    padding-top: 0;
  }
  .lc-col-data {
    order: 2;
    flex: 0 0 auto;
    font-size: .65rem;
    color: var(--muted);
    padding-top: 3px;
    margin-right: 8px;
  }
  .lc-col-cat {
    order: 3;
    flex: 0 0 auto;
    padding-top: 3px;
  }
}

/* 3 ── Tabela anual (detalhamento mensal): 3 colunas, sem scroll */
.tabela-anual {
  width: 100%;
}

/* 4 ── Quadros DASN (Receita + Despesas): 3 colunas, sem scroll */
.lc-quadro {
  width: 100%;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.lc-quadro::-webkit-scrollbar { display: none; }

/* 5 ── Gráfico de barras anual: mais espaço em telas pequenas */
@media (max-width: 380px) {
  .grafico-barras { gap: 4px; }
  .barra-grupo    { min-width: 30px; }
  .barra          { width: 12px; }
  .barra-mes      { font-size: .55rem; }
}

/* 6 ── Totais anuais: coluna única abaixo de 380px */
@media (max-width: 380px) {
  .anual-totais { grid-template-columns: 1fr; }
  .anual-item   { padding: 10px 12px; }
}

/* Botão gerar documento oficial */
.btn-gerar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: var(--r-sm);
  font-size: .75rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--t), transform var(--t);
  flex-shrink: 0;
}
.btn-gerar:active { background: var(--brown-dark); transform: scale(.96); }

.incluir-pessoal-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--muted);
  cursor: pointer;
}

.report-config-box {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 10px 12px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.report-config-grid {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.report-config-grid .fg { margin: 0; flex-shrink: 0; }
.incluir-pessoal-toggle-modern {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--muted);
  cursor: pointer;
  flex: 1;
  min-width: 0;
}
.btn-gerar-large {
  width: 100%;
  padding: 9px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: var(--r-md);
  font-size: 0.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all var(--t);
}
.btn-gerar-large:active { background: var(--brown-dark); transform: scale(0.98); }

/* ════════════════════════════════════════════════════════════
   @MEDIA PRINT — formatação para impressão
   ════════════════════════════════════════════════════════════ */
@media print {
  /* Esconder chrome do app */
  .hdr, .nav, .tab-hdr,
  .rel-tipo-nav,
  .teto-alertas, .ano-selector-inline,
  .btn-abrir-import { display: none !important; }

  /* Resetar container */
  body, html { height: auto !important; overflow: visible !important; font-size: 11pt; }
  .shell, .main, 
  .relatorio-wrap {
    padding: 0 !important;
    gap: 10pt !important;
  }

  /* Cards sem sombra, sem quebra interna */
  .sheet-card {
    box-shadow: none !important;
    border: 1px solid var(--border) !important;
    break-inside: avoid;
    margin-bottom: 8pt;
  }

  /* Tabelas: mostrar sem scroll */
  .lc-quadro, .tabela-anual {
    overflow: visible !important;
  }
  .lc-q-linha  { min-width: auto !important; }
  .ta-hdr, .ta-row { min-width: auto !important; }

  /* Livro Caixa: restaurar grid de 4 colunas no papel */
  .lc-hdr {
    display: grid !important;
    grid-template-columns: 56px 1fr 80px 64px !important;
  }
  .lc-row {
    display: grid !important;
    grid-template-columns: 56px 1fr 80px 64px !important;
    flex-wrap: unset !important;
  }
  .lc-col-data, .lc-col-desc, .lc-col-cat, .lc-col-val {
    order: unset !important;
    flex: unset !important;
    padding-top: 0 !important;
  }

  /* Barra de teto sem alertas visuais desnecessários */
  .teto-card { border-left: 2px solid var(--text) !important; }

  /* Garantir cores legíveis no papel */
  
  
  
}
</style>