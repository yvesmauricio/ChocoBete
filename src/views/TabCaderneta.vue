<template>
  <div class="tab-caderneta">

    <!-- ══ TELA: DASHBOARD ══════════════════════════════════ -->
    <div v-if="tela === 'dashboard'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <h2 class="tab-title">
            <i class="fas fa-book"></i> Caderninho
          </h2>
          <div class="tab-actions">
            <button class="btn-icon" @click="emit('trocar-perfil')" title="Trocar perfil">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </button>
          </div>
        </div>
        <p class="tab-subtitle">Gestão de vendas e fiados · {{ dataBR }}</p>
      </div>

      <div class="cad-body">
        <div class="cad-greeting">
          <div class="cad-hello">{{ saudacao }}</div>
        </div>

        <!-- KPIs -->
        <div class="cad-kpi-grid">
          <div class="cad-kpi destaque">
            <div class="cad-kpi-label">💰 Em Aberto</div>
            <div class="cad-kpi-val verde">R$ {{ fmt(stats.totalAberto) }}</div>
          </div>
          <div class="cad-kpi alerta">
            <div class="cad-kpi-label">⚠️ Vencidos</div>
            <div class="cad-kpi-val vermelho">R$ {{ fmt(stats.totalVencido) }}</div>
          </div>
        </div>

        <!-- Alerta do dia -->
        <div v-if="alertasDia.length" class="cad-alerta-dia">
          <div class="cad-alerta-titulo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Cobranças de hoje
          </div>
          <div v-for="a in alertasDia" :key="a.fiadoId" class="cad-alerta-item" @click="irParaResumo">
            <div class="cad-alerta-avatar">{{ iniciais(a.clienteNome) }}</div>
            <div class="cad-alerta-info">
              <div class="cad-alerta-nome">{{ a.clienteNome }}</div>
              <div class="cad-alerta-loja">{{ a.lojaNome }}</div>
            </div>
            <div class="cad-alerta-val">R$ {{ fmt(a.saldo) }}</div>
          </div>
          <div v-if="alertasDia.length > 3" class="cad-alerta-mais" @click="irParaResumo">
            + {{ alertasDia.length - 3 }} mais cobranças →
          </div>
        </div>


      </div>
    </div>

    <!-- ══ TELA: LOJAS ══════════════════════════════════════ -->
    <div v-else-if="tela === 'lojas'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <button class="cad-btn-icon" @click="irPara('dashboard')">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h2 class="tab-title"><i class="fas fa-store"></i> Lojas</h2>
          <button class="btn-icon" @click="abrirModalLoja()"><i class="fas fa-plus"></i></button>
        </div>
        <p class="tab-subtitle">Escolha onde a venda foi realizada</p>
      </div>
      <div class="cad-search-bar">
        <div class="cad-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="cad-search-input" placeholder="Buscar loja..." v-model="buscaLojas">
        </div>
      </div>
      <div class="cad-scroll-list">
        <div v-if="!lojasFiltradas.length" class="cad-empty">
          <div class="cad-empty-ico">🏪</div>
          <p>{{ buscaLojas ? 'Nenhuma loja encontrada' : 'Nenhuma loja cadastrada.\nToque em + para adicionar.' }}</p>
        </div>
        <CadernetaSwipeItem
          v-for="l in lojasFiltradas" :key="l.id" :id="l.id"
          @click="escolherLoja(l)"
          @edit="abrirModalLoja(l)"
          @delete="confirmarExcluirLoja(l)"
          @opened="fecharOutrosLojas(l.id)"
          ref="swipeLojas"
        >
          <div class="cad-list-icon">🏪</div>
          <div class="cad-list-info">
            <div class="cad-list-nome">{{ l.nome }}</div>
            <div v-if="l.referencia" class="cad-list-sub">{{ l.referencia }}</div>
          </div>
        </CadernetaSwipeItem>
      </div>
    </div>

    <!-- ══ TELA: CLIENTES ══════════════════════════════════ -->
    <div v-else-if="tela === 'clientes'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <button class="cad-btn-icon" @click="irPara('lojas')">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h2 class="tab-title"><i class="fas fa-user-friends"></i> {{ lojaAtual?.nome }}</h2>
          <button class="btn-icon" @click="abrirModalCliente()"><i class="fas fa-plus"></i></button>
        </div>
        <p class="tab-subtitle">{{ lojaAtual?.referencia || 'Listagem de clientes' }}</p>
      </div>
      <div class="cad-search-bar">
        <div class="cad-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="cad-search-input" placeholder="Buscar cliente..." v-model="buscaClientes">
        </div>
      </div>
      <div class="cad-scroll-list">
        <div v-if="!clientesFiltrados.length" class="cad-empty">
          <div class="cad-empty-ico">👤</div>
          <p>{{ buscaClientes ? 'Nenhum cliente encontrado' : 'Nenhuma cliente nesta loja.\nToque em + para adicionar.' }}</p>
        </div>
        <CadernetaSwipeItem
          v-for="c in clientesFiltrados" :key="c.id" :id="c.id"
          @click="escolherCliente(c)"
          @edit="abrirModalCliente(c)"
          @delete="confirmarExcluirCliente(c)"
          @opened="fecharOutrosClientes(c.id)"
          ref="swipeClientes"
        >
          <div class="cad-list-icon pessoa">👩</div>
          <div class="cad-list-info">
            <div class="cad-list-nome">{{ c.nome }}</div>
            <div class="cad-list-sub">{{ c.telefone || 'Sem telefone' }}</div>
          </div>
        </CadernetaSwipeItem>
      </div>
    </div>

    <!-- ══ TELA: LANÇAR ════════════════════════════════════ -->
    <div v-else-if="tela === 'lancar'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <button class="cad-btn-icon" @click="voltarDeLancar">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h2 class="tab-title"><i class="fas fa-cart-plus"></i> Nova Venda</h2>
          <div class="hdr-actions">
             <span class="cad-tag-date" @click="$refs.dpRef?.showPicker?.()">{{ dataVendaFmt }}</span>
             <input type="date" ref="dpRef" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0" v-model="dataVenda">
          </div>
        </div>
        <p class="tab-subtitle">Lançamento de fiado para {{ clienteAtual?.nome }}</p>
      </div>

      <div class="cad-lancar-body">
        <!-- Card cliente -->
        <div class="cad-cliente-card">
          <div class="cad-avatar">{{ iniciais(clienteAtual?.nome) }}</div>
          <div class="cad-cliente-info">
            <div class="cad-cliente-nome">{{ clienteAtual?.nome || '—' }}</div>
            <div class="cad-cliente-loja" style="font-weight:700; color:var(--brown-mid)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h11.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
              {{ lojaAtual?.nome || '—' }}
            </div>
          </div>
        </div>

        <!-- Produtos -->
        <div>
          <div class="section-label">📋 O que ela levou?</div>
          <div class="cad-produtos-grid">
            <div
              v-for="p in produtos" :key="p.id"
              class="cad-produto-card" :class="{ ativo: qtds[p.id] > 0 }"
            >
              <div class="cad-prod-emoji">{{ p.emoji }}</div>
              <div class="cad-prod-nome">{{ p.nome }}</div>
              <div class="cad-prod-preco">R$ {{ fmt(p.preco) }}</div>
              <div class="cad-stepper">
                <button class="cad-stepper-btn" :disabled="!qtds[p.id]" @click="dec(p)">−</button>
                <div class="cad-stepper-qty">{{ qtds[p.id] || 0 }}</div>
                <button class="cad-stepper-btn" @click="inc(p)">+</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Vencimento — OBRIGATÓRIO -->
        <div>
          <div class="section-label">📅 Data do acerto</div>
          <div class="cad-chip-row">
            <button
              v-for="c in chipsVenc" :key="c.id"
              class="chip" :class="{ ativo: chipAtivo === c.id }"
              @click="setChip(c.id)"
            >{{ c.label }}</button>
          </div>
          <!-- Data manual: mostra sempre após chips -->
          <div class="cad-date-field" :class="{ 'cad-date-field--filled': dataVenc, 'cad-date-field--empty': !dataVenc }" @click="$refs.vencRef?.showPicker?.()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>{{ dataVenc ? fmtBR(dataVenc) : 'Escolher outra data…' }}</span>
            <input type="date" ref="vencRef" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0" v-model="dataVenc" @change="chipAtivo=null">
          </div>
        </div>
      </div>

      <div class="cad-footer-lancar">
        <div class="cad-footer-total">
          <div class="cad-footer-label">Total da Compra</div>
          <div class="cad-footer-val">R$ {{ fmt(totalLancar) }}</div>
        </div>
        <button class="cad-btn-salvar" :disabled="totalLancar === 0" @click="salvarFiado">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Salvar
        </button>
      </div>
    </div>

    <!-- ══ TELA: RESUMO ════════════════════════════════════ -->
    <div v-else-if="tela === 'resumo'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <h2 class="tab-title"><i class="fas fa-list-check"></i> Resumo</h2>
          <div class="cad-resumo-seg-control">
            <button class="cad-resumo-seg-btn" :class="{ active: modoResumo === 'abertos' }" @click="modoResumo = 'abertos'">
              Aberto
            </button>
            <button class="cad-resumo-seg-btn" :class="{ active: modoResumo === 'historico' }" @click="modoResumo = 'historico'">
              Histórico
            </button>
          </div>
        </div>
        <div class="search-wrap" style="margin-top: 10px; margin-bottom: 8px;">
          <i class="fas fa-search search-icon"></i>
          <input v-model="buscaResumo" class="search-input" type="search" placeholder="Buscar cliente ou loja..." />
        </div>
      </div>

      <!-- KPIs inline finos -->
      <div class="cad-kpi-inline">
        <div class="cad-kpi-item">
          <div class="cad-kpi-item-label">Em aberto</div>
          <div class="cad-kpi-item-val">R$ {{ fmt(stats.totalAberto) }}</div>
        </div>
        <div class="cad-kpi-divider"></div>
        <div class="cad-kpi-item">
          <div class="cad-kpi-item-label">Vencidos</div>
          <div class="cad-kpi-item-val cad-kpi-item-val--red">R$ {{ fmt(stats.totalVencido) }}</div>
        </div>
      </div>

      <div class="cad-resumo-lista">

        <!-- Sem resultados -->
        <div v-if="!gruposResumo.length" class="cad-empty">
          <div class="cad-empty-ico">📭</div>
          <p>{{ textoVazioResumo }}</p>
        </div>

        <!-- Agendamentos: seção de vencimentos quando no modo abertos -->
        <template v-if="modoResumo === 'abertos' && !buscaResumo.trim()">

          <!-- Vencidos -->
          <div v-if="fiadosVencidos.length" class="cad-secao cad-secao--red">
            <div class="cad-secao-header">
              <span class="cad-secao-ico">🔴</span>
              <span class="cad-secao-titulo">Vencidos</span>
              <span class="cad-secao-badge">{{ fiadosVencidos.length }}</span>
            </div>
            <div v-for="f in fiadosVencidos" :key="f.id" class="cad-agend-row cad-agend-row--red">
              <div class="cad-agend-avatar cad-agend-avatar--red">{{ iniciais(f.clienteNome) }}</div>
              <div class="cad-agend-info">
                <div class="cad-agend-nome">{{ f.clienteNome }}</div>
                <div class="cad-agend-loja">{{ f.lojaNome }}</div>
                <div class="cad-agend-itens" :title="resumoItens(f.itens)">{{ resumoItens(f.itens) }}</div>
              </div>
              <div class="cad-agend-dir">
                <div class="cad-agend-val">R$ {{ fmt(f.saldo) }}</div>
                <div class="cad-agend-data cad-agend-data--red">{{ fmtBR(f.dataVenc) }}</div>
                <div class="cad-agend-acoes">
                  <button class="cad-btn-receber-sm" @click.stop="abrirReceber(f)" title="Receber">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg>
                  </button>
                  <button v-if="f.clienteTel" class="cad-btn-zap-sm" @click.stop="abrirWhatsappFiado(f)" title="Enviar WhatsApp">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>


          <!-- Sem data de vencimento -->
          <div v-if="fiadosSemData.length" class="cad-secao cad-secao--gray">
            <div class="cad-secao-header">
              <span class="cad-secao-ico">⚪</span>
              <span class="cad-secao-titulo">Sem vencimento</span>
              <span class="cad-secao-badge cad-secao-badge--gray">{{ fiadosSemData.length }}</span>
            </div>
            <div v-for="f in fiadosSemData" :key="f.id" class="cad-agend-row cad-agend-row--gray">
              <div class="cad-agend-avatar cad-agend-avatar--gray">{{ iniciais(f.clienteNome) }}</div>
              <div class="cad-agend-info">
                <div class="cad-agend-nome">{{ f.clienteNome }}</div>
                <div class="cad-agend-loja">{{ f.lojaNome }}</div>
                <div class="cad-agend-itens" :title="resumoItens(f.itens)">{{ resumoItens(f.itens) }}</div>
              </div>
              <div class="cad-agend-dir">
                <div class="cad-agend-val">R$ {{ fmt(f.saldo) }}</div>
                <button class="cad-btn-agendar" @click.stop="abrirEditarVenc(f)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Agendar
                </button>
              </div>
            </div>
          </div>

          <!-- Separador antes da visão por cliente -->
        </template>

        <!-- Visão agrupada por loja/cliente (mantida para busca e histórico) -->
        <div v-if="gruposResumo.length" class="cad-separador">
          <span>{{ tituloListaResumo }}</span>
        </div>

        <div v-for="g in gruposResumo" :key="g.lojaId" class="cad-grupo-loja">
          <div class="cad-loja-header" :class="{ colapsado: lojaColapsada(g) }" @click="alternarLoja(g)">
            <svg class="cad-loja-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span class="cad-loja-nome">{{ g.lojaNome }}</span>
            <span class="cad-loja-total">R$ {{ fmt(modoResumo === 'historico' ? g.totalCompras : g.total) }}</span>
            <svg class="cad-loja-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>

          <div class="cad-grupo-clientes" :class="{ colapsado: lojaColapsada(g) }">
            <div v-for="c in g.clientes" :key="c.clienteId" class="cad-cli-card" :class="{ atrasado: c.atrasado }">
              <div class="cad-cli-header" :class="{ colapsado: clienteColapsado(g, c) }" @click="alternarCliente(g, c)">
                <div class="cad-cli-avatar" :class="{ atrasado: c.atrasado }">{{ iniciais(c.clienteNome) }}</div>
                <div class="cad-cli-info">
                  <div class="cad-cli-nome">{{ c.clienteNome }}</div>
                  <div v-if="c.telefone" class="cad-cli-tel">{{ c.telefone }}</div>
                </div>
                <div class="cad-cli-total" :class="{ 'cad-cli-total--red': c.atrasado, 'cad-cli-total--ok': modoResumo === 'historico' && c.saldo <= 0.01 }">
                  R$ {{ fmt(modoResumo === 'historico' ? c.totalCompras : c.saldo) }}
                </div>
                <svg class="cad-cli-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </div>

              <div v-if="modoResumo !== 'historico' || c.telefone" class="cad-cli-btns" @click.stop>
                <button v-if="modoResumo !== 'historico'" class="cad-btn-venda" @click="iniciarVendaResumo(g, c)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Venda
                </button>
                <button v-if="modoResumo !== 'historico' && c.saldo > 0.01" class="cad-btn-quitar" @click="abrirQuitarTudo(c)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Quitar
                </button>
                <button
                  v-if="c.telefone && !(modoResumo === 'historico' && c.saldo <= 0.01)"
                  class="cad-btn-zap"
                  @click="abrirWhatsapp(c)"
                  title="Enviar WhatsApp"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  Cobrar
                </button>
              </div>

              <div class="cad-compras-lista" :class="{ colapsado: clienteColapsado(g, c) }">
                <CadernetaSwipeItem
                  v-for="f in c.fiados" :key="f.id" :id="f.id"
                  :class="{ 'compra-atrasada': f.atrasada }"
                  :actions="compraSwipeActions(f)"
                  @edit="abrirEditarFiado(f)"
                  @receive="abrirReceber(f)"
                  @delete="confirmarExcluirFiado(f)"
                  @opened="fecharOutrosCompras(f.id, c)"
                  ref="swipeCompras"
                >
                  <div class="cad-compra-esq">
                    <span class="cad-compra-data">{{ fmtDataHora(f) }}</span>
                    <span class="cad-compra-itens" :title="resumoItens(f.itens)">{{ resumoItens(f.itens) }}</span>
                    <span v-if="f.pagamentos?.length" class="cad-compra-pagamentos">
                      Recebido R$ {{ fmt(totalPagoF(f)) }} · falta R$ {{ fmt(f.saldo) }}
                    </span>
                  </div>
                  <div class="cad-compra-dir">
                    <span class="cad-compra-valor" :class="{ 'cad-compra-valor--red': f.atrasada }">
                      R$ {{ fmt(modoResumo === 'historico' ? f.total : f.saldo) }}
                    </span>
                    <div class="cad-compra-meta">
                      <span v-if="modoResumo === 'historico'" class="cad-compra-status" :class="{ pago: f.saldo <= 0.01 }">
                        {{ f.saldo <= 0.01 ? 'Pago' : 'Aberto' }}
                      </span>
                      <span v-else class="cad-compra-vence" :class="{ 'cad-compra-vence--red': f.atrasada, 'cad-compra-vence--gray': !f.dataVenc }">
                        <template v-if="f.dataVenc">{{ f.atrasada ? '⚠️ ' : '📅 ' }}{{ fmtBR(f.dataVenc) }}</template>
                        <span v-else class="cad-compra-vence--gray">Sem vencimento</span>
                      </span>
                    </div>
                  </div>
                </CadernetaSwipeItem>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ TELA: CALCULADORA ════════════════════════════════ -->
    <div v-else-if="tela === 'calculadora'" class="cad-tela">
      <div class="tab-hdr">
        <div class="tab-hdr-top">
          <h2 class="tab-title"><i class="fas fa-calculator"></i> Taxas</h2>
        </div>
        <p class="tab-subtitle">Simulador de repasse para o cliente</p>
      </div>
      
      <div class="cad-body">
        <div class="calc-input-wrap">
          <div class="calc-input-label">Valor líquido desejado</div>
          <input
            ref="calcInputRef"
            class="calc-input-field"
            type="tel"
            inputmode="numeric"
            placeholder="0,00"
            v-model="rawCalcInput"
            @input="handleCalcInput"
          >
        </div>

        <div class="calc-results">
          <div class="calc-result-card debito">
            <div class="calc-result-icon"><span>💳</span></div>
            <div class="calc-result-info">
              <div class="calc-result-tipo">Débito na hora</div>
              <div class="calc-result-taxa">Taxa: {{ taxaStr(taxasMaquineta.debito) }}</div>
              <div class="calc-result-val debito">R$ {{ resultDebito }}</div>
            </div>
          </div>

          <div class="calc-result-card credito">
            <div class="calc-result-icon"><span>💰</span></div>
            <div class="calc-result-info">
              <div class="calc-result-tipo">Crédito à vista</div>
              <div class="calc-result-taxa">Taxa: {{ taxaStr(taxasMaquineta.credito_avista) }}</div>
              <div class="calc-result-val credito">R$ {{ resultCredito }}</div>
            </div>
          </div>
        </div>

        <button class="calc-clear-btn mt-24" @click="rawCalcInput = ''">Limpar Valores</button>
      </div>
    </div>

    <!-- ── BARRA DE NAVEGAÇÃO INFERIOR (Bete) ── -->
    <nav class="nav cad-nav-fixa" v-if="['dashboard', 'lojas', 'resumo', 'calculadora'].includes(tela)">
      <button class="nav-btn" :class="{ active: navAtivo === 'dashboard' }" @click="navSwitch('dashboard')">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Início</span>
      </button>
      <button class="nav-btn" :class="{ active: navAtivo === 'calculadora' }" @click="navSwitch('calculadora')">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
        <span>Calculadora</span>
      </button>
      <button class="nav-btn" :class="{ active: navAtivo === 'resumo' }" @click="navSwitch('resumo')">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/><path d="M8 4h8v4H8z"/></svg>
        <span>Resumo</span>
      </button>
    </nav>

    <!-- ── BOTÃO FLUTUANTE: NOVO FIADO ── -->
    <Teleport to="body">
      <button
        v-if="!['lojas', 'clientes', 'lancar'].includes(tela)"
        class="cad-fab-taxas"
        @click="navSwitch('lojas')"
        title="Novo Fiado"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span class="cad-fab-taxas-label">Fiado</span>
      </button>
    </Teleport>

    <!-- ═══ MODAIS ══════════════════════════════════════════ -->
    <Teleport to="body">
      <!-- Modal Loja -->
      <div v-if="modalLoja" class="cad-modal-overlay" @click.self="modalLoja=null">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header"><div class="cad-modal-titulo">{{ editandoLoja ? 'Editar Loja' : 'Nova Loja' }}</div><button class="cad-btn-fechar" @click="modalLoja=null">✕</button></div>
          <div class="cad-form-group">
            <label class="cad-form-label">Nome da loja *</label>
            <input class="cad-form-input" v-model="formLoja.nome" placeholder="Ex: Escritório Santos" autofocus>
          </div>
          <div class="cad-form-group">
            <label class="cad-form-label">Referência (opcional)</label>
            <input class="cad-form-input" v-model="formLoja.referencia" placeholder="Ex: Sala 301">
          </div>
          <button class="cad-btn-primary" @click="salvarLoja_" :disabled="!formLoja.nome.trim()">
            {{ editandoLoja ? 'Salvar Alterações' : 'Cadastrar Loja' }}
          </button>
        </div>
      </div>

      <!-- Modal Cliente -->
      <div v-if="modalCliente" class="cad-modal-overlay" @click.self="modalCliente=null">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header"><div class="cad-modal-titulo">{{ editandoCliente ? 'Editar Cliente' : 'Nova Cliente' }}</div><button class="cad-btn-fechar" @click="modalCliente=null">✕</button></div>
          <div class="cad-form-group">
            <label class="cad-form-label">Nome *</label>
            <input class="cad-form-input" v-model="formCliente.nome" placeholder="Nome completo" autofocus>
          </div>
          <div class="cad-form-group">
            <label class="cad-form-label">Telefone / WhatsApp</label>
            <div class="cad-input-with-btn">
              <input class="cad-form-input" v-model="formCliente.telefone" placeholder="(21) 9 9999-9999" type="tel" @input="formatarTelefone" style="flex: 1">
              <button v-if="canImportContact" class="cad-btn-agenda" @click="importarDaAgenda" title="Importar da agenda">
                <i class="fas fa-address-book"></i>
              </button>
            </div>
          </div>
          <button class="cad-btn-primary" @click="salvarCliente_" :disabled="!formCliente.nome.trim()">
            {{ editandoCliente ? 'Salvar Alterações' : 'Cadastrar Cliente' }}
          </button>
        </div>
      </div>

      <!-- Dialog excluir loja -->
      <div v-if="paraExcluirLoja" class="cad-overlay" @click.self="paraExcluirLoja=null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">Excluir loja?</div>
          <div class="cad-dialog-sub">Todos os clientes e fiados desta loja serão removidos.</div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="paraExcluirLoja=null">Cancelar</button>
            <button class="cad-btn-confirm danger" @click="excluirLoja_">Excluir</button>
          </div>
        </div>
      </div>

      <!-- Dialog excluir cliente -->
      <div v-if="paraExcluirCliente" class="cad-overlay" @click.self="paraExcluirCliente=null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">Excluir cliente?</div>
          <div class="cad-dialog-sub">Todos os fiados desta cliente serão removidos.</div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="paraExcluirCliente=null">Cancelar</button>
            <button class="cad-btn-confirm danger" @click="excluirCliente_">Excluir</button>
          </div>
        </div>
      </div>

      <!-- Dialog receber pagamento -->
      <div v-if="fiadoReceber" class="cad-overlay" @click.self="fiadoReceber=null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">Receber pagamento</div>
          <div class="cad-dialog-sub">{{ fiadoReceber.clienteNome }} · R$ {{ fmt(fiadoReceber.saldo) }}</div>
          <div class="cad-form-group" style="margin-top:16px">
            <label class="cad-form-label">Valor recebido</label>
            <input class="cad-form-input" type="number" step="0.01" min="0.01" :max="fiadoReceber.saldo" v-model.number="valorReceber" placeholder="0,00">
          </div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="fiadoReceber=null">Cancelar</button>
            <button class="cad-btn-confirm" @click="confirmarReceber">✓ Confirmar</button>
          </div>
        </div>
      </div>

      <!-- Dialog quitar tudo -->
      <div v-if="clienteQuitar" class="cad-overlay" @click.self="clienteQuitar=null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">Quitar todas as dívidas?</div>
          <div class="cad-dialog-sub">
            <strong>{{ clienteQuitar.clienteNome }}</strong><br>
            {{ clienteQuitar.fiados.length }} compra{{ clienteQuitar.fiados.length > 1 ? 's' : '' }} ·
            <span style="color:var(--brown);font-weight:800">R$ {{ fmt(clienteQuitar.saldo) }}</span>
          </div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="clienteQuitar=null">Cancelar</button>
            <button class="cad-btn-confirm" @click="quitarTudo">💰 Quitar tudo</button>
          </div>
        </div>
      </div>

      <!-- Dialog excluir fiado -->
      <div v-if="fiadoExcluir" class="cad-overlay" @click.self="fiadoExcluir=null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">Excluir este fiado?</div>
          <div class="cad-dialog-sub">Esta ação não pode ser desfeita.</div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="fiadoExcluir=null">Cancelar</button>
            <button class="cad-btn-confirm danger" @click="excluirFiado_">Excluir</button>
          </div>
        </div>
      </div>

      <!-- Dialog editar vencimento -->
      <div v-if="fiadoEditarVenc" class="cad-overlay" @click.self="fiadoEditarVenc=null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">📅 Agendar vencimento</div>
          <div class="cad-dialog-sub">{{ fiadoEditarVenc.clienteNome }} · R$ {{ fmt(fiadoEditarVenc.saldo) }}</div>
          <div class="cad-chip-row" style="margin-top:14px">
            <button v-for="c in chipsVenc" :key="c.id" class="chip" :class="{ ativo: chipEditarAtivo === c.id }" @click="setChipEditar(c.id)">{{ c.label }}</button>
          </div>
          <div class="cad-form-group" style="margin-top:10px">
            <label class="cad-form-label">Ou escolha uma data</label>
            <input class="cad-form-input" type="date" v-model="dataVencEditar" @change="chipEditarAtivo=null">
          </div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="fiadoEditarVenc=null">Cancelar</button>
            <button class="cad-btn-confirm" :disabled="!dataVencEditar" @click="salvarVencimento">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Modal editar fiado completo -->
      <div v-if="fiadoEditar" class="cad-modal-overlay" @click.self="fiadoEditar=null">
        <div class="cad-modal-sheet cad-modal-sheet--tall">
          <div class="cad-modal-header"><div class="cad-modal-titulo">✏️ Editar venda</div><button class="cad-btn-fechar" @click="fiadoEditar=null">✕</button></div>

          <div class="cad-edit-cliente-tag">
            <div class="cad-edit-avatar">{{ iniciais(fiadoEditar.clienteNome) }}</div>
            <div>
              <div class="cad-edit-nome">{{ fiadoEditar.clienteNome }}</div>
              <div class="cad-edit-loja">{{ fiadoEditar.lojaNome }}</div>
            </div>
          </div>

          <!-- Itens -->
          <div class="cad-form-group">
            <label class="cad-form-label">Itens da venda</label>
            <div class="cad-produtos-grid">
              <div
                v-for="p in produtosEditar" :key="p.id"
                class="cad-produto-card" :class="{ ativo: qtdsEditar[p.id] > 0 }"
              >
                <div class="cad-prod-emoji">{{ p.emoji }}</div>
                <div class="cad-prod-nome">{{ p.nome }}</div>
                <div class="cad-prod-preco">R$ {{ fmt(p.preco) }}</div>
                <div class="cad-stepper">
                  <button class="cad-stepper-btn" :disabled="!qtdsEditar[p.id]" @click="decEditar(p)">−</button>
                  <div class="cad-stepper-qty">{{ qtdsEditar[p.id] || 0 }}</div>
                  <button class="cad-stepper-btn" @click="incEditar(p)">+</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Data/hora da venda -->
          <div class="cad-form-group">
            <label class="cad-form-label">Data e hora da venda</label>
            <div class="cad-edit-datetime">
              <input class="cad-form-input" type="date" v-model="fiadoEditarData" style="flex:1">
              <input class="cad-form-input" type="time" v-model="fiadoEditarHora" style="width:110px">
            </div>
          </div>

          <!-- Vencimento -->
          <div class="cad-form-group">
            <label class="cad-form-label">Data do acerto</label>
            <div class="cad-chip-row" style="justify-content:flex-start">
              <button v-for="ch in chipsVenc" :key="ch.id" class="chip" :class="{ ativo: chipEditarAtivo === ch.id }" @click="setChipEditar(ch.id)">{{ ch.label }}</button>
            </div>
            <input class="cad-form-input" type="date" v-model="dataVencEditar" @change="chipEditarAtivo=null" style="margin-top:6px">
          </div>

          <!-- Total calculado -->
          <div class="cad-edit-total">
            <span class="cad-edit-total-label">Total</span>
            <span class="cad-edit-total-val">R$ {{ fmt(totalEditar) }}</span>
          </div>

          <button class="cad-btn-primary" :disabled="totalEditar <= 0" @click="salvarEdicaoFiado">✓ Salvar alterações</button>
        </div>
      </div>

    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import CadernetaSwipeItem from '../components/CadernetaSwipeItem.vue'
import {
  getLojas, salvarLoja, excluirLoja as dbExcluirLoja,
  getClientes, getTodosClientes, salvarCliente, excluirCliente as dbExcluirCliente,
  getFiados, getFiadosAbertos, getFiadosVencendoHoje,
  salvarFiado as dbSalvarFiado, atualizarFiado, excluirFiado as dbExcluirFiado,
  getStats,
  getProdutosCaderneta, salvarProdutosCaderneta,
  getTaxas, salvarTaxas,
  aplicarPagamento,
  fmt, fmtBR, fmtHora, iniciais, normalizar, resumoItens,
  hoje, horaAtual
} from '../composables/useCaderneta.js'
import { useStore } from '../store.js'
import { useConfirm } from '../composables/useConfirm.js'

const emit = defineEmits(['trocar-perfil'])
const s = useStore()
const confirmar = useConfirm()

// ── Navegação interna ─────────────────────────────────────
const tela     = ref('dashboard')
const navAtivo = ref('dashboard')
const calcInputRef = ref(null)

function irPara(dest) {
  tela.value = dest
  if (['dashboard','lojas','resumo','calculadora'].includes(dest)) navAtivo.value = dest

  // Garante o carregamento dos dados ao trocar de tela
  if (dest === 'lojas')       carregarLojas()
  if (dest === 'dashboard')   carregarDashboard()
  if (dest === 'resumo')      carregarResumo()
  if (dest === 'calculadora') {
    carregarCalculadora()
    setTimeout(() => {
      const el = calcInputRef.value
      if (el) {
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }, 150)
  }
}

function irParaResumo() {
  irPara('resumo')
}

function navSwitch(aba) {
  irPara(aba)
}

// ── Dashboard ────────────────────────────────────────────
const saudacao = ref('')
const dataBR   = ref('')
const stats    = reactive({ totalAberto: 0, totalVencido: 0, qtdAbertos: 0 })
const alertasDia = ref([])

async function carregarDashboard() {
  const agora = new Date()
  const hora  = agora.getHours()
  saudacao.value = hora < 12 ? 'Bom dia! ☀️' : hora < 18 ? 'Boa tarde! 🌤️' : 'Boa noite! 🌙'
  dataBR.value = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const s2 = await getStats()
  Object.assign(stats, s2)

  // Alertas do dia: consulta por índice dataVenc — sem full scan
  const [vencendoHoje, clientes] = await Promise.all([
    getFiadosVencendoHoje(),
    getTodosClientes()
  ])
  const telMap = Object.fromEntries(clientes.map(c => [c.id, c.telefone]))
  alertasDia.value = vencendoHoje
    .map(f => ({ ...f, clienteTel: telMap[f.clienteId] || '' }))
    .slice(0, 5)
}

// ── Lojas ────────────────────────────────────────────────
const lojas      = ref([])
const buscaLojas = ref('')
const modalLoja  = ref(null)
const formLoja   = ref({ nome: '', referencia: '' })
const editandoLoja   = ref(null)
const paraExcluirLoja = ref(null)
const swipeLojas = ref([])

const lojasFiltradas = computed(() =>
  lojas.value
    .filter(l => !buscaLojas.value || normalizar(l.nome).includes(normalizar(buscaLojas.value)))
    .sort((a, b) => a.nome.localeCompare(b.nome))
)

async function carregarLojas() { lojas.value = await getLojas() }

function abrirModalLoja(l = null) {
  editandoLoja.value = l ? l.id : null
  formLoja.value = { nome: l?.nome || '', referencia: l?.referencia || '' }
  modalLoja.value = true
}

async function salvarLoja_() {
  if (!formLoja.value.nome.trim()) return
  const obj = { nome: formLoja.value.nome.trim(), referencia: formLoja.value.referencia.trim() }
  if (editandoLoja.value) obj.id = editandoLoja.value
  await salvarLoja(obj)
  modalLoja.value = null
  s.notify(editandoLoja.value ? 'Loja atualizada!' : 'Loja cadastrada!')
  await carregarLojas()
}

function fecharOutrosLojas(id) {
  swipeLojas.value?.forEach(item => { if (item && item.id !== id) item.close?.() })
}

function confirmarExcluirLoja(l) { paraExcluirLoja.value = l }
async function excluirLoja_() {
  await dbExcluirLoja(paraExcluirLoja.value.id)
  paraExcluirLoja.value = null
  s.notify('Loja removida')
  await carregarLojas()
}

function escolherLoja(l) {
  lojaAtual.value = l
  carregarClientes()
  irPara('clientes')
}

// ── Clientes ─────────────────────────────────────────────
const clientes       = ref([])
const lojaAtual      = ref(null)
const buscaClientes  = ref('')
const modalCliente   = ref(null)
const formCliente    = ref({ nome: '', telefone: '' })
const editandoCliente = ref(null)
const paraExcluirCliente = ref(null)
const swipeClientes  = ref([])

// Verifica se o navegador suporta a API de seleção de contatos
const canImportContact = computed(() => !!(navigator.contacts && navigator.contacts.select))

async function importarDaAgenda() {
  try {
    const props = ['name', 'tel']
    const opts = { multiple: false } // Selecionar apenas um contato
    const contacts = await navigator.contacts.select(props, opts)

    if (contacts && contacts.length > 0) {
      const contact = contacts[0]
      
      // Atribui o nome (pega o primeiro nome da lista retornada)
      if (contact.name && contact.name.length > 0) {
        formCliente.value.nome = contact.name[0]
      }

      // Atribui o telefone e aplica a máscara
      if (contact.tel && contact.tel.length > 0) {
        let tel = contact.tel[0].replace(/\D/g, '')
        if (tel.length > 11 && tel.startsWith('55')) tel = tel.slice(2)
        formCliente.value.telefone = tel
        formatarTelefone({ target: { value: tel } })
      }
    }
  } catch (err) {
    console.info('Seleção de contato cancelada ou não disponível no dispositivo.')
  }
}

const clientesFiltrados = computed(() =>
  clientes.value
    .filter(c => !buscaClientes.value || normalizar(c.nome).includes(normalizar(buscaClientes.value)))
    .sort((a, b) => a.nome.localeCompare(b.nome))
)

async function carregarClientes() {
  if (!lojaAtual.value) return
  clientes.value = await getClientes(lojaAtual.value.id)
}

function abrirModalCliente(c = null) {
  editandoCliente.value = c ? c.id : null
  formCliente.value = { nome: c?.nome || '', telefone: c?.telefone || '' }
  modalCliente.value = true
}

async function salvarCliente_() {
  if (!formCliente.value.nome.trim()) return
  const obj = { nome: formCliente.value.nome.trim(), telefone: formCliente.value.telefone.trim(), lojaId: lojaAtual.value.id }
  if (editandoCliente.value) obj.id = editandoCliente.value
  await salvarCliente(obj)
  modalCliente.value = null
  s.notify(editandoCliente.value ? 'Cliente atualizada!' : 'Cliente cadastrada!')
  await carregarClientes()
}

function fecharOutrosClientes(id) {
  swipeClientes.value?.forEach(item => { if (item && item.id !== id) item.close?.() })
}

function confirmarExcluirCliente(c) { paraExcluirCliente.value = c }
async function excluirCliente_() {
  await dbExcluirCliente(paraExcluirCliente.value.id)
  paraExcluirCliente.value = null
  s.notify('Cliente removida')
  await carregarClientes()
}

function escolherCliente(c) {
  clienteAtual.value = c
  iniciarLancar()
  irPara('lancar')
}

// ── Lançar ───────────────────────────────────────────────
const clienteAtual  = ref(null)
const produtos      = ref([])
const qtds          = reactive({})
const dataVenda     = ref(new Date().toLocaleDateString('sv'))
const horaVenda     = ref(new Date().toTimeString().slice(0, 5))
const dataVenc      = ref('')
const chipAtivo     = ref(null)
const origemLancar  = ref('clientes')

const chipsVenc = [
  { id: '5dia', label: '5º Dia Útil' },
  { id: '15',   label: 'Dia 15'      },
  { id: 'fim',  label: 'Fim do Mês'  },
]

const dataVendaFmt = computed(() =>
  dataVenda.value ? dataVenda.value.split('-').reverse().join('/') : '--/--'
)
const totalLancar = computed(() =>
  produtos.value.reduce((s, p) => s + (qtds[p.id] || 0) * p.preco, 0)
)

async function iniciarLancar() {
  produtos.value = await getProdutosCaderneta()
  produtos.value.forEach(p => { qtds[p.id] = 0 })
  dataVenda.value = new Date().toLocaleDateString('sv')
  horaVenda.value = new Date().toTimeString().slice(0, 5)
  // Default: fim do mês como vencimento
  dataVenc.value  = ''
  chipAtivo.value = null
  setChip('fim') // pré-seleciona fim do mês
}

function inc(p) { qtds[p.id] = (qtds[p.id] || 0) + 1 }
function dec(p) { if (qtds[p.id] > 0) qtds[p.id]-- }

function calcChipDate(id, base) {
  let d = new Date(base)
  if (id === '5dia') {
    d.setMonth(d.getMonth() + 1); d.setDate(1)
    let uteis = 0
    while (uteis < 5) { const dia = d.getDay(); if (dia !== 0 && dia !== 6) uteis++; if (uteis < 5) d.setDate(d.getDate() + 1) }
  } else if (id === '15') {
    d.setDate(15); if (d <= base) d.setMonth(d.getMonth() + 1)
  } else if (id === 'fim') {
    d.setMonth(d.getMonth() + 1); d.setDate(0)
  }
  return d.toLocaleDateString('sv')
}

function setChip(id) {
  chipAtivo.value = id
  const base = dataVenda.value ? new Date(dataVenda.value + 'T12:00:00') : new Date()
  dataVenc.value = calcChipDate(id, base)
}

async function salvarFiado() {
  if (totalLancar.value === 0 || !clienteAtual.value || !lojaAtual.value) return

  // 1. Validação de agendamento (vencimento)
  if (!dataVenc.value) {
    s.notify('Escolha uma data para o acerto (vencimento)', 'warning')
    return
  }

  // 2. Montagem do resumo para confirmação
  const itensTexto = produtos.value
    .filter(p => qtds[p.id] > 0)
    .map(p => `• ${qtds[p.id]}x ${p.nome}`)
    .join('\n')

  const resumo = `Cliente: ${clienteAtual.value.nome}\n` +
                 `Vencimento: ${fmtBR(dataVenc.value)}\n` +
                 `Total: R$ ${fmt(totalLancar.value)}\n\n` +
                 `Itens:\n${itensTexto}`

  const ok = await confirmar.ask(resumo, {
    title: 'Confirmar Fiado?',
    confirmLabel: 'Salvar no Caderninho',
    icon: 'fas fa-calendar-check',
    type: 'primary'
  })
  if (!ok) return

  const itens = produtos.value
    .filter(p => qtds[p.id] > 0)
    .map(p => ({ id: p.id, nome: p.nome, emoji: p.emoji, qty: qtds[p.id], preco: p.preco, subtotal: qtds[p.id] * p.preco }))
  const fiado = {
    clienteId:   clienteAtual.value.id,
    clienteNome: clienteAtual.value.nome,
    lojaId:      lojaAtual.value.id,
    lojaNome:    lojaAtual.value.nome,
    itens,
    total:       totalLancar.value,
    saldo:       totalLancar.value,
    status:      'aberto',
    dataVenda:   dataVenda.value,
    horaVenda:   horaVenda.value || null,
    dataVenc:    dataVenc.value || null,
    criadoEm:    new Date().toISOString(),
  }
  await dbSalvarFiado(fiado)
  s.notify('Fiado salvo!')
  s.syncImediato()   // sync imediato no Drive
  const s2 = await getStats()
  Object.assign(stats, s2)
  if (origemLancar.value === 'resumo') {
    await carregarResumo()
    irPara('resumo')
  } else {
    irPara('clientes')
  }
}

function voltarDeLancar() {
  if (origemLancar.value === 'resumo') { carregarResumo(); irPara('resumo') }
  else { irPara('clientes') }
}

// ── Resumo ───────────────────────────────────────────────
const fiadosTodos    = ref([])
const clientesTodos  = ref([])
const buscaResumo    = ref('')
const modoResumo     = ref('abertos')

// Recarrega fiados ao trocar modo: abertos usa índice, histórico carrega tudo
watch(modoResumo, () => { if (tela.value === 'resumo') carregarResumo() })
const lojasExpandidas    = ref(new Set())
const clientesExpandidos = ref(new Set())
const fiadoReceber   = ref(null)
const valorReceber   = ref(0)
const clienteQuitar  = ref(null)
const fiadoExcluir   = ref(null)
const fiadoEditarVenc    = ref(null)
const dataVencEditar     = ref('')
const chipEditarAtivo    = ref(null)
const fiadoEditar        = ref(null)
const produtosEditar     = ref([])
const qtdsEditar         = reactive({})
const fiadoEditarData    = ref('')
const fiadoEditarHora    = ref('')
const swipeCompras       = ref([])

async function carregarResumo() {
  // Modo abertos: usa índice — não carrega histórico completo
  // Modo histórico: carrega tudo (necessário para mostrar fiados pagos)
  const [fiados, clientes, s2] = await Promise.all([
    modoResumo.value === 'historico' ? getFiados() : getFiadosAbertos(),
    getTodosClientes(),
    getStats()
  ])
  fiadosTodos.value   = fiados
  clientesTodos.value = clientes
  Object.assign(stats, s2)
}

const telMap = computed(() => Object.fromEntries(clientesTodos.value.map(c => [c.id, c.telefone])))

// Fiados abertos enriquecidos com telefone
const fiadosAbertosEnriquecidos = computed(() => {
  const hj = hoje()
  return fiadosTodos.value
    .filter(f => f.saldo > 0.01)
    .map(f => ({
      ...f,
      clienteTel: telMap.value[f.clienteId] || '',
      atrasada: f.dataVenc && f.dataVenc < hj
    }))
})

// Seções de agendamento
const fiadosVencidos = computed(() =>
  fiadosAbertosEnriquecidos.value
    .filter(f => f.atrasada)
    .sort((a, b) => (a.dataVenc||'').localeCompare(b.dataVenc||''))
)
const fiadosSemData = computed(() =>
  fiadosAbertosEnriquecidos.value.filter(f => !f.dataVenc)
)

function fmtVencLabel(dataVenc) {
  if (!dataVenc) return '—'
  const hj = hoje()
  if (dataVenc === hj) return '⚡ Hoje'
  const amanha = new Date(hj + 'T12:00:00')
  amanha.setDate(amanha.getDate() + 1)
  if (dataVenc === amanha.toLocaleDateString('sv')) return 'Amanhã'
  return fmtBR(dataVenc)
}

const fiadosAbertos = computed(() => fiadosTodos.value.filter(f => f.saldo > 0.01))
const textoVazioResumo = computed(() => {
  if (buscaResumo.value.trim()) return 'Nenhum cliente encontrado.'
  return modoResumo.value === 'historico' ? 'Nenhum histórico registrado.' : 'Nenhum fiado em aberto.'
})

const tituloListaResumo = computed(() => {
  if (buscaResumo.value.trim()) return 'Resultados da busca'
  return modoResumo.value === 'historico' ? 'Histórico de Clientes' : 'Aberto por Cliente'
})

const gruposResumo = computed(() => montarGrupos())

function montarGrupos() {
  const hj    = hoje()
  const termo = normalizar(buscaResumo.value.trim())
  const fonte = modoResumo.value === 'historico' ? fiadosTodos.value : fiadosAbertos.value
  const filtrados = fonte.filter(f => {
    if (!termo) return true
    const telefone = telMap.value[f.clienteId] || f.clienteTel || ''
    return normalizar([f.clienteNome, f.lojaNome, telefone, resumoItens(f.itens)].join(' ')).includes(termo)
  })
  const porLoja = new Map()
  filtrados.forEach(f => {
    if (!porLoja.has(f.lojaId)) porLoja.set(f.lojaId, { lojaId: f.lojaId, lojaNome: f.lojaNome, clientes: new Map() })
    const g = porLoja.get(f.lojaId)
    if (!g.clientes.has(f.clienteId)) {
      g.clientes.set(f.clienteId, {
        clienteId: f.clienteId, clienteNome: f.clienteNome,
        telefone: telMap.value[f.clienteId] || '',
        fiados: [], saldo: 0, atrasado: false
      })
    }
    const c = g.clientes.get(f.clienteId)
    const atrasada = f.saldo > 0.01 && f.dataVenc && f.dataVenc < hj
    c.fiados.push({ ...f, atrasada })
    c.saldo += f.saldo || 0
    if (atrasada) c.atrasado = true
  })
  return [...porLoja.values()].map(g => {
    const clientes = [...g.clientes.values()].map(c => ({
      ...c,
      fiados: c.fiados.sort((a, b) => {
        const da = `${a.dataVenda||''} ${a.horaVenda||'00:00'}`
        const db = `${b.dataVenda||''} ${b.horaVenda||'00:00'}`
        return String(db).localeCompare(String(da))
      }),
      totalCompras: c.fiados.reduce((s, f) => s + Number(f.total || 0), 0)
    })).sort((a, b) => a.clienteNome.localeCompare(b.clienteNome))
    return { ...g, clientes, total: clientes.reduce((s,c) => s+c.saldo, 0), totalCompras: clientes.reduce((s,c) => s+c.totalCompras, 0) }
  }).sort((a, b) => a.lojaNome.localeCompare(b.lojaNome))
}

function fmtDataHora(f) {
  const hora = fmtHora(f.horaVenda)
  return hora ? `${fmtBR(f.dataVenda)} ${hora}` : fmtBR(f.dataVenda)
}
function totalPagoF(f) { return (f.pagamentos||[]).reduce((s,p)=>s+Number(p.valor||0),0) }

function lojaColapsada(g) { return !buscaResumo.value.trim() && !lojasExpandidas.value.has(g.lojaId) }
function clienteColapsado(g, c) { return !buscaResumo.value.trim() && !clientesExpandidos.value.has(`${g.lojaId}:${c.clienteId}`) }
function alternarLoja(g) {
  const s = new Set(lojasExpandidas.value)
  s.has(g.lojaId) ? s.delete(g.lojaId) : s.add(g.lojaId)
  lojasExpandidas.value = s
}
function alternarCliente(g, c) {
  const key = `${g.lojaId}:${c.clienteId}`
  const s = new Set(clientesExpandidos.value)
  s.has(key) ? s.delete(key) : s.add(key)
  clientesExpandidos.value = s
}

function iniciarVendaResumo(g, c) {
  lojaAtual.value    = { id: g.lojaId, nome: g.lojaNome, referencia: '' }
  clienteAtual.value = { id: c.clienteId, nome: c.clienteNome, telefone: c.telefone, lojaId: g.lojaId }
  origemLancar.value = 'resumo'
  iniciarLancar()
  irPara('lancar')
}

function abrirWhatsapp(c) {
  const tel = (c.telefone || '').replace(/\D/g, '')
  let msg = `Oi ${c.clienteNome}, tudo bem! `
  
  if (modoResumo.value === 'historico') {
    msg = encodeURIComponent(msg)
  } else {
    const abertos = c.fiados.filter(f => f.saldo > 0.01)
    if (abertos.length === 1) {
      const f = abertos[0]
      const itens = resumoItens(f.itens)
      msg += `Passando para falar sobre a venda do dia ${fmtBR(f.dataVenda)}${f.horaVenda ? ' às ' + f.horaVenda : ''} no valor de R$ ${fmt(f.saldo)}.`
      if (itens) msg += `\n\nItens:\n${itens}`
    } else {
      const lista = abertos.map(f => {
        const itensTxt = resumoItens(f.itens).replace(/\n/g, ', ')
        return `• ${fmtBR(f.dataVenda)}${f.horaVenda ? ' às ' + f.horaVenda : ''}: R$ ${fmt(f.saldo)} (${itensTxt})`
      }).join('\n')
      msg += `Passando para falar sobre as vendas em aberto:\n\n${lista}\n\nTotal: R$ ${fmt(c.saldo)}.`
    }
    msg = encodeURIComponent(msg)
  }
  window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
}

function abrirWhatsappFiado(f) {
  const tel = (f.clienteTel || '').replace(/\D/g, '')
  const itens = resumoItens(f.itens)
  let msg = `Oi ${f.clienteNome}, tudo bem! Passando para falar sobre a venda do dia ${fmtBR(f.dataVenda)}${f.horaVenda ? ' às ' + f.horaVenda : ''} no valor de R$ ${fmt(f.saldo)}.`
  if (itens) msg += `\n\nItens:\n${itens}`
  const msgEncoded = encodeURIComponent(msg)
  window.open(`https://wa.me/55${tel}?text=${msgEncoded}`, '_blank')
}

function abrirReceber(f) { fiadoReceber.value = f; valorReceber.value = f.saldo }
async function confirmarReceber() {
  const f = fiadoReceber.value
  if (!f || !valorReceber.value || valorReceber.value <= 0) return
  const pago = Math.min(valorReceber.value, f.saldo)
  await atualizarFiado(f.id, aplicarPagamento(f, pago))
  fiadoReceber.value = null
  s.notify('Pagamento registrado!')
  s.syncImediato()   // sync imediato no Drive
  await carregarResumo()
  const s2 = await getStats()
  Object.assign(stats, s2)
}

function abrirQuitarTudo(c) { clienteQuitar.value = c }
async function quitarTudo() {
  const c = clienteQuitar.value
  if (!c) return
  await Promise.all(c.fiados.map(f => atualizarFiado(f.id, aplicarPagamento(f, f.saldo))))
  clienteQuitar.value = null
  s.notify(`${c.clienteNome} quitado!`)
  s.syncImediato()   // sync imediato no Drive
  await carregarResumo()
  const s2 = await getStats()
  Object.assign(stats, s2)
}

function confirmarExcluirFiado(f) { fiadoExcluir.value = f }
async function excluirFiado_() {
  await dbExcluirFiado(fiadoExcluir.value.id)
  fiadoExcluir.value = null
  s.notify('Fiado removido')
  s.syncImediato()   // sync imediato no Drive
  await carregarResumo()
}

// Editar vencimento de um fiado existente
function abrirEditarVenc(f) {
  fiadoEditarVenc.value  = f
  dataVencEditar.value   = f.dataVenc || ''
  chipEditarAtivo.value  = null
}
function setChipEditar(id) {
  chipEditarAtivo.value = id
  const base = new Date()
  dataVencEditar.value = calcChipDate(id, base)
}
async function salvarVencimento() {
  if (!fiadoEditarVenc.value || !dataVencEditar.value) return
  await atualizarFiado(fiadoEditarVenc.value.id, { dataVenc: dataVencEditar.value })
  fiadoEditarVenc.value = null
  s.notify('Vencimento salvo!')
  await carregarResumo()
}

// ── Editar fiado (corrigir cobrança) ─────────────────────────
async function abrirEditarFiado(f) {
  fiadoEditar.value   = f
  fiadoEditarData.value = f.dataVenda || hoje()
  fiadoEditarHora.value = f.horaVenda || ''
  dataVencEditar.value  = f.dataVenc  || ''
  chipEditarAtivo.value = null
  // Carrega produtos e pré-preenche quantidades dos itens existentes
  produtosEditar.value = await getProdutosCaderneta()
  produtosEditar.value.forEach(p => {
    const item = (f.itens || []).find(i => i.id === p.id)
    qtdsEditar[p.id] = item ? (item.qty ?? item.qtd ?? 0) : 0
  })
}
function incEditar(p) { qtdsEditar[p.id] = (qtdsEditar[p.id] || 0) + 1 }
function decEditar(p) { if (qtdsEditar[p.id] > 0) qtdsEditar[p.id]-- }
const totalEditar = computed(() =>
  (produtosEditar.value || []).reduce((s, p) => s + (qtdsEditar[p.id] || 0) * p.preco, 0)
)
function compraSwipeActions(f) {
  // No modo histórico não mostra receber/editar
  if (modoResumo.value === 'historico') return ['edit', 'delete']
  return f.saldo > 0.01 ? ['receive', 'edit', 'delete'] : ['edit', 'delete']
}
function fecharOutrosCompras(id, cliente) {
  // Fecha outros swipes abertos dentro do mesmo cliente
  swipeCompras.value?.forEach(item => { if (item && item.id !== id) item.close?.() })
}
async function salvarEdicaoFiado() {
  const f = fiadoEditar.value
  if (!f || totalEditar.value <= 0) return
  const itens = produtosEditar.value
    .filter(p => qtdsEditar[p.id] > 0)
    .map(p => ({ id: p.id, nome: p.nome, emoji: p.emoji, qty: qtdsEditar[p.id], preco: p.preco, subtotal: qtdsEditar[p.id] * p.preco }))
  const novoTotal = totalEditar.value
  const totalPago = (f.pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0)
  const novoSaldo = Math.max(0, novoTotal - totalPago)
  await atualizarFiado(f.id, {
    itens,
    total:      novoTotal,
    saldo:      novoSaldo,
    status:     novoSaldo <= 0.01 ? 'pago' : 'aberto',
    dataVenda:  fiadoEditarData.value,
    horaVenda:  fiadoEditarHora.value || null,
    dataVenc:   dataVencEditar.value  || null,
    editadoEm:  new Date().toISOString()
  })
  fiadoEditar.value = null
  s.notify('Venda atualizada!')
  s.syncImediato()
  await carregarResumo()
  const s2 = await getStats()
  Object.assign(stats, s2)
}

// ── Máscara de telefone ───────────────────────────────────────
function formatarTelefone(e) {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 10)
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  else
    v = v.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4')
  formCliente.value.telefone = v
}

// ── Calculadora ──────────────────────────────────────────
const rawCalcInput = ref('')
const taxasMaquineta = ref({ debito: 0, credito_avista: 0 })

const taxaStr = (t) => String(t || 0).replace('.', ',') + '%'

async function carregarCalculadora() {
  taxasMaquineta.value = await getTaxas()
}

function parseCalcVal() {
  if (!rawCalcInput.value) return 0
  const clean = rawCalcInput.value.replace(/[^\d,]/g, "").replace(",", ".")
  return parseFloat(clean) || 0
}

function calcBruto(liquido, taxa) {
  if (!taxa) return liquido
  return liquido / (1 - taxa / 100)
}

const resultDebito = computed(() => {
  const v = parseCalcVal()
  return v ? fmt(calcBruto(v, taxasMaquineta.value.debito)) : '0,00'
})

const resultCredito = computed(() => {
  const v = parseCalcVal()
  return v ? fmt(calcBruto(v, taxasMaquineta.value.credito_avista)) : '0,00'
})

function handleCalcInput(e) {
  let v = e.target.value.replace(/\D/g, "")
  if (!v) {
    rawCalcInput.value = ""
    return
  }
  rawCalcInput.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(v) / 100)
  
  // Garante que o cursor permaneça no final após a formatação da máscara
  setTimeout(() => {
    const el = e.target
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, 0)
}

// ── Init ─────────────────────────────────────────────────
onMounted(async () => {
  await carregarDashboard()
  carregarLojas() // Pré-carrega as lojas em background para navegação instantânea
})
</script>

<style scoped>
/* ── Layout base ─────────────────────────────────────── */
.tab-caderneta { height: 100%; display: flex; flex-direction: column; background: var(--bg); }
.cad-tela { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

/* ── Topbar ──────────────────────────────────────────── */
.cad-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; min-height: 56px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.cad-topbar-title {
  font-size: 15px; font-weight: 800; color: var(--text);
  display: flex; flex-direction: column; align-items: center;
}
.cad-topbar-sub { font-size: 11px; font-weight: 500; color: var(--muted); }
.cad-btn-icon {
  width: 40px; height: 40px; border: none; background: transparent;
  color: var(--brown); cursor: pointer; display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
}
.cad-btn-icon:active { background: var(--border); }

/* ── Dashboard body ──────────────────────────────────── */
.cad-body { flex: 1; overflow-y: auto; padding: 20px 16px 120px; }
.cad-greeting { text-align: center; margin-bottom: 20px; }
.cad-hello { font-size: 22px; font-weight: 800; }
.cad-date  { font-size: 13px; color: var(--muted); margin-top: 4px; }

.cad-kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.cad-kpi {
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); padding: 14px; box-shadow: var(--shadow);
}
.cad-kpi.destaque { border-color: rgba(26,122,69,.3); }
.cad-kpi.alerta   { border-color: #fecaca; }
.cad-kpi-label { font-size: 11px; color: var(--muted); font-weight: 700; }
.cad-kpi-val   { font-size: 22px; font-weight: 800; font-family: var(--mono); margin-top: 4px; }
.cad-kpi-val.verde    { color: var(--green); }
.cad-kpi-val.vermelho { color: var(--red, #dc2626); }

/* Alerta do dia */
.cad-alerta-dia {
  background: var(--gold-bg); border: 1.5px solid rgba(200,137,10,.3);
  border-radius: var(--r-md); margin-bottom: 16px; overflow: hidden;
}
.cad-alerta-titulo {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; font-size: 11px; font-weight: 800;
  color: var(--gold-dark); text-transform: uppercase; letter-spacing: .04em;
  border-bottom: 1px solid rgba(200,137,10,.2);
}
.cad-alerta-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer; border-bottom: 1px solid rgba(200,137,10,.12);
}
.cad-alerta-item:last-of-type { border-bottom: none; }
.cad-alerta-item:active { background: rgba(200,137,10,.08); }
.cad-alerta-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--brown); color: #fff;
  font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cad-alerta-info { flex: 1; min-width: 0; }
.cad-alerta-nome { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-alerta-loja { font-size: 11px; color: var(--muted); }
.cad-alerta-val  { font-size: 14px; font-weight: 800; color: var(--brown); font-family: var(--mono); flex-shrink: 0; }
.cad-alerta-mais {
  text-align: center; padding: 8px 14px;
  font-size: 12px; font-weight: 700; color: var(--gold-dark);
  cursor: pointer; border-top: 1px solid rgba(200,137,10,.2);
}

.cad-dash-actions { display: flex; gap: 10px; margin-bottom: 24px; }
.cad-action-btn {
  flex: 1; padding: 14px 12px; border: none; border-radius: var(--r-md);
  font-family: var(--font); font-size: 14px; font-weight: 800;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: var(--shadow);
}
.cad-action-btn.primary  { background: var(--brown); color: #fff; }
.cad-action-btn.secondary { background: var(--surface); color: var(--brown); border: 1.5px solid var(--border); }
.cad-action-btn:active { opacity: .8; }

.cad-nav-row { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.cad-nav-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 8px 14px; border-radius: var(--r-full); border: 1.5px solid var(--border);
  background: var(--surface); color: var(--muted);
  font-family: var(--font); font-size: 12px; font-weight: 700; cursor: pointer;
}
.cad-nav-chip.ativo { background: var(--brown); color: #fff; border-color: var(--brown); }
.cad-nav-chip:active { opacity: .8; }

/* ── Search / Scroll ─────────────────────────────────── */
.cad-search-bar { padding: 10px 14px; flex-shrink: 0; }
.cad-search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-full); padding: 0 14px; height: 44px;
  color: var(--muted);
}
.cad-search-input {
  flex: 1; border: none; background: transparent; font-size: 15px;
  color: var(--text); outline: none; font-family: var(--font);
}
.cad-scroll-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 14px 100px; }

/* ── List items ──────────────────────────────────────── */
.cad-list-icon { font-size: 24px; flex-shrink: 0; margin-right: 12px; }
.cad-list-icon.pessoa { font-size: 20px; }
.cad-list-info { flex: 1; min-width: 0; }
.cad-list-nome { font-size: 15px; font-weight: 700; }
.cad-list-sub  { font-size: 12px; color: var(--muted); margin-top: 2px; }

.cad-empty { text-align: center; padding: 60px 20px; color: var(--muted); }
.cad-empty-ico { font-size: 40px; margin-bottom: 10px; }

/* ── Lançar ──────────────────────────────────────────── */
.cad-lancar-body {
  flex: 1; overflow-y: auto; padding: 14px 14px 130px;
  display: flex; flex-direction: column; gap: 18px;
}
.cad-lancar-body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.cad-lancar-body::-webkit-scrollbar {
  display: none;
}
.cad-date-tags { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.cad-tag-label { font-size: 9px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
.cad-tag-date {
  background: var(--gold-bg, #fff8e1); color: var(--gold, #b8860b);
  border: 1px solid rgba(200,137,10,.3); min-height: 28px; padding: 0 8px;
  border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer;
  display: inline-flex; align-items: center;
}
.cad-cliente-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--cream); border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 14px;
}
.cad-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  background: var(--brown); color: #fff;
  font-size: 17px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cad-cliente-info { flex: 1; min-width: 0; }
.cad-cliente-nome { font-size: 16px; font-weight: 800; }
.cad-cliente-loja { font-size: 11px; color: var(--muted); margin-top: 3px; display: flex; align-items: center; gap: 4px; }

.cad-section-label { font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 8px; }
.cad-section-label--required { display: flex; align-items: center; gap: 6px; }
.cad-required-badge {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  background: rgba(200,137,10,.15); color: var(--gold-dark);
  padding: 2px 6px; border-radius: var(--r-full);
}

.cad-produtos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cad-produto-card {
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); padding: 16px 12px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  box-shadow: var(--shadow); transition: border-color var(--t), background var(--t);
}
.cad-produto-card.ativo { border-color: var(--brown-light); background: var(--cream); }
.cad-prod-emoji { font-size: 34px; line-height: 1; }
.cad-prod-nome  { font-size: 13px; font-weight: 700; text-align: center; }
.cad-prod-preco { font-size: 11px; color: var(--muted); font-family: var(--mono); }
.cad-stepper {
  display: flex; align-items: center; margin-top: 6px;
  background: var(--bg); border: 1.5px solid var(--border); border-radius: var(--r-full); overflow: hidden;
}
.cad-stepper-btn {
  width: 44px; height: 44px; border: none; background: transparent;
  color: var(--brown); font-size: 24px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-family: var(--font);
}
.cad-stepper-btn:active { background: var(--border); }
.cad-stepper-btn:disabled { color: var(--muted); }
.cad-stepper-qty { min-width: 34px; text-align: center; font-size: 17px; font-weight: 800; color: var(--text); font-family: var(--mono); }
.cad-chip-row { display: flex; justify-content: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }

/* Campo de data clicável */
.cad-date-field {
  display: flex; align-items: center; gap: 8px; position: relative;
  padding: 12px 14px; border-radius: var(--r-sm); cursor: pointer;
  border: 1.5px solid var(--border); font-size: 14px; font-weight: 700;
  transition: border-color var(--t), background var(--t);
}
.cad-date-field--filled { background: var(--cream); border-color: var(--brown-light); color: var(--brown); }
.cad-date-field--empty  { background: var(--surface); color: var(--muted); }
.cad-date-field:active  { opacity: .8; }
.cad-venc-aviso {
  font-size: 11px; color: var(--orange); font-weight: 700;
  margin-top: 6px; padding: 6px 10px;
  background: var(--orange-bg); border-radius: var(--r-sm);
}

.cad-footer-fixo {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: var(--bg); border-top: 1px solid var(--border);
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 12px; z-index: 50;
  box-shadow: 0 -4px 20px rgba(61,32,8,.08);
}
.cad-footer-total { flex: 1; }
.cad-footer-label { font-size: 11px; color: var(--muted); font-weight: 600; }
.cad-footer-val   { font-size: 24px; font-weight: 800; color: var(--brown); font-family: var(--mono); line-height: 1.1; }
.cad-btn-salvar {
  padding: 14px 24px; border-radius: var(--r-md); border: none;
  background: var(--green); color: #fff; font-family: var(--font);
  font-size: 15px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
.cad-btn-salvar:active   { opacity: .85; }
.cad-btn-salvar:disabled { opacity: .4; cursor: default; }

/* ── Resumo ──────────────────────────────────────────── */

/* Topo do resumo */
.cad-resumo-topbar {
  display: flex; flex-direction: column; gap: 9px;
  padding: 10px 14px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.cad-resumo-titlebar {
  display: flex; align-items: center; gap: 10px;
  min-height: 34px;
}
.cad-resumo-titulo {
  font-size: .95rem; font-weight: 800;
  color: var(--brown-dark); display: flex; align-items: center; gap: 7px;
}
.cad-resumo-titulo svg { color: var(--brown-mid); flex-shrink: 0; }
.cad-resumo-filter-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; min-width: 0;
}
.cad-resumo-search {
  flex: 1 1 auto; min-width: 0;
  display: flex; align-items: center; gap: 6px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-full); padding: 0 10px; height: 34px;
}
.cad-resumo-search-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 12px; font-family: var(--font); color: var(--text);
}
.cad-resumo-search-input::placeholder { color: var(--muted); }
.cad-resumo-clear {
  background: none; border: none; cursor: pointer; padding: 0;
  color: var(--muted); display: flex; align-items: center;
}
.cad-resumo-seg-control {
  flex-shrink: 0;
  display: flex; background: var(--bg);
  border: 1px solid var(--border); border-radius: var(--r-full);
  padding: 3px; gap: 2px;
}
.cad-resumo-seg-btn {
  padding: 5px 10px; border-radius: var(--r-full);
  font-size: .74rem; font-weight: 700; color: var(--muted);
  cursor: pointer; background: transparent; border: none;
  transition: all .18s; white-space: nowrap;
  font-family: var(--font);
}
.cad-resumo-seg-btn.active {
  background: var(--brown-dark); color: var(--cream);
  box-shadow: 0 1px 4px rgba(61,31,7,.25);
}

/* KPIs inline finos */
.cad-kpi-inline {
  display: flex; align-items: center; gap: 0;
  padding: 7px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.cad-kpi-item { flex: 1; }
.cad-kpi-divider { width: 1px; height: 28px; background: var(--border); margin: 0 14px; flex-shrink: 0; }
.cad-kpi-item-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.cad-kpi-item-val   { font-size: 15px; font-weight: 800; color: var(--brown); font-family: var(--mono); margin-top: 2px; }
.cad-kpi-item-val--red { color: var(--red, #dc2626); }

.cad-agend-row:last-child { border-bottom: none; }
.cad-agend-row--red    { background: #fff9f9; }
.cad-agend-row--gray   { background: var(--cream); }

.cad-agend-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: var(--cream-deep); color: var(--brown-mid); font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--border2);
}
.cad-agend-avatar--red  { background: #fef2f2; color: var(--red, #dc2626); border-color: #fecaca; }
.cad-agend-avatar--gray { background: var(--border); color: var(--muted); }

.cad-agend-info { flex: 1; min-width: 0; }
.cad-agend-nome  { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-agend-loja  { font-size: 10px; color: var(--muted); }
.cad-agend-itens {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre-line;
  line-height: 1.35;
}
.cad-agend-dir   { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 84px; }
.cad-agend-val   { font-size: 14px; font-weight: 800; font-family: var(--mono); color: var(--brown); }
.cad-agend-data  { font-size: 10px; color: var(--muted); font-weight: 700; }
.cad-agend-data--red    { color: var(--red, #dc2626); }
.cad-agend-acoes { display: flex; gap: 4px; }

.cad-btn-receber-sm {
  width: 32px; height: 32px; border-radius: 50%; border: none;
  background: var(--green); color: #fff;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.cad-btn-zap-sm {
  display: flex; align-items: center; gap: 3px; white-space: nowrap;
  padding: 5px 9px; border-radius: var(--r-full); border: none;
  background: #25D366; color: #fff;
  font-family: var(--font); font-size: 11px; font-weight: 700; cursor: pointer;
}
.cad-btn-zap-sm:active { opacity: .85; }
.cad-btn-agendar {
  display: flex; align-items: center; gap: 4px; white-space: nowrap;
  padding: 5px 10px; border: 1.5px solid var(--border2); border-radius: var(--r-full);
  background: var(--surface); color: var(--muted);
  font-family: var(--font); font-size: 11px; font-weight: 700; cursor: pointer;
}
.cad-btn-agendar:active { background: var(--border); }

.cad-separador {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em;
}
.cad-separador::before, .cad-separador::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}

/* Grupos */
.cad-grupo-loja { display: flex; flex-direction: column; gap: 6px; }
.cad-loja-header {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; min-height: 48px;
  background: var(--surface); border-radius: 10px; border-left: 3px solid var(--brown);
  box-shadow: var(--shadow); cursor: pointer; user-select: none; z-index: 2;
}
.cad-loja-header:active { opacity: .8; }
.cad-loja-ico     { color: var(--brown); flex-shrink: 0; }
.cad-loja-nome    { font-size: 13px; font-weight: 800; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-loja-total   { font-size: 13px; font-weight: 800; color: var(--brown); font-family: var(--mono); white-space: nowrap; }
.cad-loja-chevron { color: var(--brown-light); flex-shrink: 0; transition: transform .22s cubic-bezier(.4,0,.2,1); margin-left: 4px; }
.cad-loja-header.colapsado .cad-loja-chevron { transform: rotate(-90deg); }
.cad-grupo-clientes {
  margin-left: 10px; padding-left: 8px; display: flex; flex-direction: column; gap: 4px;
  overflow: hidden; transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease;
  max-height: 9999px; opacity: 1;
}
.cad-grupo-clientes.colapsado { max-height: 0 !important; opacity: 0; }
.cad-cli-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md); overflow: hidden; box-shadow: var(--shadow); }
.cad-cli-card.atrasado { border-color: #fecaca; background: #fff9f9; }
.cad-cli-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; min-height: 60px; cursor: pointer; user-select: none; }
.cad-cli-header:active { background: var(--cream); }
.cad-cli-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  background: var(--cream-deep); color: var(--brown-mid); font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--border2);
}
.cad-cli-avatar.atrasado { background: #fef2f2; color: var(--red, #dc2626); border-color: #fecaca; }
.cad-cli-info  { flex: 1; min-width: 0; }
.cad-cli-nome  { font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-cli-tel   { font-size: 11px; color: var(--muted); margin-top: 1px; }
.cad-cli-total { font-size: 15px; font-weight: 800; font-family: var(--mono); white-space: nowrap; flex-shrink: 0; }
.cad-cli-total--red { color: var(--red, #dc2626); }
.cad-cli-total--ok  { color: var(--green); }
.cad-cli-chevron { color: var(--brown-light); flex-shrink: 0; transition: transform .22s; }
.cad-cli-header.colapsado .cad-cli-chevron { transform: rotate(-90deg); }
.cad-cli-btns { display: flex; gap: 8px; align-items: center; padding: 0 12px 10px 64px; flex-wrap: nowrap; }
.cad-btn-venda, .cad-btn-quitar {
  min-height: 40px; padding: 0 12px; border-radius: var(--r-full); border: none;
  color: #fff; font-size: 12px; font-weight: 800; cursor: pointer;
  font-family: var(--font); display: flex; align-items: center; gap: 4px; white-space: nowrap;
}
.cad-btn-venda  { background: var(--green); }
.cad-btn-quitar { background: var(--brown); }
.cad-btn-venda:active, .cad-btn-quitar:active { opacity: .8; }
.cad-btn-zap {
  min-height: 40px; padding: 0 12px; border-radius: var(--r-full); border: none;
  background: #25D366; color: #fff;
  font-size: 12px; font-weight: 800; cursor: pointer;
  font-family: var(--font); display: flex; align-items: center; gap: 4px; white-space: nowrap;
}
.cad-btn-zap:active { opacity: .85; }
.cad-compras-lista { border-top: 1.5px dashed var(--border2); overflow: hidden; transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease; max-height: 9999px; opacity: 1; }
.cad-compras-lista.colapsado { max-height: 0 !important; opacity: 0; border-top-color: transparent; }
.cad-compra-row { display: flex; align-items: flex-start; justify-content: space-between; padding: 8px 12px; gap: 10px; border-bottom: 1px dashed var(--border); min-height: 52px; }
.cad-compra-row:last-child { border-bottom: none; }
.cad-compra-row.atrasada   { background: #fff5f5; }
.cad-compra-esq { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cad-compra-data { font-size: 11px; font-weight: 700; color: var(--brown-mid); }
.cad-compra-itens {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre-line;
  line-height: 1.35;
}
.cad-compra-pagamentos { font-size: 11px; color: var(--green); font-weight: 700; }
.cad-compra-dir { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 96px; }
.cad-compra-valor { font-size: 14px; font-weight: 800; font-family: var(--mono); white-space: nowrap; }
.cad-compra-valor--red { color: var(--red, #dc2626); }
.cad-compra-meta  { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
.cad-compra-status { font-size: 10px; color: var(--orange); font-weight: 800; text-transform: uppercase; white-space: nowrap; }
.cad-compra-status.pago { color: var(--green); }
.cad-compra-vence { font-size: 10px; color: var(--muted); white-space: nowrap; }
.cad-compra-vence--red  { color: var(--red, #dc2626); font-weight: 700; }
.cad-compra-vence--gray { color: var(--muted); }

/* ── Config ──────────────────────────────────────────── */
.cad-prod-edit-row {
  display: grid; grid-template-columns: 44px 1fr 74px 44px;
  align-items: center; gap: 6px; margin-bottom: 8px; box-sizing: border-box;
}
.cad-input-emoji {
  width: 44px; height: 44px; text-align: center; font-size: 20px;
  border: 1.5px solid var(--border); border-radius: var(--r-sm);
  padding: 4px; background: var(--surface); box-sizing: border-box; flex-shrink: 0;
}
/* ── Layout e Nav Bete ── */
.cad-nav-fixa { 
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  max-width: 480px; margin: 0 auto;
  border-top: 1px solid var(--border);
}

/* ── FAB Taxas (teleported to body — use :global) ── */
:global(.cad-fab-taxas) {
  position: fixed;
  bottom: 104px;
  right: 16px;
  z-index: 9100;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--brown-dark);
  color: rgba(255,255,255,.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  box-shadow: 0 4px 16px rgba(61,31,7,.35), 0 1px 4px rgba(61,31,7,.2);
  cursor: pointer;
  transition: transform .18s cubic-bezier(.34,1.56,.64,1), background .15s, box-shadow .15s;
  font-family: var(--font);
}
:global(.cad-fab-taxas:active) {
  transform: scale(.88);
  box-shadow: 0 2px 8px rgba(61,31,7,.25);
}
:global(.cad-fab-taxas--active) {
  background: var(--gold-dark);
  color: #fff;
  box-shadow: 0 4px 16px rgba(200,137,10,.4);
}
:global(.cad-fab-taxas-label) {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .5px;
  line-height: 1;
  opacity: .8;
}

/* Botão "+ Fiado" destacado na nav */
.nav-btn--fiado {
  color: var(--brown) !important;
}
.nav-btn--fiado svg {
  color: var(--gold-dark);
  background: var(--gold-bg);
  border-radius: 50%;
  padding: 3px;
  width: 30px !important;
  height: 30px !important;
  border: 1.5px solid rgba(200,137,10,.3);
}
.nav-btn--fiado.active svg {
  background: var(--gold);
  color: var(--brown-dark);
  border-color: var(--gold-light);
}
.cad-body { padding-bottom: 100px; }

.kpi-card.alerta-red { border-color: var(--red-dim); background: var(--red-bg); }

/* ── Checkout de Lançamento ── */
.cad-footer-lancar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--surface); border-top: 1px solid var(--border);
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 12px; z-index: 110;
  max-width: 480px; margin: 0 auto;
  box-shadow: 0 -8px 24px rgba(61,32,8,.12);
}

.cad-btn-salvar {
  flex: 1; height: 52px; background: var(--green); color: #fff;
  border-radius: var(--r-md); font-weight: 800; font-size: 1.05rem;
  display: flex; align-items: center; justify-content: center; gap: 8px; border: none;
}

.cad-input-nome  { min-width: 0; width: 100%; padding: 10px 8px !important; font-size: 14px !important; box-sizing: border-box; }
.cad-input-preco { min-width: 0; width: 100%; padding: 10px 6px !important; font-size: 14px !important; text-align: right; box-sizing: border-box; }
.ajustes-nav-wrap { display: flex; overflow-x: auto; gap: 2px; padding: 0 16px; scrollbar-width: none; }
.ajustes-nav-wrap::-webkit-scrollbar { display: none; }
.cad-taxas-row { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.cad-taxa-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; background: var(--cream); border: 1.5px solid var(--border);
  border-radius: var(--r-sm); min-height: 52px;
}
.cad-taxa-label { font-size: 14px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 6px; }
.cad-taxa-input-wrap { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.cad-taxa-input-wrap .input { width: 80px; margin-bottom: 0; }
.cad-taxa-unit { font-size: 14px; font-weight: 700; color: var(--brown); }
.ajustes-content { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px 16px 100px; display: flex; flex-direction: column; gap: 16px; }
.ajustes-content .sheet-card { flex-shrink: 0; }

/* ── Modais ───────────────────────────────────────────── */
.cad-modal-overlay, .cad-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000;
  display: flex; align-items: flex-end; justify-content: center;
}
.cad-modal-sheet {
  background: var(--surface); border-radius: 20px 20px 0 0;
  padding: 0 20px calc(20px + env(safe-area-inset-bottom));
  width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.cad-dialog { background: var(--surface); border-radius: 16px; padding: 20px; width: 100%; max-width: 480px; }
.cad-overlay .cad-dialog { margin: 20px; max-height: unset; align-self: center; }
.cad-modal-sheet--tall {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.cad-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  margin: 0 -20px 12px; padding: 12px 20px 10px;
  position: sticky; top: -1px; z-index: 10; background: var(--surface);
  border-radius: 20px 20px 0 0;
  border-bottom: 1px solid var(--border);
}
.cad-modal-titulo { font-size: 16px; font-weight: 800; }
.cad-btn-fechar { width: 32px; height: 32px; border: none; background: var(--border); border-radius: 50%; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--muted); }
.cad-form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.cad-form-label { font-size: 12px; font-weight: 700; color: var(--muted); }
.cad-form-input { padding: 12px 14px; border: 1.5px solid var(--border); border-radius: var(--r-sm); font-size: 16px; color: var(--text); background: var(--surface); outline: none; font-family: var(--font); }
.cad-form-input:focus { border-color: var(--brown-light); }
.cad-btn-primary { width: 100%; padding: 14px; border: none; border-radius: var(--r-md); background: var(--brown); color: #fff; font-family: var(--font); font-size: 15px; font-weight: 800; cursor: pointer; margin-top: 4px; }
.cad-btn-primary:disabled { opacity: .5; cursor: default; }
.cad-dialog-title { font-size: 16px; font-weight: 800; margin-bottom: 6px; }
.cad-dialog-sub   { font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
.cad-dialog-btns  { display: flex; gap: 10px; }
.cad-btn-cancel   { flex: 1; padding: 12px; border: 1.5px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--text); font-family: var(--font); font-size: 14px; font-weight: 700; cursor: pointer; }
.cad-btn-confirm  { flex: 1; padding: 12px; border: none; border-radius: var(--r-md); background: var(--brown); color: #fff; font-family: var(--font); font-size: 14px; font-weight: 700; cursor: pointer; }
.cad-btn-confirm.danger { background: var(--red, #dc2626); }
.cad-btn-confirm:disabled { opacity: .4; cursor: default; }

@media (max-width: 380px) {
  .cad-cli-btns { padding-left: 12px; }
  .cad-btn-venda, .cad-btn-quitar, .cad-btn-zap { flex: 1 1 0; justify-content: center; }
}

/* chip.ativo */
:deep(.chip.ativo), .chip.ativo {
  background: var(--brown); color: #fff; border-color: var(--brown);
  box-shadow: 0 2px 8px rgba(61,31,7,.2);
}

/* SwipeItem layout */
:deep(.swipe-wrap) { position: relative; overflow: hidden; border-radius: var(--r-md); box-shadow: var(--shadow); flex-shrink: 0; margin-bottom: 8px; }
:deep(.swipe-wrap:last-child) { margin-bottom: 0; }
:deep(.swipe-front) {
  position: relative; z-index: 2; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); display: flex; align-items: center; gap: 12px;
  padding: 13px 14px; cursor: pointer; transition: transform .22s cubic-bezier(.4,0,.2,1);
  will-change: transform; min-height: 64px;
}
:deep(.swipe-front.open) { transform: translateX(-140px); border-color: var(--border2); }
:deep(.swipe-front:active:not(.open)) { background: var(--cream); border-color: var(--brown-light); }
:deep(.swipe-actions) { position: absolute; right: 0; top: 0; bottom: 0; width: 140px; display: flex; z-index: 1; }
:deep(.swipe-action-btn) {
  flex: 1; border: none; color: #fff; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
  font-family: var(--font); font-size: 10px; font-weight: 800; cursor: pointer; transition: opacity .15s;
}
:deep(.swipe-action-btn:active) { opacity: .85; }
:deep(.swipe-action-btn.receive) { background: var(--green); }
:deep(.swipe-action-btn.edit) { background: var(--brown-light); }
:deep(.swipe-action-btn.del)  { background: var(--red, #dc2626); }
:deep(.swipe-hint) { margin-left: auto; color: var(--muted); flex-shrink: 0; }

.cad-list-icon {
  width: 42px; height: 42px; border-radius: 50%; background: var(--gold-bg); color: var(--gold);
  display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
}
.cad-list-icon.pessoa { background: var(--cream-deep); color: var(--brown-mid); }

/* ── Calculadora UI ── */
.calc-input-wrap {
  background: var(--surface); border: 2.5px solid var(--border2);
  border-radius: var(--r-lg); padding: 10px 18px 6px;
  box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 12px;
}
.calc-input-label { font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; text-align: center; }
.calc-input-field {
  width: 100%; border: none; background: transparent;
  font-family: var(--mono) !important; font-size: 24px !important; font-weight: 800;
  color: var(--brown); outline: none; min-height: 52px; text-align: center;
  line-height: 1;
}
.calc-divider { height: 1px; background: var(--border); margin: 0 -18px 4px; }
.calc-hint { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px; font-weight: 600; }
.calc-hint i { color: var(--gold); }

.calc-results { display: flex; flex-direction: column; gap: 12px; }
.calc-result-card {
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); padding: 16px 18px;
  box-shadow: var(--shadow); display: flex; align-items: center; gap: 14px;
}
.calc-result-card.debito  { border-left: 4px solid var(--blue); }
.calc-result-card.credito { border-left: 4px solid var(--green); }
.calc-result-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.calc-result-card.debito  .calc-result-icon { background: var(--blue-bg); }
.calc-result-card.credito .calc-result-icon { background: var(--green-bg); }
.calc-result-info  { flex: 1; min-width: 0; }
.calc-result-tipo  { font-size: 12px; font-weight: 800; color: var(--brown); }
.calc-result-taxa  { font-size: 10px; color: var(--muted); font-weight: 600; margin-top: 1px; }
.calc-result-val   { font-family: var(--mono); font-size: 20px; font-weight: 800; margin-top: 4px; white-space: nowrap; }
.calc-result-val.debito  { color: var(--blue); }
.calc-result-val.credito { color: var(--green); }
.calc-info-box {
  background: var(--gold-bg); border: 1px solid rgba(200,137,10,.25);
  border-radius: var(--r-md); padding: 14px 16px;
  display: flex; gap: 10px; align-items: flex-start;
}
.calc-info-box p { font-size: 12px; color: var(--brown-mid); line-height: 1.5; }

.calc-clear-btn {
  align-self: center; padding: 10px 24px;
  border-radius: var(--r-full); border: 1.5px solid var(--border2);
  background: var(--surface); color: var(--muted);
  font-family: var(--font); font-size: 13px; font-weight: 700; cursor: pointer;
  transition: all .15s;
}
.calc-clear-btn:active { background: var(--cream-deep); transform: scale(0.96); }


/* ── Modal de edição completa ── */
.cad-modal-sheet--tall { max-height: 92vh; }
.cad-edit-cliente-tag {
  display: flex; align-items: center; gap: 10px;
  background: var(--cream); border-radius: var(--r-sm);
  padding: 10px 12px; margin-bottom: 16px;
}
.cad-edit-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--brown); color: #fff;
  font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cad-edit-nome { font-size: 14px; font-weight: 800; }
.cad-edit-loja { font-size: 11px; color: var(--muted); }
.cad-edit-datetime { display: flex; gap: 8px; }
.cad-edit-total {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; background: var(--cream); border-radius: var(--r-sm);
  margin-bottom: 14px;
}
.cad-edit-total-label { font-size: 12px; font-weight: 700; color: var(--muted); }
.cad-edit-total-val   { font-size: 22px; font-weight: 800; color: var(--brown); font-family: var(--mono); }

/* ── compra-row como swipe ── */
.compra-atrasada :deep(.swipe-front) { background: #fff5f5; }

.cad-resumo-lista { flex: 1; overflow-y: auto; padding: 4px 14px 80px; display: flex; flex-direction: column; gap: 14px; }

/* ── Estilos de Cabeçalho (Padronização com perfil Yves) ── */
.tab-hdr { 
  padding: 14px 16px 12px; background: var(--surface); border-bottom: 1px solid var(--border); 
  box-shadow: 0 2px 8px rgba(61,31,7,.06);
  position: sticky; top: 0; z-index: 50;
}
.tab-hdr-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }

.tab-title {
  font-size: .98rem; font-weight: 900;
  color: var(--brown-dark); display: flex; align-items: center; gap: 7px;
  margin: 0; line-height: 1.2;
}
.tab-title i { color: var(--brown-mid); font-size: 0.9rem; }
.tab-subtitle { font-size: .72rem; color: var(--muted); margin: 0; font-weight: 600; }

.cad-input-with-btn { display: flex; gap: 8px; align-items: stretch; }
.cad-btn-agenda {
  width: 48px; border: 1.5px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface); color: var(--brown); font-size: 1.1rem;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.cad-btn-agenda:active { background: var(--cream); transform: scale(0.95); }
</style>