<template>
  <div class="tab-financeiro">

    <!-- ── Cabeçalho ───────────────────────────────────── -->
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-money-check-dollar"></i> Financeiro</h2>
        <!-- ── Seletor de grupo (estilo seletor, igual ao Painel) ── -->
        <div ref="grupoStripEl" class="seg-control">
          <button v-for="g in grupos" :key="g.id" class="seg-btn"
            :ref="el => setGrupoRef(el, g.id)"
            :class="{ active: grupoAtivo === g.id }"
            @click="grupoAtivo = g.id">
            {{ g.label }}
          </button>
        </div>
      </div>

      <!-- ── Navegação de abas ────────────────────────── -->
      <div ref="abaStripEl" class="aba-nav">
        <button v-for="aba in abasVisiveis" :key="aba.id" class="aba-btn"
          :ref="el => setAbaRef(el, aba.id)"
          :class="{ active: abaAtiva === aba.id }"
          :data-id="aba.id"
          @click="abaAtiva = aba.id">
          <i :class="aba.icon"></i> {{ aba.label }}
        </button>
      </div>
    </div>

    <!-- ═══ ABA: IMPORTAR ═══ -->
    <template v-if="abaAtiva === 'importar'">
      <div class="relatorio-wrap im-pagina">

        <header class="im-cab">
          <h3 class="im-titulo">Importar extrato</h3>
          <p class="im-desc">Traga os lançamentos do seu banco para o app enviando o arquivo do extrato.</p>
        </header>

        <div v-if="!temAlgumBancoConfigurado" class="im-card im-vazio">
          <div class="im-vazio-icone"><i class="fas fa-building-columns"></i></div>
          <strong>Nenhuma conta cadastrada</strong>
          <span>Cadastre uma conta bancária em Ajustes › Financeiro para poder importar extratos.</span>
        </div>

        <template v-else>
          <!-- Passo 1: banco (só aparece quando há mais de um) -->
          <section v-if="bancosImportacaoDisponiveis.length > 1" class="im-bloco">
            <div class="im-passo-cab"><span class="im-passo">1</span><h4>Escolha o banco</h4></div>
            <div class="im-bancos" role="radiogroup" aria-label="Banco do extrato">
              <button v-if="temContasPagbank" class="im-banco" :class="{ active: bancoImport === 'pagbank' }" role="radio" :aria-checked="bancoImport === 'pagbank'" @click="bancoImport = 'pagbank'">
                <i class="fas fa-file-csv"></i><strong>PagBank</strong><span>arquivo CSV</span>
              </button>
              <button v-if="temContasItau" class="im-banco" :class="{ active: bancoImport === 'itau' }" role="radio" :aria-checked="bancoImport === 'itau'" @click="bancoImport = 'itau'">
                <i class="fas fa-file-pdf"></i><strong>Itaú</strong><span>arquivo PDF</span>
              </button>
              <button v-if="temContasBb" class="im-banco" :class="{ active: bancoImport === 'bb' }" role="radio" :aria-checked="bancoImport === 'bb'" @click="bancoImport = 'bb'">
                <i class="fas fa-file-csv"></i><strong>BB</strong><span>arquivo CSV</span>
              </button>
            </div>
          </section>

          <!-- Passo 2: envio do arquivo (os importadores são componentes próprios, não mudam) -->
          <section class="im-bloco">
            <div class="im-passo-cab">
              <span v-if="bancosImportacaoDisponiveis.length > 1" class="im-passo">2</span>
              <h4>{{ bancoImport === 'itau' ? 'Envie o PDF do Itaú' : bancoImport === 'bb' ? 'Envie o CSV do Banco do Brasil' : 'Envie o CSV do PagBank' }}</h4>
            </div>
            <div class="im-card im-card--painel">
              <div class="importador-panel">
                <ImportadorExtrato v-if="bancoImport === 'pagbank'" @editar-lancamento="abrirModalEdicao" />
                <ImportadorItau v-else-if="bancoImport === 'itau'" />
                <ImportadorBancoBrasil v-else-if="bancoImport === 'bb'" />
              </div>
            </div>
          </section>
        </template>

        <!-- Gerenciar / excluir extratos: separado e em vermelho, por ser irreversível -->
        <section v-if="s.financeiro.length" class="im-bloco">
          <div class="im-card im-card--risco">
            <button class="im-admin-toggle" :aria-expanded="mostrarExcluirBanco" @click="mostrarExcluirBanco = !mostrarExcluirBanco">
              <span class="im-admin-icone"><i class="fas fa-trash-can"></i></span>
              <span class="im-admin-txt">
                <strong>Excluir extratos importados</strong>
                <small>{{ s.financeiro.length }} {{ s.financeiro.length === 1 ? 'lançamento guardado' : 'lançamentos guardados' }}</small>
              </span>
              <i class="fas im-admin-seta" :class="mostrarExcluirBanco ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
            </button>
            <Transition name="fade-slide">
              <div v-if="mostrarExcluirBanco" class="im-excluir">
                <p class="im-excluir-aviso"><i class="fas fa-triangle-exclamation"></i> Excluir é permanente e não dá para desfazer. Antes de confirmar, o app pergunta de novo.</p>
                <button v-for="b in bancosComLancamentos" :key="b.id" class="im-excluir-btn" @click="handleExcluirPorBanco(b.id)">
                  <span class="im-excluir-nome">{{ b.label }}</span>
                  <span class="im-excluir-qtd">{{ b.count }} {{ b.count === 1 ? 'lançamento' : 'lançamentos' }}</span>
                  <i class="fas fa-chevron-right"></i>
                </button>
                <button class="im-excluir-btn im-excluir-btn--todos" @click="handleExcluirPorBanco('todos')">
                  <span class="im-excluir-nome">Excluir tudo</span>
                  <span class="im-excluir-qtd">{{ s.financeiro.length }} {{ s.financeiro.length === 1 ? 'lançamento' : 'lançamentos' }}</span>
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
            </Transition>
          </div>
        </section>
      </div>
    </template>

    <template v-else-if="abaAtiva === 'lancamentos'">

      <!-- ── Resumo do mês: navegação de mês + totais (rola junto com a lista) ── -->
      <div class="mv-resumo">
        <div v-if="mesesDisponiveis.length" class="mv-mes">
          <button class="mv-mes-btn" :disabled="!temMesMaisAntigo" aria-label="Mês anterior" @click="irParaMesMaisAntigo"><i class="fas fa-chevron-left"></i></button>
          <div class="mv-mes-centro">
            <span>{{ rotuloMes(filtroMes) }}</span><i class="fas fa-chevron-down mv-mes-caret"></i>
            <select v-model="filtroMes" aria-label="Escolher mês">
              <option value="">Todos os períodos</option>
              <option v-for="m in mesesDisponiveis" :key="m" :value="m">{{ rotuloMes(m) }}</option>
            </select>
          </div>
          <button class="mv-mes-btn" :disabled="!temMesMaisNovo" aria-label="Próximo mês" @click="irParaMesMaisNovo"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="mv-tot">
          <div><span>Entradas</span><b class="c-green">{{ Rs(totalEntradas) }}</b></div>
          <div><span>Saídas</span><b class="c-red">{{ Rs(totalSaidas) }}</b></div>
          <div><span>Saldo</span><b :class="saldoFiltrado >= 0 ? 'c-green' : 'c-red'">{{ Rs(saldoFiltrado) }}</b></div>
        </div>
      </div>

      <!-- ── Tipo de lançamento (atalho rápido) ── -->
      <div class="mv-seg" role="group" aria-label="Tipo de lançamento">
        <button v-for="t in TIPOS_MOV" :key="t.id" type="button" class="mv-seg-btn" :class="{ ativo: filtroNatureza === t.id }" :aria-pressed="filtroNatureza === t.id" @click="escolherTipo(t.id)">{{ t.nome }}</button>
      </div>

      <!-- ── Busca + Filtros: única linha que fica fixa ao rolar ── -->
      <div class="lancamentos-sticky">
        <div class="mv-bar">
          <label class="mv-busca">
            <i class="fas fa-search"></i>
            <input v-model.trim="buscaDescricao" type="search" inputmode="search" enterkeyhint="search" placeholder="Buscar lançamento" autocomplete="off" />
            <button v-if="buscaDescricao" type="button" class="mv-busca-x" aria-label="Limpar busca" @click.prevent="buscaDescricao = ''"><i class="fas fa-xmark"></i></button>
          </label>
          <button type="button" class="mv-btn-filtros" :class="{ ativo: nFiltrosPainel > 0 }" aria-label="Abrir filtros" @click="painelFiltros = true">
            <i class="fas fa-sliders"></i><span>Filtros</span>
            <span v-if="nFiltrosPainel" class="mv-badge">{{ nFiltrosPainel }}</span>
          </button>
        </div>

        <!-- Filtros aplicados: contagem + etiquetas removíveis -->
        <div v-if="filtrosAtivosCount" class="mv-ativos">
          <span class="mv-count">{{ lancamentosFiltrados.length }} {{ lancamentosFiltrados.length === 1 ? 'lançamento' : 'lançamentos' }}</span>
          <div class="mv-pills">
            <button v-if="filtroBanco" type="button" class="mv-pill" @click="filtroBanco = ''">{{ bancoAtivoLabel }} <i class="fas fa-xmark"></i></button>
            <button v-if="filtroCategoria" type="button" class="mv-pill" @click="filtroCategoria = ''">{{ filtroCategoria }} <i class="fas fa-xmark"></i></button>
          </div>
          <button type="button" class="mv-limpar" @click="limparFiltros">Limpar</button>
        </div>
      </div><!-- fim .lancamentos-sticky -->

      <!-- Dica de seleção (só quando NÃO está no modo seleção) -->
      <div v-if="!modoSelecao && lancamentosFiltrados.length" class="selecao-dica">
        <i class="fas fa-hand-pointer"></i> Segure um item para selecionar vários
      </div>

      <!-- Barra de seleção em lote (quando ativa) -->
      <div v-if="modoSelecao" class="selecao-bar">
        <button class="sel-all-btn" @click="toggleSelecionarTodos">
          <i :class="todosSelecionados ? 'fas fa-square-check' : 'far fa-square'"></i>
          {{ todosSelecionados ? 'Desmarcar' : `Todos (${lancamentosFiltrados.length})` }}
        </button>
        <span v-if="selecionados.size" class="sel-count">{{ selecionados.size }} sel.</span>
        <button class="sel-fechar-btn" aria-label="Sair da seleção" @click="toggleSelecao"><i class="fas fa-xmark"></i></button>
      </div>

      <!-- Transferências internas: linha discreta, não ocupa espaço grande -->
      <button v-if="transInternasCount && !filtroCategoria"
        class="trans-interna-hint"
        @click="selecionarCategoria('Transferência Interna')">
        <i class="fas fa-arrow-right-arrow-left"></i>
        {{ transInternasCount }} {{ transInternasCount === 1 ? 'transferência interna oculta' : 'transferências internas ocultas' }} · toque para ver
      </button>

      <!-- Vazio -->
      <div v-if="!lancamentosFiltrados.length" class="app-empty">
        <i class="fas fa-inbox"></i>
        <h3>Nenhum lançamento</h3>
        <p>Importe um extrato ou ajuste os filtros.</p>
        <button v-if="temAlgumBancoConfigurado" class="btn btn-primary btn-sm mt-12" @click="abaAtiva = 'importar'">
          <i class="fas fa-file-import"></i> Importar extrato
        </button>
      </div>

      <!-- Lista simplificada -->
      <div v-else class="lancamentos-list">
        <!-- Cabeçalho de colunas (só aparece no layout de desktop) -->
        <div class="tbl-head tbl-head--fin" :class="{ 'tbl-head--sel': modoSelecao }" aria-hidden="true">
          <span>Descrição</span><span>Categoria</span><span>Data</span><span>Conta</span><span class="th-right">Valor</span>
        </div>
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
            'row-selected': selecionados.has(item.id),
            'modo-selecao': modoSelecao
          }"
          @click="modoSelecao ? toggleItem(item.id) : abrirModalEdicao(item)"
          @touchstart.passive="iniciarLongPress(item)"
          @touchend.passive="cancelarLongPress"
          @touchmove.passive="cancelarLongPress">

          <!-- Checkbox modo seleção -->
          <div v-if="modoSelecao" class="row-check">
            <i :class="selecionados.has(item.id) ? 'fas fa-square-check' : 'far fa-square'"></i>
          </div>

          <div class="row-left">
            <div class="row-title">{{ capitalizarDescricao(item.descricao) }}</div>
            <div class="row-subtitle">
              <span class="fl-data">{{ formatarData(item.data) }}</span>
              <span class="badge">{{ item.categoria }}</span>
              <span class="fl-banco" :title="item.banco === 'itau' ? 'Itaú' : item.banco === 'bb' ? 'Banco do Brasil' : 'PagBank'"><span class="fl-dot">·</span> <span class="fl-banco-nome">{{ item.banco === 'itau' ? 'Itaú' : item.banco === 'bb' ? 'BB' : 'PagBank' }}</span><span class="fl-banco-sigla">{{ item.banco === 'itau' ? 'IT' : item.banco === 'bb' ? 'BB' : 'PB' }}</span></span>
            </div>
          </div>
          <div class="row-right" :class="item.valor >= 0 ? 'green' : 'red'">
            {{ item.valor >= 0 ? '+' : '−' }}{{ R$(Math.abs(item.valor)) }}
          </div>
        </FinanceListRow>
      </div>

      <!-- ── Painel de filtros ── -->
      <BaseModal v-if="painelFiltros" title="Filtros" @close="painelFiltros = false">
        <div class="mv-painel">
          <div class="mv-sec">
            <div class="mv-sec-tit">Tipo</div>
            <div class="mv-chips">
              <button v-for="t in TIPOS_MOV" :key="t.id" type="button" class="mv-chip" :class="{ ativo: filtroNatureza === t.id }" @click="escolherTipo(t.id)">{{ t.nome }}</button>
            </div>
          </div>

          <div v-if="filtrosBanco.length > 2" class="mv-sec">
            <div class="mv-sec-tit">Banco</div>
            <div class="mv-chips">
              <button v-for="b in filtrosBanco" :key="b.id" type="button" class="mv-chip" :class="{ ativo: filtroBanco === b.id }" @click="filtroBanco = b.id">{{ b.label }}</button>
            </div>
          </div>

          <div class="mv-sec mv-sec--lista">
            <div class="mv-sec-tit">Categoria</div>
            <div class="cat-list mv-cats">
              <button class="cat-list-item" :class="{ active: !filtroCategoria }" @click="selecionarCategoria('')">
                <i class="fas fa-layer-group cat-list-icon"></i><span>Todas as categorias</span>
                <i v-if="!filtroCategoria" class="fas fa-check cat-list-check"></i>
              </button>
              <template v-for="grupo in gruposCategoriasFiltro" :key="grupo.nome">
                <div class="cat-list-grupo">{{ grupo.nome }}</div>
                <button v-for="cat in grupo.categorias" :key="cat.nome" class="cat-list-item" :class="{ active: filtroCategoria === cat.nome }" @click="selecionarCategoria(cat.nome)">
                  <i class="fas cat-list-icon" :class="cat.icon"></i><span>{{ cat.nome }}</span>
                  <i v-if="filtroCategoria === cat.nome" class="fas fa-check cat-list-check"></i>
                </button>
              </template>
            </div>
          </div>
        </div>
        <template #foot>
          <button type="button" class="btn btn-secondary" :disabled="!filtrosAtivosCount" @click="limparFiltros">Limpar</button>
          <button type="button" class="btn btn-primary mv-foot-ver" @click="painelFiltros = false">Ver {{ lancamentosFiltrados.length }} {{ lancamentosFiltrados.length === 1 ? 'lançamento' : 'lançamentos' }}</button>
        </template>
      </BaseModal>
    </template>

    <!-- ═══ ABA: MENSAL ═══ -->
    <!-- ═══ ABA: FIADO × À VISTA (conciliação do extrato com a Caderneta) ═══ -->
    <template v-else-if="abaAtiva === 'vendas'">
      <div class="relatorio-wrap">
        <ConciliacaoVendas />
      </div>
    </template>

    <!-- ═══ ABA: CAIXA E CUSTOS (fôlego, DAS, custos fixos reais, custo real) ═══ -->
    <template v-else-if="abaAtiva === 'caixa'">
      <div class="relatorio-wrap">
        <SaudeFinanceira />
      </div>
    </template>

    <template v-else-if="abaAtiva === 'mensal'">
      <div class="relatorio-wrap rs-pagina">

        <!-- ── Período (mês compartilhado com Movimentações) ── -->
        <div class="rs-periodo">
          <div class="rs-seg" role="group" aria-label="Tipo de período">
            <button type="button" class="rs-seg-btn" :class="{ ativo: modoMensal === 'mes' }" :aria-pressed="modoMensal === 'mes'" @click="modoMensal = 'mes'">Mês</button>
            <button type="button" class="rs-seg-btn" :class="{ ativo: modoMensal === 'ano' }" :aria-pressed="modoMensal === 'ano'" @click="modoMensal = 'ano'">Ano</button>
          </div>
          <div class="rs-nav">
            <button type="button" class="rs-nav-btn" :disabled="!temAnterior" aria-label="Período anterior" @click="periodoAnterior"><i class="fas fa-chevron-left"></i></button>
            <div class="rs-nav-centro">
              <span>{{ modoMensal === 'mes' ? rotuloMes(mesFiltroMensal) : anoFiltroMensal }}</span><i class="fas fa-chevron-down rs-nav-caret"></i>
              <select v-if="modoMensal === 'mes'" v-model="mesFiltroMensal" aria-label="Escolher mês">
                <option v-for="m in mesesDisponiveis" :key="m" :value="m">{{ rotuloMes(m) }}</option>
              </select>
              <select v-else v-model="anoFiltroMensal" aria-label="Escolher ano">
                <option v-for="a in anosDisponiveis" :key="a" :value="a">{{ a }}</option>
              </select>
            </div>
            <button type="button" class="rs-nav-btn" :disabled="!temProximo" aria-label="Próximo período" @click="periodoProximo"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>

        <div v-if="!resumo" class="rs-vazio">
          <i class="fas fa-inbox"></i>
          <b>Sem lançamentos neste período</b>
          <span>Importe um extrato ou escolha outro {{ modoMensal === 'mes' ? 'mês' : 'ano' }}.</span>
        </div>

        <template v-else>
          <!-- ── Resultado em destaque ── -->
          <section class="rs-hero" :class="resumo.saldo_mes >= 0 ? 'ok' : 'neg'">
            <div class="rs-hero-rot">{{ resumo.saldo_mes >= 0 ? 'Sobrou' : 'Faltou' }} em {{ modoMensal === 'mes' ? nomeMesSozinho : anoFiltroMensal }}</div>
            <div class="rs-hero-val">{{ Rs(Math.abs(resumo.saldo_mes)) }}</div>
            <div v-if="variacao" class="rs-var" :class="variacao.pct >= 0 ? 'sobe' : 'desce'">
              <i class="fas" :class="variacao.pct >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'"></i>
              Receita MEI {{ variacao.pct >= 0 ? '+' : '' }}{{ variacao.pct }}% em relação a {{ variacao.contra }}
            </div>
            <div v-else-if="emAndamento" class="rs-var neutro"><i class="fas fa-hourglass-half"></i> {{ modoMensal === 'mes' ? 'Mês em andamento' : 'Ano em andamento' }} — a comparação aparece quando fechar</div>
            <p class="rs-conta">Tudo que entrou no banco − despesas do negócio − despesas pessoais.</p>
          </section>

          <!-- ── Para onde foi o dinheiro ── -->
          <section class="rs-card">
            <div class="rs-linha">
              <div class="rs-linha-txt">
                <span><i class="rs-ponto verde"></i> Receita MEI</span>
                <small v-if="canalTexto">{{ canalTexto }}</small>
              </div>
              <b class="c-green">{{ Rs(resumo.receitas_mei) }}</b>
            </div>
            <div class="rs-linha">
              <div class="rs-linha-txt"><span><i class="rs-ponto vermelho"></i> Despesas do negócio</span></div>
              <b class="c-red">{{ Rs(resumo.saidas_operacionais) }}</b>
            </div>
            <div class="rs-linha">
              <div class="rs-linha-txt"><span><i class="rs-ponto vermelho"></i> Despesas pessoais</span></div>
              <b class="c-red">{{ Rs(resumo.saidas_pessoais) }}</b>
            </div>

            <div v-if="uso" class="rs-uso">
              <div class="rs-uso-barra" role="img" :aria-label="`Despesas do negócio ${uso.op}%, pessoais ${uso.pes}%, sobra ${uso.sobra}%`">
                <span class="u-op" :style="{ width: uso.op + '%' }"></span><span class="u-pes" :style="{ width: uso.pes + '%' }"></span><span v-if="uso.sobra > 0" class="u-sobra" :style="{ width: uso.sobra + '%' }"></span>
              </div>
              <div class="rs-uso-leg">
                <span><i class="u-op"></i> Negócio {{ uso.op }}%</span>
                <span><i class="u-pes"></i> Pessoal {{ uso.pes }}%</span>
                <span v-if="uso.sobra > 0"><i class="u-sobra"></i> Sobrou {{ uso.sobra }}%</span>
                <span v-if="uso.deficit" class="deficit">Gastou mais do que entrou</span>
              </div>
            </div>

            <button type="button" class="rs-toggle" :aria-expanded="!!detalhesMensalAbertos[chaveDetalhe]" @click="toggleDetalhesMensal(chaveDetalhe)">
              {{ detalhesMensalAbertos[chaveDetalhe] ? 'Esconder' : 'Ver' }} a conta completa <i class="fas" :class="detalhesMensalAbertos[chaveDetalhe] ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
            </button>
            <div v-if="detalhesMensalAbertos[chaveDetalhe]" class="rs-detalhe">
              <div class="rs-det-linha"><span>Entrou no banco</span><b>{{ Rs(resumo.entradas) }}</b></div>
              <div class="rs-det-linha sub"><span>Receita MEI</span><b>{{ Rs(resumo.receitas_mei) }}</b></div>
              <div v-if="resumo.rendimento_financeiro > 0" class="rs-det-linha sub"><span>Rendimento financeiro</span><b>{{ Rs(resumo.rendimento_financeiro) }}</b></div>
              <div v-if="resumo.outras_entradas_nao_mei > 0" class="rs-det-linha sub"><span>Outras entradas (não são do MEI)</span><b>{{ Rs(resumo.outras_entradas_nao_mei) }}</b></div>
              <div class="rs-det-linha"><span>− Despesas do negócio</span><b class="c-red">{{ Rs(resumo.saidas_operacionais) }}</b></div>
              <div class="rs-det-linha"><span>− Despesas pessoais</span><b class="c-red">{{ Rs(resumo.saidas_pessoais) }}</b></div>
              <div class="rs-det-linha total"><span>= {{ resumo.saldo_mes >= 0 ? 'Sobrou' : 'Faltou' }}</span><b :class="resumo.saldo_mes >= 0 ? 'c-green' : 'c-red'">{{ Rs(Math.abs(resumo.saldo_mes)) }}</b></div>
              <div class="rs-det-sep"></div>
              <div class="rs-det-linha"><span>Resultado do negócio</span><b :class="resumo.saldo_operacional >= 0 ? 'c-green' : 'c-red'">{{ Rs(resumo.saldo_operacional) }}</b></div>
              <p class="rs-det-nota">É só a Receita MEI menos as despesas do negócio, sem contar entradas e gastos pessoais. Mostra se as vendas pagam o negócio.</p>
            </div>
          </section>

          <!-- ── Ano: gráfico mês a mês ── -->
          <section v-if="modoMensal === 'ano' && grafico" class="rs-bloco">
            <div class="rs-bloco-tit">Mês a mês</div>
            <div class="rs-grafico-box">
              <svg :viewBox="`0 0 ${grafico.W} ${grafico.H}`" class="rs-grafico" role="img" aria-label="Receita MEI e despesas de cada mês do ano">
                <text class="max" x="4" y="10">{{ Rs(grafico.max) }}</text>
                <line class="base" x1="0" :x2="grafico.W" :y1="grafico.T + grafico.ch" :y2="grafico.T + grafico.ch" />
                <g v-for="g in grafico.barras" :key="g.m" class="col" :class="{ vazio: !g.tem }" @click="g.tem && irParaMes(g.ref)">
                  <rect class="hit" :x="g.slotX" y="0" :width="g.slot" :height="grafico.H" />
                  <rect class="b-rec" :x="g.rx" :y="g.base - g.rh" :width="g.w" :height="Math.max(g.rh, g.tem ? 1 : 0)" rx="2" />
                  <rect class="b-desp" :x="g.dx" :y="g.base - g.dh" :width="g.w" :height="Math.max(g.dh, g.tem ? 1 : 0)" rx="2" />
                  <text class="mes" :x="g.cx" :y="grafico.H - 6" text-anchor="middle">{{ g.letra }}</text>
                </g>
              </svg>
              <div class="rs-leg"><span><i class="b-rec"></i> Receita MEI</span><span><i class="b-desp"></i> Despesas</span><span class="dica">Toque num mês para abrir</span></div>
            </div>
            <div class="rs-meses">
              <button v-for="m in mesesDoAnoVisiveis" :key="m.ref" type="button" class="rs-mes" @click="irParaMes(m.ref)">
                <span class="rs-mes-nome">{{ m.nome }}</span>
                <span class="rs-mes-rec">{{ Rs(m.receita) }}</span>
                <span class="rs-mes-desp">{{ Rs(m.despesa) }}</span>
                <b class="rs-mes-sobra" :class="m.sobra >= 0 ? 'c-green' : 'c-red'">{{ m.sobra >= 0 ? '+' : '−' }}{{ Rs(Math.abs(m.sobra)) }}</b>
              </button>
            </div>
            <button v-if="mesesDoAno.length > 6" type="button" class="rs-mais" @click="verTodosMeses = !verTodosMeses">
              {{ verTodosMeses ? 'Mostrar menos' : `Ver todos os ${mesesDoAno.length} meses` }} <i class="fas" :class="verTodosMeses ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
            </button>
          </section>
        </template>

        <!-- ── Categorias: maiores primeiro; toque abre as Movimentações filtradas ── -->
        <section v-if="resumo" class="rs-bloco">
          <div class="rs-bloco-cab">
            <div class="rs-bloco-tit">Por categoria</div>
            <div class="rs-seg rs-seg--mini" role="group" aria-label="Saídas ou entradas">
              <button type="button" class="rs-seg-btn" :class="{ ativo: catTipo === 'saidas' }" @click="catTipo = 'saidas'">Saídas</button>
              <button type="button" class="rs-seg-btn" :class="{ ativo: catTipo === 'entradas' }" @click="catTipo = 'entradas'">Entradas</button>
            </div>
          </div>
          <div v-if="!catLista.length" class="rs-nada">Nada neste grupo no período.</div>
          <div v-else class="rs-cats">
            <button v-for="c in catVisiveis" :key="c.categoria" type="button" class="rs-cat" @click="verMovimentacoes({ categoria: c.categoria })">
              <span class="rs-cat-info">
                <span class="rs-cat-nome">{{ c.categoria }}</span>
                <span class="rs-cat-sub">{{ c.quantidade }} {{ c.quantidade === 1 ? 'lançamento' : 'lançamentos' }} · {{ c.pct }}%</span>
              </span>
              <b class="rs-cat-valor">{{ Rs(c.total) }}</b>
              <i class="fas fa-chevron-right rs-cat-chev"></i>
              <span class="rs-cat-barra"><i :class="catTipo" :style="{ width: Math.max(c.pct, 2) + '%' }"></i></span>
            </button>
          </div>
          <button v-if="catLista.length > 5" type="button" class="rs-mais" @click="verTodasCats = !verTodasCats">
            {{ verTodasCats ? 'Mostrar menos' : `Ver todas (${catLista.length})` }} <i class="fas" :class="verTodasCats ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>
        </section>

        <!-- ── Por banco ── -->
        <section v-if="resumo && bancosResumo.length" class="rs-bloco">
          <div class="rs-bloco-tit">Por banco</div>
          <div class="rs-bancos">
            <button v-for="bk in bancosResumo" :key="bk.id" type="button" class="rs-banco" :class="'b-' + bk.id" @click="verMovimentacoes({ banco: bk.id })">
              <span class="rs-banco-nome"><i class="fas" :class="bk.icon"></i> {{ bk.nome }}</span>
              <b :class="bk.saldo >= 0 ? 'c-green' : 'c-red'">{{ Rs(bk.saldo) }}</b>
              <small>entrou {{ Rs(bk.receitas) }} · saiu {{ Rs(bk.saidas) }}</small>
            </button>
          </div>
        </section>

      </div>
    </template>

    <!-- ═══ ABA: META DE RETIRADA ═══ -->
    <template v-else-if="abaAtiva === 'mao-de-obra'">
      <div class="relatorio-wrap mo-pagina">
          <div class="mo-corpo">

            <header class="mo-cab">
              <h3 class="mo-titulo">Retirada e mão de obra</h3>
              <p class="mo-desc">Quanto você pode retirar com segurança em cada mês e quanto vale a sua hora de trabalho.</p>
            </header>

            <!-- Cabeçalho: as duas métricas globais, com o mesmo peso visual -->
            <div class="mtr-kpis">
              <div class="mtr-kpi">
                <div class="mtr-kpi-ico"><i class="fas fa-bullseye"></i></div>
                <div class="mtr-kpi-txt">
                  <span class="mtr-label">Meta de retirada</span>
                  <strong class="mtr-valor">{{ R$(s.company.meta_salario_mensal) }}</strong>
                  <span class="mtr-sub">Quanto você quer tirar por mês</span>
                </div>
              </div>
              <div class="mtr-kpi mtr-kpi--giro">
                <div class="mtr-kpi-ico"><i class="fas fa-shield-halved"></i></div>
                <div class="mtr-kpi-txt">
                  <span class="mtr-label">Giro de segurança</span>
                  <strong class="mtr-valor c-orange">{{ R$(s.sugestaoProvisionamentoSemanal) }}</strong>
                  <span class="mtr-sub">Reservado p/ próxima compra de insumos</span>
                </div>
              </div>
            </div>

            <!-- Lista de meses -->
            <div v-if="s.resumoProducaoPorMes.length" class="mtr-lista">
              <div v-for="mes in s.resumoProducaoPorMes" :key="mes.mes_ref" class="mtr-card">

                <!-- Linha topo: mês + selo de status -->
                <div class="mtr-card-topo">
                  <span class="mtr-card-mes">{{ mes.mes_ref }}</span>
                  <span class="mtr-badge"
                    :class="retirSegura(mes) >= (s.metaSalarioEm(mes.mes_ref) || 0) ? 'mtr-badge--ok' : retirSegura(mes) > 0 ? 'mtr-badge--parcial' : 'mtr-badge--baixo'">
                    {{ retirSegura(mes) >= (s.metaSalarioEm(mes.mes_ref) || 0) ? 'Meta atingida' : retirSegura(mes) > 0 ? 'Abaixo da meta' : 'Sem margem' }}
                  </span>
                </div>

                <!-- Número principal: o que realmente importa nesse card -->
                <div class="mtr-card-principal">
                  <span class="mtr-card-principal-lbl">Retirada segura</span>
                  <strong class="mtr-card-retirada" :class="retirSegura(mes) >= (s.metaSalarioEm(mes.mes_ref) || 0) ? 'c-green' : retirSegura(mes) > 0 ? 'c-orange' : 'c-red'">
                    {{ R$(Math.max(0, retirSegura(mes))) }}
                  </strong>
                </div>

                <div v-if="retiradoMes(mes) > 0" class="mtr-retirado">
                  <span>Já retirado no mês <strong>{{ R$(retiradoMes(mes)) }}</strong></span>
                  <span>Ainda disponível <strong :class="aindaDisponivel(mes) > 0 ? 'c-green' : 'c-red'">{{ R$(Math.max(0, aindaDisponivel(mes))) }}</strong></span>
                </div>
                <div v-if="mes.a_classificar_qtd > 0" class="fin-aviso fin-aviso--mini">
                  <i class="fas fa-circle-question"></i>
                  <span>{{ mes.a_classificar_qtd }} {{ mes.a_classificar_qtd === 1 ? 'lançamento' : 'lançamentos' }} ({{ R$(mes.a_classificar_valor) }}) em "A classificar" contam como despesa. Se forem retiradas, mude para Pró-labore / Retirada.</span>
                </div>

                <!-- Barra de progresso em relação à meta -->
                <div class="mtr-bar-row">
                  <div class="mtr-bar-bg" aria-hidden="true">
                    <div class="mtr-bar-fill"
                      :style="{
                        width: s.metaSalarioEm(mes.mes_ref)
                          ? Math.min(100, Math.max(0, retirSegura(mes)) / s.metaSalarioEm(mes.mes_ref) * 100) + '%'
                          : '0%',
                        background: retirSegura(mes) >= (s.metaSalarioEm(mes.mes_ref) || 0) ? 'var(--green)' : 'var(--accent)'
                      }">
                    </div>
                  </div>
                  <span class="mtr-bar-pct">
                    {{ s.metaSalarioEm(mes.mes_ref) ? Math.round(Math.min(100, Math.max(0, retirSegura(mes)) / s.metaSalarioEm(mes.mes_ref) * 100)) : 0 }}%
                  </span>
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

                <!-- Detalhes do cálculo — escondido por padrão pra não poluir o card -->
                <button class="mtr-detalhes-toggle" @click="toggleDetalhesMes(mes.mes_ref)">
                  <span><i class="fas fa-calculator"></i> Ver como foi calculado</span>
                  <i class="fas" :class="detalhesAbertos[mes.mes_ref] ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                </button>
                <Transition name="fade-slide">
                  <div v-if="detalhesAbertos[mes.mes_ref]" class="mtr-equacao">
                    <div class="mtr-eq-row">
                      <span>Vendas</span>
                      <strong class="c-green">{{ R$(mes.receitas_reais_banco) }}</strong>
                    </div>
                    <div class="mtr-eq-row mtr-eq-row--sub">
                      <span>− Despesas</span>
                      <strong class="c-red">{{ R$(mes.despesas_reais_banco) }}</strong>
                    </div>
                    <div class="mtr-eq-row mtr-eq-row--sub">
                      <span>− Reserva (giro)</span>
                      <strong class="c-orange">{{ R$(s.reservaGiroEm(mes.mes_ref)) }}</strong>
                    </div>
                    <div class="mtr-eq-row mtr-eq-row--result">
                      <span>= Retirada segura</span>
                      <strong :class="retirSegura(mes) >= 0 ? 'c-green' : 'c-red'">{{ R$(retirSegura(mes)) }}</strong>
                    </div>
                    <template v-if="retiradoMes(mes) > 0">
                      <div class="mtr-eq-row mtr-eq-row--sub">
                        <span>− Já retirado no mês</span>
                        <strong class="c-orange">{{ R$(retiradoMes(mes)) }}</strong>
                      </div>
                      <div class="mtr-eq-row mtr-eq-row--result">
                        <span>= Ainda disponível</span>
                        <strong :class="aindaDisponivel(mes) >= 0 ? 'c-green' : 'c-red'">{{ R$(aindaDisponivel(mes)) }}</strong>
                      </div>
                    </template>
                  </div>
                </Transition>

              </div>
            </div>
            <div v-else class="mo-vazio"><i class="fas fa-chart-simple"></i><strong>Nenhum dado financeiro ainda</strong><span>Importe um extrato para ver aqui a retirada segura de cada mês.</span></div>

            <!-- Explicação do tempo de produção — colapsável, fica fora do caminho -->
            <button class="mtr-explainer-toggle" @click="explicacaoAberta = !explicacaoAberta">
              <span><i class="fas fa-lightbulb"></i> Para que serve registrar o tempo de produção?</span>
              <i class="fas" :class="explicacaoAberta ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
            </button>
            <Transition name="fade-slide">
              <div v-if="explicacaoAberta" class="mtr-explainer">
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
            </Transition>

          </div>
      </div>
    </template>

    <!-- ═══ ABA: ANUAL ═══ -->
    <template v-else-if="abaAtiva === 'anual'">
      <div class="relatorio-wrap an-pagina">

        <header class="an-cab">
          <h3 class="an-titulo">Resumo do ano</h3>
          <p class="an-desc">Quanto entrou, quanto saiu e o que sobrou em cada ano.</p>
        </header>

        <!-- Seletor de ano -->
        <div class="an-anos" role="radiogroup" aria-label="Ano">
          <button v-for="a in anosDisponiveis" :key="a" class="an-ano" :class="{ active: anoRelAnual === a }"
            role="radio" :aria-checked="anoRelAnual === a" @click="anoRelAnual = a">{{ a }}</button>
        </div>

        <!-- Resultado do ano em destaque -->
        <div class="an-hero" :class="totalAnual.saldo >= 0 ? 'an-hero--ok' : 'an-hero--neg'">
          <span class="an-hero-lbl">{{ totalAnual.saldo >= 0 ? 'Sobrou em ' + anoRelAnual : 'Faltou em ' + anoRelAnual }}</span>
          <strong class="an-hero-valor">{{ R$(totalAnual.saldo) }}</strong>
          <span class="an-hero-sub">Receita MEI − despesas operacionais</span>
        </div>

        <!-- De onde veio e para onde foi -->
        <section class="an-bloco">
          <header class="an-bloco-cab"><h4 class="an-bloco-titulo">Entradas e saídas</h4></header>
          <div class="an-card">
            <div class="an-linha">
              <span class="an-ponto an-ponto--verde"></span>
              <div class="an-linha-txt">
                <div class="an-linha-nome">Receita MEI</div>
                <div class="an-linha-sub">PIX de clientes (sem renda pessoal)</div>
              </div>
              <strong class="an-linha-valor c-green">{{ R$(totalAnual.receitas) }}</strong>
            </div>
            <div v-if="totalAnual.outras_entradas" class="an-linha">
              <span class="an-ponto an-ponto--roxo"></span>
              <div class="an-linha-txt">
                <div class="an-linha-nome">Entradas não-MEI</div>
                <div class="an-linha-sub">Renda pessoal e rendimentos. Não contam no faturamento MEI</div>
              </div>
              <strong class="an-linha-valor c-purple">{{ R$(totalAnual.outras_entradas) }}</strong>
            </div>
            <div class="an-linha">
              <span class="an-ponto an-ponto--vermelho"></span>
              <div class="an-linha-txt">
                <div class="an-linha-nome">Despesas operacionais</div>
                <div class="an-linha-sub">Insumos, mercado, serviços</div>
              </div>
              <strong class="an-linha-valor c-red">{{ R$(totalAnual.operacional) }}</strong>
            </div>
            <div class="an-linha">
              <span class="an-ponto"></span>
              <div class="an-linha-txt">
                <div class="an-linha-nome">Despesas pessoais</div>
                <div class="an-linha-sub">Moradia, transferências</div>
              </div>
              <strong class="an-linha-valor">{{ R$(totalAnual.pessoal) }}</strong>
            </div>
          </div>
        </section>

        <!-- Gráfico de barras (CSS) -->
        <section v-if="relatorioAnualMeses.length" class="an-bloco">
          <header class="an-bloco-cab"><h4 class="an-bloco-titulo">Evolução mensal</h4></header>
          <div class="an-card an-card--pad">
            <div class="an-legenda">
              <span class="an-leg an-leg--verde"><i></i> Receita MEI</span>
              <span class="an-leg an-leg--vermelho"><i></i> Saída operacional</span>
            </div>
            <div class="grafico-barras an-grafico">
              <div v-for="item in relatorioAnualMeses" :key="item.mes_ref" class="barra-grupo">
                <div class="barra-labels">
                  <div class="barra entrada" :style="{ height: barraAltura(item.receitas_mei) + 'px' }" :title="'Receita: ' + R$(item.receitas_mei)"></div>
                  <div class="barra saida" :style="{ height: barraAltura(item.saidas_operacionais) + 'px' }" :title="'Saída: ' + R$(item.saidas_operacionais)"></div>
                </div>
                <div class="barra-mes">{{ item.mes_ref.split('/')[0] }}/{{ item.mes_ref.split('/')[1].slice(2) }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Tabela mensal -->
        <section v-if="relatorioAnualMeses.length" class="an-bloco">
          <header class="an-bloco-cab"><h4 class="an-bloco-titulo">Mês a mês</h4></header>
          <div class="an-card">
            <div class="an-tabela">
              <div class="an-th"><span>Mês</span><span>Receita MEI</span><span>Saldo</span></div>
              <div v-for="item in relatorioAnualMeses" :key="item.mes_ref" class="an-tr">
                <span class="an-td-mes">{{ item.mes_ref }}</span>
                <span class="c-green">{{ R$(item.receitas_mei) }}</span>
                <span :class="item.saldo_operacional >= 0 ? 'c-green' : 'c-red'">{{ R$(item.saldo_operacional) }}</span>
              </div>
            </div>
          </div>
        </section>

        <div v-if="!relatorioAnualMeses.length" class="app-empty">
          <i class="fas fa-chart-bar"></i>
          <p>Sem dados para {{ anoRelAnual }}.</p>
          <button class="btn btn-primary" @click="abaAtiva = 'importar'">
            <i class="fas fa-file-import"></i> Importar extrato
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="abaAtiva === 'relatorios'">
      <div class="relatorio-wrap rl-pagina">

        <header class="rl-cab">
          <h3 class="rl-titulo">Relatórios oficiais</h3>
          <p class="rl-desc">Livro Caixa do mês e Declaração Anual (DASN-SIMEI) do seu MEI, para conferir aqui e gerar em PDF.</p>
        </header>

        <!-- ── Seletor tipo relatório ── -->
        <div class="rel-tipo-nav" role="radiogroup" aria-label="Tipo de relatório">
          <button class="rel-tipo-btn" :class="{ active: relTipo === 'mensal' }" role="radio" :aria-checked="relTipo === 'mensal'" @click="relTipo = 'mensal'">
            <i class="fas fa-calendar-days"></i> Livro Caixa mensal
          </button>
          <button class="rel-tipo-btn" :class="{ active: relTipo === 'anual' }" role="radio" :aria-checked="relTipo === 'anual'" @click="relTipo = 'anual'">
            <i class="fas fa-file-invoice-dollar"></i> Declaração anual
          </button>
        </div>

        <!-- ══ BARRA TETO MEI ════════════════════════════ -->
        <section class="sheet-card teto-card">
          <div class="sheet-body">
            <div class="teto-header">
              <div>
                <div class="teto-titulo">Faturamento MEI · {{ anoRelatorioAtual }}</div>
                <div class="teto-sub">Limite anual: {{ R$(TETO_MEI_ANUAL) }}<template v-if="mesesAtividadeNoAno < 12"> · proporcional a {{ mesesAtividadeNoAno }} {{ mesesAtividadeNoAno === 1 ? 'mês' : 'meses' }} de atividade</template></div>
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
                <span v-if="percentualTeto > 120">Passou de 20% acima do teto ({{ R$(faturamentoAnoRel - TETO_MEI_ANUAL) }} a mais). Pode haver desenquadramento do MEI com efeito retroativo. Procure seu contador com urgência.</span>
                <span v-else-if="percentualTeto >= 100">Teto ultrapassado em {{ R$(faturamentoAnoRel - TETO_MEI_ANUAL) }}, dentro da tolerância de 20% (até {{ R$(TETO_COM_TOLERANCIA) }}). O excedente gera DAS complementar e, acima da tolerância, há desenquadramento. Confirme com seu contador.</span>
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
                  <div class="fg rl-fg-switch" style="margin:0">
                    <label class="rl-switch-linha">
                      <span>Incluir rendas pessoais</span>
                      <input type="checkbox" role="switch" class="rl-switch" v-model="incluirRendasPessoais" />
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

              <div v-if="dadosRelMensal && dadosRelMensal.a_classificar_qtd > 0" class="fin-aviso">
                <i class="fas fa-circle-question"></i>
                <span>{{ dadosRelMensal.a_classificar_qtd }} {{ dadosRelMensal.a_classificar_qtd === 1 ? 'lançamento' : 'lançamentos' }} ({{ R$(dadosRelMensal.a_classificar_valor) }}) em <strong>A classificar</strong>: contam como despesa até você revisar. Se forem retiradas, mude para Pró-labore / Retirada (o app aprende a descrição).</span>
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
                  <div v-if="dadosRelMensal.estornos_receita > 0" class="lc-estorno">
                    <span>Estornos e devoluções (já abatidos do faturamento)</span>
                    <strong class="c-red">− {{ R$(dadosRelMensal.estornos_receita) }}</strong>
                  </div>
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
                  <div class="fg rl-fg-switch" style="margin:0">
                    <label class="rl-switch-linha">
                      <span>Incluir rendas pessoais</span>
                      <input type="checkbox" role="switch" class="rl-switch" v-model="incluirRendasPessoais" />
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
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue'
import ImportadorExtrato from '../components/ImportadorExtrato.vue'
import ImportadorItau from '../components/ImportadorItau.vue'
import ImportadorBancoBrasil from '../components/ImportadorBancoBrasil.vue'

import FinanceListRow from '../components/FinanceListRow.vue'
import ConciliacaoVendas from '../components/ConciliacaoVendas.vue'
import SaudeFinanceira from '../components/SaudeFinanceira.vue'
import BaseModal from '../components/BaseModal.vue'
import EditarCategoriaModal from '../components/EditarCategoriaModal.vue'
import CategoryFilter from '../components/CategoryFilter.vue'
import { useStore } from '../store.js'
import { db, configGet } from '../db.js'
import { conciliar } from '../modules/conciliacao.js'
import { hoje } from '../composables/useCaderneta.js'
import { R$, formatarData, normalizar } from '../utils.js'
import { useConfirm as useAppConfirm } from '../composables/useConfirm.js'
import { gerarLivroCaixa, gerarDASNSIMEI } from '../composables/useGerarDocumento.js'
import { useTabScroll } from '../composables/useTabScroll.js'

const s = useStore()
const confirmar = useAppConfirm()
const lancamentoEmEdicao = ref(null)
const bancoImport = ref('pagbank')
const mostrarExcluirBanco = ref(false)
// Popover ativo na barra de filtros compacta: '', 'busca', 'periodo', 'banco', 'tipo' ou 'categoria'
const popoverAtivo = ref('')
function togglePopover(nome) {
  popoverAtivo.value = popoverAtivo.value === nome ? '' : nome
}

// Painel de filtros (tela cheia) e atalhos de tipo da aba Movimentações
const painelFiltros = ref(false)
const TIPOS_MOV = [
  { id: '',            nome: 'Todos' },
  { id: 'entrada',     nome: 'Receitas' },
  { id: 'operacional', nome: 'Custos' },
  { id: 'pessoal',     nome: 'Pessoal' },
]
function escolherTipo(id) {
  if (!id) { filtroNatureza.value = ''; return }
  if (filtroNatureza.value !== id) selecionarNatureza(id) // mesma regra de antes: limpa a categoria ao escolher um tipo
}
// Filtros que moram no painel (a busca tem campo próprio e o mês tem navegação própria)
const nFiltrosPainel = computed(() => (filtroBanco.value ? 1 : 0) + (filtroCategoria.value ? 1 : 0) + (filtroNatureza.value ? 1 : 0))
const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
function rotuloMes(ref) { // '11/2026' -> 'Novembro 2026'
  const [m, a] = String(ref || '').split('/')
  return NOMES_MES[Number(m) - 1] ? `${NOMES_MES[Number(m) - 1]} ${a}` : 'Todos os períodos'
}

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

const grupos = [
  { id: 'diaadia', label: 'Dia a dia', icon: 'fas fa-calendar-day' },
  { id: 'mei',     label: 'MEI e Relatórios', icon: 'fas fa-file-invoice' }
]
const grupoAtivo = ref('diaadia')
const { stripEl: grupoStripEl, setTabRef: setGrupoRef } = useTabScroll(grupoAtivo)

const abas = [
  { id: 'importar',    label: 'Importar',       icon: 'fas fa-file-import',   grupo: 'diaadia' },
  { id: 'lancamentos', label: 'Movimentações', icon: 'fas fa-list',          grupo: 'diaadia' },
  { id: 'vendas',      label: 'Fiado × À vista', icon: 'fas fa-code-compare', grupo: 'diaadia' },
  { id: 'caixa',       label: 'Caixa e Custos',  icon: 'fas fa-heart-pulse',  grupo: 'diaadia' },
  { id: 'mensal',      label: 'Resumo Mensal',  icon: 'fas fa-calendar',      grupo: 'diaadia' },
  { id: 'mao-de-obra', label: 'Meta de Retirada', icon: 'fas fa-bullseye',    grupo: 'diaadia' },
  { id: 'anual',       label: 'Resumo Anual',   icon: 'fas fa-chart-bar',     grupo: 'mei' },
  { id: 'relatorios',  label: 'Documentos MEI', icon: 'fas fa-file-contract', grupo: 'mei' }
]
const abasVisiveis = computed(() => abas.filter(a => a.grupo === grupoAtivo.value))
const abaAtiva = ref('lancamentos')
const { stripEl: abaStripEl, setTabRef: setAbaRef } = useTabScroll(abaAtiva)

// Aba padrão de cada grupo — independe da ordem visual da tira de abas
// (ex.: "Importar" aparece antes na lista, mas "Movimentações" continua
// sendo a aba que abre por padrão).
const abaPadraoPorGrupo = { diaadia: 'lancamentos', mei: 'anual' }
watch(grupoAtivo, () => {
  abaAtiva.value = abaPadraoPorGrupo[grupoAtivo.value] || abasVisiveis.value[0]?.id
})

watch([abaAtiva, bancosImportacaoDisponiveis], () => {
  if (abaAtiva.value === 'importar') selecionarBancoImportacaoDisponivel()
}, { immediate: true })

// ── Filtros ──
const filtroBanco     = ref('')
const filtroMes       = ref('')
const filtroNatureza  = ref('')
const filtroCategoria = ref('')
const buscaDescricao = ref('')
const buscaNoExtratoInteiro = ref(false)

const filtrosBanco = computed(() => {
  const bancos = [
    { id: '',        label: 'Todos' }
  ]
  if (temContasPagbank.value) bancos.push({ id: 'pagbank', label: 'PagBank' })
  if (temContasItau.value)    bancos.push({ id: 'itau',    label: 'Itaú' })
  if (temContasBb.value)      bancos.push({ id: 'bb',      label: 'BB' })
  return bancos
})

const bancoAtivoLabel = computed(() =>
  filtrosBanco.value.find(b => b.id === filtroBanco.value)?.label || 'Banco'
)

const tipoAtivoLabel = computed(() => {
  if (filtroNatureza.value === 'entrada') return 'Receitas'
  if (filtroNatureza.value === 'operacional') return 'Custos'
  if (filtroNatureza.value === 'pessoal') return 'Pessoal'
  return 'Tipo'
})

const gruposCategoriasFiltro = computed(() => {
  const map = new Map()
  s.categoriasFinanceiro.forEach(cat => {
    if (!map.has(cat.grupo)) map.set(cat.grupo, { nome: cat.grupo, categorias: [] })
    map.get(cat.grupo).categorias.push(cat)
  })
  return [...map.values()]
})

function capitalizarDescricao(txt) {
  if (!txt) return ''
  return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
}

function limparFiltros() {
  filtroBanco.value = filtroCategoria.value = filtroNatureza.value = ''
  buscaDescricao.value = ''
  buscaNoExtratoInteiro.value = false
  popoverAtivo.value = ''
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

// Definição única de caixa (igual no card por banco, na lista e no "saldo do mês"):
// entrou = valor positivo, saiu = valor negativo, sem transferências entre contas próprias.
function totaisCaixa(items) {
  let entradas = 0, saidas = 0
  for (const i of items) {
    if (i.natureza === 'interna') continue
    if (i.valor > 0) entradas += i.valor
    else saidas -= i.valor
  }
  return { entradas, saidas, saldo: entradas - saidas }
}

const totalEntradas  = computed(() => totaisCaixa(lancamentosFiltrados.value).entradas)
const totalSaidas    = computed(() => totaisCaixa(lancamentosFiltrados.value).saidas)

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

const anosDisponiveis = computed(() => {
  const set = new Set(s.financeiro.map(i => (i.data || '').slice(0, 4)).filter(Boolean))
  return [...set].sort((a, b) => b.localeCompare(a))
})

// ── Resumo Mensal ──
// O mês escolhido aqui é o MESMO filtro de mês da aba Movimentações: navegar numa aba vale na outra.
const modoMensal = ref('mes') // 'mes' | 'ano'
const anoFiltroMensal = ref(String(new Date().getFullYear()))
const mesFiltroMensal = computed({
  get: () => (modoMensal.value === 'mes' ? (filtroMes.value || mesesDisponiveis.value[0] || '') : ''),
  set: (v) => { if (v) { filtroMes.value = v; anoFiltroMensal.value = v.split('/')[1] } },
})
watch(filtroMes, (v) => { if (v) anoFiltroMensal.value = v.split('/')[1] }, { immediate: true })

const Rs = (v) => 'R$ ' + R$(v) // o R$ do app devolve só o número; aqui o símbolo ajuda no valor grande

const idxMesMensal = computed(() => mesesDisponiveis.value.indexOf(mesFiltroMensal.value))
const idxAnoMensal = computed(() => anosDisponiveis.value.indexOf(anoFiltroMensal.value))
const temAnterior = computed(() => modoMensal.value === 'mes'
  ? idxMesMensal.value >= 0 && idxMesMensal.value < mesesDisponiveis.value.length - 1
  : idxAnoMensal.value >= 0 && idxAnoMensal.value < anosDisponiveis.value.length - 1)
const temProximo = computed(() => (modoMensal.value === 'mes' ? idxMesMensal.value > 0 : idxAnoMensal.value > 0))
function periodoAnterior() {
  if (!temAnterior.value) return
  if (modoMensal.value === 'mes') mesFiltroMensal.value = mesesDisponiveis.value[idxMesMensal.value + 1]
  else anoFiltroMensal.value = anosDisponiveis.value[idxAnoMensal.value + 1]
}
function periodoProximo() {
  if (!temProximo.value) return
  if (modoMensal.value === 'mes') mesFiltroMensal.value = mesesDisponiveis.value[idxMesMensal.value - 1]
  else anoFiltroMensal.value = anosDisponiveis.value[idxAnoMensal.value - 1]
}
function irParaMes(ref) { modoMensal.value = 'mes'; mesFiltroMensal.value = ref }

const relatorioMensalFiltrado = computed(() => s.relatorioMensalMei.filter(item => item.mes_ref.endsWith(`/${anoFiltroMensal.value}`)))

const CAMPOS_SOMA = ['entradas', 'receitas_mei', 'outras_entradas_nao_mei', 'rendimento_financeiro', 'saidas_operacionais', 'saidas_pessoais', 'saldo_mes', 'saldo_operacional']
function somarItens(items) {
  if (!items.length) return null
  const r = {}
  for (const c of CAMPOS_SOMA) r[c] = items.reduce((a, i) => a + Number(i[c] || 0), 0)
  return r
}
const resumo = computed(() => (modoMensal.value === 'mes'
  ? (s.relatorioMensalMei.find(i => i.mes_ref === mesFiltroMensal.value) || null)
  : somarItens(relatorioMensalFiltrado.value)))
const nomeMesSozinho = computed(() => NOMES_MES[Number(String(mesFiltroMensal.value).split('/')[0]) - 1] || '')
const chaveDetalhe = computed(() => (modoMensal.value === 'mes' ? mesFiltroMensal.value : `ano-${anoFiltroMensal.value}`))

// Período ainda aberto: comparar com o anterior seria injusto (faltam dias)
const emAndamento = computed(() => {
  const agora = new Date()
  return modoMensal.value === 'mes'
    ? mesFiltroMensal.value === `${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`
    : anoFiltroMensal.value === String(agora.getFullYear())
})
const variacao = computed(() => {
  if (!resumo.value || emAndamento.value) return null
  let anterior, contra
  if (modoMensal.value === 'mes') {
    const [m, a] = mesFiltroMensal.value.split('/').map(Number)
    const ref = m === 1 ? `12/${a - 1}` : `${String(m - 1).padStart(2, '0')}/${a}`
    anterior = s.relatorioMensalMei.find(i => i.mes_ref === ref) || null
    contra = rotuloMes(ref)
  } else {
    const ant = String(Number(anoFiltroMensal.value) - 1)
    anterior = somarItens(s.relatorioMensalMei.filter(i => i.mes_ref.endsWith(`/${ant}`)))
    contra = ant
  }
  const base = Number(anterior?.receitas_mei || 0)
  if (!(base > 0)) return null
  return { pct: Math.round(((Number(resumo.value.receitas_mei || 0) - base) / base) * 100), contra }
})

// Como a entrada foi usada: negócio × pessoal × o que sobrou
const uso = computed(() => {
  const r = resumo.value
  if (!r) return null
  const op = Number(r.saidas_operacionais || 0), pes = Number(r.saidas_pessoais || 0), sobra = Math.max(0, Number(r.saldo_mes || 0))
  const total = op + pes + sobra
  if (total <= 0) return null
  return { op: Math.round((op / total) * 100), pes: Math.round((pes / total) * 100), sobra: Math.round((sobra / total) * 100), deficit: Number(r.saldo_mes || 0) < 0 }
})

// ── Receita MEI: quanto foi fiado e quanto foi à vista (vem da conciliação do extrato) ──
const canaisPorMes = ref({}) // 'AAAA-MM' -> { fiado, provavel, avista }
async function carregarCanais() {
  try {
    const [f, c, ign] = await Promise.all([db.cad_fiados.toArray(), db.cad_clientes.toArray(), configGet('conciliacao_ignorados', [])])
    const entradas = s.financeiro.filter(e => e.categoria === 'Receita de Vendas' && Number(e.valor) > 0)
    const r = conciliar({ entradas, fiados: f, clientes: c, ignorados: Array.isArray(ign) ? ign : [], hoje: hoje() })
    canaisPorMes.value = Object.fromEntries(r.meses.map(m => [m.mes, m]))
  } catch (e) { console.error('Resumo mensal: não deu para separar fiado e à vista', e) }
}
watch(abaAtiva, (a) => { if (a === 'mensal') carregarCanais() }, { immediate: true })
const canalTexto = computed(() => {
  const meses = modoMensal.value === 'mes' ? [mesFiltroMensal.value] : mesesDisponiveis.value.filter(m => m.endsWith(`/${anoFiltroMensal.value}`))
  let fiado = 0, provavel = 0, avista = 0
  for (const m of meses) {
    const [mm, aa] = String(m).split('/')
    const c = canaisPorMes.value[`${aa}-${mm}`]
    if (c) { fiado += c.fiado; provavel += c.provavel; avista += c.avista }
  }
  if (fiado + provavel + avista <= 0) return ''
  const partes = []
  if (fiado > 0) partes.push(`fiado ${Rs(fiado)}`)
  if (avista > 0) partes.push(`à vista ${Rs(avista)}`)
  if (provavel > 0) partes.push(`talvez fiado ${Rs(provavel)}`)
  return partes.join(' · ')
})

// ── Ano: gráfico e lista compacta dos meses ──
const MESES_LETRA = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const grafico = computed(() => {
  if (modoMensal.value !== 'ano') return null
  const porMes = new Map(relatorioMensalFiltrado.value.map(i => [Number(i.mes_ref.split('/')[0]), i]))
  const W = 340, H = 150, L = 4, Rr = 4, T = 18, B = 22
  const slot = (W - L - Rr) / 12, bw = Math.min(10, slot / 2 - 1.5), ch = H - T - B
  const val = (i) => [Number(i?.receitas_mei || 0), Number(i?.saidas_operacionais || 0) + Number(i?.saidas_pessoais || 0)]
  const max = Math.max(1, ...[...porMes.values()].flatMap(val))
  const barras = []
  for (let m = 1; m <= 12; m++) {
    const i = porMes.get(m); const [r, d] = val(i); const cx = L + (m - 1) * slot + slot / 2
    barras.push({ m, ref: `${String(m).padStart(2, '0')}/${anoFiltroMensal.value}`, tem: !!i, letra: MESES_LETRA[m - 1], cx,
      rx: cx - bw - 1, dx: cx + 1, w: bw, rh: (r / max) * ch, dh: (d / max) * ch, base: T + ch, slotX: cx - slot / 2, slot })
  }
  return { W, H, T, ch, max, barras }
})
const verTodosMeses = ref(false)
const mesesDoAno = computed(() => [...relatorioMensalFiltrado.value]
  .sort((a, b) => Number(b.mes_ref.split('/')[0]) - Number(a.mes_ref.split('/')[0]))
  .map(i => ({ ref: i.mes_ref, nome: NOMES_MES[Number(i.mes_ref.split('/')[0]) - 1], receita: Number(i.receitas_mei || 0),
    despesa: Number(i.saidas_operacionais || 0) + Number(i.saidas_pessoais || 0), sobra: Number(i.saldo_mes || 0) })))
const mesesDoAnoVisiveis = computed(() => (verTodosMeses.value ? mesesDoAno.value : mesesDoAno.value.slice(0, 6)))

function resumoBancoPorPeriodo(banco, ano, mes = '') {
  const items = s.financeiro.filter(i => {
    const isBanco = (i.banco || 'pagbank') === banco
    const isAno = (i.data || '').startsWith(ano)
    const isMes = mes ? i.mes_ref === mes : true
    return isBanco && isAno && isMes
  })
  // Transferências entre contas próprias (natureza 'interna') ficam de fora,
  // igual em todo o resto do Financeiro — mover dinheiro do PagBank pro Itaú
  // não é receita nem despesa do negócio.
  const { entradas, saidas, saldo } = totaisCaixa(items)
  return { receitas: entradas, saidas, saldo }
}

// Bancos do período (só os configurados ou que tiveram movimento)
const BANCOS_RESUMO = [
  { id: 'pagbank', nome: 'PagBank', icon: 'fa-mobile-screen', tem: temContasPagbank },
  { id: 'itau', nome: 'Itaú', icon: 'fa-building-columns', tem: temContasItau },
  { id: 'bb', nome: 'Banco do Brasil', icon: 'fa-landmark', tem: temContasBb },
]
const bancosResumo = computed(() => BANCOS_RESUMO
  .map(b => ({ ...b, ...resumoBancoPorPeriodo(b.id, anoFiltroMensal.value, mesFiltroMensal.value) }))
  .filter(b => b.tem.value || b.receitas || b.saidas))

// ── Categorias do período (transferências entre contas próprias ficam de fora) ──
const catTipo = ref('saidas') // 'saidas' | 'entradas'
const verTodasCats = ref(false)
watch(catTipo, () => { verTodasCats.value = false })
const categoriasPorDirecao = computed(() => {
  const mapas = { entradas: new Map(), saidas: new Map() }
  s.financeiro.forEach(i => {
    if ((i.natureza || '') === 'interna') return
    if (!(i.data || '').startsWith(anoFiltroMensal.value)) return
    if (mesFiltroMensal.value && i.mes_ref !== mesFiltroMensal.value) return
    const mapa = Number(i.valor) >= 0 ? mapas.entradas : mapas.saidas
    const chave = i.categoria || 'Sem categoria'
    if (!mapa.has(chave)) mapa.set(chave, { categoria: chave, total: 0, quantidade: 0 })
    const a = mapa.get(chave); a.total += Math.abs(Number(i.valor)); a.quantidade += 1
  })
  const fechar = (m) => {
    const lista = [...m.values()].sort((a, b) => b.total - a.total)
    const soma = lista.reduce((x, c) => x + c.total, 0) || 1
    return lista.map(c => ({ ...c, pct: Math.round((c.total / soma) * 100) }))
  }
  return { entradas: fechar(mapas.entradas), saidas: fechar(mapas.saidas) }
})
const catLista = computed(() => categoriasPorDirecao.value[catTipo.value])
const catVisiveis = computed(() => (verTodasCats.value ? catLista.value : catLista.value.slice(0, 5)))

// Abre as Movimentações já filtradas (mesmo mês, e categoria ou banco tocado)
function verMovimentacoes({ categoria = '', banco = '' } = {}) {
  limparFiltros()
  filtroCategoria.value = categoria
  filtroBanco.value = banco
  filtroMes.value = modoMensal.value === 'mes' ? mesFiltroMensal.value : ''
  abaAtiva.value = 'lancamentos'
  nextTick(() => window.scrollTo?.({ top: 0 }))
}

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

function selecionarCategoria(categoria) {
  filtroCategoria.value = categoria
  filtroNatureza.value = '' // Limpa o filtro de natureza ao selecionar uma categoria específica
  popoverAtivo.value = ''
}

function selecionarNatureza(natureza) {
  filtroNatureza.value = filtroNatureza.value === natureza ? '' : natureza
  filtroCategoria.value = '' // Limpa o filtro de categoria ao selecionar uma natureza
}

// ── Multi-seleção ──
const modoSelecao    = ref(false)
const selecionados   = ref(new Set())

// Long press para ativar seleção (500ms)
let _longPressTimer = null
function iniciarLongPress(item) {
  _longPressTimer = setTimeout(() => {
    if (!modoSelecao.value) {
      modoSelecao.value = true
      if (navigator.vibrate) navigator.vibrate(30)
    }
    const novo = new Set(selecionados.value)
    novo.add(item.id)
    selecionados.value = novo
  }, 500)
}
function cancelarLongPress() {
  clearTimeout(_longPressTimer)
}
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
    { title: 'Excluir Extrato', icon: 'fas fa-trash-can', confirmLabel: 'Excluir', type: 'danger' }
  )
  if (ok) {
    await s.limparFinanceiroPorBanco(banco)
    mostrarExcluirBanco.value = false
  }
}

// ── Helpers ──
// ── Relatórios ──────────────────────────────────────────────
const TETO_BASE_ANUAL = computed(() => s.company.teto_mei_anual || 81000)
// No ano de abertura o teto é proporcional: teto ÷ 12 × meses de atividade (mês da abertura conta inteiro).
const mesesAtividadeNoAno = computed(() => {
  const ab = String(s.company.mei_data_abertura || '')
  const [y, m] = ab.split('-').map(Number)
  if (!y || !m) return 12
  const ano = Number(anoRelAnual.value)
  if (y === ano) return Math.max(1, 13 - m)
  return y > ano ? 0 : 12
})
const TETO_MEI_ANUAL = computed(() => TETO_BASE_ANUAL.value / 12 * mesesAtividadeNoAno.value)
const TETO_COM_TOLERANCIA = computed(() => TETO_MEI_ANUAL.value * 1.2)   // excesso de até 20%
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
  // "Retirada segura" = o que o negócio gerou no mês (receitas − despesas operacionais) menos a reserva de giro.
  // Não é saldo do banco.
  const geradoNoMes = mes.total_gerado_retirada || 0
  const reservaGiro = s.reservaGiroEm(mes.mes_ref) || 0
  return geradoNoMes - reservaGiro
}
// O que já saiu do negócio para o bolso no mês (Pró-labore + transferências da conta PJ para contas próprias)
const retiradoMes = (mes) => Number(mes.retirado_negocio || 0)
const aindaDisponivel = (mes) => retirSegura(mes) - retiradoMes(mes)

// ── Meta de Retirada: accordions (detalhe do cálculo por mês + explicação) ──
// Fechados por padrão para manter o card enxuto; o usuário abre só o que
// quer conferir.
const detalhesAbertos = reactive({})
function toggleDetalhesMes(mesRef) {
  detalhesAbertos[mesRef] = !detalhesAbertos[mesRef]
}
const explicacaoAberta = ref(false)

// ── Resumo Mensal: accordion da composição de cada card de mês ──
// Mesmo princípio: o card mostra só o resultado (o que sobrou + 2
// indicadores-chave); a composição completa (receita/despesas linha a
// linha) fica escondida até o usuário pedir.
const detalhesMensalAbertos = reactive({})
function toggleDetalhesMensal(mesRef) {
  detalhesMensalAbertos[mesRef] = !detalhesMensalAbertos[mesRef]
}

onMounted(() => s.carregarFinanceiro())
</script>

<style scoped>
/* seletor de grupo agora usa .seg-control/.seg-btn globais (main.css) */
/* ── Painel excluir por banco ─────────────────────────────── */

/* Transição painel excluir */



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
.sel-fechar-btn { background: rgba(255,255,255,.14); border: none; color: rgba(255,255,255,.9); width: 44px; height: 44px; border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; margin-left: auto; }
.sel-fechar-btn:active { background: rgba(255,255,255,.22); }

/* ── Cabeçalho ─── */
.tab-hdr { 
  padding: 14px 16px 0; background: var(--surface); border-bottom: 1px solid var(--border); 
  flex-shrink: 0; 
  position: sticky; top: 0; z-index: var(--z-sticky);
}

.hdr-actions { display: flex; gap: 6px; }
.tab-financeiro .aba-btn { flex: 0 0 auto; padding-left: 12px; padding-right: 12px; }

/* ── Importadores ─── */
.importador-panel { margin: 0 -14px; border-top: 1px solid var(--border); background: var(--bg); }

.cat-list { display: flex; flex-direction: column; }
.cat-list-grupo { font-size: .8rem; font-weight: 800; color: var(--brown-mid); padding: 12px 16px 6px; background: var(--cream); border-bottom: .5px solid var(--border); }
.cat-list-item { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 10px 16px; border: none; border-bottom: .5px solid var(--border); background: var(--surface); color: var(--text); font-size: .95rem; font-weight: 600; text-align: left; width: 100%; transition: background var(--t); }
.cat-list-item:last-child { border-bottom: none; }
.cat-list-item:active { background: var(--gold-bg); }
.cat-list-item.active {
  background: var(--gold-bg);
  color: var(--brown-dark);
  border-left: 3px solid var(--brown);
  padding-left: 13px;
}
.cat-list-icon { width: 20px; text-align: center; color: var(--muted); font-size: .95rem; flex-shrink: 0; }
.cat-list-item.active .cat-list-icon { color: var(--brown-mid); }
.cat-list-item span { flex: 1; }
.cat-list-check { color: var(--brown); font-size: .9rem; }
.grupo { margin-bottom: 4px; }
.grupo-titulo { font-size: .72rem; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.grupo-natureza { padding: 2px 7px; border-radius: var(--r-full); font-size: .65rem; font-weight: 800; }
.nat-entrada { background: var(--green-bg); color: var(--green); }
.nat-operacional { background: var(--red-bg); color: var(--red); }
.nat-pessoal { background: var(--gold-bg); color: var(--orange); }
.filtro-select { padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--bg); color: var(--text); font-size: .82rem; appearance: none; }
.filtro-select.sm { width: auto; min-width: 80px; }
.nat-interna { background: var(--blue-bg); color: var(--blue); }
.check-icon { color: var(--brown) !important; font-size: .75rem !important; width: auto !important; }

/* ── Estilos Filtros Modernos Consolidados ── */
.lancamentos-sticky {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(61,31,7,.07);
}

.periodo-mini-nav { display: flex; align-items: center; gap: 8px; padding: 11px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }






/* ── Barra de filtros compacta (Movimentações): uma linha de chips + popover ── */
































/* Transições */



/* ── Aviso transferência interna ─── */
.trans-interna-hint { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 10px 16px; background: none; border: none; border-top: 1px solid var(--border); font-size: .84rem; font-weight: 700; color: var(--gold-dark); cursor: pointer; text-align: left; }
.trans-interna-hint i { font-size: .85rem; }

/* ── Barra de seleção em lote ─── */
.selecao-dica { font-size: .82rem; color: var(--muted); padding: 10px 16px 4px; display: flex; align-items: center; gap: 8px; }
.selecao-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px; background: var(--brown-dark); color: #fff; flex-shrink: 0; }
.sel-all-btn { background: none; border: none; min-height: 44px; padding: 0 6px; color: rgba(255,255,255,.92); font-size: .9rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.sel-all-btn i { font-size: 1.05rem; color: var(--gold-light); }
.sel-count { font-size: .88rem; font-weight: 800; color: var(--gold-light); }

/* ── Lista ─── */
.lancamentos-list { padding-top: 8px; padding-bottom: max(96px, calc(72px + env(safe-area-inset-bottom))); touch-action: pan-y; }
.lancamento-row { margin: 0 16px 10px; min-height: 64px; }

.row-operacional { border-left-color: var(--red); }
.row-pessoal { border-left-color: var(--purple); }
.row-entrada { border-left-color: var(--green); }
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
.row-title { font-size: .96rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-subtitle { font-size: .8rem; color: var(--muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px; }

/* ── Empty ─── */
.empty-mini { text-align: center; color: var(--muted); padding: 32px 24px; font-size: .82rem; display: flex; flex-direction: column; align-items: center; gap: 8px; line-height: 1.5; }
.empty-mini i { font-size: 1.8rem; opacity: .2; }

/* ── Relatório ─── */
.relatorio-wrap { padding: 14px 16px max(96px, calc(72px + env(safe-area-inset-bottom))); display: flex; flex-direction: column; gap: 14px; }

/* Anual */

/* Gráfico */
.grafico-barras { display: flex; align-items: flex-end; gap: 6px; height: 80px; padding-bottom: 4px; overflow-x: auto; }
.barra-grupo { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 36px; flex-shrink: 0; }
.barra-labels { display: flex; align-items: flex-end; gap: 2px; height: 64px; }
.barra { width: 14px; border-radius: 3px 3px 0 0; transition: height 0.4s ease; }
.barra.entrada { background: var(--green); }
.barra.saida   { background: var(--red); opacity: .75; }
.barra-mes { font-size: .6rem; color: var(--muted); font-weight: 600; white-space: nowrap; }

/* Tabela anual */

.renda-pessoal { background: var(--purple-bg); border-radius: 4px; padding-left: 4px; padding-right: 4px; }

/* ── Aba Relatórios ─────────────────────────────────────── */
.rel-tipo-nav { display: flex; gap: 8px; padding: 0; }
.rel-tipo-btn { flex: 1; min-height: 52px; padding: 8px 10px; border: 1.5px solid var(--border); border-radius: var(--r-lg); background: var(--surface); color: var(--brown-mid); font-size: .88rem; font-weight: 800; line-height: 1.25; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all var(--t); }
.rel-tipo-btn.active {
  background: var(--brown);
  color: #fff;
  border-color: var(--brown);
}

/* ── Barra de teto ── */
.teto-card { border-left: 3px solid var(--brown); }
.teto-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
.teto-titulo { font-size: .88rem; font-weight: 800; color: var(--brown-dark); }
.teto-sub { font-size: 0.82rem; color: var(--muted); margin-top: 2px; }
.teto-valor-wrap { text-align: right; flex-shrink: 0; }
.teto-valor { font-family: var(--mono); font-size: 1.1rem; font-weight: 800; }
.teto-pct { font-size: 0.8rem; color: var(--muted); margin-top: 2px; }

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
.teto-falta { font-size: 0.78rem; color: var(--muted); font-weight: 600; display: inline-block; }

.teto-alertas { margin-top: 4px; }
.teto-alerta {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--r-md);
  font-size: 0.86rem;
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
  font-size: 0.84rem;
}
.lc-cb-linha span { color: var(--muted); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
.lc-cb-linha strong { color: var(--text); font-size: 0.86rem; word-break: break-word; line-height: 1.3; }

.lc-section-label {
  font-size: 0.76rem;
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
.lc-row .lc-col-data { order: 3; color: var(--muted); font-size: 0.78rem; font-weight: 600; }
/* use flexbox row for first line via pseudo wrapper — handle in template instead */
.lc-col-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.lc-col-data { color: var(--muted); font-size: 0.78rem; font-weight: 600; }
.lc-col-desc { color: var(--text); word-break: break-word; line-height: 1.35; font-size: .8rem; }
.lc-col-cat  { }
.lc-col-val  { font-family: var(--mono); font-size: .86rem; font-weight: 700; flex-shrink: 0; }
.lc-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}
.lc-entrada { background: var(--green-bg); color: var(--green); }
.lc-saida   { background: var(--red-bg); color: var(--red); }
.lc-pessoal { background: var(--purple-bg); color: var(--purple); }

.lc-vazio { font-size: 0.86rem; color: var(--muted); padding: 8px 0; }

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
  font-size: 0.82rem;
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
.lc-acum-item span { display: block; font-size: 0.78rem; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 4px; }
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
  font-size: 0.84rem;
  border: 1px solid var(--border);
  border-left: 5px solid var(--brown-light);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  align-items: center;
}
.lc-q-linha.hdr {
  font-size: 0.76rem;
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
.lra-linha.sub { background: var(--bg); opacity: .8; font-size: 0.84rem; }
.lra-verificacao {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 0.84rem;
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

/* ── Meta de Retirada (reorganizada: KPIs no topo, um número principal
   por card, detalhes do cálculo e explicação escondidos por padrão) ── */

/* Cabeçalho — duas métricas com o mesmo peso visual, empilhadas no
   celular estreito (padrão do app, ver .mei-grid) e lado a lado a
   partir de 420px. */
.mtr-kpis { display: flex; flex-direction: column; gap: 10px; }
@media (min-width: 420px) { .mtr-kpis { flex-direction: row; } }
.mtr-kpi { flex: 1; display: flex; align-items: flex-start; gap: 12px; padding: 16px; background: var(--surface); border-radius: var(--r-lg); border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.mtr-kpi-ico { width: 42px; height: 42px; flex-shrink: 0; border-radius: var(--r-md); background: var(--cream); color: var(--brown); display: flex; align-items: center; justify-content: center; font-size: 1.05rem; }
.mtr-kpi--giro .mtr-kpi-ico { background: var(--orange-bg); color: var(--orange); }
.mtr-kpi-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mtr-label { font-size: .8rem; font-weight: 700; color: var(--muted); }
.mtr-valor { font-size: 1.35rem; font-weight: 800; color: var(--brown-dark); font-family: var(--mono); line-height: 1.2; }
.mtr-sub { font-size: .78rem; color: var(--muted); line-height: 1.4; margin-top: 1px; }

.mtr-lista { display: flex; flex-direction: column; gap: 12px; }

.mtr-card { border: 1px solid var(--border); border-radius: var(--r-lg); padding: 16px; background: var(--surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 14px; }

/* Mês + selo de status — dá pra escanear a lista inteira sem ler números */
.mtr-card-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mtr-card-mes { font-weight: 800; font-size: 1.08rem; color: var(--brown-dark); }
.mtr-badge { font-size: .76rem; font-weight: 800; padding: 5px 11px; border-radius: var(--r-full); white-space: nowrap; }
.mtr-badge--ok      { background: var(--green-bg);  color: var(--green); }
.mtr-badge--parcial { background: var(--orange-bg); color: var(--orange); }
.mtr-badge--baixo   { background: var(--red-bg);    color: var(--red); }

/* Número principal do card — o que a pessoa realmente veio ver */
.mtr-card-principal { display: flex; flex-direction: column; gap: 2px; }
.mtr-card-principal-lbl { font-size: .84rem; font-weight: 700; color: var(--muted); }
.mtr-card-retirada { font-size: 1.8rem; font-weight: 800; font-family: var(--mono); line-height: 1.15; font-variant-numeric: tabular-nums; }

.mtr-bar-row { display: flex; align-items: center; gap: 8px; }
.mtr-bar-bg { flex: 1; height: 10px; background: var(--border); border-radius: 5px; overflow: hidden; }
.mtr-bar-fill { height: 100%; border-radius: 5px; transition: width .6s ease; }
.mtr-bar-pct { font-size: .84rem; color: var(--brown-mid); font-weight: 800; flex-shrink: 0; min-width: 38px; text-align: right; }

.mtr-labor { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: .84rem; color: var(--muted); padding: 10px 12px; background: var(--bg); border-radius: var(--r-md); }
.mtr-labor i { color: var(--brown-light); }
.mtr-labor-sep { opacity: .4; }
.mtr-labor-meta { opacity: .75; }

/* Detalhes do cálculo — escondido por padrão, abre em lista vertical
   (evita o wrap quebrado que operadores soltos causavam em telas estreitas) */
.mtr-detalhes-toggle { width: 100%; min-height: 46px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--cream); color: var(--brown-mid); font-size: .88rem; font-weight: 700; text-align: left; cursor: pointer; }
.mtr-detalhes-toggle span { display: flex; align-items: center; gap: 6px; }
.mtr-detalhes-toggle i:last-child { font-size: .62rem; }
.mtr-detalhes-toggle:active { background: var(--cream-deep); }

.mtr-equacao { display: flex; flex-direction: column; gap: 4px; padding: 6px 4px 0; }
.mtr-eq-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 38px; font-size: .92rem; color: var(--brown); }
.mtr-eq-row--sub { color: var(--muted); }
.mtr-eq-row strong { font-family: var(--mono); font-weight: 800; font-size: .92rem; }
.mtr-eq-row--result { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--border2); font-weight: 800; color: var(--brown-dark); }
.mtr-eq-row--result strong { font-size: 1.02rem; }

/* Explicação do tempo de produção — accordion, some do caminho até que
   a pessoa peça por ele */
.mtr-explainer-toggle { width: 100%; min-height: 52px; margin-top: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-radius: var(--r-lg); background: var(--blue-bg); border: 1px solid var(--blue-dim, #bfdbfe); color: var(--blue); font-size: .88rem; font-weight: 800; text-align: left; cursor: pointer; }
.mtr-explainer-toggle span { display: flex; align-items: center; gap: 8px; }
.mtr-explainer { margin-top: -6px; padding: 16px; border-radius: var(--r-lg); background: var(--blue-bg); border: 1px solid var(--blue-dim, #bfdbfe); display: flex; flex-direction: column; gap: 12px; }
.mtr-exp-item { display: flex; flex-direction: column; gap: 3px; }
.mtr-exp-item strong { font-size: .9rem; color: var(--brown-dark); }
.mtr-exp-item span { font-size: .84rem; color: var(--brown); line-height: 1.55; }
.mtr-exp-aviso { display: flex; gap: 8px; padding: 10px 12px; border-radius: var(--r-md); background: var(--gold-bg); color: var(--gold-dark); font-size: .82rem; line-height: 1.5; }
.mtr-exp-aviso i { flex-shrink: 0; margin-top: 1px; }

@media (min-width: 420px) {
  .mei-grid { display: grid; grid-template-columns: repeat(2, 1fr); }
}

/* ════════════════════════════════════════════════════════════
   FIXES SAMSUNG A22 — tela estreita (≤ 380px)
   ════════════════════════════════════════════════════════════ */

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
    font-size: 0.86rem;
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
    font-size: 0.86rem;
    text-align: right;
    padding-top: 0;
  }
  .lc-col-data {
    order: 2;
    flex: 0 0 auto;
    font-size: 0.76rem;
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


/* 4 ── Quadros DASN (Receita + Despesas): 3 colunas, sem scroll */
.lc-quadro {
  width: 100%;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.lc-quadro::-webkit-scrollbar { display: none; }

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

.report-config-box { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
.report-config-grid { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: end; }
.report-config-grid .fg { margin: 0; }
.incluir-pessoal-toggle-modern { display: flex; align-items: center; gap: 6px; font-size: .84rem; color: var(--muted); cursor: pointer; flex: 1; min-width: 0; }
.btn-gerar-large { width: 100%; min-height: 52px; padding: 10px; background: var(--blue); color: #fff; border: none; border-radius: var(--r-md); font-size: .95rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all var(--t); }
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

/* ══════════════════════════════════════════════════════════════
   Financeiro › Mensal — visual novo (classes mn-*, só desta aba)
══════════════════════════════════════════════════════════════ */



/* Período */














/* Blocos */











/* Por banco */















/* Card do mês */
















/* Composição (aberta sob demanda) */












/* Por categoria */








/* ── Movimentações: valor da linha e conta por extenso ── */
.lancamentos-list .row-right { font-family: var(--mono); font-size: 1rem; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.lancamentos-list .row-right.green { color: var(--green); }
.lancamentos-list .row-right.red { color: var(--red); }
.lancamentos-list .fl-dot { display: none; }
.lancamentos-list .fl-banco-sigla { display: none; }
html.is-desktop .lancamentos-list .fl-banco-nome { display: none; }
html.is-desktop .lancamentos-list .fl-banco-sigla { display: inline; }


/* ══ Financeiro › Importar (classes im-*) ══ */
.im-pagina { gap: 20px; }
.im-cab { padding: 0 2px; }
.im-titulo { margin: 0; font-size: 1.3rem; font-weight: 800; line-height: 1.2; color: var(--brown-dark); }
.im-desc { margin: 4px 0 0; font-size: .88rem; line-height: 1.5; color: var(--muted); }
.im-bloco { display: flex; flex-direction: column; gap: 10px; }
.im-passo-cab { display: flex; align-items: center; gap: 10px; padding: 0 2px; }
.im-passo-cab h4 { margin: 0; font-size: 1.02rem; font-weight: 800; color: var(--brown-dark); }
.im-passo { width: 26px; height: 26px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--brown); color: #fff; font-size: .8rem; font-weight: 800; }
.im-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
.im-card--painel .importador-panel { margin: 0; border-top: none; background: var(--surface); }
.im-card--risco { border-color: var(--red-dim); background: #fffafa; }

.im-vazio { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 20px; text-align: center; }
.im-vazio-icone { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--cream); color: var(--muted); font-size: 1.3rem; margin-bottom: 4px; }
.im-vazio strong { font-size: 1rem; color: var(--brown-dark); }
.im-vazio span { font-size: .86rem; line-height: 1.5; color: var(--muted); }

/* Escolha do banco */
.im-bancos { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.im-banco {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 76px; padding: 10px 8px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-lg); color: var(--brown-mid); cursor: pointer; transition: all var(--t);
}
.im-banco i { font-size: 1.25rem; margin-bottom: 2px; }
.im-banco strong { font-size: .95rem; font-weight: 800; color: var(--brown-dark); }
.im-banco span { font-size: .76rem; font-weight: 600; color: var(--muted); }
.im-banco.active { background: var(--brown); border-color: var(--brown); color: #fff; box-shadow: var(--shadow-sm); }
.im-banco.active strong, .im-banco.active span { color: #fff; }
.im-banco:focus-visible, .im-admin-toggle:focus-visible, .im-excluir-btn:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: -3px; }

/* Excluir extratos */
.im-admin-toggle { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 64px; padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; }
.im-admin-icone { width: 40px; height: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: var(--r-md); background: var(--red-bg); color: var(--red); }
.im-admin-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.im-admin-txt strong { font-size: .95rem; font-weight: 800; color: var(--red); }
.im-admin-txt small { font-size: .8rem; color: var(--muted); }
.im-admin-seta { font-size: .75rem; color: var(--muted); }
.im-excluir { display: flex; flex-direction: column; gap: 8px; padding: 4px 16px 16px; border-top: 1px solid var(--red-dim); }
.im-excluir-aviso { margin: 8px 0 4px; font-size: .82rem; line-height: 1.5; color: var(--muted); }
.im-excluir-aviso i { color: var(--red); margin-right: 4px; }
.im-excluir-btn { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); cursor: pointer; text-align: left; }
.im-excluir-btn:active { background: var(--red-bg); }
.im-excluir-nome { flex: 1; font-size: .92rem; font-weight: 700; color: var(--brown-dark); }
.im-excluir-qtd { font-size: .8rem; color: var(--muted); font-weight: 600; }
.im-excluir-btn i { font-size: .7rem; color: var(--muted); }
.im-excluir-btn--todos { border-color: var(--red-dim); background: var(--red-bg); }
.im-excluir-btn--todos .im-excluir-nome, .im-excluir-btn--todos .im-excluir-qtd { color: var(--red); }

/* ══ Financeiro › Retirada e mão de obra (mo-*) ══ */
.mo-pagina { gap: 0; }
/* A barra de progresso usava var(--accent), que não existe: sem isso a barra aparecia vazia quando a meta não era atingida */
.mtr-bar-row { --accent: var(--orange); }
.mo-corpo { display: flex; flex-direction: column; gap: 16px; }
.mo-cab { padding: 0 2px; }
.mo-titulo { margin: 0; font-size: 1.3rem; font-weight: 800; line-height: 1.2; color: var(--brown-dark); }
.mo-desc { margin: 4px 0 0; font-size: .88rem; line-height: 1.5; color: var(--muted); }
.mo-vazio { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 20px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); }
.mo-vazio i { font-size: 1.6rem; color: var(--muted); margin-bottom: 4px; }
.mo-vazio strong { font-size: 1rem; color: var(--brown-dark); }
.mo-vazio span { font-size: .86rem; line-height: 1.5; color: var(--muted); }
.mtr-detalhes-toggle:focus-visible, .mtr-explainer-toggle:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 1px; }

/* ══ Financeiro › Anual (classes an-*) ══ */
.an-pagina { gap: 20px; }
.an-cab { padding: 0 2px; }
.an-titulo { margin: 0; font-size: 1.3rem; font-weight: 800; line-height: 1.2; color: var(--brown-dark); }
.an-desc { margin: 4px 0 0; font-size: .88rem; line-height: 1.5; color: var(--muted); }
.an-anos { display: flex; gap: 8px; flex-wrap: wrap; }
.an-ano { min-width: 76px; min-height: 46px; padding: 0 20px; border: 1.5px solid var(--border); border-radius: var(--r-full); background: var(--surface); color: var(--brown-mid); font-size: .95rem; font-weight: 800; cursor: pointer; transition: all var(--t); }
.an-ano.active { background: var(--brown); border-color: var(--brown); color: #fff; }
.an-ano:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }
.an-hero { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 20px 16px; border-radius: var(--r-lg); text-align: center; }
.an-hero--ok { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-dim); }
.an-hero--neg { background: var(--red-bg); color: var(--red); border: 1px solid var(--red-dim); }
.an-hero-lbl { font-size: .9rem; font-weight: 700; }
.an-hero-valor { font-family: var(--mono); font-size: 2rem; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
.an-hero-sub { font-size: .8rem; font-weight: 600; opacity: .85; }
.an-bloco { display: flex; flex-direction: column; gap: 10px; }
.an-bloco-cab { padding: 0 2px; }
.an-bloco-titulo { margin: 0; font-size: 1.02rem; font-weight: 800; color: var(--brown-dark); }
.an-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
.an-card--pad { padding: 16px; }
.an-linha { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-top: 1px solid var(--border); }
.an-linha:first-child { border-top: none; }
.an-ponto { width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; background: var(--border2); }
.an-ponto--verde { background: var(--green); }
.an-ponto--vermelho { background: var(--red); }
.an-ponto--roxo { background: var(--purple); }
.an-linha-txt { flex: 1; min-width: 0; }
.an-linha-nome { font-size: .95rem; font-weight: 700; color: var(--brown-dark); }
.an-linha-sub { margin-top: 2px; font-size: .8rem; line-height: 1.4; color: var(--muted); }
.an-linha-valor { flex-shrink: 0; font-family: var(--mono); font-size: .98rem; font-weight: 800; font-variant-numeric: tabular-nums; }

/* Gráfico: reaproveita as classes do script (barra-*), só maior e mais legível */
.an-legenda { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; font-size: .82rem; font-weight: 700; color: var(--muted); }
.an-leg { display: inline-flex; align-items: center; gap: 6px; }
.an-leg i { width: 12px; height: 12px; border-radius: 3px; }
.an-leg--verde i { background: var(--green); }
.an-leg--vermelho i { background: var(--red); opacity: .75; }
.an-grafico.grafico-barras { height: 132px; gap: 8px; padding-bottom: 4px; align-items: flex-end; }
.an-grafico .barra-grupo { min-width: 44px; gap: 6px; }
.an-grafico .barra-labels { height: 96px; gap: 3px; }
.an-grafico .barra { width: 18px; border-radius: 4px 4px 0 0; transform: scaleY(1.55); transform-origin: bottom; }
.an-grafico .barra-mes { font-size: .76rem; font-weight: 700; color: var(--brown-mid); }

/* Tabela mês a mês */
.an-tabela { display: flex; flex-direction: column; }
.an-th, .an-tr { display: grid; grid-template-columns: 64px 1fr 1fr; gap: 8px; align-items: center; padding: 0 16px; }
.an-th { min-height: 40px; background: var(--cream); font-size: .8rem; font-weight: 800; color: var(--muted); }
.an-th span:not(:first-child), .an-tr span:not(:first-child) { text-align: right; }
.an-tr { min-height: 48px; border-top: 1px solid var(--border); }
.an-tr span { font-family: var(--mono); font-size: .88rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.an-tr .an-td-mes { font-family: var(--font); font-size: .88rem; font-weight: 800; color: var(--brown-dark); }

/* ══ Financeiro › Relatórios (rl-*) ══ */
.rl-pagina { gap: 16px; }
.rl-cab { padding: 0 2px; }
.rl-titulo { margin: 0; font-size: 1.3rem; font-weight: 800; line-height: 1.2; color: var(--brown-dark); }
.rl-desc { margin: 4px 0 0; font-size: .88rem; line-height: 1.5; color: var(--muted); }
.report-config-grid .input { min-height: 48px; font-size: 1rem; }
.rl-switch-linha { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 0 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-sm); font-size: .92rem; font-weight: 700; color: var(--brown-dark); cursor: pointer; }
.rl-switch { -webkit-appearance: none; appearance: none; position: relative; flex-shrink: 0; margin: 0; width: 50px; height: 30px; border-radius: var(--r-full); background: var(--border2); cursor: pointer; transition: background var(--t); }
.rl-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform var(--t); }
.rl-switch:checked { background: var(--green); }
.rl-switch:checked::after { transform: translateX(20px); }
.rl-switch:focus-visible, .rel-tipo-btn:focus-visible, .btn-gerar-large:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }
@media (min-width: 560px) { .report-config-grid { grid-template-columns: 1fr 1fr; } }
@media print { .rl-cab { display: none !important; } }

/* Relatórios: valores em reais nunca quebram em duas linhas; o rótulo é que quebra */
.lc-total, .lc-resumo-linha, .lra-linha { gap: 10px; }
.lc-total > span:first-child, .lc-resumo-linha > span:first-child, .lra-linha > span:first-child { flex: 1; min-width: 0; }
.lc-total strong, .lc-resumo-linha strong, .lra-linha strong, .lc-acum-item strong { white-space: nowrap; flex-shrink: 0; }
.lc-q-linha { grid-template-columns: 56px 1fr 1fr; gap: 6px; padding: 10px; }
.lc-q-linha span { font-size: .8rem; white-space: nowrap; }
.lc-q-linha span:not(:first-child) { text-align: right; }
.lc-q-linha span:first-child { white-space: normal; }
.lc-q-linha.hdr span { font-size: .72rem; }
.lc-q-linha .lc-q-mes { font-size: .8rem; }

/* Avisos e retirada já feita */
.fin-aviso { display: flex; gap: 10px; align-items: flex-start; margin: 10px 0; padding: 11px 13px; border-radius: var(--r-md); background: var(--orange-bg, #fff4e5); color: var(--orange, #b45309); font-size: 13px; font-weight: 600; line-height: 1.4; }
.fin-aviso i { margin-top: 2px; }
.fin-aviso--mini { font-size: 12px; padding: 9px 11px; }
.mtr-retirado { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 10px 0 2px; padding: 9px 12px; border-radius: var(--r-sm); background: var(--cream); font-size: 12.5px; font-weight: 600; color: var(--muted); }
.mtr-retirado strong { margin-left: 4px; font-family: var(--mono); }
.lc-estorno { display: flex; justify-content: space-between; gap: 10px; padding: 10px 14px; font-size: 13px; font-weight: 600; color: var(--muted); }

/* Animação usada pelos blocos que abrem/fecham (Transition name="fade-slide") */
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

/* ───────── Movimentações ───────── */
.mv-resumo { margin: 12px 12px 0; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); overflow: hidden; }
.mv-mes { display: flex; align-items: center; padding: 4px 6px; border-bottom: 1px solid var(--border); }
.mv-mes-btn { flex-shrink: 0; width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; color: var(--brown-mid); font-size: .85rem; cursor: pointer; }
.mv-mes-btn:active:not(:disabled) { background: var(--cream-deep); }
.mv-mes-btn:disabled { opacity: .25; cursor: default; }
.mv-mes-centro { position: relative; flex: 1; min-width: 0; height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1rem; font-weight: 800; color: var(--brown-dark); }
.mv-mes-caret { font-size: .62rem; color: var(--muted); }
.mv-mes-centro select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-size: 16px; }
.mv-tot { display: grid; grid-template-columns: repeat(3, 1fr); }
.mv-tot > div { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 4px 11px; min-width: 0; }
.mv-tot > div + div { border-left: 1px solid var(--border); }
.mv-tot span { font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.mv-tot b { max-width: 100%; font-family: var(--mono); font-size: .98rem; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.mv-seg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin: 10px 12px 0; padding: 4px; background: var(--cream-deep); border-radius: var(--r-full); }
.mv-seg-btn { min-height: 40px; padding: 0 4px; border: 0; border-radius: var(--r-full); background: transparent; font-family: var(--font); font-size: .84rem; font-weight: 700; color: var(--muted); cursor: pointer; white-space: nowrap; transition: background var(--t), color var(--t); }
.mv-seg-btn.ativo { background: var(--surface); color: var(--brown-dark); box-shadow: 0 1px 3px rgba(61,31,7,.12); }

.lancamentos-sticky { position: sticky; top: 0; z-index: var(--z-sticky); margin-top: 10px; background: var(--bg); box-shadow: 0 2px 8px rgba(61,31,7,.07); }
.mv-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--border); }
.mv-busca { flex: 1; min-width: 0; position: relative; display: flex; align-items: center; margin: 0; }
.mv-busca > i { position: absolute; left: 13px; font-size: .9rem; color: var(--muted); pointer-events: none; }
.mv-busca input { width: 100%; height: 44px; padding: 0 40px 0 38px; border: 1.5px solid var(--border); border-radius: var(--r-full); background: var(--bg); font-family: var(--font); font-size: 16px; color: var(--brown-dark); outline: none; }
.mv-busca input:focus { border-color: var(--brown); background: var(--surface); }
.mv-busca-x { position: absolute; right: 6px; width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: var(--muted); font-size: .8rem; cursor: pointer; }
.mv-btn-filtros { position: relative; flex-shrink: 0; height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 7px; border: 1.5px solid var(--border); border-radius: var(--r-full); background: var(--bg); color: var(--brown-mid); font-family: var(--font); font-size: .86rem; font-weight: 800; cursor: pointer; }
.mv-btn-filtros.ativo { border-color: var(--brown); background: var(--gold-bg); color: var(--brown-dark); }
.mv-badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--brown); color: #fff; font-size: .7rem; display: inline-flex; align-items: center; justify-content: center; }
@media (max-width: 360px) { .mv-btn-filtros span:not(.mv-badge) { display: none; } .mv-btn-filtros { padding: 0 12px; } }

.mv-ativos { display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: var(--cream); border-bottom: 1px solid var(--border); }
.mv-count { flex-shrink: 0; font-size: .78rem; font-weight: 800; color: var(--brown-mid); }
.mv-pills { flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.mv-pills::-webkit-scrollbar { display: none; }
.mv-pill { flex-shrink: 0; max-width: 170px; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 1px solid var(--brown); border-radius: var(--r-full); background: var(--gold-bg); color: var(--brown-dark); font-family: var(--font); font-size: .76rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.mv-pill i { font-size: .62rem; opacity: .7; }
.mv-limpar { flex-shrink: 0; min-height: 36px; padding: 0 4px; border: 0; background: none; font-family: var(--font); font-size: .78rem; font-weight: 800; color: var(--red); cursor: pointer; }

/* Painel de filtros */
.mv-painel { padding: 0 0 24px; }
.mv-sec { padding: 16px 16px 4px; }
.mv-sec--lista { padding-left: 0; padding-right: 0; }
.mv-sec--lista .mv-sec-tit { padding: 0 16px; }
.mv-sec-tit { margin-bottom: 10px; font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.mv-chips { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 12px; }
.mv-chip { min-height: 44px; padding: 0 18px; border: 1.5px solid var(--border); border-radius: var(--r-full); background: var(--surface); font-family: var(--font); font-size: .9rem; font-weight: 700; color: var(--brown-mid); cursor: pointer; }
.mv-chip.ativo { background: var(--brown); border-color: var(--brown); color: #fff; }
.mv-cats { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.mv-foot-ver { flex: 1; }

/* ───────── Resumo Mensal ───────── */
.rs-pagina { gap: 14px; }
.rs-periodo { display: flex; flex-direction: column; gap: 10px; }
.rs-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; background: var(--cream-deep); border-radius: var(--r-full); }
.rs-seg--mini { width: 168px; flex-shrink: 0; }
.rs-seg-btn { min-height: 40px; padding: 0 10px; border: 0; border-radius: var(--r-full); background: transparent; font-family: var(--font); font-size: .86rem; font-weight: 700; color: var(--muted); cursor: pointer; transition: background var(--t), color var(--t); }
.rs-seg--mini .rs-seg-btn { min-height: 34px; font-size: .78rem; }
.rs-seg-btn.ativo { background: var(--surface); color: var(--brown-dark); box-shadow: 0 1px 3px rgba(61,31,7,.12); }
.rs-nav { display: flex; align-items: center; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); padding: 4px 6px; }
.rs-nav-btn { flex-shrink: 0; width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; color: var(--brown-mid); font-size: .85rem; cursor: pointer; }
.rs-nav-btn:active:not(:disabled) { background: var(--cream-deep); }
.rs-nav-btn:disabled { opacity: .25; cursor: default; }
.rs-nav-centro { position: relative; flex: 1; min-width: 0; height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1.05rem; font-weight: 800; color: var(--brown-dark); }
.rs-nav-caret { font-size: .62rem; color: var(--muted); }
.rs-nav-centro select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-size: 16px; }

.rs-vazio { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 16px; text-align: center; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--r-md); font-size: .85rem; }
.rs-vazio i { font-size: 28px; color: var(--gold-dark); } .rs-vazio b { color: var(--brown-dark); font-size: .95rem; }

.rs-hero { padding: 16px; border-radius: var(--r-md); color: #fff; box-shadow: var(--shadow); background: linear-gradient(135deg, var(--green), #2f6b3e); }
.rs-hero.neg { background: linear-gradient(135deg, #b23b2e, var(--red)); }
.rs-hero-rot { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: rgba(255,255,255,.8); }
.rs-hero-val { margin-top: 2px; font-family: var(--mono); font-size: 2rem; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
.rs-var { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 4px 11px; border-radius: 99px; font-size: .76rem; font-weight: 800; background: rgba(255,255,255,.18); }
.rs-var.neutro { font-weight: 600; background: rgba(0,0,0,.14); }
.rs-conta { margin: 10px 0 0; font-size: .74rem; line-height: 1.4; color: rgba(255,255,255,.78); }

.rs-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); padding: 4px 14px 6px; }
.rs-linha { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--border); }
.rs-linha-txt { min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: .92rem; font-weight: 700; color: var(--brown-dark); }
.rs-linha-txt small { font-size: .74rem; font-weight: 500; color: var(--muted); line-height: 1.35; }
.rs-linha b { flex-shrink: 0; font-family: var(--mono); font-size: .98rem; font-variant-numeric: tabular-nums; }
.rs-ponto { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; }
.rs-ponto.verde { background: var(--green); } .rs-ponto.vermelho { background: var(--red); }

.rs-uso { padding: 12px 0 4px; }
.rs-uso-barra { display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: var(--cream-deep); }
.rs-uso-barra span { display: block; height: 100%; }
.u-op { background: var(--brown); } .u-pes { background: var(--orange); } .u-sobra { background: var(--green); }
.rs-uso-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: .74rem; color: var(--muted); }
.rs-uso-leg span { display: inline-flex; align-items: center; gap: 5px; }
.rs-uso-leg i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.rs-uso-leg .deficit { color: var(--red); font-weight: 800; }

.rs-toggle { width: 100%; min-height: 44px; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-top: 1px solid var(--border); background: none; font-family: var(--font); font-size: .82rem; font-weight: 800; color: var(--brown); cursor: pointer; }
.rs-toggle i { font-size: .65rem; }
.rs-detalhe { padding: 4px 0 8px; }
.rs-det-linha { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; font-size: .84rem; color: var(--brown-dark); }
.rs-det-linha.sub { padding-left: 14px; font-size: .8rem; color: var(--muted); }
.rs-det-linha b { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.rs-det-linha.total { margin-top: 2px; border-top: 1px dashed var(--border); font-weight: 800; }
.rs-det-sep { height: 1px; margin: 6px 0; background: var(--border); }
.rs-det-nota { margin: 4px 0 0; font-size: .74rem; line-height: 1.45; color: var(--muted); }

.rs-bloco-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.rs-bloco-tit { padding: 0 2px; margin-bottom: 8px; font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.rs-bloco-cab .rs-bloco-tit { margin-bottom: 0; }
.rs-nada { padding: 16px; text-align: center; font-size: .85rem; color: var(--muted); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--r-md); }

.rs-grafico-box { padding: 10px 10px 8px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow); }
.rs-grafico { display: block; width: 100%; height: auto; font-family: var(--font); }
.rs-grafico .max { font-size: 9px; fill: var(--muted); font-family: var(--mono); }
.rs-grafico .base { stroke: var(--border); stroke-width: 1; }
.rs-grafico .mes { font-size: 10px; font-weight: 700; fill: var(--muted); }
.rs-grafico .hit { fill: transparent; }
.rs-grafico .col:not(.vazio) { cursor: pointer; }
.rs-grafico .col.vazio .mes { opacity: .4; }
.rs-grafico .b-rec, .rs-leg i.b-rec { fill: var(--green); background: var(--green); }
.rs-grafico .b-desp, .rs-leg i.b-desp { fill: var(--red); background: var(--red); opacity: .85; }
.rs-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; font-size: .72rem; color: var(--muted); }
.rs-leg span { display: inline-flex; align-items: center; gap: 5px; }
.rs-leg i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.rs-leg .dica { margin-left: auto; font-style: italic; }
.rs-meses { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.rs-mes { display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'nome sobra' 'rec desp'; gap: 2px 10px; width: 100%; padding: 10px 12px; text-align: left; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); font-family: var(--font); cursor: pointer; }
.rs-mes:active { background: var(--cream); }
.rs-mes-nome { grid-area: nome; font-weight: 800; font-size: .92rem; color: var(--brown-dark); }
.rs-mes-sobra { grid-area: sobra; text-align: right; font-family: var(--mono); font-size: .9rem; font-variant-numeric: tabular-nums; }
.rs-mes-rec { grid-area: rec; font-size: .76rem; color: var(--green); font-family: var(--mono); }
.rs-mes-desp { grid-area: desp; text-align: right; font-size: .76rem; color: var(--red); font-family: var(--mono); }

.rs-cats { display: flex; flex-direction: column; gap: 6px; }
.rs-cat { display: grid; grid-template-columns: 1fr auto 14px; grid-template-areas: 'info valor chev' 'barra barra barra'; align-items: center; gap: 6px 10px; width: 100%; padding: 11px 12px 10px; text-align: left; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); font-family: var(--font); cursor: pointer; }
.rs-cat:active { background: var(--cream); }
.rs-cat-info { grid-area: info; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rs-cat-nome { font-weight: 800; font-size: .9rem; color: var(--brown-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rs-cat-sub { font-size: .72rem; color: var(--muted); }
.rs-cat-valor { grid-area: valor; font-family: var(--mono); font-size: .92rem; color: var(--brown-dark); font-variant-numeric: tabular-nums; }
.rs-cat-chev { grid-area: chev; font-size: .65rem; color: var(--muted); }
.rs-cat-barra { grid-area: barra; display: block; height: 6px; border-radius: 99px; background: var(--cream-deep); overflow: hidden; }
.rs-cat-barra i { display: block; height: 100%; border-radius: 99px; }
.rs-cat-barra i.saidas { background: var(--red); opacity: .75; } .rs-cat-barra i.entradas { background: var(--green); }

.rs-mais { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 8px; padding: 11px; border: 1.5px dashed var(--border); border-radius: var(--r-md); background: transparent; font-family: var(--font); font-size: .82rem; font-weight: 700; color: var(--brown); cursor: pointer; }
.rs-mais i { font-size: .7rem; }

.rs-bancos { display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 420px) { .rs-bancos { grid-template-columns: 1fr 1fr; } }
.rs-banco { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; text-align: left; background: var(--surface); border: 1.5px solid var(--border); border-left-width: 4px; border-radius: var(--r-md); font-family: var(--font); cursor: pointer; }
.rs-banco:active { background: var(--cream); }
.rs-banco.b-pagbank { border-left-color: var(--green); } .rs-banco.b-itau { border-left-color: var(--orange); } .rs-banco.b-bb { border-left-color: #185FA5; }
.rs-banco-nome { font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.rs-banco-nome i { margin-right: 5px; }
.rs-banco b { font-family: var(--mono); font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.rs-banco small { font-size: .74rem; color: var(--muted); }
</style>