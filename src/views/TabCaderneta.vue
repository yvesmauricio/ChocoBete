<template>
  <div class="tab-caderneta">

    <!-- ══ TELA: DASHBOARD ══════════════════════════════════ -->
    <div v-if="tela === 'dashboard'" class="cad-tela">

      <!-- Lombada perfurada — assinatura visual do "caderninho" -->
      <div class="cad-spiral">
        <span v-for="n in 12" :key="n"></span>
      </div>

      <div class="cad-hdr">
        <div class="cad-hdr-row">
          <div>
            <h2 class="cad-hdr-hello">{{ saudacao }} <i class="fas" :class="saudacaoIcone"></i></h2>
            <p class="cad-hdr-date">{{ dataBR }}</p>
          </div>
          <div class="cad-hdr-icons">
            <!-- Sync com o Google Drive — mesmo botão do outro perfil: nuvem verde = salvo,
                 amarela = salvando/pendente, vermelha = falhou (toque para tentar de novo) -->
            <button
              v-if="s.googleDriveConfigured && syncEstado !== 'idle'"
              class="cad-hdr-icon-btn cad-hdr-sync"
              :class="`cad-hdr-sync--${syncEstado}`"
              :disabled="!syncClicavel"
              :title="syncTitulo"
              @click="onClickSync"
            >
              <i class="fas" :class="syncIcone"></i>
            </button>
            <button class="cad-hdr-icon-btn" @click="modalContato = true" title="Meu contato">
              <i class="fas fa-address-card"></i>
            </button>
            <button class="cad-hdr-icon-btn" @click="emit('trocar-perfil')" title="Trocar perfil">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Aviso de backup: Drive desconectado ou cópia antiga -->
      <div v-if="s.alertaBackup" class="cad-alerta-backup">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ s.alertaBackup.msg }}</span>
        <button :disabled="fazendoBackup" @click="fazerBackupAgora">
          {{ fazendoBackup ? 'Salvando…' : (s.googleDriveConfigured ? 'Salvar agora' : 'Baixar backup') }}
        </button>
      </div>

      <div class="cad-body cad-body--comnav">

        <!-- ══ Cobrar Pix — card direto no painel. O valor é o protagonista
             (grande, centralizado); o QR e o copia-e-cola vêm logo abaixo. -->
        <div class="cad-pix-card">
          <div v-if="!chavePixVendedor" class="cad-cobr-vazio cad-cobr-vazio--card">
            <i class="fas fa-circle-info"></i>
            <p>Cadastre seu WhatsApp em <strong>Ajustes → Dados da loja</strong> (perfil Admin) pra habilitar o QR de cobrança Pix.</p>
          </div>

          <template v-else>
            <div class="cad-pix-card-topo">
              <div class="cad-pix-card-titulo"><i class="fas fa-qrcode"></i> Cobrar com Pix</div>
              <label class="cad-pix-valor-hero" :class="{ 'cad-pix-valor-hero--vazio': !valorCobrancaTexto }">
                <span class="cad-pix-valor-hero-prefixo">R$</span>
                <input
                  class="cad-pix-valor-hero-input"
                  type="text"
                  :value="valorCobrancaTexto"
                  :style="{ width: Math.max(valorCobrancaTexto.length, 4) + 'ch' }"
                  @input="onInputValorCobranca"
                  @keydown="bloquearLetrasValor"
                  inputmode="numeric"
                  placeholder="0,00"
                >
              </label>
              <button v-if="valorCobrancaTexto" class="cad-pix-valor-hero-limpar" @click="valorCobrancaTexto = ''">
                <i class="fas fa-xmark"></i> Limpar
              </button>
              <p v-else class="cad-pix-valor-hero-dica">Toque no valor e digite</p>
            </div>

            <div class="cad-pix-card-corpo">
              <div class="cad-pix-qr-wrap">
                <div v-if="qrPixSvg" class="cad-pix-qr" v-html="qrPixSvg"></div>
                <div v-else class="cad-pix-qr-erro"><i class="fas fa-triangle-exclamation"></i> Não deu pra gerar o QR</div>
              </div>

              <p class="cad-pix-hint">
                {{ valorCobrancaNum > 0
                  ? `Cliente paga exatamente R$ ${fmt(valorCobrancaNum)} ao escanear`
                  : 'Sem valor definido — o cliente digita o valor no banco dele' }}
              </p>

              <button class="cad-pix-copiar" :class="{ copiado: pixCopiado }" @click="copiarCodigoPixCobranca">
                <i class="fas" :class="pixCopiado ? 'fa-check' : 'fa-copy'"></i>
                {{ pixCopiado ? 'Código copiado!' : 'Copiar código Pix' }}
              </button>
            </div>
          </template>
        </div>

        <!-- Alerta do dia -->
        <div v-if="alertasDia.length">
          <div class="cad-sec-title"><i class="fas fa-bell"></i> Cobranças de hoje</div>
          <div class="cad-alerta-dia">
            <div v-for="a in alertasDiaVisiveis" :key="a.clienteId" class="cad-alerta-item" @click="irParaResumo()">
              <div class="cad-alerta-avatar">{{ iniciais(a.clienteNome) }}</div>
              <div class="cad-alerta-info">
                <div class="cad-alerta-nome">{{ a.clienteNome }}<span v-if="a.clienteFuncao" class="cad-funcao-tag">{{ a.clienteFuncao }}</span></div>
                <div class="cad-alerta-loja">{{ a.lojaNome }}<template v-if="lojaLocal(a.lojaId)"> · {{ lojaLocal(a.lojaId) }}</template><template v-if="a.compras > 1"> · {{ a.compras }} compras</template></div>
              </div>
              <div class="cad-alerta-val">R$ {{ fmt(a.saldo) }}</div>
            </div>
            <div v-if="alertasDia.length > alertasDiaVisiveis.length" class="cad-alerta-mais" @click="irParaResumo()">
              + {{ alertasDia.length - alertasDiaVisiveis.length }} mais cobranças <i class="fas fa-chevron-right"></i>
            </div>
          </div>
        </div>

      </div>

      <!-- Barra inferior — os botões que antes disputavam espaço na tela
           (Fiado, Cobranças, Cardápio, Pedidos, Calculadora) agora ficam
           sempre à mão aqui, deixando a tela livre pro QR de cobrança -->
      <div class="cad-bottom-nav">
        <button class="cad-bn-btn" @click="irParaNovaVenda">
          <i class="fas fa-plus"></i><span>Fiado</span>
        </button>
        <button class="cad-bn-btn" @click="irParaResumo()">
          <i class="fas fa-book-bookmark"></i><span>Cobranças</span>
        </button>
        <button class="cad-bn-btn" @click="irPara('cardapio')">
          <i class="fas fa-utensils"></i><span>Cardápio</span>
        </button>
        <button class="cad-bn-btn" @click="irPara('cardapio', { abrirPedidos: true })">
          <i class="fas fa-clipboard-list"></i><span>Pedidos</span>
          <span v-if="pedidosBalcaoPendentes" class="cad-shortcut-badge" :class="{ 'cad-shortcut-badge--info': !pedidosBalcaoUrgentes }">{{ pedidosBalcaoPendentes }}</span>
        </button>
        <button class="cad-bn-btn" @click="abrirCalculadora">
          <i class="fas fa-calculator"></i><span>Calc</span>
        </button>
      </div>
    </div>

    <!-- ══ TELA: CARDÁPIO DIGITAL ═══════════════════════════ -->
    <!-- Sem o wrapper .cad-tela (que tem overflow:hidden + height:100%): o
         Cardápio Digital foi feito pra rolar junto com o scroll ambiente da
         página (mesmo esquema do perfil do Yves), não com scroll interno
         próprio como as outras telas da Bete. -->
    <TabCardapio v-else-if="tela === 'cardapio'" standalone :forcar-edicao="cardapioForcarEdicao" :abrir-pedidos="cardapioAbrirPedidos" @fechar="irPara('dashboard')" />

    <!-- ══ TELA: LOJAS ══════════════════════════════════════ -->
    <div v-else-if="tela === 'lojas'" class="cad-tela">
      <div class="cad-spiral">
        <span v-for="n in 12" :key="n"></span>
      </div>
      <div class="cad-hdr">
        <div class="cad-hdr-row">
          <div class="cad-hdr-titulo-group">
            <button class="cad-hdr-icon-btn" @click="irPara('dashboard')" title="Voltar">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div>
              <h2 class="cad-hdr-titulo"><i class="fas fa-store"></i> Lojas</h2>
              <p class="cad-hdr-date">Escolha onde a venda foi realizada</p>
            </div>
          </div>
          <div class="cad-hdr-icons">
            <button class="cad-hdr-icon-btn" @click="irPara('dashboard')" title="Início"><i class="fas fa-house"></i></button>
            <button class="cad-hdr-icon-btn" @click="abrirModalLoja()" title="Adicionar loja"><i class="fas fa-plus"></i></button>
          </div>
        </div>
      </div>
      <div class="cad-search-bar">
        <div class="cad-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="cad-search-input" placeholder="Buscar loja..." v-model="buscaLojas">
        </div>
      </div>
      <div class="cad-scroll-list">
        <div v-if="!lojasFiltradas.length" class="cad-empty">
          <div class="cad-empty-ico"><i class="fas fa-store"></i></div>
          <p>{{ buscaLojas ? 'Nenhuma loja encontrada' : 'Nenhuma loja cadastrada.\nToque em + para adicionar.' }}</p>
        </div>
        <CadernetaSwipeItem
          v-for="l in lojasFiltradas" :key="l.id" :id="l.id" scope="lojas"
          @click="escolherLoja(l)"
          @edit="abrirModalLoja(l)"
          @delete="confirmarExcluirLoja(l)"
          delete-label="Remover"
        >
          <div class="cad-list-icon"><i class="fas fa-store"></i></div>
          <div class="cad-list-info">
            <div class="cad-list-nome">{{ l.nome }}</div>
            <div v-if="localBairro(l)" class="cad-list-sub">{{ localBairro(l) }}</div>
          </div>
        </CadernetaSwipeItem>

        <div v-if="mostrarArquivadas" class="cad-arq-lista">
          <div v-for="l in lojasArquivadas" :key="'arq' + l.id" class="cad-arq-item">
            <div class="cad-list-info">
              <div class="cad-list-nome">{{ l.nome }}</div>
              <div class="cad-list-sub">Arquivada</div>
            </div>
            <button class="cad-arq-btn" @click="reativarLoja(l)"><i class="fas fa-rotate-left"></i> Reativar</button>
          </div>
        </div>
        <div class="cad-arq-rodape">
          <button v-if="lojasArquivadas.length" class="cad-arq-link" @click="mostrarArquivadas = !mostrarArquivadas">
            <i class="fas fa-box-archive"></i> {{ mostrarArquivadas ? 'Ocultar' : 'Ver' }} arquivadas ({{ lojasArquivadas.length }})
          </button>
          <button class="cad-arq-link" @click="abrirRepetidos">
            <i class="fas fa-clone"></i> Verificar cadastros repetidos
          </button>
        </div>
      </div>
    </div>

    <!-- ══ TELA: CLIENTES ══════════════════════════════════ -->
    <div v-else-if="tela === 'clientes'" class="cad-tela">
      <div class="cad-spiral">
        <span v-for="n in 12" :key="n"></span>
      </div>
      <div class="cad-hdr">
        <div class="cad-hdr-row">
          <div class="cad-hdr-titulo-group">
            <button class="cad-hdr-icon-btn" @click="irPara('lojas')" title="Voltar">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div>
              <h2 class="cad-hdr-titulo"><i class="fas fa-user-friends"></i> {{ lojaAtual?.nome }}</h2>
              <p class="cad-hdr-date">{{ localBairro(lojaAtual) || 'Lista de clientes da Loja selecionada' }}</p>
            </div>
          </div>
          <div class="cad-hdr-icons">
            <button class="cad-hdr-icon-btn" @click="irPara('dashboard')" title="Início"><i class="fas fa-house"></i></button>
            <button class="cad-hdr-icon-btn" @click="abrirModalCliente()" title="Adicionar cliente"><i class="fas fa-plus"></i></button>
          </div>
        </div>
      </div>
      <div class="cad-search-bar">
        <div class="cad-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="cad-search-input" placeholder="Buscar cliente..." v-model="buscaClientes">
        </div>
      </div>
      <div class="cad-scroll-list">
        <div v-if="!clientesFiltrados.length" class="cad-empty">
          <div class="cad-empty-ico"><i class="fas fa-user"></i></div>
          <p>{{ buscaClientes ? 'Nenhum cliente encontrado' : 'Nenhuma cliente nesta loja.\nToque em + para adicionar.' }}</p>
        </div>
        <CadernetaSwipeItem
          v-for="c in clientesFiltrados" :key="c.id" :id="c.id" scope="clientes"
          :saldo="saldoPorCliente[c.id] || 0"
          @click="escolherCliente(c)"
          @edit="abrirModalCliente(c)"
          @delete="confirmarExcluirCliente(c)"
          delete-label="Remover"
        >
          <div class="cad-list-icon pessoa"><i class="fas fa-user"></i></div>
          <div class="cad-list-info">
            <div class="cad-list-nome">{{ c.nome }}<span v-if="c.funcao" class="cad-funcao-tag">{{ c.funcao }}</span></div>
            <div class="cad-list-sub">{{ c.telefone || 'Sem telefone' }}</div>
          </div>
        </CadernetaSwipeItem>

        <div v-if="mostrarArquivadas" class="cad-arq-lista">
          <div v-for="c in clientesArquivados" :key="'arq' + c.id" class="cad-arq-item">
            <div class="cad-list-info">
              <div class="cad-list-nome">{{ c.nome }}<span v-if="c.funcao" class="cad-funcao-tag">{{ c.funcao }}</span></div>
              <div class="cad-list-sub">Arquivada · {{ c.telefone || 'Sem telefone' }}</div>
            </div>
            <button class="cad-arq-btn" @click="reativarCliente(c)"><i class="fas fa-rotate-left"></i> Reativar</button>
          </div>
        </div>
        <div v-if="clientesArquivados.length" class="cad-arq-rodape">
          <button class="cad-arq-link" @click="mostrarArquivadas = !mostrarArquivadas">
            <i class="fas fa-box-archive"></i> {{ mostrarArquivadas ? 'Ocultar' : 'Ver' }} arquivadas ({{ clientesArquivados.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- ══ TELA: NOVA VENDA ════════════════════════════════════
         Tudo numa tela só: data da compra, categorias (Trufa, Cone, Barra,
         Bolo, Torta, Brownie), data combinada de pagamento e total ao vivo. -->
    <div v-else-if="tela === 'lancar'" class="cad-tela">
      <div class="cad-spiral">
        <span v-for="n in 12" :key="n"></span>
      </div>

      <div class="cad-hdr">
        <div class="cad-hdr-row">
          <div class="cad-hdr-titulo-group">
            <button class="cad-hdr-icon-btn" @click="voltarDeLancar" title="Voltar">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div>
              <h2 class="cad-hdr-titulo"><i class="fas fa-cart-plus"></i> Nova Venda</h2>
              <p class="cad-hdr-date">{{ clienteAtual?.nome }}<template v-if="clienteAtual?.funcao"> ({{ clienteAtual.funcao }})</template> · {{ lojaAtual?.nome || '—' }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="cad-lancar-body cad-nv-body">

        <!-- Já lançado: só aparece se o cliente tem compras em aberto -->
        <button v-if="ultimasAbertas.length" type="button" class="cad-nv-jalancado" @click="modalJaLancadas = true">
          <i class="fas fa-clock-rotate-left"></i>
          <span class="cad-nv-jalancado-txt">
            <b>Já lançado:</b>
            {{ comprasAbertasCliente.length }} em aberto · última {{ fmtBR(ultimasAbertas[0].dataVenda) }} · R$ {{ fmt(ultimasAbertas[0].total) }}
          </span>
          <i class="fas fa-chevron-right"></i>
        </button>

        <!-- 1 · Data da compra -->
        <div class="cad-nv-bloco">
          <div class="cad-nv-label"><span class="cad-nv-num">1</span> Data da compra</div>
          <label class="cad-nv-data">
            <i class="fas fa-calendar-day"></i>
            <span class="cad-nv-data-txt">
              {{ fmtBR(dataVenda) }}
              <small>{{ rotuloDia(dataVenda) }}</small>
            </span>
            <i class="fas fa-chevron-down cad-nv-data-seta"></i>
            <input type="date" class="cad-nv-data-input" v-model="dataVenda">
          </label>
        </div>

        <!-- 2 · O que levou -->
        <div class="cad-nv-bloco">
          <div class="cad-nv-label">
            <span class="cad-nv-num">2</span> O que levou?
            <button type="button" class="cad-nv-precos-btn" @click="abrirModalPrecos()">
              <i class="fas fa-tag"></i> Preços
            </button>
          </div>

          <div class="cad-nv-cats">
            <div
              v-for="c in categoriasVenda" :key="c.id"
              class="cad-nv-cat" :class="{ ativo: qtds[c.id] > 0 }"
            >
              <div class="cad-nv-cat-emoji">{{ c.emoji }}</div>
              <div class="cad-nv-cat-info">
                <div class="cad-nv-cat-nome">{{ c.nome }}</div>
                <template v-if="c.preco > 0">
                  <div class="cad-nv-cat-preco">
                    <template v-if="qtds[c.id] > 0">{{ qtds[c.id] }} × R$ {{ fmt(c.preco) }}</template>
                    <template v-else>R$ {{ fmt(c.preco) }} cada</template>
                  </div>
                  <div v-if="qtds[c.id] > 0" class="cad-nv-cat-subtotal">= R$ {{ fmt(qtds[c.id] * c.preco) }}</div>
                </template>
                <button v-else type="button" class="cad-nv-cat-defpreco" @click="abrirModalPrecos(c.id)">
                  <i class="fas fa-circle-exclamation"></i> Definir preço
                </button>
              </div>
              <div class="cad-stepper cad-stepper--linha">
                <button class="cad-stepper-btn" :disabled="!qtds[c.id]" @click="dec(c)" :aria-label="`Remover ${c.nome}`">−</button>
                <div class="cad-stepper-qty">{{ qtds[c.id] || 0 }}</div>
                <button class="cad-stepper-btn" @click="inc(c)" :aria-label="`Adicionar ${c.nome}`">+</button>
              </div>
            </div>
          </div>

          <DescontoCampo v-model:valor="descontoRaw" v-model:motivo="descontoMotivo" />
        </div>

        <!-- 3 · Data combinada -->
        <div class="cad-nv-bloco">
          <div class="cad-nv-label"><span class="cad-nv-num">3</span> Data combinada para pagamento</div>
          <div class="cad-chip-row" style="justify-content:flex-start">
            <button
              v-for="c in chipsVenc" :key="c.id"
              class="chip" :class="{ ativo: chipAtivo === c.id }"
              @click="setChip(c.id)"
            >{{ c.label }}</button>
          </div>
          <label class="cad-nv-data" :class="{ 'cad-nv-data--ok': dataVenc }">
            <i class="fas fa-calendar-check"></i>
            <span class="cad-nv-data-txt">
              <template v-if="dataVenc">{{ fmtBR(dataVenc) }} <small>{{ rotuloDia(dataVenc) }}</small></template>
              <template v-else>Escolher outra data…</template>
            </span>
            <i class="fas fa-chevron-down cad-nv-data-seta"></i>
            <input type="date" class="cad-nv-data-input" v-model="dataVenc" @change="chipAtivo = null">
          </label>
        </div>

      </div>

      <div class="cad-footer-lancar">
        <div class="cad-footer-total">
          <div class="cad-footer-label">Total<template v-if="descontoLancar > 0"> · desconto − R$ {{ fmt(descontoLancar) }}</template></div>
          <div class="cad-footer-val">R$ {{ fmt(totalLancar) }}</div>
        </div>
        <button class="cad-btn-salvar" :disabled="brutoLancar === 0 || !dataVenc || salvandoFiado" @click="salvarFiado()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Confirmar
        </button>
      </div>

      <!-- Já lançado: últimas 5 compras em aberto (somente leitura) -->
      <div v-if="modalJaLancadas" class="cad-modal-overlay" @click.self="modalJaLancadas = false">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header">
            <div class="cad-modal-titulo"><i class="fas fa-clock-rotate-left"></i> Já lançado · {{ clienteAtual?.nome }}</div>
            <button class="cad-btn-fechar" @click="modalJaLancadas = false"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="cad-jl-lista">
            <div v-for="f in ultimasAbertas" :key="f.id" class="cad-jl-item">
              <div class="cad-jl-info">
                <div class="cad-jl-data">{{ fmtDataHora(f) }}</div>
                <div class="cad-jl-desc">{{ descFiado(f) || qtdItens(f) }}</div>
              </div>
              <div class="cad-jl-valor">
                R$ {{ fmt(f.saldo) }}
                <small v-if="f.saldo < f.total - 0.01">de R$ {{ fmt(f.total) }}</small>
              </div>
            </div>
          </div>
          <p v-if="comprasAbertasCliente.length > ultimasAbertas.length" class="cad-jl-mais">
            + {{ comprasAbertasCliente.length - ultimasAbertas.length }} mais antiga(s) na lista do cliente
          </p>
          <button class="cad-btn-primary" @click="modalJaLancadas = false">Fechar</button>
        </div>
      </div>

      <!-- Aviso de venda parecida (não bloqueia: o cliente pode mesmo ter comprado igual) -->
      <div v-if="avisoDuplicado" class="cad-overlay" @click.self="avisoDuplicado = null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">Venda igual já lançada</div>
          <div class="cad-dialog-sub">
            {{ clienteAtual?.nome }} já tem uma venda de <b>R$ {{ fmt(avisoDuplicado.total) }}</b>
            lançada em {{ fmtDataHora(avisoDuplicado) }}<template v-if="descFiado(avisoDuplicado)"> ({{ descFiado(avisoDuplicado) }})</template>.
            Se é uma compra nova, pode lançar.
          </div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="avisoDuplicado = null">Voltar</button>
            <button class="cad-btn-confirm" @click="salvarFiado(true)">Lançar mesmo assim</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ TELA: RESUMO DA VENDA (aparece ao confirmar) ═══════ -->
    <div v-else-if="tela === 'fiado-salvo' && fiadoSalvo" class="cad-tela">
      <div class="cad-spiral">
        <span v-for="n in 12" :key="n"></span>
      </div>

      <div class="cad-nv-ok-topo">
        <div class="cad-nv-ok-check"><i class="fas fa-check"></i></div>
        <h2 class="cad-nv-ok-titulo">Anotado na caderneta</h2>
        <p class="cad-nv-ok-sub">{{ fiadoSalvo.clienteNome }}<template v-if="clienteAtual?.funcao"> ({{ clienteAtual.funcao }})</template> · {{ fiadoSalvo.lojaNome }}<template v-if="lojaLocal(fiadoSalvo.lojaId)"> ({{ lojaLocal(fiadoSalvo.lojaId) }})</template></p>
      </div>

      <div class="cad-lancar-body cad-nv-body">
        <div class="cad-nv-recibo">
          <div v-for="i in fiadoSalvo.itens" :key="i.id" class="cad-nv-recibo-linha">
            <div class="cad-nv-recibo-emoji">{{ i.emoji }}</div>
            <div class="cad-nv-recibo-desc">
              <div class="cad-nv-recibo-nome">{{ i.qty }}× {{ i.nome }}</div>
              <div class="cad-nv-recibo-unit">R$ {{ fmt(i.preco) }} cada</div>
            </div>
            <div class="cad-nv-recibo-val">R$ {{ fmt(i.subtotal) }}</div>
          </div>

          <div v-if="descontoDe(fiadoSalvo) > 0" class="cad-nv-recibo-linha">
            <div class="cad-nv-recibo-emoji">🏷️</div>
            <div class="cad-nv-recibo-desc">
              <div class="cad-nv-recibo-nome">Desconto</div>
              <div v-if="fiadoSalvo.descontoMotivo" class="cad-nv-recibo-unit">{{ fiadoSalvo.descontoMotivo }}</div>
            </div>
            <div class="cad-nv-recibo-val">− R$ {{ fmt(descontoDe(fiadoSalvo)) }}</div>
          </div>

          <div class="cad-nv-recibo-total">
            <span>Total</span>
            <strong>R$ {{ fmt(fiadoSalvo.total) }}</strong>
          </div>
        </div>

        <div class="cad-nv-datas">
          <div class="cad-nv-datas-item">
            <i class="fas fa-calendar-day"></i>
            <div>
              <small>Data da compra</small>
              <b>{{ fmtBR(fiadoSalvo.dataVenda) }}</b>
            </div>
          </div>
          <div class="cad-nv-datas-item cad-nv-datas-item--cobr">
            <i class="fas fa-calendar-check"></i>
            <div>
              <small>Data de cobrança</small>
              <b>{{ fmtBR(fiadoSalvo.dataVenc) }}</b>
            </div>
          </div>
        </div>

        <button type="button" class="cad-nv-desfazer" @click="desfazerFiadoSalvo">
          <i class="fas fa-rotate-left"></i> Foi engano? Desfazer
        </button>
      </div>

      <div class="cad-footer-lancar">
        <button class="cad-btn-salvar" @click="concluirFiadoSalvo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Voltar para a lista
        </button>
      </div>
    </div>

    <!-- ══ TELA: RESUMO ════════════════════════════════════ -->
    <div v-else-if="tela === 'resumo'" class="cad-tela">
      <div class="cad-spiral">
        <span v-for="n in 12" :key="n"></span>
      </div>
      <div class="cad-hdr">
        <div class="cad-hdr-row">
          <div class="cad-hdr-titulo-group">
            <button class="cad-hdr-icon-btn" @click="irPara('dashboard')" title="Voltar">
              <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="cad-hdr-titulo"><i class="fas" :class="modoResumo === 'historico' ? 'fa-clock-rotate-left' : 'fa-list-check'"></i> {{ modoResumo === 'historico' ? 'Histórico' : 'Cobranças' }}</h2>
          </div>
          <button type="button" class="cad-hdr-pill" @click="modoResumo = modoResumo === 'historico' ? 'abertos' : 'historico'">
            <i class="fas" :class="modoResumo === 'historico' ? 'fa-list-check' : 'fa-clock-rotate-left'"></i>
            {{ modoResumo === 'historico' ? 'A receber' : 'Histórico' }}
          </button>
        </div>

        <div v-if="modoResumo === 'abertos'" class="cad-resumo-seg-control">
          <button type="button" class="cad-resumo-seg-btn" :class="{ active: filtroSit === 'todos' }" @click="filtroSit = 'todos'">
            <span class="cad-resumo-seg-label">Todos</span>
            <span class="cad-resumo-seg-val">R$ {{ fmt(stats.totalAberto) }}</span>
          </button>
          <button type="button" class="cad-resumo-seg-btn" :class="{ active: filtroSit === 'vencidos' }" @click="filtroSit = 'vencidos'">
            <span class="cad-resumo-seg-label">Vencidos</span>
            <span class="cad-resumo-seg-val" :class="{ 'cad-resumo-seg-val--red': stats.totalVencido > 0.009 }">R$ {{ fmt(stats.totalVencido) }}</span>
          </button>
        </div>
        <div v-else class="cad-sit-chips">
          <button v-for="o in filtrosHist" :key="o.id" type="button" class="chip"
            :class="{ ativo: filtroHist === o.id }" @click="filtroHist = o.id">{{ o.label }}</button>
        </div>

        <div class="search-wrap">
          <i class="fas fa-search search-icon"></i>
          <input v-model="buscaResumo" class="search-input" type="search" placeholder="Buscar loja ou cliente" />
        </div>
      </div>

      <div class="cad-resumo-lista">

        <!-- Sem resultados -->
        <div v-if="!gruposResumo.length" class="cad-empty">
          <div class="cad-empty-ico"><i class="fas fa-inbox"></i></div>
          <p>{{ textoVazioResumo }}</p>
        </div>

        <div v-for="g in gruposResumo" :key="g.lojaId" class="cad-grupo-loja">
          <div v-if="mostrarAgrupamentoLoja" class="cad-loja-header" :class="{ colapsado: lojaColapsada(g) }" @click="!lojaUnica && alternarLoja(g)" :style="lojaUnica ? 'cursor: default' : null">
            <svg class="cad-loja-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span class="cad-loja-nome">
              {{ g.lojaNome }}
              <small v-if="lojaLocal(g.lojaId)" class="cad-loja-local">{{ lojaLocal(g.lojaId) }}</small>
            </span>
            <span class="cad-loja-dir">
              <span class="cad-loja-total">R$ {{ fmt(modoResumo === 'historico' ? g.totalCompras : g.total) }}</span>
              <span v-if="modoResumo !== 'historico' && filtroSit === 'todos' && g.vencidos" class="cad-chip cad-chip--red">{{ g.vencidos }} {{ g.vencidos > 1 ? 'vencidos' : 'vencido' }}</span>
            </span>
            <svg v-if="!lojaUnica" class="cad-loja-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>

          <div class="cad-grupo-clientes" :class="{ colapsado: mostrarAgrupamentoLoja && lojaColapsada(g), 'cad-grupo-clientes--indent': mostrarAgrupamentoLoja }">
            <div v-for="c in g.clientes" :key="c.clienteId" class="cad-cli-card" :class="{ atrasado: c.atrasado && modoResumo !== 'historico' }">

              <div class="cad-cli-header" :class="{ colapsado: clienteColapsado(g, c) }" @click="alternarCliente(g, c)">
                <div class="cad-cli-avatar" :class="{ atrasado: c.atrasado && modoResumo !== 'historico' }">{{ iniciais(c.clienteNome) }}</div>
                <div class="cad-cli-info">
                  <div class="cad-cli-nome">
                    {{ c.clienteNome }}
                    <span v-if="c.clienteFuncao" class="cad-funcao-tag">{{ c.clienteFuncao }}</span>
                  </div>
                  <div class="cad-cli-sub">
                    <template v-if="modoResumo === 'historico'">{{ rotuloCompras(c.kpi.n) }}<template v-if="c.kpi.ultima"> · última em {{ fmtBR(c.kpi.ultima).slice(0, 5) }}</template></template>
                    <span v-else class="cad-cli-status" :class="statusCliente(c).cls">{{ statusCliente(c).txt }}</span>
                  </div>
                </div>
                <template v-if="modoResumo === 'historico'">
                  <span v-if="c.kpi.saldo <= 0.01" class="cad-chip cad-chip--ok"><i class="fas fa-check"></i> Em dia</span>
                  <span v-else class="cad-chip cad-chip--warn"><i class="fas fa-clock"></i> R$ {{ fmt(c.kpi.saldo) }}<span class="cad-chip-extra">&nbsp;em aberto</span></span>
                </template>
                <div v-else class="cad-cli-valor" :class="{ 'cad-cli-valor--red': c.atrasado }">
                  <b>R$ {{ fmt(c.saldo) }}</b>
                </div>
                <button
                  v-if="modoResumo !== 'historico' && c.telefone"
                  type="button" class="cad-cli-zap" aria-label="Cobrar pelo WhatsApp" title="Cobrar pelo WhatsApp"
                  @click.stop="abrirWhatsapp(c)"
                ><i class="fab fa-whatsapp" aria-hidden="true"></i></button>
                <svg class="cad-cli-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </div>

              <div v-if="modoResumo === 'historico'" class="cad-cli-kpis" :class="{ colapsado: clienteColapsado(g, c) }">
                <div><small>Comprado</small><b :title="'R$ ' + fmt(c.kpi.comprado)">R$ {{ fmt(c.kpi.comprado) }}</b></div>
                <div><small>Pago</small><b :title="'R$ ' + fmt(c.kpi.pago)">R$ {{ fmt(c.kpi.pago) }}</b></div>
                <div><small>Estornos</small><b>{{ c.kpi.estornos }}</b></div>
              </div>

              <div v-if="modoResumo !== 'historico' || (c.telefone && c.saldo > 0.01)" class="cad-cli-btns" :class="{ colapsado: clienteColapsado(g, c) }" @click.stop>
                <button
                  v-if="c.telefone && modoResumo === 'historico' && c.saldo > 0.01"
                  class="cad-btn-zap"
                  @click="abrirWhatsapp(c)"
                  title="Enviar cobrança pelo WhatsApp"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  Cobrar
                </button>
                <button v-if="modoResumo !== 'historico' && c.saldo > 0.01" class="cad-btn-quitar" @click="abrirQuitarTudo(c)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Quitar
                </button>
                <button v-if="modoResumo !== 'historico'" class="cad-btn-venda cad-btn-icone" aria-label="Nova venda" title="Nova venda" @click="iniciarVendaResumo(g, c)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button
                  v-if="modoResumo !== 'historico' && c.telefone && c.saldo > 0.01"
                  class="cad-btn-pix cad-btn-icone"
                  aria-label="Enviar Pix copia e cola"
                  title="Enviar Pix copia e cola"
                  @click="abrirPixCopiaECola(c)"
                >
                  <i class="fas fa-qrcode"></i>
                </button>
              </div>

              <div class="cad-compras-lista" :class="{ colapsado: clienteColapsado(g, c) }">
                <template v-for="(f, i) in c.fiadosVisiveis" :key="f.id">
                  <div v-if="modoResumo === 'historico' && novoMes(c.fiadosVisiveis, i)" class="cad-mes">{{ rotuloMes(f.dataVenda) }}</div>
                  <CadernetaSwipeItem
                    :id="f.id" scope="compras"
                    class="cad-compra-swipe"
                    :class="{ 'compra-atrasada': f.atrasada }"
                    :actions="compraSwipeActions(f)"
                    @click="abrirDetalheFiado(f)"
                    @edit="abrirEditarFiado(f)"
                    @receive="abrirReceber(f)"
                    @receipt="enviarComprovanteFiado(f)"
                    @delete="confirmarExcluirFiado(f)"
                  >
                    <div v-if="modoResumo === 'historico'" class="cad-hist-row">
                      <span class="cad-hist-ico" :class="'cad-hist-ico--' + iconeHist(f).cls"><i class="fas" :class="iconeHist(f).ico"></i></span>
                      <div class="cad-hist-meio">
                        <span class="cad-compra-data">{{ fmtDataHora(f) }}</span>
                        <span class="cad-compra-itens">{{ qtdItens(f) }}</span>
                        <span v-if="f.estornos?.length" class="cad-hist-estorno">Pagamento estornado em {{ fmtBR(ultimoEstorno(f).data) }}</span>
                      </div>
                      <div class="cad-hist-dir">
                        <span class="cad-compra-valor">R$ {{ fmt(f.total) }}</span>
                        <span class="cad-chip" :class="'cad-chip--' + chipHist(f).cls">{{ chipHist(f).txt }}</span>
                      </div>
                    </div>
                    <template v-else>
                      <div class="cad-compra-esq">
                        <span class="cad-compra-data">{{ fmtDataHora(f) }}</span>
                        <span class="cad-compra-itens">{{ qtdItens(f) }}</span>
                        <div v-if="f.pagamentos?.length" class="cad-compra-pgto">
                          <div class="cad-compra-pgto-linha">
                            <span class="cad-compra-pgto-recebido"><i class="fas fa-check-circle"></i> R$ {{ fmt(totalPagoF(f)) }}</span>
                            <span class="cad-compra-pgto-falta">falta R$ {{ fmt(f.saldo) }}</span>
                          </div>
                          <div class="cad-compra-pgto-bar"><div class="cad-compra-pgto-bar-fill" :style="{ width: pctPago(f) + '%' }"></div></div>
                        </div>
                      </div>
                      <div class="cad-compra-dir">
                        <span class="cad-compra-valor" :class="{ 'cad-compra-valor--red': f.atrasada }">R$ {{ fmt(f.saldo) }}</span>
                        <div class="cad-compra-meta">
                          <span class="cad-chip" :class="f.atrasada ? 'cad-chip--red' : 'cad-chip--neutral'">
                            <template v-if="f.dataVenc"><i class="fas" :class="f.atrasada ? 'fa-calendar-xmark' : 'fa-calendar-days'"></i> {{ f.atrasada ? 'Venceu' : 'Vence' }} {{ fmtBR(f.dataVenc).slice(0, 5) }}</template>
                            <button v-else type="button" class="cad-chip-btn" @click.stop="abrirEditarVenc(f)"><i class="fas fa-calendar-plus"></i> Agendar</button>
                          </span>
                        </div>
                      </div>
                    </template>
                  </CadernetaSwipeItem>
                </template>
                <button v-if="modoResumo === 'historico' && c.fiados.length > c.fiadosVisiveis.length" type="button" class="cad-hist-mais" @click="verTodasCompras(g, c)">
                  Ver compras mais antigas ({{ c.fiados.length - c.fiadosVisiveis.length }})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ TELA: CALCULADORA ════════════════════════════════ -->
    <!-- ══ CALCULADORA DE TAXAS: agora é modal (ver seção de modais) ══ -->

    <!-- ═══ MODAIS ══════════════════════════════════════════ -->
    <Teleport to="body">
      <!-- Modal Meu contato -->
      <div v-if="modalContato" class="cad-modal-overlay" @click.self="modalContato=false">
        <div class="cad-modal-sheet cad-modal-sheet--tall">
          <div class="cad-modal-header"><div class="cad-modal-titulo"><i class="fas fa-address-card"></i> Meu contato</div><button class="cad-btn-fechar" @click="modalContato=false"><i class="fas fa-xmark"></i></button></div>
        <div class="cad-cobr-painel">
          <div class="cad-ct-card">
            <div class="cad-ct-nome">{{ s.company.nome || 'Minha loja' }}</div>

            <div v-if="numeroWhatsappEfetivo" class="cad-ct-fone">
              <i class="fab fa-whatsapp"></i> {{ telefoneBonito(numeroWhatsappEfetivo) }}
            </div>
            <div v-else class="cad-ct-vazio">Sem telefone cadastrado</div>
            <div v-if="instagramUser" class="cad-ct-insta">
              <i class="fab fa-instagram"></i> @{{ instagramUser }}
            </div>
            <div v-else class="cad-ct-vazio">Sem Instagram cadastrado</div>
            <p v-if="!numeroWhatsappEfetivo || !instagramUser" class="cad-ct-aviso" style="text-align:center;margin-top:8px">
              Pra cadastrar ou alterar, acesse <strong>Ajustes → Dados da loja</strong> no perfil Admin.
            </p>
          </div>

          <div class="cad-qr-chips">
            <button class="cad-qr-chip" :class="{ ativo: qrModo === 'contato' }" @click="qrModo = 'contato'"><i class="fas fa-address-card"></i> Contato</button>
            <button class="cad-qr-chip" :class="{ ativo: qrModo === 'instagram' }" @click="qrModo = 'instagram'"><i class="fab fa-instagram"></i> Instagram</button>
            <button class="cad-qr-chip" :class="{ ativo: qrModo === 'cardapio' }" @click="qrModo = 'cardapio'"><i class="fas fa-utensils"></i> Cardápio</button>
          </div>

          <div v-if="qrModo === 'cardapio'" class="cad-qr-chips cad-qr-chips--sub">
            <button class="cad-qr-chip" :class="{ ativo: cardapioQrId === 'diaadia' }" @click="cardapioQrId = 'diaadia'">Dia a dia</button>
            <button class="cad-qr-chip" :class="{ ativo: cardapioQrId === 'festa' }" @click="cardapioQrId = 'festa'">Festa</button>
          </div>

          <div class="cad-pix-qr-wrap">
            <div v-if="qrContatoAtualSvg" class="cad-pix-qr" v-html="qrContatoAtualSvg"></div>
            <div v-else class="cad-pix-qr-erro">
              <i class="fas fa-circle-info"></i>
              {{ qrModo === 'instagram' ? 'Cadastre seu Instagram (botão Editar)'
                : qrModo === 'cardapio' ? 'Link do cardápio não configurado'
                : 'Cadastre seu telefone ou Instagram (botão Editar)' }}
            </div>
          </div>
          <p class="cad-pix-hint">{{ dicaQrContato }}</p>

          <button class="cad-pix-copiar" @click="abrirEnvioCliente">
            <i class="fab fa-whatsapp"></i> Enviar para um cliente
          </button>
        </div>
        </div>
      </div>

      <!-- Modal Preços das categorias -->
      <div v-if="modalPrecos" class="cad-modal-overlay cad-modal-overlay--top" @click.self="modalPrecos=false">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header"><div class="cad-modal-titulo"><i class="fas fa-tag"></i> Preço de cada categoria</div><button class="cad-btn-fechar" @click="modalPrecos=false"><i class="fas fa-xmark"></i></button></div>
          <p class="cad-nv-precos-dica">O mesmo preço vale pra todos os sabores da categoria.</p>
          <div v-for="c in categoriasVenda" :key="c.id" class="cad-nv-preco-linha">
            <span class="cad-nv-preco-emoji">{{ c.emoji }}</span>
            <span class="cad-nv-preco-nome">{{ c.nome }}</span>
            <div class="cad-nv-preco-campo">
              <span>R$</span>
              <input
                :id="`preco-${c.id}`"
                type="text" inputmode="numeric" placeholder="0,00"
                :value="formPrecos[c.id]"
                @input="onInputPreco(c.id, $event)"
              >
            </div>
          </div>
          <button class="cad-btn-primary" @click="salvarPrecos_"><i class="fas fa-check"></i> Salvar preços</button>
        </div>
      </div>

      <!-- Modal Loja -->
      <div v-if="modalLoja" class="cad-modal-overlay cad-modal-overlay--top" @click.self="modalLoja=null">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header"><div class="cad-modal-titulo">{{ editandoLoja ? 'Editar Loja' : 'Nova Loja' }}</div><button class="cad-btn-fechar" @click="modalLoja=null"><i class="fas fa-xmark"></i></button></div>
          <div class="cad-form-group">
            <label class="cad-form-label">Nome da loja *</label>
            <input class="cad-form-input" :class="{ 'cad-form-input--erro': avisoLoja.dup }" v-model="formLoja.nome" placeholder="Ex: Escritório Santos" autofocus>
            <div v-if="avisoLoja.dup" class="cad-form-aviso cad-form-aviso--erro">
              <i class="fas fa-circle-exclamation"></i>
              <span>Já existe uma loja chamada <strong>{{ avisoLoja.dup.nome }}</strong><template v-if="avisoLoja.dup.arquivado"> (arquivada)</template>. Use outro nome<template v-if="avisoLoja.dup.arquivado"> ou reative a arquivada</template>.</span>
            </div>
            <div v-else-if="avisoLoja.afeta" class="cad-form-aviso">
              <i class="fas fa-shield-halved"></i>
              <span>
                O novo nome será atualizado em <strong>{{ avisoLoja.vendas }} venda(s)</strong><template v-if="avisoLoja.abertas"> — {{ avisoLoja.abertas }} em aberto (R$ {{ fmt(avisoLoja.saldo) }})</template> nas Cobranças.
                Nenhuma venda, valor, vencimento ou pagamento é apagado ou alterado.
              </span>
            </div>
          </div>
          <div class="cad-form-group">
            <label class="cad-form-label">Local (opcional)</label>
            <input class="cad-form-input" v-model="formLoja.referencia" placeholder="Ex: Shopping Leblon, Galeria 2000">
          </div>
          <div class="cad-form-group">
            <label class="cad-form-label">Bairro (opcional)</label>
            <input class="cad-form-input" v-model="formLoja.bairro" placeholder="Ex: Leblon">
          </div>
          <button class="cad-btn-primary" @click="salvarLoja_" :disabled="!formLoja.nome.trim() || !!avisoLoja.dup || salvandoCadastro">
            {{ editandoLoja ? 'Salvar Alterações' : 'Cadastrar Loja' }}
          </button>
        </div>
      </div>

      <!-- Modal: QR Code Pix da cobrança (botão "Pix") — mostrar ao cliente pra pagar na hora -->
      <div v-if="pixSegundaMsg" class="cad-modal-overlay cad-modal-overlay--top" @click.self="pixSegundaMsg = null">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header">
            <div class="cad-modal-titulo"><i class="fas fa-qrcode"></i> Pix para {{ pixSegundaMsg.nome }}</div>
            <button class="cad-btn-fechar" @click="pixSegundaMsg = null"><i class="fas fa-xmark"></i></button>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center">
            <div class="cad-pix-qr-wrap">
              <div v-if="pixSegundaQrSvg" class="cad-pix-qr" v-html="pixSegundaQrSvg"></div>
              <div v-else class="cad-pix-qr-erro"><i class="fas fa-triangle-exclamation"></i> Não deu pra gerar o QR</div>
            </div>
            <p class="cad-pix-hint">
              Cliente paga exatamente <strong>R$ {{ fmt(pixSegundaMsg.valor) }}</strong> ao apontar a câmera ou abrir o Pix no banco e escanear.
            </p>
          </div>
          <button class="cad-btn-primary" style="margin-top:14px" @click="enviarCodigoPixWhatsapp">
            <i class="fab fa-whatsapp"></i> Enviar Pix copia e cola
          </button>
          <button class="cad-ct-btn-sec" style="margin-top:8px;width:100%" @click="copiarCodigoPixSegundaMsg">
            <i class="fas fa-copy"></i> Só copiar o código
          </button>
        </div>
      </div>

      <!-- Modal: enviar meu contato / Instagram / cardápio a um cliente -->
      <div v-if="modalEnvio" class="cad-modal-overlay cad-modal-overlay--top" @click.self="modalEnvio = false">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header">
            <div class="cad-modal-titulo">Enviar para um cliente</div>
            <button class="cad-btn-fechar" @click="modalEnvio = false"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="cad-form-group">
            <label class="cad-form-label">Nome do cliente</label>
            <input class="cad-form-input" v-model="formEnvio.nome" placeholder="Nome (opcional)">
          </div>
          <div class="cad-form-group">
            <label class="cad-form-label">Telefone / WhatsApp</label>
            <div class="cad-input-with-btn">
              <input class="cad-form-input" style="flex:1" type="tel" inputmode="numeric" placeholder="(21) 9 9999-9999"
                     :value="formEnvio.telefone" @input="e => formEnvio.telefone = maskTelefone(e.target.value)">
              <button v-if="canImportContact" class="cad-btn-agenda" @click="escolherDaAgendaEnvio" title="Escolher da agenda">
                <i class="fas fa-address-book"></i>
              </button>
            </div>
          </div>
          <div class="cad-form-group">
            <label class="cad-form-label">O que enviar</label>
            <label class="cad-envio-check"><input type="checkbox" v-model="formEnvio.contato" :disabled="!numeroWhatsappEfetivo"> Meu telefone</label>
            <label class="cad-envio-check"><input type="checkbox" v-model="formEnvio.instagram" :disabled="!instagramUser"> Meu Instagram</label>
            <label class="cad-envio-check"><input type="checkbox" v-model="formEnvio.cardapio" :disabled="!urlCardapioEnvio"> Cardápio
              <span class="cad-envio-seg">
                <button type="button" :class="{ ativo: cardapioQrId === 'diaadia' }" @click.prevent="cardapioQrId = 'diaadia'">Dia a dia</button>
                <button type="button" :class="{ ativo: cardapioQrId === 'festa' }" @click.prevent="cardapioQrId = 'festa'">Festa</button>
              </span>
            </label>
          </div>
          <div class="cad-envio-previa">{{ mensagemEnvio }}</div>
          <button class="cad-btn-primary" :disabled="!mensagemEnvioValida" @click="enviarPorWhatsapp">
            <i class="fab fa-whatsapp"></i> Abrir WhatsApp
          </button>
          <button v-if="formEnvio.nome.trim() && formEnvio.telefone" class="cad-ct-btn-sec cad-envio-salvar" @click="salvarEnvioComoCliente">
            <i class="fas fa-user-plus"></i> Salvar em Clientes
          </button>
          <p class="cad-ct-aviso" style="text-align:center;margin-top:8px">O WhatsApp precisa de internet para enviar.</p>
        </div>
      </div>

      <!-- Modal Cliente -->
      <div v-if="modalCliente" class="cad-modal-overlay cad-modal-overlay--top" @click.self="modalCliente=null">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header"><div class="cad-modal-titulo">{{ editandoCliente ? 'Editar Cliente' : 'Nova Cliente' }}</div><button class="cad-btn-fechar" @click="modalCliente=null"><i class="fas fa-xmark"></i></button></div>
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
          <div class="cad-form-group">
            <label class="cad-form-label">Função <span class="cad-form-label-aux">(opcional — ajuda a diferenciar nomes iguais; não vai na mensagem)</span></label>
            <div class="cad-funcao-chips">
              <button v-for="fn in funcoesOpcoes" :key="fn" type="button" class="cad-funcao-chip"
                      :class="{ ativo: mesmaFuncao(fn, formCliente.funcao) }" @click="alternarFuncao(fn)">{{ fn }}</button>
              <button v-if="!novaFuncaoAberta" type="button" class="cad-funcao-chip cad-funcao-chip--nova" @click="abrirNovaFuncao">
                <i class="fas fa-plus"></i> Outra
              </button>
            </div>
            <div v-if="novaFuncaoAberta" class="cad-input-with-btn">
              <input ref="novaFuncaoInput" class="cad-form-input" v-model="novaFuncaoTexto" maxlength="30"
                     placeholder="Ex: Caixa, Recepcionista" style="flex: 1" @keyup.enter="confirmarNovaFuncao">
              <button type="button" class="cad-btn-agenda" @click="confirmarNovaFuncao" title="Usar esta função"><i class="fas fa-check"></i></button>
            </div>
          </div>
          <div v-if="editandoCliente && lojas.length > 1" class="cad-form-group">
            <label class="cad-form-label">Loja</label>
            <select class="cad-form-input" v-model="formCliente.lojaId">
              <option v-for="l in lojas" :key="l.id" :value="l.id">{{ l.nome }}</option>
            </select>
          </div>
          <button class="cad-btn-primary" @click="salvarCliente_" :disabled="!formCliente.nome.trim() || salvandoCadastro">
            {{ editandoCliente ? 'Salvar Alterações' : 'Cadastrar Cliente' }}
          </button>
        </div>
      </div>

      <!-- Modal Calculadora de Taxas — agora desliza de cima pra baixo (não
           mais bottom sheet): assim os campos ficam longe do teclado, que
           cobre a parte de baixo da tela no celular. -->
      <Transition name="calc-modal">
        <div v-if="calculadoraAberta" class="cad-modal-overlay calc-modal-overlay cad-modal-overlay--top" @click.self="fecharCalculadora">
          <div class="cad-modal-sheet calc-modal-sheet">
            <div class="cad-modal-header calc-modal-header">
              <div class="cad-modal-titulo"><i class="fas fa-calculator"></i> Calculadora de Taxas</div>
              <button class="cad-btn-fechar" @click="fecharCalculadora"><i class="fas fa-xmark"></i></button>
            </div>
            
            <div class="calc-input-wrap">
              <div class="calc-input-label">Valor líquido desejado</div>
              <div class="calc-input-linha">
                <span class="calc-input-prefixo">R$</span>
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
            </div>

            <Transition name="calc-fade" mode="out-in">
              <div class="calc-results" :key="rawCalcInput ? 'com-valor' : 'vazio'">
                <div class="calc-result-card debito">
                  <div class="calc-result-icon"><i class="fas fa-credit-card"></i></div>
                  <div class="calc-result-info">
                    <div class="calc-result-tipo">Débito na hora <span class="calc-result-taxa">· {{ taxaStr(taxasMaquineta.debito) }}</span></div>
                  </div>
                  <div class="calc-result-val debito">R$ {{ resultDebito }}</div>
                </div>

                <div class="calc-result-card credito">
                  <div class="calc-result-icon"><i class="fas fa-money-bill-wave"></i></div>
                  <div class="calc-result-info">
                    <div class="calc-result-tipo">Crédito à vista <span class="calc-result-taxa">· {{ taxaStr(taxasMaquineta.credito_avista) }}</span></div>
                  </div>
                  <div class="calc-result-val credito">R$ {{ resultCredito }}</div>
                </div>
              </div>
            </Transition>

            <button class="calc-clear-btn" @click="rawCalcInput = ''">
              <i class="fas fa-eraser"></i> Limpar valores
            </button>
          </div>
        </div>
      </Transition>

      <!-- Dialog remover loja: exclui se estiver vazia; senão arquiva (mantém histórico) -->
      <div v-if="paraExcluirLoja" class="cad-overlay" @click.self="paraExcluirLoja=null">
        <div class="cad-dialog">
          <template v-if="paraExcluirLoja._info.vendas === 0 && paraExcluirLoja._info.clientes === 0">
            <div class="cad-dialog-title">Excluir loja?</div>
            <div class="cad-dialog-sub">{{ paraExcluirLoja.nome }} não tem clientes nem vendas.</div>
          </template>
          <template v-else>
            <div class="cad-dialog-title">Arquivar loja?</div>
            <div class="cad-dialog-sub">
              {{ paraExcluirLoja.nome }} tem {{ paraExcluirLoja._info.clientes }} cliente(s) e {{ paraExcluirLoja._info.vendas }} venda(s).
              <template v-if="paraExcluirLoja._info.abertas"> Ainda há <strong>R$ {{ fmt(paraExcluirLoja._info.saldo) }}</strong> em aberto — a cobrança continua aparecendo.</template>
              Ela some da lista, mas o histórico fica guardado e você pode reativar depois.
            </div>
          </template>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="paraExcluirLoja=null">Cancelar</button>
            <button class="cad-btn-confirm" :class="{ danger: paraExcluirLoja._info.vendas === 0 && paraExcluirLoja._info.clientes === 0 }" @click="excluirLoja_">
              {{ paraExcluirLoja._info.vendas === 0 && paraExcluirLoja._info.clientes === 0 ? 'Excluir' : 'Arquivar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Dialog remover cliente: exclui se nunca teve venda; senão arquiva -->
      <div v-if="paraExcluirCliente" class="cad-overlay" @click.self="paraExcluirCliente=null">
        <div class="cad-dialog">
          <template v-if="paraExcluirCliente._info.vendas === 0">
            <div class="cad-dialog-title">Excluir cliente?</div>
            <div class="cad-dialog-sub">{{ paraExcluirCliente.nome }} não tem nenhuma venda registrada.</div>
          </template>
          <template v-else>
            <div class="cad-dialog-title">Arquivar cliente?</div>
            <div class="cad-dialog-sub">
              {{ paraExcluirCliente.nome }} tem {{ paraExcluirCliente._info.vendas }} venda(s) no histórico.
              <template v-if="paraExcluirCliente._info.abertas"> Ainda deve <strong>R$ {{ fmt(paraExcluirCliente._info.saldo) }}</strong> — a cobrança continua aparecendo.</template>
              Ela some da lista, mas o histórico fica guardado e você pode reativar depois.
            </div>
          </template>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" @click="paraExcluirCliente=null">Cancelar</button>
            <button class="cad-btn-confirm" :class="{ danger: paraExcluirCliente._info.vendas === 0 }" @click="excluirCliente_">
              {{ paraExcluirCliente._info.vendas === 0 ? 'Excluir' : 'Arquivar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Dialog genérico de decisão (cliente já existe, mover vendas em aberto, juntar...) -->
      <div v-if="dialogAcao" class="cad-overlay" @click.self="dialogAcao=null">
        <div class="cad-dialog">
          <div class="cad-dialog-title">{{ dialogAcao.titulo }}</div>
          <div class="cad-dialog-sub">{{ dialogAcao.sub }}</div>
          <div class="cad-dialog-btns" :class="{ 'cad-dialog-btns--col': dialogAcao.botoes.length > 2 }">
            <button class="cad-btn-cancel" @click="dialogAcao=null">Cancelar</button>
            <button v-for="b in dialogAcao.botoes" :key="b.rotulo" class="cad-btn-confirm" @click="executarDialogAcao(b)">{{ b.rotulo }}</button>
          </div>
        </div>
      </div>

      <!-- Cadastros repetidos que já existem no banco -->
      <div v-if="modalRepetidos" class="cad-modal-overlay cad-modal-overlay--top" @click.self="modalRepetidos=null">
        <div class="cad-modal-sheet">
          <div class="cad-modal-header">
            <div class="cad-modal-titulo"><i class="fas fa-clone"></i> Cadastros repetidos</div>
            <button class="cad-btn-fechar" @click="modalRepetidos=null"><i class="fas fa-xmark"></i></button>
          </div>
          <div v-if="!modalRepetidos.lojas.length && !modalRepetidos.clientes.length" class="cad-dialog-sub">
            <i class="fas fa-circle-check"></i> Nenhuma loja ou cliente repetido. Tudo certo!
          </div>
          <template v-else>
            <p class="cad-dialog-sub">Toque em <strong>Manter este</strong> no cadastro que vale. Vendas e histórico dos outros passam para ele e os repetidos são removidos.</p>
            <div v-for="(g, gi) in modalRepetidos.lojas" :key="'l' + gi" class="cad-rep-grupo">
              <div class="cad-rep-titulo"><i class="fas fa-store"></i> Lojas com o mesmo nome</div>
              <div v-for="l in g" :key="l.id" class="cad-arq-item">
                <div class="cad-list-info">
                  <div class="cad-list-nome">{{ l.nome }}{{ l.arquivado ? ' (arquivada)' : '' }}</div>
                  <div class="cad-list-sub">{{ l.vendas }} venda(s)</div>
                </div>
                <button class="cad-arq-btn" @click="juntarGrupo('loja', g, l)">Manter este</button>
              </div>
            </div>
            <div v-for="(g, gi) in modalRepetidos.clientes" :key="'c' + gi" class="cad-rep-grupo">
              <div class="cad-rep-titulo"><i class="fas fa-user"></i> Clientes com o mesmo telefone</div>
              <div v-for="c in g" :key="c.id" class="cad-arq-item">
                <div class="cad-list-info">
                  <div class="cad-list-nome">{{ c.nome }}{{ c.arquivado ? ' (arquivada)' : '' }}</div>
                  <div class="cad-list-sub">{{ c.lojaNome }} · {{ c.telefone || 'sem telefone' }} · {{ c.vendas }} venda(s)</div>
                </div>
                <button class="cad-arq-btn" @click="juntarGrupo('cliente', g, c)">Manter este</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Receber pagamento (folha no topo: não fica embaixo do teclado) -->
      <div v-if="fiadoReceber" class="cad-modal-overlay cad-modal-overlay--top" @click.self="fecharReceber">
        <div class="cad-modal-sheet" role="dialog" aria-modal="true" aria-labelledby="receber-titulo">
          <div class="cad-modal-header">
            <div id="receber-titulo" class="cad-modal-titulo"><i class="fas fa-hand-holding-dollar"></i> Receber pagamento</div>
            <button type="button" class="cad-btn-fechar" aria-label="Fechar" :disabled="salvandoReceber" @click="fecharReceber"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="cad-edit-cliente-tag">
            <div class="cad-edit-avatar">{{ iniciais(fiadoReceber.clienteNome) }}</div>
            <div>
              <div class="cad-edit-nome">
                {{ fiadoReceber.clienteNome }}
                <span v-if="fiadoReceber.clienteFuncao" class="cad-funcao-tag">{{ fiadoReceber.clienteFuncao }}</span>
              </div>
              <div class="cad-edit-loja">{{ fiadoReceber.lojaNome }}</div>
            </div>
          </div>

          <div class="cad-det-saldo">
            <span>Saldo em aberto</span>
            <span class="cad-det-saldo-val">R$ {{ fmt(fiadoReceber.saldo) }}</span>
          </div>

          <div class="cad-form-group cad-receber-campo">
            <label class="cad-form-label" for="receber-valor">Valor pago</label>
            <div class="cad-valor-input-wrap">
              <span class="cad-valor-prefixo">R$</span>
              <input
                id="receber-valor"
                ref="receberInput"
                class="cad-valor-input"
                type="text" inputmode="numeric" placeholder="0,00" autocomplete="off"
                v-model="rawValorReceber"
                @input="handleValorReceberInput"
                @keyup.enter="confirmarReceber"
              >
            </div>
            <div class="cad-receber-atalhos">
              <button
                type="button" class="chip" :class="{ ativo: receberEhTotal }"
                @click="preencherValorReceberTudo"
              >Valor total</button>
            </div>
          </div>

          <div class="cad-receber-feedback" aria-live="polite">
            <div v-if="receberExcede" class="cad-quitar-aviso">
              <i class="fas fa-circle-info"></i> Passa do saldo. Serão registrados só <strong>R$ {{ fmt(fiadoReceber.saldo) }}</strong>.
            </div>
            <div v-else-if="receberEhTotal" class="cad-receber-ok">
              <i class="fas fa-circle-check"></i> Quita esta compra
            </div>
            <div v-else-if="valorReceberNum > 0" class="cad-quitar-resumo">
              <span>Ainda fica faltando</span>
              <strong>R$ {{ fmt(receberRestante) }}</strong>
            </div>
          </div>

          <button
            type="button" class="cad-btn-primary"
            :disabled="!valorReceberNum || salvandoReceber"
            @click="confirmarReceber"
          ><i class="fas fa-check"></i> Registrar pagamento</button>
        </div>
      </div>

      <!-- Quitar ou receber parte (por cliente) -->
      <div v-if="clienteQuitar" class="cad-modal-overlay cad-modal-overlay--top" @click.self="fecharQuitar">
        <div class="cad-modal-sheet" role="dialog" aria-modal="true" aria-labelledby="quitar-titulo">
          <div class="cad-modal-header">
            <div id="quitar-titulo" class="cad-modal-titulo"><i class="fas fa-hand-holding-dollar"></i> Receber pagamento</div>
            <button type="button" class="cad-btn-fechar" aria-label="Fechar" :disabled="salvandoQuitar" @click="fecharQuitar"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="cad-edit-cliente-tag">
            <div class="cad-edit-avatar">{{ iniciais(clienteQuitar.clienteNome) }}</div>
            <div>
              <div class="cad-edit-nome">
                {{ clienteQuitar.clienteNome }}
                <span v-if="clienteQuitar.clienteFuncao" class="cad-funcao-tag">{{ clienteQuitar.clienteFuncao }}</span>
              </div>
              <div class="cad-edit-loja">{{ clienteQuitar.fiados.length }} compra{{ clienteQuitar.fiados.length > 1 ? 's' : '' }} em aberto</div>
            </div>
          </div>

          <div class="cad-det-saldo">
            <span>Saldo em aberto</span>
            <span class="cad-det-saldo-val">R$ {{ fmt(clienteQuitar.saldo) }}</span>
          </div>

          <div class="cad-quitar-modos" role="tablist">
            <button type="button" role="tab" :aria-selected="quitarModo === 'total'" class="cad-quitar-modo" :class="{ ativo: quitarModo === 'total' }" @click="quitarModo = 'total'">Total</button>
            <button type="button" role="tab" :aria-selected="quitarModo === 'parcial'" class="cad-quitar-modo" :class="{ ativo: quitarModo === 'parcial' }" @click="quitarModo = 'parcial'">Parcial</button>
          </div>

          <div v-if="quitarModo === 'total'" class="cad-receber-ok cad-receber-ok--bloco">
            <i class="fas fa-circle-check"></i>
            <span>Todas as {{ clienteQuitar.fiados.length }} compras ficam quitadas.</span>
          </div>

          <template v-else>
            <div class="cad-form-group cad-receber-campo">
              <label class="cad-form-label" for="quitar-valor">Valor pago</label>
              <div class="cad-valor-input-wrap">
                <span class="cad-valor-prefixo">R$</span>
                <input
                  id="quitar-valor"
                  ref="quitarInput"
                  class="cad-valor-input"
                  type="text" inputmode="numeric" placeholder="0,00" autocomplete="off"
                  v-model="rawValorQuitarParcial"
                  @input="onInputValorQuitarParcial"
                >
              </div>
            </div>

            <div class="cad-receber-feedback" aria-live="polite">
              <div v-if="quitarParcialValido" class="cad-quitar-resumo">
                <span>Ainda fica faltando</span>
                <strong>R$ {{ fmt(quitarParcialRestante) }}</strong>
              </div>
              <div v-else-if="valorQuitarParcialNum >= clienteQuitar.saldo - 0.01 && valorQuitarParcialNum > 0" class="cad-quitar-aviso">
                <i class="fas fa-circle-info"></i> Esse valor cobre toda a dívida. Use a aba <strong>Total</strong>.
              </div>
            </div>

            <div v-if="quitarParcialValido" class="cad-form-group">
              <div class="cad-form-label">Data combinada para o restante</div>
              <div class="cad-chip-row cad-chip-row--inicio">
                <button v-for="c in chipsVenc" :key="c.id" type="button" class="chip" :class="{ ativo: chipRestanteAtivo === c.id }" @click="setChipRestante(c.id)">{{ c.label }}</button>
              </div>
              <label class="cad-nv-data" :class="{ 'cad-nv-data--ok': dataVencRestante }">
                <i class="fas fa-calendar-check"></i>
                <span class="cad-nv-data-txt">
                  <template v-if="dataVencRestante">{{ fmtBR(dataVencRestante) }} <small>{{ rotuloDia(dataVencRestante) }}</small></template>
                  <template v-else>Escolher outra data…</template>
                </span>
                <i class="fas fa-chevron-down cad-nv-data-seta"></i>
                <input type="date" class="cad-nv-data-input" :min="hoje()" v-model="dataVencRestante" @change="chipRestanteAtivo = null">
              </label>
              <div v-if="dataVencRestante && dataVencRestante < hoje()" class="cad-quitar-aviso">Escolha uma data de hoje em diante.</div>
              <div v-else class="cad-quitar-nota">O valor pago abate as compras da mais antiga para a mais nova.</div>
            </div>
          </template>

          <button
            v-if="quitarModo === 'total'"
            type="button" class="cad-btn-primary"
            :disabled="salvandoQuitar" @click="quitarTudo"
          ><i class="fas fa-check"></i> Quitar dívida</button>
          <button
            v-else
            type="button" class="cad-btn-primary"
            :disabled="salvandoQuitar || !quitarParcialPronto" @click="confirmarReceberParcial"
          ><i class="fas fa-check"></i> Registrar pagamento</button>
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
          <div class="cad-dialog-title"><i class="fas fa-calendar-days"></i> Agendar vencimento</div>
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

      <!-- Modal detalhe do fiado (somente leitura) -->
      <div v-if="fiadoDetalhe" class="cad-modal-overlay" @click.self="fiadoDetalhe=null">
        <div class="cad-modal-sheet cad-modal-sheet--tall">
          <div class="cad-modal-header">
            <div class="cad-modal-titulo"><i class="fas fa-receipt"></i> Detalhes da cobrança</div>
            <button class="cad-btn-fechar" @click="fiadoDetalhe=null"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="cad-edit-cliente-tag">
            <div class="cad-edit-avatar">{{ iniciais(fiadoDetalhe.clienteNome) }}</div>
            <div>
              <div class="cad-edit-nome">
                {{ fiadoDetalhe.clienteNome }}
                <span v-if="fiadoDetalhe.clienteFuncao" class="cad-funcao-tag">{{ fiadoDetalhe.clienteFuncao }}</span>
                <span v-if="fiadoDetalhe.atrasada" class="cad-tag-vencido">Vencido</span>
                <span v-if="fiadoDetalhe.estornos?.length && fiadoDetalhe.saldo > 0.01" class="cad-chip cad-chip--warn" style="margin-left:6px">Reaberta</span>
              </div>
              <div class="cad-edit-loja">{{ fiadoDetalhe.lojaNome }}<template v-if="lojaLocal(fiadoDetalhe.lojaId)"> ({{ lojaLocal(fiadoDetalhe.lojaId) }})</template> · {{ fmtDataHora(fiadoDetalhe) }}</div>
            </div>
          </div>

          <div class="cad-det-itens">
            <div v-if="fiadoDetalheItens(fiadoDetalhe).length" class="cad-det-lista">
              <div v-for="i in fiadoDetalheItens(fiadoDetalhe)" :key="i.id" class="cad-det-item">
                <span class="cad-det-item-emoji">{{ i.emoji || '📦' }}</span>
                <span class="cad-det-item-nome">{{ i.nome }}</span>
                <span class="cad-det-item-tag">{{ i.qty }}x {{ fmt(i.preco || 0) }}</span>
                <span class="cad-det-item-sub">R$ {{ fmt(i.subtotal ?? (i.qty * (i.preco||0))) }}</span>
              </div>
            </div>
            <p v-else-if="fiadoDetalhe.descricaoLivre" class="cad-det-livre">{{ fiadoDetalhe.descricaoLivre }}</p>
            <div v-if="descontoDe(fiadoDetalhe) > 0" class="cad-det-lista">
              <div class="cad-det-item">
                <span class="cad-det-item-emoji">🏷️</span>
                <span class="cad-det-item-nome">Desconto<template v-if="fiadoDetalhe.descontoMotivo"> · {{ fiadoDetalhe.descontoMotivo }}</template></span>
                <span class="cad-det-item-sub">− R$ {{ fmt(descontoDe(fiadoDetalhe)) }}</span>
              </div>
            </div>
          </div>

          <div class="cad-edit-total">
            <span class="cad-edit-total-label">Total da venda</span>
            <span class="cad-edit-total-val">R$ {{ fmt(fiadoDetalhe.total) }}</span>
          </div>

          <div v-if="fiadoDetalhe.pagamentos?.length" class="cad-det-pagtos">
            <div class="cad-det-pagtos-titulo"><i class="fas fa-hand-holding-dollar"></i> Pagamentos recebidos</div>
            <div v-for="(p, idx) in fiadoDetalhe.pagamentos" :key="idx" class="cad-det-pagto-row">
              <span>{{ fmtBR(p.data) }}{{ p.hora ? ' · ' + fmtHora(p.hora) : '' }}</span>
              <span class="cad-det-pagto-dir">
                <span class="cad-det-pagto-val">R$ {{ fmt(p.valor) }}</span>
                <button type="button" class="cad-det-pagto-estornar" title="Foi engano? Estornar este pagamento"
                  @click="pedirEstorno(fiadoDetalhe, p, idx)"><i class="fas fa-rotate-left"></i> Estornar</button>
              </span>
            </div>
          </div>

          <p v-else-if="fiadoDetalhe.saldo <= 0.01" class="cad-det-sem-pagto">
            Quitada sem pagamento registrado — não há pagamento para estornar.
          </p>

          <div v-if="fiadoDetalhe.estornos?.length" class="cad-det-pagtos cad-det-estornos">
            <div class="cad-det-pagtos-titulo"><i class="fas fa-rotate-left"></i> Estornos</div>
            <div v-for="(e, i) in fiadoDetalhe.estornos" :key="e.criadoEm || i" class="cad-det-pagto-row">
              <span>
                {{ fmtBR(e.data) }}{{ e.hora ? ' · ' + fmtHora(e.hora) : '' }}
                <small class="cad-det-est-sub">Pagamento de {{ fmtBR(e.pagamentoData) }} desfeito</small>
              </span>
              <span class="cad-det-pagto-val cad-det-pagto-val--est">R$ {{ fmt(e.valor) }}</span>
            </div>
          </div>

          <div class="cad-det-saldo" :class="{ 'cad-det-saldo--ok': fiadoDetalhe.saldo <= 0.01 }">
            <span>{{ fiadoDetalhe.saldo <= 0.01 ? 'Quitado' : 'Saldo em aberto' }}</span>
            <span class="cad-det-saldo-val">R$ {{ fmt(fiadoDetalhe.saldo) }}</span>
          </div>

          <div v-if="fiadoDetalhe.dataVenc" class="cad-det-venc" :class="{ 'cad-det-venc--red': fiadoDetalhe.atrasada }">
            <i class="fas" :class="fiadoDetalhe.atrasada ? 'fa-triangle-exclamation' : 'fa-calendar-days'"></i>
            Vencimento: {{ fmtBR(fiadoDetalhe.dataVenc) }}
          </div>

          <div class="cad-dialog-btns" style="margin-top:16px">
            <button
              v-if="fiadoDetalhe.saldo > 0.01"
              class="cad-btn-confirm"
              @click="abrirReceber(fiadoDetalhe); fiadoDetalhe=null"
            ><i class="fas fa-hand-holding-dollar"></i> Receber</button>
            <button
              v-if="telMap[fiadoDetalhe.clienteId] || fiadoDetalhe.clienteTel"
              class="cad-btn-cancel"
              style="background: #25D366; color: #fff; border-color: #25D366"
              @click="enviarComprovanteFiado(fiadoDetalhe); fiadoDetalhe=null"
            ><i class="fab fa-whatsapp"></i> Comprovante</button>
            <button class="cad-btn-cancel" @click="abrirEditarFiado(fiadoDetalhe); fiadoDetalhe=null"><i class="fas fa-pen"></i> Editar</button>
          </div>
        </div>
      </div>

      <!-- Dialog estornar pagamento (fica depois do detalhe para aparecer por cima dele) -->
      <div v-if="estornoPendente" class="cad-overlay" @click.self="cancelarEstorno">
        <div class="cad-dialog">
          <div class="cad-dialog-title">Estornar este pagamento?</div>
          <div class="cad-dialog-sub">
            Pagamento de <strong>R$ {{ fmt(estornoPendente.p.valor) }}</strong> em
            {{ fmtBR(estornoPendente.p.data) }}{{ estornoPendente.p.hora ? ' às ' + fmtHora(estornoPendente.p.hora) : '' }}.<br>
            O valor volta para o saldo em aberto desta compra, que passa de
            R$ {{ fmt(estornoPendente.fiado.saldo) }} para <strong>R$ {{ fmt(saldoAposEstorno) }}</strong>.
            <template v-if="estornoPendente.fiado.saldo <= 0.01"> A compra, que estava quitada, será reaberta.</template>
          </div>
          <div class="cad-dialog-btns">
            <button class="cad-btn-cancel" :disabled="salvandoEstorno" @click="cancelarEstorno">Cancelar</button>
            <button class="cad-btn-confirm danger" :disabled="salvandoEstorno" @click="confirmarEstorno">
              {{ salvandoEstorno ? 'Estornando…' : 'Estornar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal editar fiado completo -->
      <div v-if="fiadoEditar" class="cad-modal-overlay cad-modal-overlay--top">
        <div class="cad-modal-sheet cad-modal-sheet--tall cad-modal-sheet--form" role="dialog" aria-modal="true" aria-labelledby="editar-titulo">
          <div class="cad-modal-header">
            <div id="editar-titulo" class="cad-modal-titulo"><i class="fas fa-pen"></i> Editar venda</div>
            <button type="button" class="cad-btn-fechar" aria-label="Fechar" :disabled="salvandoEdicao" @click="fecharEditarFiado"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="cad-edit-cliente-tag">
            <div class="cad-edit-avatar">{{ iniciais(fiadoEditar.clienteNome) }}</div>
            <div>
              <div class="cad-edit-nome">{{ fiadoEditar.clienteNome }}<span v-if="fiadoEditar.clienteFuncao" class="cad-funcao-tag">{{ fiadoEditar.clienteFuncao }}</span></div>
              <div class="cad-edit-loja">{{ fiadoEditar.lojaNome }}<template v-if="lojaLocal(fiadoEditar.lojaId)"> ({{ lojaLocal(fiadoEditar.lojaId) }})</template></div>
            </div>
          </div>

          <!-- Itens -->
          <div class="cad-form-group">
            <div class="cad-form-label">O que levou?</div>

            <div v-if="!modoDetalhadoEditar" class="cad-valor-simples">
              <div class="cad-valor-input-wrap">
                <span class="cad-valor-prefixo">R$</span>
                <input
                  class="cad-valor-input"
                  type="text" inputmode="numeric" placeholder="0,00"
                  v-model="rawValorLivreEditar"
                  @input="handleValorLivreEditarInput"
                  aria-label="Valor da venda"
                >
              </div>
              <input
                class="cad-nota-input"
                type="text" maxlength="80"
                placeholder="Descrição (opcional)"
                v-model="notaLivreEditar"
              >
              <button type="button" class="cad-link-detalhar" @click="modoDetalhadoEditar = true">
                <i class="fas fa-arrow-left"></i> Voltar pra lista de produtos
              </button>
            </div>

            <template v-else>
              <div v-for="grupo in gruposProdutosEditar" :key="grupo.categoria" class="cad-prod-categoria">
                <div v-if="gruposProdutosEditar.length > 1" class="cad-prod-categoria-titulo">{{ grupo.categoria }}</div>
                <div class="cad-prod-lista">
                  <div
                    v-for="p in grupo.itens" :key="p.id"
                    class="cad-prod-linha" :class="{ ativo: qtdsEditar[p.id] > 0 }"
                  >
                    <div class="cad-prod-linha-avatar">
                      <img v-if="p.foto" :src="p.foto" alt="">
                      <span v-else>{{ p.emoji }}</span>
                    </div>
                    <div class="cad-prod-linha-info">
                      <div class="cad-prod-linha-nome">{{ p.nome }}</div>
                      <div class="cad-prod-linha-preco">
                        R$ {{ fmt(p.preco) }}
                        <span v-if="qtdsEditar[p.id] > 0" class="cad-prod-linha-subtotal"> · {{ qtdsEditar[p.id] }}x</span>
                      </div>
                    </div>
                    <div class="cad-stepper cad-stepper--linha">
                      <button class="cad-stepper-btn" :disabled="!qtdsEditar[p.id]" @click="decEditar(p)">−</button>
                      <div class="cad-stepper-qty">{{ qtdsEditar[p.id] || 0 }}</div>
                      <button class="cad-stepper-btn" @click="incEditar(p)">+</button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <DescontoCampo v-if="modoDetalhadoEditar" v-model:valor="descontoEditarRaw" v-model:motivo="descontoEditarMotivo" />
          </div>

          <!-- Data e hora da compra -->
          <div class="cad-form-group">
            <div class="cad-form-label">Data da compra</div>
            <div class="cad-edit-datetime">
              <label class="cad-nv-data" :class="{ 'cad-nv-data--ok': fiadoEditarData }">
                <i class="fas fa-calendar-day"></i>
                <span class="cad-nv-data-txt">
                  <template v-if="fiadoEditarData">{{ fmtBR(fiadoEditarData) }} <small>{{ rotuloDia(fiadoEditarData) }}</small></template>
                  <template v-else>Escolher data…</template>
                </span>
                <i class="fas fa-chevron-down cad-nv-data-seta"></i>
                <input type="date" class="cad-nv-data-input" v-model="fiadoEditarData" aria-label="Data da compra">
              </label>
              <label class="cad-nv-data cad-nv-data--hora" :class="{ 'cad-nv-data--ok': fiadoEditarHora }">
                <i class="fas fa-clock"></i>
                <span class="cad-nv-data-txt">{{ fmtHora(fiadoEditarHora) || '--:--' }}</span>
                <input type="time" class="cad-nv-data-input" v-model="fiadoEditarHora" aria-label="Hora da compra">
              </label>
            </div>
          </div>

          <!-- Data combinada para pagamento -->
          <div class="cad-form-group">
            <div class="cad-form-label">Data combinada para pagamento</div>
            <div class="cad-chip-row cad-chip-row--inicio">
              <button v-for="ch in chipsVenc" :key="ch.id" type="button" class="chip" :class="{ ativo: chipEditarAtivo === ch.id }" @click="setChipEditar(ch.id)">{{ ch.label }}</button>
            </div>
            <label class="cad-nv-data" :class="{ 'cad-nv-data--ok': dataVencEditar }">
              <i class="fas fa-calendar-check"></i>
              <span class="cad-nv-data-txt">
                <template v-if="dataVencEditar">{{ fmtBR(dataVencEditar) }} <small>{{ rotuloDia(dataVencEditar) }}</small></template>
                <template v-else>Escolher outra data…</template>
              </span>
              <i class="fas fa-chevron-down cad-nv-data-seta"></i>
              <input type="date" class="cad-nv-data-input" v-model="dataVencEditar" @change="chipEditarAtivo = null" aria-label="Data combinada para pagamento">
            </label>
          </div>

          <!-- Efeito no que já foi recebido -->
          <div v-if="editarPago > 0" class="cad-edit-pago">
            <div class="cad-edit-pago-linha"><span>Já recebido</span><strong>R$ {{ fmt(editarPago) }}</strong></div>
            <div class="cad-edit-pago-linha"><span>Saldo depois de salvar</span><strong>R$ {{ fmt(editarSaldoNovo) }}</strong></div>
            <div v-if="editarAbaixoDoPago" class="cad-quitar-aviso">
              <i class="fas fa-circle-info"></i> O total ficou abaixo do que já foi recebido. A compra será marcada como quitada.
            </div>
          </div>

          <div class="cad-modal-foot">
            <div class="cad-footer-total">
              <div class="cad-footer-label">Total<template v-if="descontoEditarVal > 0"> · desconto − R$ {{ fmt(descontoEditarVal) }}</template></div>
              <div class="cad-footer-val">R$ {{ fmt(totalEditarGeral) }}</div>
            </div>
            <button type="button" class="cad-btn-salvar" :disabled="brutoEditarGeral <= 0 || salvandoEdicao" @click="salvarEdicaoFiado">
              <i class="fas fa-check"></i> Salvar alterações
            </button>
          </div>
        </div>
      </div>

    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import CadernetaSwipeItem from '../components/CadernetaSwipeItem.vue'
import DescontoCampo from '../components/DescontoCampo.vue'
import TabCardapio from './TabCardapio.vue'
import {
  getLojas, salvarLojaValidada, excluirLoja as dbExcluirLoja, resumoLoja, arquivarLoja,
  previaRenomearLoja, reconciliarNomesLojas, getNomesLojas,
  getClientes, getTodosClientes, salvarClienteValidado, excluirCliente as dbExcluirCliente,
  resumoCliente, arquivarCliente, listarDuplicados, juntarClientes, juntarLojas,
  validarTelefone, centavos,
  getFuncoes, FUNCOES_PADRAO, limparFuncao, mesmaFuncao, observarSaldosClientes,
  getFiados, getFiadosAbertos, getFiadosVencendoHoje, getFiadosDoCliente,
  salvarFiado as dbSalvarFiado, atualizarFiado, excluirFiado as dbExcluirFiado,
  getStats,
  getTaxas, salvarTaxas,
  getPrecosCategorias, salvarPrecosCategorias,
  aplicarPagamento, receberParcialCliente, estornarPagamento,
  fmt, fmtBR, fmtHora, iniciais, normalizar, resumoItens,
  hoje, horaAtual
} from '../composables/useCaderneta.js'
import { useStore } from '../store.js'
import { useConfirm } from '../composables/useConfirm.js'
import {
  carregarConfigCardapio, montarItensCardapio, agruparPorCategoria,
  extrairTelefoneDeTexto, numeroWhatsAppFormatado, compartilharArquivo
} from '../composables/useCardapio.js'
import { gerarCupomVenda, nomeArquivoCupom } from '../services/cupomService.js'
import { maskTelefone, maskMoney, parseMoney } from '../utils.js'
import { listarPedidosCardapio } from '../db.js'
import { chavePixDoWhatsapp, montarPayloadPix } from '../services/pixService.js'
import { gerarQrSvg, montarVCard } from '../services/qrCodeService.js'
import { normalizarInstagram, urlInstagram, telefoneBonito, urlWhatsapp } from '../services/contatoService.js'
import { carregarConfigPublicacao, urlPublicaFinal } from '../services/githubPublish.js'

const emit = defineEmits(['trocar-perfil'])
const s = useStore()

// ── Navegação interna ─────────────────────────────────────
const tela     = ref('dashboard')
const calcInputRef = ref(null)
// true = a calculadora de taxas abriu como modal por cima da tela atual
// (ver abrirCalculadora/fecharCalculadora) — não é mais uma tela própria.
const calculadoraAberta = ref(false)
// true = a próxima vez que a tela 'cardapio' montar deve ir direto pro
// editor, ignorando o modo "abrir sempre em tela cheia". Fica sempre em
// sincronia com o destino da navegação (ver irPara), pra não "vazar" pra
// outras visitas ao Cardápio feitas pelo menu de baixo.
const cardapioForcarEdicao = ref(false)
// true = a próxima vez que a tela 'cardapio' montar deve pular direto pro
// painel "Pedidos do balcão" — atalho de acesso rápido do dashboard.
const cardapioAbrirPedidos = ref(false)

function irPara(dest, opts = {}) {
  tela.value = dest
  cardapioForcarEdicao.value = dest === 'cardapio' ? !!opts.forcarEdicao : false
  cardapioAbrirPedidos.value = dest === 'cardapio' ? !!opts.abrirPedidos : false

  // Garante o carregamento dos dados ao trocar de tela
  if (dest === 'lojas')       carregarLojas()
  if (dest === 'dashboard')   carregarDashboard()
  if (dest === 'resumo')      carregarResumo()
}

function abrirCalculadora() {
  calculadoraAberta.value = true
  carregarCalculadora()
  setTimeout(() => {
    const el = calcInputRef.value
    if (el) {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, 320) // espera a animação de entrada do modal terminar antes de focar
}

function fecharCalculadora() {
  calculadoraAberta.value = false
}

function irParaResumo(modo) {
  if (modo === 'vencidos') { modoResumo.value = 'abertos'; filtroSit.value = 'vencidos' }
  else if (modo) modoResumo.value = modo
  irPara('resumo')
}

// ── Dashboard ────────────────────────────────────────────
const saudacao = ref('')
const saudacaoIcone = ref('fa-sun')
const dataBR   = ref('')
const stats    = reactive({ totalAberto: 0, totalVencido: 0, qtdAbertos: 0, qtdCompras: 0 })
const alertasDia = ref([])   // uma linha por cliente (soma das vendas que vencem hoje)
const alertasDiaVisiveis = computed(() => alertasDia.value.slice(0, 5))
// Contagem de pedidos do balcão ainda em aberto (nem entregues ainda) —
// mostrada como badge no atalho "Pedidos". Ao marcar um pedido como
// entregue na tela de Cardápio, esse número cai sozinho na próxima vez
// que a pessoa voltar pro dashboard (carregarDashboard roda de novo).
const pedidosBalcaoPendentes = ref(0)
// Dentro desses, quantos ainda nem têm data combinada — esses sim são
// urgentes (precisam de uma ligação/agendamento). Controla a cor do badge:
// vermelho = tem gente sem retorno ainda; azul = já tá tudo agendado,
// só falta entregar.
const pedidosBalcaoUrgentes = ref(0)

async function carregarDashboard() {
  const agora = new Date()
  const hora  = agora.getHours()
  saudacao.value = hora < 12 ? 'Bom dia!' : hora < 18 ? 'Boa tarde!' : 'Boa noite!'
  saudacaoIcone.value = hora < 12 ? 'fa-sun' : hora < 18 ? 'fa-cloud-sun' : 'fa-moon'
  dataBR.value = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const s2 = await getStats()
  Object.assign(stats, s2)

  // Alertas do dia: consulta por índice dataVenc — sem full scan
  carregarLojasLocal()
  const [vencendoHoje, clientes, pedidosBalcao, nomesLojas] = await Promise.all([
    getFiadosVencendoHoje(),
    getTodosClientes(),
    listarPedidosCardapio(),
    getNomesLojas()
  ])
  const telMap = Object.fromEntries(clientes.map(c => [c.id, c.telefone]))
  const nomeMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]))
  const funcaoMap = Object.fromEntries(clientes.map(c => [c.id, c.funcao || '']))
  // Um item por cliente, com o valor total do que vence hoje (não venda a venda).
  const porCliente = new Map()
  for (const f of vencendoHoje) {
    const a = porCliente.get(f.clienteId) || {
      clienteId: f.clienteId,
      clienteNome: nomeMap[f.clienteId] || f.clienteNome,
      clienteFuncao: funcaoMap[f.clienteId] || '',
      lojaId: f.lojaId,
      lojaNome: nomesLojas[f.lojaId] || f.lojaNome,
      clienteTel: telMap[f.clienteId] || '',
      saldo: 0, compras: 0
    }
    a.saldo = centavos(a.saldo + Number(f.saldo || 0))
    a.compras++
    porCliente.set(f.clienteId, a)
  }
  alertasDia.value = [...porCliente.values()].sort((x, y) => y.saldo - x.saldo)
  pedidosBalcaoPendentes.value = pedidosBalcao.filter(p => p.status !== 'entregue').length
  pedidosBalcaoUrgentes.value = pedidosBalcao.filter(p => p.status === 'pendente').length
}

// ── Cobrança: QR Pix + QR de contato (tela inicial da Bete) ──────────
// Tudo gerado localmente (payload Pix / vCard + SVG do QR) — funciona sem
// internet, igual ao restante do app. A chave Pix é o mesmo WhatsApp usado
// no cardápio interativo (cadastrado em Ajustes, perfil Admin): assim a
// pessoa não precisa cadastrar a mesma informação duas vezes.
const modalContato = ref(false)
const valorCobrancaTexto = ref('') // já formatado (ex: "25,90") — mesmo padrão "bancário" usado no resto do app
const pixCopiado = ref(false)

// Mesmo padrão de digitação "bancária" já usado em Insumos/Compras
// (ver onFracValorInput em useModalCompra.js): a pessoa digita só números,
// da direita pra esquerda, e o campo vai formatando sozinho com a vírgula.
function onInputValorCobranca(e) {
  const raw = e.target.value.replace(/\D/g, '')
  const num = parseInt(raw || '0') / 100
  valorCobrancaTexto.value = num > 0 ? maskMoney(num) : ''
}
function bloquearLetrasValor(e) {
  const permitidas = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter']
  if (permitidas.includes(e.key)) return
  if (!/^\d$/.test(e.key)) e.preventDefault()
}
const valorCobrancaNum = computed(() => parseMoney(valorCobrancaTexto.value))

// Número efetivo: o WhatsApp de pedidos, com fallback pro número já usado
// no contato da etiqueta — mesmo padrão do cardápio interativo (ver
// numeroEfetivoPedido em TabCardapio.vue), pra não pedir o dado de novo.
const numeroContatoSugerido  = computed(() => extrairTelefoneDeTexto(s.company.contato_etiqueta))
const numeroWhatsappEfetivo  = computed(() => s.company.whatsapp_pedidos || numeroContatoSugerido.value)
const chavePixVendedor       = computed(() => chavePixDoWhatsapp(numeroWhatsappEfetivo.value))

const payloadPixCobranca = computed(() => {
  if (!chavePixVendedor.value) return ''
  return montarPayloadPix({
    chave: chavePixVendedor.value,
    nome: s.company.nome,
    cidade: s.company.municipio,
    valor: valorCobrancaNum.value,
    identificador: 'COBRANCA'
  })
})
const qrPixSvg = computed(() => gerarQrSvg(payloadPixCobranca.value, { cellSize: 6, margin: 2 }))

// ── Meu contato: dados, edição inline, QR (contato/Instagram/cardápio) e envio ──
const instagramUser = computed(() => normalizarInstagram(s.company.instagram))
const qrModo        = ref('contato')   // 'contato' | 'instagram' | 'cardapio'
const cardapioQrId  = ref('diaadia')   // 'diaadia' | 'festa'

// Domínio do cardápio publicado vem do .env (não precisa do token do GitHub —
// o token só serve pra publicar, não pra montar o link).
const configPub = ref(null)
carregarConfigPublicacao().then(c => { configPub.value = c }).catch(() => {})
const urlCardapioQr = computed(() => {
  if (!configPub.value?.dominio) return ''
  return urlPublicaFinal({ ...configPub.value, caminho: `public/pedido-${cardapioQrId.value}.html` })
})
const urlCardapioEnvio = urlCardapioQr

const vCardContato = computed(() => {
  if (!numeroWhatsappEfetivo.value && !instagramUser.value) return ''
  return montarVCard({
    nome: s.company.nome || 'Loja',
    telefoneWhatsapp: numeroWhatsAppFormatado(numeroWhatsappEfetivo.value),
    instagramUrl: urlInstagram(instagramUser.value),
    nota: 'Fale comigo pelo WhatsApp'
  })
})
const textoQrAtual = computed(() =>
  qrModo.value === 'instagram' ? urlInstagram(instagramUser.value)
  : qrModo.value === 'cardapio' ? urlCardapioQr.value
  : vCardContato.value
)
const qrContatoAtualSvg = computed(() => gerarQrSvg(textoQrAtual.value, { cellSize: 6, margin: 2 }))
const dicaQrContato = computed(() =>
  qrModo.value === 'instagram' ? 'O cliente aponta a câmera e abre seu perfil (precisa de internet no celular dele).'
  : qrModo.value === 'cardapio' ? 'Abre o cardápio no celular do cliente. Confirme que ele já foi publicado em Cardápio.'
  : 'Peça pro cliente apontar a câmera — a maioria oferece "Adicionar aos contatos" na hora, sem internet.'
)


// Enviar meu contato/Instagram/cardápio a um cliente (abre o WhatsApp com texto pronto)
const modalEnvio = ref(false)
const formEnvio = ref({ nome: '', telefone: '', contato: true, instagram: true, cardapio: true })
function abrirEnvioCliente() {
  formEnvio.value = {
    nome: '', telefone: '',
    contato: !!numeroWhatsappEfetivo.value,
    instagram: !!instagramUser.value,
    cardapio: !!urlCardapioEnvio.value
  }
  modalEnvio.value = true
}
async function escolherDaAgendaEnvio() {
  try {
    const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false })
    if (contacts && contacts.length > 0) {
      const c = contacts[0]
      if (c.name && c.name.length > 0) formEnvio.value.nome = c.name[0]
      if (c.tel && c.tel.length > 0) {
        let tel = c.tel[0].replace(/\D/g, '')
        if (tel.length > 11 && tel.startsWith('55')) tel = tel.slice(2)
        formEnvio.value.telefone = maskTelefone(tel)
      }
    }
  } catch { /* cancelado ou indisponível */ }
}
const mensagemEnvio = computed(() => {
  const f = formEnvio.value
  const primeiro = (f.nome || '').trim().split(/\s+/)[0]
  const linhas = [`Oi${primeiro ? ', ' + primeiro : ''}! Aqui é da ${s.company.nome || 'loja'}.`]
  if (f.contato && numeroWhatsappEfetivo.value) linhas.push(`📱 WhatsApp: ${telefoneBonito(numeroWhatsappEfetivo.value)}`)
  if (f.instagram && instagramUser.value) linhas.push(`📷 Instagram: @${instagramUser.value}\n${urlInstagram(instagramUser.value)}`)
  if (f.cardapio && urlCardapioEnvio.value) linhas.push(`🍽️ Cardápio: ${urlCardapioEnvio.value}`)
  return linhas.join('\n')
})
const mensagemEnvioValida = computed(() => {
  const f = formEnvio.value
  return (f.contato && numeroWhatsappEfetivo.value) || (f.instagram && instagramUser.value) || (f.cardapio && urlCardapioEnvio.value)
})
function enviarPorWhatsapp() {
  window.open(urlWhatsapp(formEnvio.value.telefone, mensagemEnvio.value), '_blank')
}
function salvarEnvioComoCliente() {
  if (!lojaAtual.value && lojas.value.length === 1) lojaAtual.value = { ...lojas.value[0] }
  if (!lojaAtual.value) {
    s.notify(lojas.value.length ? 'Abra Clientes e escolha a loja primeiro' : 'Cadastre uma loja antes de salvar clientes')
    return
  }
  const { nome, telefone } = formEnvio.value
  modalEnvio.value = false
  editandoCliente.value = null
  formCliente.value = { nome: nome.trim(), telefone, funcao: '', lojaId: lojaAtual.value?.id }
  lojaOriginalCliente.value = null
  novaFuncaoAberta.value = false
  funcoesOpcoes.value = [...FUNCOES_PADRAO]
  getFuncoes().then(lista => { lista.forEach(garantirOpcaoFuncao) }).catch(() => {})
  modalCliente.value = true
}

// Copia qualquer texto pro clipboard (com fallback pra contextos sem Clipboard API).
async function copiarTexto(texto) {
  if (!texto) return false
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
    throw new Error('sem clipboard API')
  } catch {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.focus()
    campo.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* sem fallback possível */ }
    document.body.removeChild(campo)
    return ok
  }
}

async function copiarCodigoPixCobranca() {
  if (!payloadPixCobranca.value) return
  await copiarTexto(payloadPixCobranca.value)
  pixCopiado.value = true
  setTimeout(() => { pixCopiado.value = false }, 2500)
}

// ── Lojas ────────────────────────────────────────────────
const lojas      = ref([])
const buscaLojas = ref('')
const modalLoja  = ref(null)
const formLoja   = ref({ nome: '', referencia: '', bairro: '' })
// "Local" (campo `referencia`, já existente) + bairro, numa linha só: "Shopping Leblon · Leblon".
// Local + bairro de cada loja pelo id — usado nas Cobranças pra não confundir de qual loja é a venda.
const lojasLocal = ref({})
const lojaLocal = (id) => lojasLocal.value[id] || ''
async function carregarLojasLocal() {
  try {
    const todas = await getLojas({ incluirArquivadas: true })
    lojasLocal.value = Object.fromEntries(todas.map(l => [l.id, localBairro(l)]))
  } catch { /* só exibição */ }
}
const localBairro = (l) => [l?.referencia, l?.bairro].map(v => String(v || '').trim()).filter(Boolean).join(' · ')
const editandoLoja   = ref(null)
const paraExcluirLoja = ref(null)
const lojasArquivadas = ref([])
const clientesArquivados = ref([])
const mostrarArquivadas = ref(false)
// ── Botão de sync com o Drive (mesma lógica do cabeçalho do outro perfil) ──
const confirmar = useConfirm()
const syncEstado = computed(() => {
  if (s.syncStatus === 'error') return 'error'
  if (s.syncStatus === 'syncing' || s.hasLocalChanges) return 'syncing'
  if (s.syncStatus === 'ok') return 'ok'
  return 'idle'
})
const temAlteracoesPendentes = computed(() => s.hasLocalChanges && s.syncStatus !== 'syncing')
const syncClicavel = computed(() => s.syncStatus === 'error' || temAlteracoesPendentes.value)
const syncTitulo = computed(() => {
  if (s.syncStatus === 'error') return 'Falha ao salvar no Drive — toque para tentar de novo'
  if (s.syncStatus === 'syncing') return 'Salvando no Drive…'
  if (s.hasLocalChanges) return 'Há alterações que ainda não foram enviadas ao Drive — toque para enviar agora'
  if (s.syncStatus === 'ok') return 'Salvo no Drive'
  return ''
})
const syncIcone = computed(() => ({
  syncing: 'fa-cloud-arrow-up fa-beat-fade',
  ok: 'fa-cloud-arrow-up',
  error: 'fa-triangle-exclamation',
  idle: 'fa-cloud-arrow-up',
}[syncEstado.value]))

async function onClickSync() {
  if (!syncClicavel.value) return
  // Com alterações pendentes, confirma antes de enviar: se outro aparelho usar a mesma
  // conta Google, enviar sem perceber pode sobrescrever algo mais novo no Drive.
  if (temAlteracoesPendentes.value) {
    const ok = await confirmar.ask(
      'Este aparelho tem alterações salvas aqui que ainda não foram enviadas ao Google Drive. Enviar agora vai atualizar o Drive com os dados deste aparelho — se outro aparelho também tiver mudanças recentes não enviadas, elas podem ser substituídas. Enviar mesmo assim?',
      { title: 'Enviar alterações pendentes', confirmLabel: 'Enviar agora', type: 'warning', icon: 'fas fa-cloud-arrow-up' }
    )
    if (!ok) return
  }
  s.syncImediato()
}

const fazendoBackup = ref(false)
async function fazerBackupAgora() {
  if (fazendoBackup.value) return
  fazendoBackup.value = true
  try { await s.backupAgora() } finally { fazendoBackup.value = false }
}
const salvandoCadastro = ref(false)   // trava contra clique duplo em "Salvar"
const dialogAcao = ref(null)          // { titulo, sub, botoes: [{ rotulo, fn }] }
const modalRepetidos = ref(null)

// Dialog genérico: roda a ação do botão e fecha (trava contra toque duplo).
async function executarDialogAcao(b) {
  if (salvandoCadastro.value) return
  const aberto = dialogAcao.value
  salvandoCadastro.value = true
  try { await b.fn() } finally {
    salvandoCadastro.value = false
    if (dialogAcao.value === aberto) dialogAcao.value = null   // não fecha um diálogo novo aberto pela ação
  }
}

const lojasFiltradas = computed(() =>
  lojas.value
    .filter(l => !buscaLojas.value || normalizar(l.nome).includes(normalizar(buscaLojas.value)))
    .sort((a, b) => a.nome.localeCompare(b.nome))
)

async function carregarLojas() {
  const todas = await getLojas({ incluirArquivadas: true })
  lojas.value = todas.filter(l => !l.arquivado)
  lojasArquivadas.value = todas.filter(l => l.arquivado)
  sincronizarLojaAtual()
}

function sincronizarLojaAtual() {
  if (!lojas.value.length) {
    lojaAtual.value = null
    return
  }

  const atualizada = lojaAtual.value && lojas.value.find(l => l.id === lojaAtual.value.id)
  if (atualizada) {
    // Mantém a loja selecionada, mas com os dados vigentes (ex.: nome recém-renomeado) —
    // senão uma venda nova gravaria o nome antigo.
    lojaAtual.value = { ...atualizada }
    return
  }

  if (lojas.value.length === 1) {
    lojaAtual.value = { ...lojas.value[0] }
    carregarClientes()
  } else {
    lojaAtual.value = null
  }
}

function abrirModalLoja(l = null) {
  editandoLoja.value = l ? l.id : null
  formLoja.value = { nome: l?.nome || '', referencia: l?.referencia || '', bairro: l?.bairro || '' }
  modalLoja.value = true
}

// Avisos ao vivo no modal da loja: nome repetido e quanto será afetado por uma renomeação.
const avisoLoja = ref({ dup: null, afeta: false, vendas: 0, abertas: 0, saldo: 0 })
let avisoLojaSeq = 0
watch(() => [formLoja.value.nome, modalLoja.value, editandoLoja.value], async () => {
  const seq = ++avisoLojaSeq
  const nome = formLoja.value.nome.trim()
  if (!modalLoja.value || !nome) { avisoLoja.value = { dup: null, afeta: false, vendas: 0, abertas: 0, saldo: 0 }; return }
  try {
    const p = await previaRenomearLoja(editandoLoja.value, nome)
    if (seq !== avisoLojaSeq) return   // resposta velha: o usuário já digitou mais
    avisoLoja.value = {
      dup: p.dup,
      afeta: !p.dup && p.mudou && p.vendas > 0,
      vendas: p.vendas, abertas: p.abertas, saldo: p.saldo,
    }
  } catch { /* o aviso é só informativo; a trava real está em salvarLojaValidada */ }
})

async function salvarLoja_() {
  if (salvandoCadastro.value || !formLoja.value.nome.trim()) return
  const obj = { nome: formLoja.value.nome.trim().replace(/\s+/g, ' '), referencia: formLoja.value.referencia.trim(), bairro: formLoja.value.bairro.trim() }
  if (editandoLoja.value) obj.id = editandoLoja.value

  // Renomear loja que já tem vendas: mostra o que vai ser atualizado e pede confirmação.
  if (editandoLoja.value) {
    try {
      const p = await previaRenomearLoja(editandoLoja.value, obj.nome)
      if (p.dup) { s.notify(`Já existe uma loja chamada "${p.dup.nome}".`, 'warning'); return }
      if (p.mudou && p.vendas > 0) {
        dialogAcao.value = {
          titulo: 'Renomear loja?',
          sub: `"${p.atual.nome}" → "${obj.nome}". ${p.vendas} venda(s) serão atualizadas nas Cobranças` +
               `${p.abertas ? ` (${p.abertas} em aberto, R$ ${fmt(p.saldo)})` : ''}. ` +
               'Valores, vencimentos e pagamentos não mudam e nada é apagado.',
          botoes: [{ rotulo: 'Renomear', fn: () => gravarLoja(obj) }],
        }
        return
      }
    } catch (err) {
      console.error(err)
      s.notify('Não deu pra conferir a loja. Nada foi alterado.', 'error')
      return
    }
  }
  await gravarLoja(obj)
}

async function gravarLoja(obj) {
  const jaTravado = salvandoCadastro.value   // quando vem do dialog, executarDialogAcao já travou
  salvandoCadastro.value = true
  try {
    const r = await salvarLojaValidada(obj)
    if (!r.ok) {
      const dup = r.dup
      if (dup.arquivado && !editandoLoja.value) {
        dialogAcao.value = {
          titulo: 'Loja arquivada com esse nome',
          sub: `"${dup.nome}" está arquivada. Quer reativá-la em vez de criar outra?`,
          botoes: [{ rotulo: 'Reativar loja', fn: () => reativarLoja(dup, true) }],
        }
      } else {
        s.notify(`Já existe uma loja chamada "${dup.nome}".`, 'warning')
      }
      return
    }
    const editou = !!editandoLoja.value
    modalLoja.value = null
    s.notify(
      !editou ? 'Loja cadastrada!'
        : r.renomeou && r.vendasAtualizadas ? `Loja renomeada — ${r.vendasAtualizadas} venda(s) atualizada(s) nas Cobranças`
        : 'Loja atualizada!'
    )
    s.syncImediato()   // sync imediato no Drive
    await carregarLojas()
    // Cobranças e alertas já carregados passam a mostrar o nome novo sem precisar reabrir.
    if (r.renomeou) {
      await carregarResumo()
      carregarDashboard()
    }
  } catch (err) {
    console.error(err)
    s.notify(
      err?.message === 'RENOMEACAO_INCONSISTENTE'
        ? 'A conferência dos dados falhou. Nada foi alterado — suas cobranças estão intactas.'
        : 'Não deu pra salvar a loja. Nada foi perdido; tenta de novo?',
      'error'
    )
  } finally {
    salvandoCadastro.value = jaTravado
  }
}

async function reativarLoja(l, fecharModal = false) {
  await arquivarLoja(l.id, false)
  if (fecharModal) modalLoja.value = null
  s.notify(`Loja "${l.nome}" reativada!`)
  s.syncImediato()
  await carregarLojas()
}

// Sem clientes nem vendas → exclui de vez. Com histórico → arquiva (nada se perde).
async function confirmarExcluirLoja(l) {
  paraExcluirLoja.value = { ...l, _info: await resumoLoja(l.id) }
}
async function excluirLoja_() {
  const l = paraExcluirLoja.value
  if (!l || salvandoCadastro.value) return
  salvandoCadastro.value = true
  try {
    const vazia = l._info.vendas === 0 && l._info.clientes === 0
    if (vazia) await dbExcluirLoja(l.id)
    else await arquivarLoja(l.id, true)
    paraExcluirLoja.value = null
    s.notify(vazia ? 'Loja excluída' : 'Loja arquivada — o histórico continua guardado')
    s.syncImediato()
    if (lojaAtual.value?.id === l.id) lojaAtual.value = null
    await carregarLojas()
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra remover a loja. Tenta de novo?', 'error')
  } finally {
    salvandoCadastro.value = false
  }
}

function escolherLoja(l) {
  lojaAtual.value = l
  clienteAtual.value = null
  carregarClientes()
  irPara('clientes')
}

// Ponto de entrada do botão "+ Fiado": sempre abre a tela de Lojas, mesmo
// com uma loja só — assim o caminho é sempre o mesmo (Loja → Cliente → Venda)
// e dá pra cadastrar outra loja sem sair do fluxo.
async function irParaNovaVenda() {
  await carregarLojas()
  irPara('lojas')
}

// ── Clientes ─────────────────────────────────────────────
const clientes       = ref([])
const lojaAtual      = ref(null)
const buscaClientes  = ref('')
const modalCliente   = ref(null)
const formCliente    = ref({ nome: '', telefone: '', funcao: '', lojaId: null })

// ── Função da cliente (Vendedor(a), Gerente, Estoquista… ou uma nova) ──
const funcoesOpcoes     = ref([...FUNCOES_PADRAO])
const novaFuncaoAberta  = ref(false)
const novaFuncaoTexto   = ref('')
const novaFuncaoInput   = ref(null)

function garantirOpcaoFuncao(fn) {
  const f = limparFuncao(fn)
  if (f && !funcoesOpcoes.value.some(x => mesmaFuncao(x, f))) funcoesOpcoes.value = [...funcoesOpcoes.value, f]
}
// Toca na função escolhida de novo para desmarcar (a função é opcional).
function alternarFuncao(fn) {
  formCliente.value.funcao = mesmaFuncao(fn, formCliente.value.funcao) ? '' : fn
}
function abrirNovaFuncao() {
  novaFuncaoTexto.value = ''
  novaFuncaoAberta.value = true
  nextTick(() => novaFuncaoInput.value?.focus())
}
function confirmarNovaFuncao() {
  const f = limparFuncao(novaFuncaoTexto.value)
  novaFuncaoAberta.value = false
  if (!f) return
  // Se já existe uma igual (ignorando acento/maiúscula), reaproveita a grafia existente.
  const existente = funcoesOpcoes.value.find(x => mesmaFuncao(x, f))
  garantirOpcaoFuncao(f)
  formCliente.value.funcao = existente || f
}
const editandoCliente = ref(null)
const lojaOriginalCliente = ref(null)
const paraExcluirCliente = ref(null)

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
  const todos = await getClientes(lojaAtual.value.id, { incluirArquivados: true })
  clientes.value = todos.filter(c => !c.arquivado)
  clientesArquivados.value = todos.filter(c => c.arquivado)
}

function abrirModalCliente(c = null) {
  if (!lojaAtual.value && lojas.value.length === 1) {
    lojaAtual.value = { ...lojas.value[0] }
  }
  editandoCliente.value = c ? c.id : null
  formCliente.value = { nome: c?.nome || '', telefone: c?.telefone || '', funcao: c?.funcao || '', lojaId: c?.lojaId ?? lojaAtual.value?.id }
  lojaOriginalCliente.value = c?.lojaId ?? null
  novaFuncaoAberta.value = false
  funcoesOpcoes.value = [...FUNCOES_PADRAO]
  garantirOpcaoFuncao(c?.funcao)
  getFuncoes().then(lista => { lista.forEach(garantirOpcaoFuncao) }).catch(() => {})
  modalCliente.value = true
}

async function finalizarSalvarCliente(msg) {
  modalCliente.value = null
  s.notify(msg)
  s.syncImediato()   // sync imediato no Drive
  await carregarClientes()
  await carregarResumo()
}

async function salvarCliente_() {
  if (salvandoCadastro.value || !formCliente.value.nome.trim()) return
  const erroTel = validarTelefone(formCliente.value.telefone)
  if (erroTel) { s.notify(erroTel, 'warning'); return }

  const editando = !!editandoCliente.value
  const lojaDestinoId = editando ? (formCliente.value.lojaId ?? lojaAtual.value?.id) : lojaAtual.value?.id
  if (lojaDestinoId == null) { s.notify('Escolha uma loja primeiro', 'warning'); return }
  const obj = {
    nome: formCliente.value.nome.trim().replace(/\s+/g, ' '),
    telefone: formCliente.value.telefone.trim(),
    funcao: limparFuncao(formCliente.value.funcao),
    lojaId: lojaDestinoId,
  }
  if (editando) obj.id = editandoCliente.value

  // Mudou de loja e tem vendas em aberto → pergunta se elas acompanham.
  if (editando && lojaOriginalCliente.value !== lojaDestinoId) {
    const info = await resumoCliente(obj.id)
    const nomeLoja = lojas.value.find(l => l.id === lojaDestinoId)?.nome || 'a nova loja'
    if (info.abertas > 0) {
      dialogAcao.value = {
        titulo: 'Mover as vendas em aberto?',
        sub: `${obj.nome} tem ${info.abertas} venda(s) em aberto (R$ ${fmt(info.saldo)}). Elas devem passar para ${nomeLoja}? O histórico já pago continua na loja onde aconteceu.`,
        botoes: [
          { rotulo: 'Só o cadastro', fn: () => gravarCliente(obj, false, 'Cliente movida!') },
          { rotulo: 'Cadastro + em aberto', fn: () => gravarCliente(obj, true, 'Cliente movida com as vendas em aberto!') },
        ],
      }
      return
    }
  }
  salvandoCadastro.value = true
  try { await gravarCliente(obj, false, editando ? 'Cliente atualizada!' : 'Cliente cadastrada!') }
  finally { salvandoCadastro.value = false }
}

// Grava com checagem de duplicidade dentro da transação. Duplicado em outra loja
// (ou arquivado) vira uma oferta de mover/reativar em vez de erro seco.
async function gravarCliente(obj, moverAbertos, msgOk) {
  try {
    const r = await salvarClienteValidado(obj, { moverAbertos })
    if (r.ok) { await finalizarSalvarCliente(msgOk); return }
    const dup = r.dup.cliente
    const nomeLojaDup = (lojas.value.concat(lojasArquivadas.value).find(l => l.id === dup.lojaId) || {}).nome
    const outraLoja = dup.lojaId !== obj.lojaId
    if (!obj.id && (dup.arquivado || (outraLoja && r.dup.motivo === 'telefone'))) {
      const nomeDestino = lojas.value.find(l => l.id === obj.lojaId)?.nome || 'esta loja'
      dialogAcao.value = {
        titulo: dup.arquivado ? 'Cliente arquivada' : 'Cliente já cadastrada',
        sub: `${dup.nome}${nomeLojaDup ? ` (${nomeLojaDup})` : ''} já usa esse telefone${dup.arquivado ? ' e está arquivada' : ''}. ${dup.arquivado ? 'Reativar' : 'Mover'} para ${nomeDestino}? As vendas em aberto vão junto; o histórico pago continua onde foi feito.`,
        botoes: [{
          rotulo: dup.arquivado ? 'Reativar aqui' : 'Mover para esta loja',
          fn: async () => {
            const r2 = await salvarClienteValidado({ id: dup.id, lojaId: obj.lojaId, arquivado: false }, { moverAbertos: true })
            if (r2.ok) await finalizarSalvarCliente('Cliente movida para esta loja!')
          },
        }],
      }
      return
    }
    s.notify(
      r.dup.motivo === 'telefone'
        ? `Este telefone já está cadastrado: ${dup.nome}${nomeLojaDup ? ` (${nomeLojaDup})` : ''}.`
        : `Já existe "${dup.nome}${dup.funcao ? ` (${dup.funcao})` : ''}" nesta loja. Informe o telefone ou a função para diferenciar.`,
      'warning', 4500
    )
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra salvar a cliente. Tenta de novo?', 'error')
  }
}

async function reativarCliente(c) {
  const r = await salvarClienteValidado({ id: c.id, arquivado: false })
  if (!r.ok) { s.notify('Não foi possível reativar: já existe outra cliente com esse telefone.', 'warning', 4500); return }
  s.notify(`${c.nome} reativada!`)
  s.syncImediato()
  await carregarClientes()
}

// Sem nenhuma venda → exclui de vez. Com histórico → arquiva (nada se perde).
async function confirmarExcluirCliente(c) {
  paraExcluirCliente.value = { ...c, _info: await resumoCliente(c.id) }
}
async function excluirCliente_() {
  const c = paraExcluirCliente.value
  if (!c || salvandoCadastro.value) return
  salvandoCadastro.value = true
  try {
    const semVendas = c._info.vendas === 0
    if (semVendas) await dbExcluirCliente(c.id)
    else await arquivarCliente(c.id, true)
    paraExcluirCliente.value = null
    s.notify(semVendas ? 'Cliente excluída' : 'Cliente arquivada — o histórico continua guardado')
    s.syncImediato()
    await carregarClientes()
    await carregarResumo()
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra remover a cliente. Tenta de novo?', 'error')
  } finally {
    salvandoCadastro.value = false
  }
}

// ── Cadastros repetidos (limpeza do que já existia antes da validação) ──
async function abrirRepetidos() { modalRepetidos.value = await listarDuplicados() }
function juntarGrupo(tipo, grupo, manter) {
  const outros = grupo.filter(i => i.id !== manter.id)
  const vendas = outros.reduce((n, i) => n + i.vendas, 0)
  dialogAcao.value = {
    titulo: tipo === 'loja' ? 'Juntar lojas?' : 'Juntar clientes?',
    sub: `Fica "${manter.nome}". ${vendas} venda(s) dos ${outros.length} cadastro(s) repetido(s) passam para ele e os repetidos são removidos. Isso não pode ser desfeito.`,
    botoes: [{
      rotulo: 'Juntar',
      fn: async () => {
        if (tipo === 'loja') await juntarLojas(manter.id, outros.map(i => i.id))
        else await juntarClientes(manter.id, outros.map(i => i.id))
        s.notify('Cadastros juntados!')
        s.syncImediato()
        await carregarLojas()
        await carregarClientes()
        await carregarResumo()
        modalRepetidos.value = await listarDuplicados()
      },
    }],
  }
}

function escolherCliente(c) {
  clienteAtual.value = c
  origemLancar.value = 'clientes'
  iniciarLancar()
  irPara('lancar')
}

// ── Nova Venda ───────────────────────────────────────────
// Seis categorias fixas, cada uma com preço único (vale pra todos os sabores).
const CATEGORIAS_VENDA = [
  { id: 'cat-trufa',   nome: 'Trufa',   emoji: '🟤', casa: /trufa/i },
  { id: 'cat-cone',    nome: 'Cone',    emoji: '🍦', casa: /cone/i },
  { id: 'cat-barra',   nome: 'Barra',   emoji: '🍫', casa: /barra/i },
  { id: 'cat-bolo',    nome: 'Bolo',    emoji: '🍰', casa: /bolo/i },
  { id: 'cat-torta',   nome: 'Torta',   emoji: '🥧', casa: /torta/i },
  { id: 'cat-brownie', nome: 'Brownie', emoji: '🟫', casa: /brownie/i },
]

const clienteAtual  = ref(null)
const categoriasVenda = ref(CATEGORIAS_VENDA.map(c => ({ id: c.id, nome: c.nome, emoji: c.emoji, preco: 0 })))
const qtds          = reactive({})
const dataVenda     = ref(new Date().toLocaleDateString('sv'))
const horaVenda     = ref(new Date().toTimeString().slice(0, 5))
const dataVenc      = ref('')
const chipAtivo     = ref(null)
const origemLancar  = ref('clientes')
const salvandoFiado = ref(false)
const fiadoSalvo    = ref(null)

// "Já lançado": compras do cliente da Nova Venda (consulta + aviso de repetida)
const comprasCliente     = ref([])
const modalJaLancadas    = ref(false)
const avisoDuplicado     = ref(null)
const chaveRecente = (f) => `${f.dataVenda || ''} ${f.horaVenda || ''} ${f.criadoEm || ''}`
const comprasAbertasCliente = computed(() =>
  comprasCliente.value
    .filter(f => f.saldo > 0.01)
    .sort((a, b) => chaveRecente(b).localeCompare(chaveRecente(a)))
)
const ultimasAbertas = computed(() => comprasAbertasCliente.value.slice(0, 5))
async function carregarComprasCliente() {
  try { comprasCliente.value = await getFiadosDoCliente(clienteAtual.value?.id) }
  catch (e) { console.error(e); comprasCliente.value = [] }
}

function descFiado(f) {
  return resumoItens(f.itens) || f.descricaoLivre || ''
}

// Linha única com a quantidade de itens do fiado — o detalhe completo
// fica a um toque de distância (abre ao clicar no card).
function qtdItens(f) {
  if (f.itens?.length) {
    const total = f.itens.reduce((soma, i) => soma + (i.qty || i.qtd || 0), 0)
    return `${total} ${total === 1 ? 'item' : 'itens'}`
  }
  return f.descricaoLivre || ''
}

const chipsVenc = [
  { id: '5dia', label: '5º Dia Útil' },
  { id: '15',   label: 'Dia 15'      },
  { id: 'fim',  label: 'Fim do Mês'  },
]

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
// "hoje", "amanhã" ou o dia da semana — ajuda a conferir a data de relance.
function rotuloDia(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return ''
  const d = new Date(iso + 'T12:00:00')
  const h = new Date(hoje() + 'T12:00:00')
  const dif = Math.round((d - h) / 86400000)
  if (dif === 0) return 'hoje'
  if (dif === 1) return 'amanhã'
  if (dif === -1) return 'ontem'
  return DIAS_SEMANA[d.getDay()]
}

// Desconto opcional da venda (ex.: trufa amassada, arredondamento, cortesia).
// `total` da venda continua sendo o valor FINAL — saldo, pagamentos e relatórios
// seguem funcionando sem mudança. O desconto fica registrado à parte.
const descontoRaw    = ref('')
const descontoMotivo = ref('')
const moedaParaNumero = (txt) => parseFloat(String(txt || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0
const fmtMoedaCampo   = (n) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(n)
// Desconto gravado numa venda (0 nas vendas antigas, que não têm o campo).
const descontoDe = (f) => centavos(Number(f?.desconto) || 0)

const brutoLancar = computed(() =>
  centavos(categoriasVenda.value.reduce((soma, c) => soma + (qtds[c.id] || 0) * c.preco, 0))
)
const descontoLancar = computed(() => Math.min(centavos(moedaParaNumero(descontoRaw.value)), brutoLancar.value))
const totalLancar = computed(() => centavos(brutoLancar.value - descontoLancar.value))

// Sugestão de preço pra quem ainda não definiu: o preço mais comum entre os
// itens do Cardápio "Dia a dia" cuja categoria ou nome combine com a categoria.
async function carregarProdutosDoCardapio() {
  const config = await carregarConfigCardapio('diaadia')
  const itens = montarItensCardapio(s.receitas, config, { apenasAtivos: true })
  return itens.map(i => ({
    id: i.uuid, nome: i.nome, categoria: i.categoria || 'Geral',
    preco: i.preco, emoji: i.emoji, foto: i.foto,
  }))
}

function precoMaisComum(lista) {
  const cont = new Map()
  for (const p of lista) {
    const v = Number(p.preco || 0)
    if (v > 0) cont.set(v, (cont.get(v) || 0) + 1)
  }
  let melhor = 0, max = 0
  for (const [v, n] of cont) if (n > max) { melhor = v; max = n }
  return melhor
}

async function carregarCategoriasVenda() {
  const salvos = await getPrecosCategorias()
  let sugestoes = null
  const lista = []
  for (const c of CATEGORIAS_VENDA) {
    let preco = Number(salvos[c.id] || 0)
    if (!(preco > 0)) {
      if (!sugestoes) {
        try { sugestoes = await carregarProdutosDoCardapio() } catch { sugestoes = [] }
      }
      preco = precoMaisComum(sugestoes.filter(p => c.casa.test(p.categoria) || c.casa.test(p.nome)))
    }
    lista.push({ id: c.id, nome: c.nome, emoji: c.emoji, preco })
  }
  categoriasVenda.value = lista
}

async function iniciarLancar() {
  CATEGORIAS_VENDA.forEach(c => { qtds[c.id] = 0 })
  dataVenda.value = new Date().toLocaleDateString('sv')
  horaVenda.value = new Date().toTimeString().slice(0, 5)
  dataVenc.value  = ''
  chipAtivo.value = null
  fiadoSalvo.value = null
  salvandoFiado.value = false
  descontoRaw.value = ''
  descontoMotivo.value = ''
  modalJaLancadas.value = false
  avisoDuplicado.value = null
  comprasCliente.value = []
  carregarComprasCliente()
  setChip('fim') // pré-seleciona fim do mês
  await carregarCategoriasVenda()
}

function inc(c) {
  if (!(c.preco > 0)) { abrirModalPrecos(c.id); return }
  qtds[c.id] = (qtds[c.id] || 0) + 1
}
function dec(c) { if (qtds[c.id] > 0) qtds[c.id]-- }

// ── Preços das categorias (modal) ─────────────────────────
const modalPrecos = ref(false)
const formPrecos  = reactive({})

const formatarPreco = (n) => n > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(n) : ''

function abrirModalPrecos(focoId = null) {
  categoriasVenda.value.forEach(c => { formPrecos[c.id] = formatarPreco(c.preco) })
  modalPrecos.value = true
  if (focoId) {
    setTimeout(() => document.getElementById(`preco-${focoId}`)?.focus(), 320)
  }
}

function onInputPreco(id, e) {
  const digitos = e.target.value.replace(/\D/g, '')
  formPrecos[id] = digitos ? formatarPreco(Number(digitos) / 100) : ''
  e.target.value = formPrecos[id]
}

async function salvarPrecos_() {
  const precos = {}
  for (const c of categoriasVenda.value) {
    const v = parseFloat(String(formPrecos[c.id] || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0
    precos[c.id] = v
  }
  await salvarPrecosCategorias(precos)
  categoriasVenda.value = categoriasVenda.value.map(c => ({ ...c, preco: precos[c.id] }))
  modalPrecos.value = false
  s.notify('Preços salvos!')
  s.syncImediato()
}

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

// Se a data da compra mudar depois de um chip de vencimento já escolhido,
// recalcula a data combinada pra continuar coerente com o chip ativo.
watch(dataVenda, () => {
  if (chipAtivo.value) setChip(chipAtivo.value)
})

// Confirmar = salva e mostra o resumo da venda.
async function salvarFiado(ignorarRepetida = false) {
  if (salvandoFiado.value) return
  if (brutoLancar.value === 0 || !clienteAtual.value || !lojaAtual.value) return
  if (!dataVenc.value) {
    s.notify('Escolha a data combinada para o pagamento', 'warning')
    return
  }
  avisoDuplicado.value = null
  // Mesmo cliente + mesma data da compra + mesmo valor → pergunta uma vez
  // (pode ser compra repetida de verdade, por isso não bloqueia).
  if (ignorarRepetida !== true) {
    await carregarComprasCliente()
    const igual = comprasCliente.value.find(f =>
      f.dataVenda === dataVenda.value && Math.abs(Number(f.total) - totalLancar.value) < 0.005)
    if (igual) { avisoDuplicado.value = igual; return }
  }
  salvandoFiado.value = true
  try {
    const itens = categoriasVenda.value
      .filter(c => qtds[c.id] > 0)
      .map(c => ({ id: c.id, nome: c.nome, emoji: c.emoji, qty: qtds[c.id], preco: c.preco, subtotal: qtds[c.id] * c.preco }))
    // Nome da loja lido do cadastro na hora de gravar (nunca de uma cópia que pode estar velha).
    const nomeLojaVigente = (await getNomesLojas())[lojaAtual.value.id] || lojaAtual.value.nome
    const fiado = {
      clienteId:   clienteAtual.value.id,
      clienteNome: clienteAtual.value.nome,
      lojaId:      lojaAtual.value.id,
      lojaNome:    nomeLojaVigente,
      itens,
      descricaoLivre: null,
      total:       totalLancar.value,
      saldo:       totalLancar.value,
      status:      totalLancar.value <= 0.01 ? 'pago' : 'aberto',
      ...(descontoLancar.value > 0
        ? { desconto: descontoLancar.value, descontoMotivo: descontoMotivo.value.trim() || null }
        : {}),
      dataVenda:   dataVenda.value,
      horaVenda:   horaVenda.value || null,
      dataVenc:    dataVenc.value,
      criadoEm:    new Date().toISOString(),
    }
    fiado.id = await dbSalvarFiado(fiado)
    fiadoSalvo.value = fiado
    s.syncImediato()   // sync imediato no Drive
    Object.assign(stats, await getStats())
    tela.value = 'fiado-salvo'
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra salvar. Tenta de novo?', 'error')
  } finally {
    salvandoFiado.value = false
  }
}

async function concluirFiadoSalvo() {
  fiadoSalvo.value = null
  voltarDeLancar()
}

// Desfazer: apaga a venda salva e volta pra Nova Venda com tudo como estava
// (categorias, quantidades e datas), pra corrigir sem refazer do zero.
async function desfazerFiadoSalvo() {
  const f = fiadoSalvo.value
  if (!f?.id) return
  await dbExcluirFiado(f.id)
  fiadoSalvo.value = null
  Object.assign(stats, await getStats())
  s.syncImediato()
  await carregarComprasCliente()
  s.notify('Venda desfeita — ajuste e confirme de novo')
  tela.value = 'lancar'
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

// Sempre que sair das Cobranças e voltar, começa na aba "Aberto" (sem filtro/busca).
// Única exceção: ir lançar uma venda a partir daqui — o fluxo volta para onde estava.
function resetarResumo() {
  modoResumo.value = 'abertos'
  filtroHist.value = 'all'
  filtroSit.value = 'todos'
  buscaResumo.value = ''
  comprasTodas.value = new Set()
}
watch(tela, (nova, antiga) => {
  if (antiga === 'resumo' && nova !== 'resumo' && nova !== 'lancar') resetarResumo()
})
const lojasEstado         = ref(new Map())   // lojaId → true (aberta) / false (fechada); sem entrada = padrão
const clientesExpandidos = ref(new Set())
const fiadoReceber   = ref(null)
const rawValorReceber = ref('')
const receberInput    = ref(null)
const salvandoReceber = ref(false)
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
const fiadoDetalhe       = ref(null)

function abrirDetalheFiado(f) { fiadoDetalhe.value = f }
function fiadoDetalheItens(f) {
  if (!f) return []
  return (f.itens || []).map(i => ({ ...i, qty: i.qty ?? i.qtd ?? 0 }))
}

async function carregarResumo() {
  // Modo abertos: usa índice — não carrega histórico completo
  // Modo histórico: carrega tudo (necessário para mostrar fiados pagos)
  carregarLojasLocal()
  const [fiados, clientes, s2, nomesLojas] = await Promise.all([
    modoResumo.value === 'historico' ? getFiados() : getFiadosAbertos(),
    getTodosClientes(),
    getStats(),
    getNomesLojas()
  ])
  // O nome fica copiado em cada fiado; usa sempre o do cadastro atual do cliente
  // (cobre renomeações antigas que não chegaram a atualizar os fiados).
  const nomePorId = Object.fromEntries(clientes.map(c => [c.id, c.nome]))
  const funcaoPorId = Object.fromEntries(clientes.map(c => [c.id, c.funcao || '']))   // só exibição (listas); não vai nas mensagens
  // Idem para a loja: o cadastro de lojas é a fonte da verdade (só na exibição — nada é regravado aqui).
  fiadosTodos.value   = fiados.map(f => ({
    ...f,
    clienteNome: nomePorId[f.clienteId] || f.clienteNome,
    clienteFuncao: funcaoPorId[f.clienteId] || '',
    lojaNome:    nomesLojas[f.lojaId]   || f.lojaNome,
  }))
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

const fiadosAbertos = computed(() => fiadosTodos.value.filter(f => f.saldo > 0.01))
const textoVazioResumo = computed(() => {
  if (buscaResumo.value.trim()) return 'Nenhum cliente encontrado.'
  if (modoResumo.value === 'historico') return filtroHist.value !== 'all' ? 'Nenhuma compra neste filtro.' : 'Nenhum histórico registrado.'
  return filtroSit.value === 'vencidos' ? 'Nenhum fiado vencido.' : 'Nenhum fiado em aberto.'
})

// ── A receber: Todos / Vencidos ──────────────────────────
const filtroSit = ref('todos')
function statusCliente(c) {
  if (c.atrasado) return { txt: `Atrasado ${rotuloAtraso(c.maxDiasAtraso)}`, cls: 'cad-cli-status--red' }
  const datas = c.fiados.filter(f => f.saldo > 0.01 && f.dataVenc).map(f => f.dataVenc).sort()
  if (!datas.length) return { txt: 'Sem vencimento', cls: '' }
  return datas[0] === hoje()
    ? { txt: 'Vence hoje', cls: 'cad-cli-status--warn' }
    : { txt: `Vence ${fmtBR(datas[0]).slice(0, 5)}`, cls: '' }
}
const gruposResumo = computed(() => montarGrupos())
// Agrupar por loja só ajuda quem tem mais de uma — com uma loja só, é um
// nível de clique/scroll a mais sem ganho nenhum de organização.
const mostrarAgrupamentoLoja = computed(() => gruposResumo.value.length > 0)
// A busca só compensa quando dá trabalho achar alguém rolando a lista —
// com poucos clientes ela é só um campo vazio ocupando espaço no topo.
const lojaUnica = computed(() => gruposResumo.value.length === 1)

function montarGrupos() {
  const hj    = hoje()
  const termo = normalizar(buscaResumo.value.trim())
  const fonte = modoResumo.value === 'historico'
    ? fiadosTodos.value
    : fiadosAbertos.value.filter(f => filtroSit.value === 'todos' || (f.dataVenc && f.dataVenc < hj))
  // Filtro do histórico (chips) — só vale nessa aba
  const filtroH = modoResumo.value === 'historico' ? filtroHist.value : 'all'
  const passaFiltro = f =>
    filtroH === 'all' ||
    (filtroH === 'pago' && f.saldo <= 0.01) ||
    (filtroH === 'aberto' && f.saldo > 0.01) ||
    (filtroH === 'estorno' && (f.estornos?.length || 0) > 0)
  // Resumo do cliente no histórico: calculado sobre TUDO dele (não muda com filtro/busca)
  const kpiPorCliente = new Map()
  if (modoResumo.value === 'historico') {
    fonte.forEach(f => {
      const k = kpiPorCliente.get(f.clienteId) || { n: 0, comprado: 0, pago: 0, estornos: 0, saldo: 0, ultima: '' }
      k.n++
      k.comprado += Number(f.total || 0)
      k.pago += totalPagoF(f)
      k.estornos += f.estornos?.length || 0
      k.saldo += Number(f.saldo || 0)
      if ((f.dataVenda || '') > k.ultima) k.ultima = f.dataVenda || ''
      kpiPorCliente.set(f.clienteId, k)
    })
  }
  const filtrados = fonte.filter(f => {
    if (!passaFiltro(f)) return false
    if (!termo) return true
    const telefone = telMap.value[f.clienteId] || f.clienteTel || ''
    return normalizar([f.clienteNome, f.clienteFuncao, f.lojaNome, lojaLocal(f.lojaId), telefone, descFiado(f)].join(' ')).includes(termo)
  })
  const porLoja = new Map()
  filtrados.forEach(f => {
    if (!porLoja.has(f.lojaId)) porLoja.set(f.lojaId, { lojaId: f.lojaId, lojaNome: f.lojaNome, clientes: new Map() })
    const g = porLoja.get(f.lojaId)
    if (!g.clientes.has(f.clienteId)) {
      g.clientes.set(f.clienteId, {
        clienteId: f.clienteId, clienteNome: f.clienteNome, clienteFuncao: f.clienteFuncao || '',
        telefone: telMap.value[f.clienteId] || '',
        fiados: [], saldo: 0, atrasado: false, valorVencido: 0, maxDiasAtraso: 0,
        kpi: kpiPorCliente.get(f.clienteId) || { n: 0, comprado: 0, pago: 0, estornos: 0, saldo: 0, ultima: '' }
      })
    }
    const c = g.clientes.get(f.clienteId)
    const atrasada = f.saldo > 0.01 && f.dataVenc && f.dataVenc < hj
    c.fiados.push({ ...f, atrasada })
    c.saldo += f.saldo || 0
    if (atrasada) {
      c.atrasado = true
      c.valorVencido += f.saldo || 0
      c.maxDiasAtraso = Math.max(c.maxDiasAtraso, diasEntre(f.dataVenc, hj))
    }
  })
  return [...porLoja.values()].map(g => {
    const clientes = [...g.clientes.values()].map(c => ({
      ...c,
      fiados: c.fiados.sort((a, b) => {
        const da = `${a.dataVenda||''} ${a.horaVenda||'00:00'}`
        const db = `${b.dataVenda||''} ${b.horaVenda||'00:00'}`
        return String(db).localeCompare(String(da))
      }),
      totalCompras: c.fiados.reduce((s, f) => s + Number(f.total || 0), 0),
      // No histórico mostra só as 6 compras mais recentes até a pessoa pedir o resto
      fiadosVisiveis: modoResumo.value === 'historico' && !comprasTodas.value.has(`${g.lojaId}:${c.clienteId}`) && !termo
        ? c.fiados.slice(0, 6)
        : c.fiados
    })).sort((a, b) => modoResumo.value === 'historico'
      ? a.clienteNome.localeCompare(b.clienteNome)
      // A receber: quem está há mais tempo atrasado primeiro, depois maior saldo
      : (b.maxDiasAtraso - a.maxDiasAtraso) || (b.saldo - a.saldo) || a.clienteNome.localeCompare(b.clienteNome))
    return {
      ...g, clientes,
      total: clientes.reduce((s,c) => s+c.saldo, 0),
      totalCompras: clientes.reduce((s,c) => s+c.totalCompras, 0),
      vencidos: clientes.filter(c => c.atrasado).length,
      valorVencido: clientes.reduce((s,c) => s+c.valorVencido, 0),
    }
  }).sort((a, b) => {
    const nome = a.lojaNome.localeCompare(b.lojaNome)
    if (modoResumo.value === 'historico') return nome
    return (b.valorVencido - a.valorVencido) || (b.total - a.total) || nome   // lojas com mais vencido primeiro
  })
}

// ── Redesign das cobranças: helpers de exibição ─────────────
const filtroHist   = ref('all')
const comprasTodas = ref(new Set())
const filtrosHist  = [
  { id: 'all', label: 'Todas' }, { id: 'pago', label: 'Pagas' }, { id: 'estorno', label: 'Estornadas' },
]
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
function rotuloCompras(n) { n = Number(n) || 0; return `${n.toLocaleString('pt-BR')} ${n === 1 ? 'compra' : 'compras'}` }
function diasEntre(a, b) {
  const t = d => { const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  return Math.max(0, Math.round((t(b) - t(a)) / 86400000))
}
function rotuloAtraso(d) { return d <= 1 ? 'há 1 dia' : `há ${d} dias` }
function mesDe(d) { return String(d || '').slice(0, 7) }
function novoMes(lista, i) { return i === 0 || mesDe(lista[i].dataVenda) !== mesDe(lista[i - 1].dataVenda) }
function rotuloMes(d) {
  const [y, m] = String(d || '').split('-')
  return MESES[Number(m) - 1] ? `${MESES[Number(m) - 1]} ${y}` : 'Sem data'
}
function ultimoEstorno(f) { const e = f.estornos || []; return e[e.length - 1] || {} }
function dataPagoF(f) {
  const p = f.pagamentos || []
  if (p.length && p[p.length - 1].data) return p[p.length - 1].data
  return f.pagoEm ? String(f.pagoEm).slice(0, 10) : ''
}
function iconeHist(f) {
  if (f.saldo <= 0.01) return { cls: 'ok', ico: 'fa-check' }
  if (f.estornos?.length) return { cls: 'warn', ico: 'fa-rotate-left' }
  return { cls: 'warn', ico: 'fa-clock' }
}
function chipHist(f) {
  if (f.saldo <= 0.01) {
    const d = dataPagoF(f)
    return { cls: 'ok', txt: d ? `Pago em ${fmtBR(d).slice(0, 5)}` : 'Pago' }
  }
  if (f.estornos?.length) return { cls: 'warn', txt: 'Reaberta' }
  return { cls: 'warn', txt: totalPagoF(f) > 0 ? `Falta R$ ${fmt(f.saldo)}` : 'Em aberto' }
}
function verTodasCompras(g, c) {
  const s2 = new Set(comprasTodas.value); s2.add(`${g.lojaId}:${c.clienteId}`); comprasTodas.value = s2
}

function fmtDataHora(f) {
  const hora = fmtHora(f.horaVenda)
  return hora ? `${fmtBR(f.dataVenda)} ${hora}` : fmtBR(f.dataVenda)
}
function totalPagoF(f) { return (f.pagamentos||[]).reduce((s,p)=>s+Number(p.valor||0),0) }
function pctPago(f) {
  const total = f.total || (totalPagoF(f) + f.saldo)
  if (!total) return 0
  return Math.min(100, Math.max(0, (totalPagoF(f) / total) * 100))
}

function lojaColapsada(g) {
  if (lojaUnica.value || buscaResumo.value.trim()) return false
  if (lojasEstado.value.has(g.lojaId)) return !lojasEstado.value.get(g.lojaId)
  return !(modoResumo.value !== 'historico' && g.vencidos > 0)   // padrão: só abre quem tem vencidos
}
function clienteColapsado(g, c) { return !buscaResumo.value.trim() && !clientesExpandidos.value.has(`${g.lojaId}:${c.clienteId}`) }
function alternarLoja(g) {
  const m = new Map(lojasEstado.value)
  m.set(g.lojaId, lojaColapsada(g))   // estava fechada → abre (e vice-versa)
  lojasEstado.value = m
}
function alternarCliente(g, c) {
  const key = `${g.lojaId}:${c.clienteId}`
  const s = new Set(clientesExpandidos.value)
  s.has(key) ? s.delete(key) : s.add(key)
  clientesExpandidos.value = s
}

function iniciarVendaResumo(g, c) {
  lojaAtual.value    = { id: g.lojaId, nome: g.lojaNome, referencia: '' }
  clienteAtual.value = { id: c.clienteId, nome: c.clienteNome, funcao: c.clienteFuncao || '', telefone: c.telefone, lojaId: g.lojaId }
  origemLancar.value = 'resumo'
  iniciarLancar()
  irPara('lancar')
}

// Horário só entra na mensagem se a configuração da empresa permitir (Ajustes > Comprovantes
// e Cobrança) E o lançamento tiver hora salva — ver dataCurtaMsg.

// Saudação pelo horário do aparelho (as mensagens não usam o nome da pessoa).
function saudacaoMsg(data = new Date()) {
  const h = data.getHours()
  if (h >= 5 && h < 12) return 'Oi, Bom dia'
  if (h >= 12 && h < 18) return 'Oi, Boa tarde'
  return 'Oi, Boa noite'
}

// ── Mensagens de WhatsApp para o cliente: tom de conversa, curtas ──────────
// "03/09" — o ano só aparece quando a compra não é do ano atual.
function dataCurtaMsg(f) {
  const d = fmtBR(f.dataVenda)
  const curta = d.endsWith('/' + new Date().getFullYear()) ? d.slice(0, 5) : d
  const hora = fmtHora(f.horaVenda)
  return (s.company.mostrar_hora_venda && hora) ? `${curta}, ${hora}` : curta
}

// Itens ("Trufa 3 x 7,00") ou, no modo simples, a descrição livre da venda.
function linhasItensMsg(f) {
  if (f.itens?.length) return f.itens.map(linhaItemDetalhe)
  return f.descricaoLivre ? [f.descricaoLivre] : []
}

// Comprovante de UMA venda: saudação, data, itens, desconto (se houver), total e situação.
function montarMensagemVenda(f, nomeCliente) {
  const linhas = [`${saudacaoMsg()}! 😊`, 'Segue sua compra:', '']
  linhas.push(dataCurtaMsg(f))
  linhas.push(...linhasItensMsg(f))
  if (descontoDe(f) > 0) linhas.push(`Desconto −${fmt(descontoDe(f))}`)

  linhas.push('')
  linhas.push(`Total: R$ ${fmt(f.total ?? f.saldo)}`)

  if (f.saldo > 0.01) {
    if (f.saldo < Number(f.total ?? f.saldo) - 0.01) linhas.push(`Em aberto: R$ ${fmt(f.saldo)}`)
    if (f.dataVenc) linhas.push(`Combinado para ${fmtBR(f.dataVenc).slice(0, 5)}`)
  } else {
    linhas.push('Já está pago, obrigada!')
  }

  linhas.push('')
  linhas.push('Qualquer coisa é só chamar! 🍫')
  return linhas.join('\n')
}

// Envia o comprovante de UMA venda específica (funciona tanto para vendas em
// aberto quanto já pagas — é uma notificação de compra, não só cobrança).
function enviarComprovanteTexto(f) {
  const tel = (telMap.value[f.clienteId] || f.clienteTel || '').replace(/\D/g, '')
  if (!tel) { s.notify('Este cliente não tem telefone cadastrado.', 'warning'); return }
  const msg = encodeURIComponent(montarMensagemVenda(f, f.clienteNome))
  window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
}

// ── Cupom em imagem (visual de recibo, sem valor fiscal) ──────────
// Vai pelo compartilhamento do celular (a pessoa escolhe WhatsApp e o contato);
// onde não há compartilhamento de arquivo, a imagem é baixada para anexar.
const gerandoCupom = ref(false)

function dadosEmpresaCupom() {
  return {
    nome: s.company.nome || 'Minha loja',
    telefone: numeroWhatsappEfetivo.value ? telefoneBonito(numeroWhatsappEfetivo.value) : '',
    instagram: instagramUser.value || '',
  }
}

async function enviarCupomVenda(f) {
  if (gerandoCupom.value) return
  gerandoCupom.value = true
  try {
    const blob = await gerarCupomVenda(f, {
      empresa: dadosEmpresaCupom(),
      mostrarHora: !!s.company.mostrar_hora_venda,
      nomeCliente: f.clienteNome,
      desconto: descontoDe(f),
    })
    const r = await compartilharArquivo(blob, {
      nomeArquivo: nomeArquivoCupom('comprovante', f.clienteNome),
      tipo: 'image/png',
      titulo: 'Comprovante de venda',
    })
    if (r === 'baixado') s.notify('Cupom salvo no aparelho — anexe na conversa do WhatsApp.', 'success')
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra gerar o cupom. Tente o envio por texto.', 'error')
  } finally {
    gerandoCupom.value = false
  }
}

// Comprovante de venda: único lugar onde a imagem (cupom) é oferecida. "Cobrar" envia sempre texto.
function enviarComprovanteFiado(f) {
  const tel = (telMap.value[f.clienteId] || f.clienteTel || '').replace(/\D/g, '')
  const botoes = [{ rotulo: 'Cupom (imagem)', fn: () => enviarCupomVenda(f) }]
  if (tel) botoes.push({ rotulo: 'Texto', fn: () => enviarComprovanteTexto(f) })
  dialogAcao.value = {
    titulo: 'Como enviar o comprovante?',
    sub: 'O cupom é uma imagem no estilo recibo, sem valor fiscal. No celular, escolha o WhatsApp e o contato na lista que abrir.',
    botoes,
  }
}

// ── Mensagem de cobrança (botão "Cobrar") ─────────────────────
// Resume todas as compras em aberto do cliente, com total, vencimento e o
// Pix "copia e cola" já com o valor exato da cobrança. WhatsApp formata
// *negrito*; o código Pix vai sozinho numa linha pra ser fácil de copiar.
function linhasItensCobranca(f) {
  if (f.itens?.length) {
    return f.itens.map(i => {
      const qtd = i.qty ?? i.qtd ?? 0
      const unit = Number(i.preco || 0)
      const subtotal = Number(i.subtotal ?? (qtd * unit))
      return `• ${i.nome}: ${qtd} x R$ ${fmt(unit)} = R$ ${fmt(subtotal)}`
    })
  }
  return f.descricaoLivre ? [`• ${f.descricaoLivre}`] : []
}

// Chave Pix (celular) só com os números, sem +55 nem símbolos, pra copiar fácil:
// "+5521999430023" → "21999430023"
function chavePixLegivel(chave) {
  let d = String(chave || '').replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  return d
}

function payloadPixParaValor(valor) {
  if (!chavePixVendedor.value || !(valor > 0)) return ''
  return montarPayloadPix({
    chave: chavePixVendedor.value,
    nome: s.company.nome,
    cidade: s.company.municipio,
    valor: Math.round(valor * 100) / 100,
    identificador: 'COBRANCA'
  })
}

// Item no formato "Cone 1 x 10,00" (qtd x valor unitário, sem "R$").
function linhaItemDetalhe(i) {
  const qtd = i.qty ?? i.qtd ?? 0
  return `${i.nome} ${qtd} x ${fmt(Number(i.preco || 0))}`
}

// Mensagem do botão "Detalhar": data de cada compra, itens (qtd x valor),
// total, chave Pix (de Ajustes) e agradecimento. (A data combinada de pagamento
// NÃO vai na mensagem — continua só no cadastro da venda.)
// Atenção: a mensagem usa SÓ o nome (c.clienteNome). A função da cliente (Gerente etc.) é
// apenas para identificação nas listas e nunca deve entrar no texto enviado.
function montarMensagemCobranca(c, abertos, pix = '') {
  const total = abertos.reduce((soma, f) => soma + Number(f.saldo || 0), 0)
  const plural = abertos.length > 1
  const linhas = []

  // Tom de conversa de WhatsApp: curto, sem formalidade. Só o essencial:
  // saudação, datas, produtos e valores, total e Pix.
  linhas.push(`${saudacaoMsg()}! 😊`)
  linhas.push(`Segue${plural ? 'm' : ''} sua${plural ? 's' : ''} compra${plural ? 's' : ''}:`)

  const ordenados = [...abertos].sort((x, y) => String(x.dataVenda || '').localeCompare(String(y.dataVenda || '')))

  ordenados.forEach(f => {
    linhas.push('')
    linhas.push(dataCurtaMsg(f))
    linhas.push(...linhasItensMsg(f))
    if (descontoDe(f) > 0) linhas.push(`Desconto −${fmt(descontoDe(f))}`)
    const totalCompra = Number(f.total ?? f.saldo)
    const saldo = Number(f.saldo || 0)
    if (saldo < totalCompra - 0.01) linhas.push(`Já pago ${fmt(totalCompra - saldo)} | Em aberto ${fmt(saldo)}`)
  })

  linhas.push('')
  linhas.push(`Total: R$ ${fmt(total)}`)

  if (pix) linhas.push(`Meu Pix: ${chavePixLegivel(chavePixVendedor.value)}`)
  // Nome que aparece no Pix (Razão Social de Ajustes > Identidade), pra cliente não estranhar.
  const nomePix = String(s.company.razao_social || '').trim()
  if (pix && nomePix) linhas.push(`Nome no Pix: ${nomePix}`)

  linhas.push('')
  linhas.push('Qualquer coisa é só chamar! Obrigada 🍫')

  return linhas.join('\n')
}

// detalhado = false → "Cobrar" (mensagem curta); true → "Detalhar" (compras, itens, vencimento).
function abrirWhatsapp(c) {
  const tel = (c.telefone || '').replace(/\D/g, '')

  if (modoResumo.value === 'historico') {
    window.open(urlWhatsapp(tel, `${saudacaoMsg()}! Tudo bem? 😊`), '_blank')
    return
  }

  const abertos = c.fiados.filter(f => f.saldo > 0.01)
  if (!abertos.length) {
    window.open(urlWhatsapp(tel, `${saudacaoMsg()}! Tudo bem? 😊`), '_blank')
    return
  }
  const total = abertos.reduce((soma, f) => soma + Number(f.saldo || 0), 0)
  const pix = payloadPixParaValor(total)
  const montar = () => montarMensagemCobranca(c, abertos, pix)

  if (!pix) {
    s.notify('Mensagem sem Pix: cadastre seu WhatsApp em Ajustes → Dados da loja', 'warning')
    window.open(urlWhatsapp(tel, montar()), '_blank')
    return
  }

  // A chave Pix (celular) vai na própria mensagem (Cobrar e Detalhar).
  // "Detalhar" também termina aqui: a chave Pix já vai no texto. O modal com
  // QR Code fica no botão "Pix" da lista (abrirPixCopiaECola).
  window.open(urlWhatsapp(tel, montar()), '_blank')
}

const pixSegundaMsg = ref(null)
// Botão "Pix" da lista: abre direto o card do copia e cola, sem reenviar a cobrança.
function abrirPixCopiaECola(c) {
  const tel = (c.telefone || '').replace(/\D/g, '')
  const abertos = c.fiados.filter(f => f.saldo > 0.01)
  const total = abertos.reduce((soma, f) => soma + Number(f.saldo || 0), 0)
  const pix = payloadPixParaValor(total)
  if (!pix) {
    s.notify('Cadastre seu WhatsApp em Ajustes → Dados da loja para gerar o Pix', 'warning')
    return
  }
  copiarTexto(pix)
  pixSegundaMsg.value = { tel, pix, nome: c.clienteNome, valor: total }
}
// QR Code do Pix (copia e cola com o valor exato) pra o cliente escanear na hora.
const pixSegundaQrSvg = computed(() =>
  pixSegundaMsg.value?.pix ? gerarQrSvg(pixSegundaMsg.value.pix, { cellSize: 8, margin: 2 }) : null
)
function enviarCodigoPixWhatsapp() {
  const d = pixSegundaMsg.value
  if (!d) return
  window.open(urlWhatsapp(d.tel, d.pix), '_blank')
  pixSegundaMsg.value = null
}
async function copiarCodigoPixSegundaMsg() {
  const d = pixSegundaMsg.value
  if (!d) return
  const ok = await copiarTexto(d.pix)
  s.notify(ok ? 'Código Pix copiado!' : 'Não deu pra copiar o código Pix.', ok ? 'success' : 'warning')
}

function parseValorReceber() {
  if (!rawValorReceber.value) return 0
  const clean = rawValorReceber.value.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}
function handleValorReceberInput(e) {
  let v = e.target.value.replace(/\D/g, '')
  if (!v) { rawValorReceber.value = ''; return }
  rawValorReceber.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(v) / 100)
  setTimeout(() => {
    const el = e.target
    const len = el.value.length
    el.setSelectionRange(len, len)
  })
}
const valorReceberNum = computed(() => parseValorReceber())
const receberExcede   = computed(() => !!fiadoReceber.value && valorReceberNum.value > fiadoReceber.value.saldo + 0.01)
const receberEhTotal  = computed(() => !!fiadoReceber.value && valorReceberNum.value > 0 && Math.abs(valorReceberNum.value - fiadoReceber.value.saldo) <= 0.01)
const receberRestante = computed(() => {
  const f = fiadoReceber.value
  if (!f) return 0
  return Math.max(0, centavos(f.saldo - Math.min(valorReceberNum.value, f.saldo)))
})

function preencherValorReceberTudo() {
  if (!fiadoReceber.value) return
  rawValorReceber.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(fiadoReceber.value.saldo)
}
function abrirReceber(f) {
  salvandoReceber.value = false
  fiadoReceber.value = f
  rawValorReceber.value = f.saldo ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(f.saldo) : ''
  // `autofocus` não dispara em elementos criados por v-if — foca na mão
  nextTick(() => { receberInput.value?.focus(); receberInput.value?.select() })
}
function fecharReceber() {
  if (salvandoReceber.value) return
  fiadoReceber.value = null
}
async function confirmarReceber() {
  const f = fiadoReceber.value
  const valor = parseValorReceber()
  if (!f || !valor || valor <= 0 || salvandoReceber.value) return
  salvandoReceber.value = true   // evita toque duplo registrar o pagamento duas vezes
  try {
    const pago = Math.min(valor, f.saldo)
    await atualizarFiado(f.id, aplicarPagamento(f, pago))
    fiadoReceber.value = null
    s.notify('Pagamento registrado!')
    s.syncImediato()   // sync imediato no Drive
    await carregarResumo()
    const s2 = await getStats()
    Object.assign(stats, s2)
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra registrar o pagamento. Tenta de novo?', 'error')
  } finally {
    salvandoReceber.value = false
  }
}

// ── Quitar / receber parte (por cliente) ─────────────────────
const quitarInput            = ref(null)
const quitarModo             = ref('total')   // 'total' | 'parcial' — abre sempre em 'total' (comportamento de sempre)
const rawValorQuitarParcial  = ref('')
const dataVencRestante       = ref('')
const chipRestanteAtivo      = ref(null)
const salvandoQuitar         = ref(false)

const valorQuitarParcialNum = computed(() => parseMoney(rawValorQuitarParcial.value))
// Parcial de verdade = maior que zero e menor que o saldo (se cobrir tudo, o caminho é "Quitar tudo").
const quitarParcialValido = computed(() => {
  const c = clienteQuitar.value
  return !!c && valorQuitarParcialNum.value > 0 && valorQuitarParcialNum.value < c.saldo - 0.01
})
const quitarParcialRestante = computed(() =>
  quitarParcialValido.value ? centavos(clienteQuitar.value.saldo - valorQuitarParcialNum.value) : 0)
const quitarParcialPronto = computed(() =>
  quitarParcialValido.value && /^\d{4}-\d{2}-\d{2}$/.test(dataVencRestante.value) && dataVencRestante.value >= hoje())

function onInputValorQuitarParcial(e) {
  const v = e.target.value.replace(/\D/g, '')
  rawValorQuitarParcial.value = v ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(v) / 100) : ''
  setTimeout(() => {
    const el = e.target
    const len = el.value.length
    el.setSelectionRange(len, len)
  })
}
// Ao abrir a aba Parcial, o cursor já vai pro campo de valor
watch(quitarModo, (m) => { if (m === 'parcial') nextTick(() => quitarInput.value?.focus()) })
function setChipRestante(id) {
  chipRestanteAtivo.value = id
  dataVencRestante.value = calcChipDate(id, new Date())
}
function abrirQuitarTudo(c) {
  quitarModo.value = 'total'
  rawValorQuitarParcial.value = ''
  dataVencRestante.value = ''
  chipRestanteAtivo.value = null
  salvandoQuitar.value = false
  clienteQuitar.value = c
}
function fecharQuitar() {
  if (salvandoQuitar.value) return
  clienteQuitar.value = null
}
async function atualizarAposQuitar() {
  s.syncImediato()   // sync imediato no Drive
  await carregarResumo()
  const s2 = await getStats()
  Object.assign(stats, s2)
}
async function quitarTudo() {
  const c = clienteQuitar.value
  if (!c || salvandoQuitar.value) return
  salvandoQuitar.value = true
  try {
    await Promise.all(c.fiados.map(f => atualizarFiado(f.id, aplicarPagamento(f, f.saldo))))
    clienteQuitar.value = null
    s.notify(`${c.clienteNome} quitado!`)
    await atualizarAposQuitar()
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra quitar. Tenta de novo?', 'error')
  } finally {
    salvandoQuitar.value = false
  }
}
async function confirmarReceberParcial() {
  const c = clienteQuitar.value
  if (!c || salvandoQuitar.value || !quitarParcialPronto.value) return
  salvandoQuitar.value = true
  try {
    const r = await receberParcialCliente(c.fiados.map(f => f.id), valorQuitarParcialNum.value, dataVencRestante.value)
    clienteQuitar.value = null
    s.notify(r.quitouTudo
      ? `${c.clienteNome} quitado!`
      : `R$ ${fmt(r.recebido)} recebido de ${c.clienteNome} — restam R$ ${fmt(r.restante)} p/ ${fmtBR(dataVencRestante.value)}`)
    await atualizarAposQuitar()
  } catch (err) {
    console.error(err)
    s.notify(err?.message || 'Não deu pra registrar o recebimento. Nada foi alterado.', 'error')
  } finally {
    salvandoQuitar.value = false
  }
}

// ── Estornar pagamento registrado por engano ──────────────────
// Só pede confirmação aqui; a gravação (transacional e conferida) é `estornarPagamento`.
const estornoPendente  = ref(null)    // { fiado, p, idx }
const salvandoEstorno  = ref(false)
const saldoAposEstorno = computed(() => {
  const e = estornoPendente.value
  if (!e) return 0
  let novo = centavos(Number(e.fiado.saldo || 0) + Number(e.p.valor || 0))
  if (Number(e.fiado.total) > 0) novo = Math.min(novo, centavos(e.fiado.total))
  return novo
})
function pedirEstorno(fiado, p, idx) { estornoPendente.value = { fiado, p, idx } }
function cancelarEstorno() { if (!salvandoEstorno.value) estornoPendente.value = null }
async function confirmarEstorno() {
  const e = estornoPendente.value
  if (!e || salvandoEstorno.value) return
  salvandoEstorno.value = true
  try {
    const r = await estornarPagamento(e.fiado.id, {
      idx: e.idx, valor: e.p.valor, data: e.p.data, hora: e.p.hora, criadoEm: e.p.criadoEm,
    })
    estornoPendente.value = null
    // Atualiza o detalhe aberto com os dados gravados (mantém nome/loja/telefone já exibidos).
    const g = r.fiado
    if (fiadoDetalhe.value && fiadoDetalhe.value.id === g.id) {
      fiadoDetalhe.value = {
        ...fiadoDetalhe.value,
        saldo: g.saldo, status: g.status, pagamentos: g.pagamentos, pagoEm: g.pagoEm, estornos: g.estornos,
        atrasada: !!(g.dataVenc && g.dataVenc < hoje() && g.saldo > 0.01),
      }
    }
    s.notify(r.reabriu ? 'Pagamento estornado — compra reaberta' : 'Pagamento estornado')
    s.syncImediato()   // sync imediato no Drive
    await carregarResumo()
    const s2 = await getStats()
    Object.assign(stats, s2)
  } catch (err) {
    console.error(err)
    s.notify(err?.message || 'Não deu pra estornar. Nada foi alterado.', 'error')
    estornoPendente.value = null
  } finally {
    salvandoEstorno.value = false
  }
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
  s.syncImediato()   // sync imediato no Drive
  await carregarResumo()
}

// ── Editar fiado (corrigir cobrança) ─────────────────────────
const salvandoEdicao      = ref(false)
const modoDetalhadoEditar = ref(true)
const rawValorLivreEditar = ref('')
const notaLivreEditar     = ref('')

function parseValorLivreEditar() {
  if (!rawValorLivreEditar.value) return 0
  const clean = rawValorLivreEditar.value.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}
function handleValorLivreEditarInput(e) {
  let v = e.target.value.replace(/\D/g, '')
  if (!v) { rawValorLivreEditar.value = ''; return }
  rawValorLivreEditar.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(v) / 100)
  setTimeout(() => {
    const el = e.target
    const len = el.value.length
    el.setSelectionRange(len, len)
  })
}

function fecharEditarFiado() {
  if (salvandoEdicao.value) return
  fiadoEditar.value = null
}
async function abrirEditarFiado(f) {
  salvandoEdicao.value = false
  fiadoEditar.value   = f
  fiadoEditarData.value = f.dataVenda || hoje()
  fiadoEditarHora.value = f.horaVenda || ''
  dataVencEditar.value  = f.dataVenc  || ''
  chipEditarAtivo.value = null
  descontoEditarRaw.value    = descontoDe(f) > 0 ? fmtMoedaCampo(descontoDe(f)) : ''
  descontoEditarMotivo.value = f.descontoMotivo || ''
  // Edita pelas mesmas categorias da Nova Venda. Itens de vendas antigas
  // (lançadas por sabor, antes da simplificação) continuam aparecendo como
  // linhas extras, pra não se perder nada ao editar.
  await carregarCategoriasVenda()
  const itensAtuais = f.itens || []
  const doCat = categoriasVenda.value.map(c => {
    const item = itensAtuais.find(i => i.id === c.id)
    // Mantém o preço gravado na venda; só usa o preço atual se o item é novo.
    return { id: c.id, nome: c.nome, emoji: c.emoji, categoria: 'Categorias', preco: item ? Number(item.preco || c.preco) : c.preco }
  })
  const antigos = itensAtuais
    .filter(i => !categoriasVenda.value.some(c => c.id === i.id))
    .map(i => ({ id: i.id, nome: i.nome, emoji: i.emoji || '📦', categoria: 'Itens anteriores', preco: Number(i.preco || 0) }))
  produtosEditar.value = [...doCat, ...antigos]
  produtosEditar.value.forEach(p => {
    const item = itensAtuais.find(i => i.id === p.id)
    qtdsEditar[p.id] = item ? (item.qty ?? item.qtd ?? 0) : 0
  })
  // Se foi lançado detalhado (tem itens), abre editando por item;
  // se foi lançado no modo simples (valor + nota), abre já no modo simples.
  const temItens = (f.itens || []).length > 0
  modoDetalhadoEditar.value = temItens
  if (!temItens) {
    rawValorLivreEditar.value = f.total ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(f.total) : ''
    notaLivreEditar.value = f.descricaoLivre || ''
  } else {
    rawValorLivreEditar.value = ''
    notaLivreEditar.value = ''
  }
}
function incEditar(p) { qtdsEditar[p.id] = (qtdsEditar[p.id] || 0) + 1 }
function decEditar(p) { if (qtdsEditar[p.id] > 0) qtdsEditar[p.id]-- }
const gruposProdutosEditar = computed(() => agruparPorCategoria(produtosEditar.value || []))
const totalEditar = computed(() =>
  (produtosEditar.value || []).reduce((s, p) => s + (qtdsEditar[p.id] || 0) * p.preco, 0)
)
const descontoEditarRaw    = ref('')
const descontoEditarMotivo = ref('')
const brutoEditarGeral = computed(() =>
  centavos(modoDetalhadoEditar.value ? totalEditar.value : parseValorLivreEditar())
)
// Desconto só existe no modo por itens; no modo "valor livre" o valor digitado já é o final.
const descontoEditarVal = computed(() =>
  modoDetalhadoEditar.value
    ? Math.min(centavos(moedaParaNumero(descontoEditarRaw.value)), brutoEditarGeral.value)
    : 0
)
const totalEditarGeral = computed(() => centavos(brutoEditarGeral.value - descontoEditarVal.value))
// O que a edição faz com o que já foi recebido (o total pode cair abaixo do pago)
const editarPago = computed(() =>
  centavos((fiadoEditar.value?.pagamentos || []).reduce((t, p) => t + Number(p.valor || 0), 0)))
const editarSaldoNovo    = computed(() => Math.max(0, centavos(totalEditarGeral.value - editarPago.value)))
const editarAbaixoDoPago = computed(() => editarPago.value > 0 && totalEditarGeral.value < editarPago.value - 0.01)
function compraSwipeActions(f) {
  const temTelefone = !!(telMap.value[f.clienteId] || f.clienteTel)
  const receipt = temTelefone ? ['receipt'] : []
  // No histórico (consulta) não mostra receber nem excluir
  if (modoResumo.value === 'historico') return [...receipt, 'edit']
  return f.saldo > 0.01 ? [...receipt, 'receive', 'edit', 'delete'] : [...receipt, 'edit', 'delete']
}
async function salvarEdicaoFiado() {
  const f = fiadoEditar.value
  if (!f || brutoEditarGeral.value <= 0 || salvandoEdicao.value) return
  salvandoEdicao.value = true   // evita toque duplo
  try {
    const itens = modoDetalhadoEditar.value
      ? produtosEditar.value
          .filter(p => qtdsEditar[p.id] > 0)
          .map(p => ({ id: p.id, nome: p.nome, emoji: p.emoji, qty: qtdsEditar[p.id], preco: p.preco, subtotal: qtdsEditar[p.id] * p.preco }))
      : []
    const novoTotal = totalEditarGeral.value
    const totalPago = (f.pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0)
    const novoSaldo = Math.max(0, novoTotal - totalPago)
    await atualizarFiado(f.id, {
      itens,
      descricaoLivre: !modoDetalhadoEditar.value && notaLivreEditar.value.trim() ? notaLivreEditar.value.trim() : null,
      total:      novoTotal,
      saldo:      novoSaldo,
      status:     novoSaldo <= 0.01 ? 'pago' : 'aberto',
      desconto:       descontoEditarVal.value,
      descontoMotivo: descontoEditarVal.value > 0 ? (descontoEditarMotivo.value.trim() || null) : null,
      dataVenda:  fiadoEditarData.value,
      horaVenda:  fiadoEditarHora.value || null,
      dataVenc:   dataVencEditar.value  || null,
      editadoEm:  new Date().toISOString()
    })
    fiadoEditar.value = null
    s.notify('Alterações salvas!')
    s.syncImediato()
    await carregarResumo()
    const s2 = await getStats()
    Object.assign(stats, s2)
  } catch (err) {
    console.error(err)
    s.notify('Não deu pra salvar a edição. Tenta de novo?', 'error')
  } finally {
    salvandoEdicao.value = false
  }
}

// ── Máscara de telefone ───────────────────────────────────────
function formatarTelefone(e) {
  const valor = e?.target?.value ?? ''
  formCliente.value.telefone = maskTelefone(valor)
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
// Saldo devedor de cada cliente (mostrado ao deslizar a linha em + Fiado › Clientes).
// Observa o banco: qualquer alteração de saldo reflete na hora, em qualquer fluxo.
const saldoPorCliente = ref({})
let pararSaldos = null
onMounted(() => { pararSaldos = observarSaldosClientes(m => { saldoPorCliente.value = m }) })
onBeforeUnmount(() => { pararSaldos?.() })

onMounted(async () => {
  // Acerta (sem apagar nada) vendas antigas cujo nome de loja ficou desatualizado.
  try {
    const n = await reconciliarNomesLojas()
    if (n) s.syncImediato()
  } catch (err) { console.error('reconciliarNomesLojas', err) }
  await carregarDashboard()
  carregarLojas() // Pré-carrega as lojas em background para navegação instantânea
})
</script>

<style scoped>
/* ── Layout base ─────────────────────────────────────── */
.tab-caderneta {
  height: 100%; display: flex; flex-direction: column; background: var(--bg);
  /* Contraste reforçado do texto secundário (datas, subtítulos, "sem telefone"
     etc.) — só neste perfil. --muted padrão do app (#8c7260 em branco) fica
     abaixo do mínimo recomendado pra quem enxerga menos; --brown-mid mantém
     a mesma paleta quente, só que bem mais legível. */
  --muted: var(--brown-mid);
  --text-faint: var(--brown-mid);
}

.cad-btn-texto-grande.ativo { background: var(--gold-bg); border-color: var(--brown); color: var(--brown-dark); }

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

/* ── Lombada perfurada (assinatura visual do Caderninho) ── */
.cad-spiral {
  display: flex; justify-content: space-evenly; align-items: center;
  padding: 8px 22px 0; background: var(--surface); flex-shrink: 0;
}
.cad-spiral span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--bg); border: 1.5px solid var(--border2);
  box-shadow: inset 0 1px 2px rgba(61,31,7,.15);
}

/* ── Cabeçalho pessoal do Início ──────────────────────── */
.cad-hdr {
  background: var(--surface); padding: 4px 16px 14px; flex-shrink: 0;
  border-bottom: 1.5px dashed var(--border2); position: relative;
}
.cad-hdr-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.cad-hdr-titulo-group { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.cad-hdr-titulo-group .cad-hdr-icon-btn { flex-shrink: 0; }
.cad-hdr-titulo-group > div { min-width: 0; }
.cad-hdr-titulo-group .cad-hdr-titulo { font-size: 23px; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.cad-hdr-titulo-group .cad-hdr-date { font-size: 13px; text-transform: none; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.cad-hdr-hello {
  font-family: var(--font-hand); font-size: 29px; font-weight: 800; color: var(--brown-dark);
  line-height: 1; display: flex; align-items: baseline; gap: 6px; margin: 0;
}
.cad-hdr-hello i { font-size: 19px; }
.cad-hdr-nome { color: var(--gold-dark); }
.cad-hdr-titulo {
  font-family: var(--font-hand); font-size: 26px; font-weight: 800; color: var(--brown-dark);
  margin: 0; display: flex; align-items: center; gap: 8px;
}
.cad-hdr-titulo i { font-size: 18px; color: var(--gold-dark); }
.cad-hdr-date { font-size: 13px; color: var(--muted); font-weight: 700; margin: 3px 0 0; text-transform: capitalize; }
.cad-hdr-icons { display: flex; gap: 6px; flex-shrink: 0; }
.cad-hdr-icon-btn {
  width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid var(--border2);
  background: var(--surface); color: var(--brown-mid); display: flex; align-items: center; justify-content: center;
  font-size: 14px; cursor: pointer; padding: 0;
}
.cad-hdr-icon-btn.ativo { background: var(--gold); color: #fff; border-color: var(--gold); }
.cad-hdr-icon-btn .cad-aa { font-weight: 800; font-size: 13px; }
/* Botão de sync com o Drive no cabeçalho (mesmas cores do outro perfil) */
.cad-hdr-sync--ok { color: var(--green); }
.cad-hdr-sync--syncing { background: var(--gold); color: var(--brown-dark); border-color: var(--gold-light); }
.cad-hdr-sync--error { background: var(--red); color: #fff; border-color: var(--red); }
.cad-hdr-sync:not(:disabled) { cursor: pointer; }
.cad-hdr-sync:disabled { opacity: .85; }

/* ── Dashboard body ──────────────────────────────────── */
.cad-body { flex: 1; overflow-y: auto; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); }

/* Hero — card ledger dominante: a única info que precisa saltar aos olhos */
.cad-hero {
  background: linear-gradient(155deg, var(--brown-dark) 0%, var(--brown) 62%, var(--brown-mid) 100%);
  border-radius: var(--r-lg); padding: 18px 18px 0; color: #fff; position: relative; overflow: hidden;
  box-shadow: var(--shadow-md); margin-bottom: 14px;
}
.cad-hero::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 85% -10%, rgba(245,200,66,.25), transparent 55%);
  pointer-events: none;
}
.cad-hero-label {
  font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  color: var(--gold-light); display: flex; align-items: center; gap: 6px; position: relative;
}
.cad-hero-val { font-size: 32px; font-weight: 800; font-family: var(--mono); margin-top: 6px; letter-spacing: -.5px; position: relative; }
.cad-hero-sub { font-size: 12px; color: rgba(255,255,255,.65); margin-top: 2px; font-weight: 600; position: relative; }
.cad-hero-status {
  width: 100%; margin-top: 14px; display: flex; align-items: center; gap: 8px;
  padding: 12px 2px; border: none; background: transparent; cursor: pointer;
  border-top: 1px solid rgba(255,255,255,.14); font-family: var(--font);
  font-size: 12.5px; font-weight: 800; text-align: left; position: relative;
}
.cad-hero-status.vencido { color: #ffb4b4; }
.cad-hero-status.ok { color: #a8f0cd; cursor: default; }
.cad-hero-status span { flex: 1; }
.cad-hero-status .chev { font-size: 10px; opacity: .7; }

/* CTA — estilo canhoto/ticket, secundário ao hero */
.cad-cta-fiado {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; margin-bottom: 18px; cursor: pointer;
  border-radius: var(--r-md); text-align: left; font-family: var(--font);
  background: var(--gold-bg); border: 1.5px dashed var(--gold); position: relative;
}
.cad-cta-fiado:active { transform: scale(.98); }
.cad-cta-fiado-ico {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: var(--gold); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.cad-cta-fiado-txt { flex: 1; min-width: 0; }
.cad-cta-fiado-tit { font-size: 14.5px; font-weight: 800; color: var(--brown-dark); }
.cad-cta-fiado-sub { font-size: 11.5px; font-weight: 600; color: var(--brown-mid); margin-top: 1px; }
.cad-cta-fiado-seta { color: var(--gold-dark); font-size: 12px; flex-shrink: 0; }

/* Títulos de seção */
.cad-sec-title {
  font-size: 11px; font-weight: 800; color: var(--brown-mid); text-transform: uppercase;
  letter-spacing: .06em; margin: 4px 0 10px; display: flex; align-items: center; gap: 6px;
}
.cad-sec-title i { color: var(--gold-dark); }

/* Alerta do dia */
.cad-alerta-dia {
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); box-shadow: var(--shadow); margin-bottom: 18px; overflow: hidden;
}
.cad-alerta-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; cursor: pointer; border-bottom: 1px solid var(--border);
}
.cad-alerta-item:last-of-type { border-bottom: none; }
.cad-alerta-item:active { background: rgba(200,137,10,.08); }
.cad-alerta-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--brown); color: #fff;
  font-size: 11.5px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cad-alerta-info { flex: 1; min-width: 0; }
.cad-alerta-nome { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-alerta-loja { font-size: 11px; color: var(--muted); }
.cad-alerta-val  { font-size: 13.5px; font-weight: 800; color: var(--brown); font-family: var(--mono); flex-shrink: 0; margin-left: auto; }
.cad-alerta-mais {
  text-align: center; padding: 8px 14px;
  font-size: 12px; font-weight: 700; color: var(--gold-dark);
  cursor: pointer; border-top: 1px solid var(--border);
}

/* Acesso rápido — grid 2×2: com 4 atalhos, fica mais equilibrado que uma
   fileira só (ficaria compacto demais) ou 3+1 sobrando sozinho embaixo. */
.cad-shortcuts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 6px; }
.cad-shortcut {
  position: relative;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  padding: 14px 8px; text-align: center; cursor: pointer; box-shadow: var(--shadow);
  font-family: var(--font); display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.cad-shortcut:active { transform: scale(.97); border-color: var(--brown-light); }
.cad-shortcut i { font-size: 16px; color: var(--gold-dark); }
.cad-shortcut span { font-size: 11.5px; font-weight: 800; color: var(--brown-dark); }
.cad-shortcut-badge {
  position: absolute; top: 6px; right: 10px;
  display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px;
  border-radius: 999px; background: var(--red, #c0392b); color: #fff; font-size: 10.5px; font-weight: 700; padding: 0 5px;
}
/* Badge azul: já tem tudo agendado, só falta entregar — sem urgência de
   ligar pro cliente. Sem essa classe, o vermelho padrão indica que tem
   pedido sem nenhuma data combinada ainda. */
.cad-shortcut-badge--info { background: var(--blue, #1d4ed8); }

/* ══ Cobrança — QR Pix + QR de contato (tela inicial da Bete) ══════════ */

/* Estado vazio: sem WhatsApp/chave Pix cadastrado ainda */
.cad-cobr-vazio {
  display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
  background: var(--gold-bg); border: 1.5px dashed var(--gold); border-radius: var(--r-md);
  padding: 28px 20px; margin-bottom: 14px; color: var(--brown-mid);
}
.cad-cobr-vazio i { font-size: 22px; color: var(--gold-dark); }
.cad-cobr-vazio p { font-size: 13px; line-height: 1.5; margin: 0; }
.cad-cobr-vazio strong { color: var(--brown-dark); }

.cad-cobr-painel { display: flex; flex-direction: column; align-items: center; margin-bottom: 14px; }

/* Campo de valor — grande, fácil de tocar, some/reaparece o "limpar" */
.cad-pix-valor-box {
  display: flex; align-items: center; gap: 6px; width: 100%; max-width: 280px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  padding: 6px 14px; margin-bottom: 16px; box-shadow: var(--shadow);
}
.cad-pix-valor-prefixo { font-size: 18px; font-weight: 800; color: var(--brown-mid); }
.cad-pix-valor-input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-family: var(--mono); font-size: 24px; font-weight: 800; color: var(--brown-dark);
  padding: 8px 0; text-align: left;
}
.cad-pix-valor-limpar {
  width: 26px; height: 26px; border-radius: 50%; border: none; flex-shrink: 0;
  background: var(--bg); color: var(--muted); display: flex; align-items: center; justify-content: center;
  font-size: 11px; cursor: pointer;
}
.cad-pix-valor-limpar:active { background: var(--border); }

/* QR — grande e bem visível, é o protagonista da tela */
.cad-pix-qr-wrap {
  width: 100%; max-width: 280px; aspect-ratio: 1 / 1; background: #fff;
  border: 1.5px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-md);
  display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
}
.cad-pix-qr { width: 100%; height: 100%; }
.cad-pix-qr :deep(svg) { width: 100%; height: 100%; display: block; }
.cad-pix-qr-erro {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--muted); font-size: 12.5px; text-align: center; padding: 20px;
}
.cad-pix-qr-erro i { font-size: 20px; color: var(--red, #c0392b); }

.cad-pix-hint {
  font-size: 12px; color: var(--brown-mid); text-align: center; line-height: 1.4;
  margin: 12px 0 0; max-width: 280px;
}

.cad-pix-copiar {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; max-width: 280px; margin-top: 14px; padding: 12px 14px;
  border: 1.5px solid var(--brown); border-radius: var(--r-md); background: var(--surface);
  color: var(--brown); font-family: var(--font); font-size: 13px; font-weight: 800; cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
}
.cad-pix-copiar.copiado { background: var(--green); color: #fff; border-color: var(--green); }
.cad-pix-copiar:active { transform: scale(.98); }

/* ── Barra inferior da Bete — reúne os atalhos que antes ficavam soltos
   na tela (Fiado, Cobranças, Cardápio, Pedidos, Calculadora), deixando o
   topo livre pro QR de cobrança. Mesmo padrão visual do AppNav do Yves. */
.cad-bottom-nav {
  display: flex; flex-shrink: 0; background: var(--surface);
  border-top: 1px solid var(--border); box-shadow: 0 -1px 0 var(--border), 0 -8px 24px rgba(61,31,7,.06);
  padding: 2px 2px max(10px, env(safe-area-inset-bottom));
}
.cad-bn-btn {
  position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 9px 4px 7px; min-height: 56px; border: none; background: transparent;
  color: var(--muted); font-family: var(--font); font-size: .64rem; font-weight: 700; cursor: pointer;
}
.cad-bn-btn i { font-size: 1.15rem; color: var(--gold-dark); }
.cad-bn-btn:active { color: var(--brown); }
.cad-bn-btn:active i { color: var(--brown-dark); }

/* Cartão "Meu contato" — nome, telefone e Instagram bem legíveis + edição inline */
.cad-ct-card {
  width: 100%; max-width: 300px; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); box-shadow: var(--shadow); padding: 16px; margin-bottom: 14px;
  text-align: center; box-sizing: border-box;
}
.cad-ct-nome { font-size: 13px; font-weight: 800; color: var(--brown-mid); text-transform: uppercase; letter-spacing: .3px; margin-bottom: 8px; }
.cad-ct-fone, .cad-ct-insta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-family: var(--mono); font-size: 19px; font-weight: 800; color: var(--brown-dark);
  padding: 6px 0;
}
.cad-ct-fone i { color: var(--green); font-size: 17px; }
.cad-ct-insta i { color: #c1358f; font-size: 17px; }
.cad-ct-vazio { font-size: 12.5px; color: var(--muted); padding: 6px 0; font-style: italic; }
.cad-ct-aviso { font-size: 11px; color: var(--muted); margin: 6px 0 0; text-align: left; }
.cad-ct-btn-sec {
  padding: 10px; border-radius: var(--r-md); font-family: var(--font); font-size: 13px;
  font-weight: 800; cursor: pointer; border: 1.5px solid var(--border); background: var(--bg); color: var(--brown-mid);
}
.cad-envio-salvar { width: 100%; margin-top: 8px; }

/* Chips de modo do QR (Contato / Instagram / Cardápio [+ sub: Dia a dia / Festa]) */
.cad-qr-chips { display: flex; gap: 6px; width: 100%; max-width: 300px; margin-bottom: 12px; }
.cad-qr-chips--sub { max-width: 220px; }
.cad-qr-chip {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px 4px; border: 1.5px solid var(--border); border-radius: var(--r-md); background: var(--surface);
  color: var(--brown-mid); font-family: var(--font); font-size: 11.5px; font-weight: 800; cursor: pointer;
}
.cad-qr-chip.ativo { background: var(--brown-dark); color: #fff; border-color: var(--brown-dark); }

/* Modal "Enviar para um cliente" */
.cad-envio-check { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--brown-dark); padding: 7px 0; }
.cad-envio-check input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--brown-dark); }
.cad-envio-seg { display: inline-flex; gap: 4px; margin-left: auto; }
.cad-envio-seg button {
  padding: 4px 10px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--bg);
  color: var(--brown-mid); font-family: var(--font); font-size: 11px; font-weight: 700; cursor: pointer;
}
.cad-envio-seg button.ativo { background: var(--brown-dark); color: #fff; border-color: var(--brown-dark); }
.cad-envio-previa {
  white-space: pre-line; background: var(--bg); border: 1.5px solid var(--border); border-radius: var(--r-md);
  padding: 12px; font-size: 12.5px; color: var(--brown-mid); line-height: 1.5; margin: 6px 0 14px;
}

/* Reserva espaço no fim do scroll do dashboard pra barra inferior fixa
   (mesma altura aproximada do AppNav) não tampar o último conteúdo. */
.cad-body--comnav { padding-bottom: 90px !important; }

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
.cad-scroll-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 0 calc(16px + env(safe-area-inset-bottom)); }

/* ── List items ──────────────────────────────────────── */
.cad-list-info { flex: 1; min-width: 0; }
.cad-list-nome { font-size: 16px; font-weight: 700; }
.cad-list-sub  { font-size: 13px; color: var(--muted); margin-top: 2px; }

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
  border: 1px solid rgba(200,137,10,.3); min-height: 32px; padding: 0 10px;
  border-radius: 7px; font-size: 13px; font-weight: 800; cursor: pointer;
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

/* Lista vertical de produtos — uma linha por item, fácil de rolar/ler no celular
   (mesma lógica de leitura do cardápio interativo, sem depender de 2 colunas) */
.cad-prod-busca {
  width: 100%; padding: 11px 14px; margin-bottom: 10px; box-sizing: border-box;
  border: 1.5px solid var(--border); border-radius: var(--r-full);
  font-size: 14px; background: var(--surface); outline: none; font-family: var(--font); color: var(--text);
}
.cad-prod-categoria { margin-bottom: 16px; }
.cad-prod-categoria-titulo {
  font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
  color: var(--gold-dark); margin: 0 0 8px 2px;
}
.cad-prod-lista { display: flex; flex-direction: column; gap: 8px; }
.cad-prod-linha {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  padding: 10px 12px; box-shadow: var(--shadow); transition: border-color var(--t), background var(--t);
}
.cad-prod-linha.ativo { border-color: var(--brown-light); background: var(--cream); }
.cad-prod-linha-avatar {
  width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%;
  background: var(--bg); border: 1.5px solid var(--border); overflow: hidden;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.cad-prod-linha-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cad-prod-linha-info { flex: 1; min-width: 0; }
.cad-prod-linha-nome { font-size: 14.5px; font-weight: 700; color: var(--text); }
.cad-prod-linha-preco { font-size: 12px; color: var(--muted); font-family: var(--mono); margin-top: 2px; }
.cad-prod-linha-subtotal { color: var(--green); font-weight: 700; }
.cad-stepper--linha { flex-shrink: 0; }
.cad-stepper--linha .cad-stepper-btn { width: 38px; height: 38px; font-size: 20px; }
.cad-stepper--linha .cad-stepper-qty { min-width: 26px; font-size: 15px; }

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

/* Cabeçalho da seção "O que ela levou?" com atalho pra gerenciar produtos */
.section-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.section-label-row .section-label { margin-bottom: 0; }
.cad-btn-gerenciar-prod {
  display: flex; align-items: center; gap: 5px; border: none; background: transparent;
  color: var(--brown-mid); font-family: var(--font); font-size: 11px; font-weight: 700;
  cursor: pointer; padding: 4px 8px; border-radius: var(--r-sm);
}
.cad-btn-gerenciar-prod:active { background: var(--cream); }

/* Modo "lançar só o valor" — pra quando o produto não está na lista */
.cad-valor-simples { display: flex; flex-direction: column; gap: 10px; }
.cad-valor-input-wrap {
  display: flex; align-items: baseline; justify-content: center; gap: 8px;
  background: var(--surface); border: 2px solid var(--border2); border-radius: var(--r-lg);
  padding: 14px 18px; box-shadow: var(--shadow);
}
.cad-valor-prefixo { font-size: 18px; font-weight: 800; color: var(--muted); }
.cad-valor-input {
  border: none; background: transparent; outline: none; text-align: center;
  font-family: var(--mono); font-size: 30px; font-weight: 800; color: var(--brown); flex: 1; min-width: 0;
}
.cad-nota-input {
  padding: 12px 14px; border: 1.5px solid var(--border); border-radius: var(--r-sm);
  font-size: 14px; color: var(--text); background: var(--surface); outline: none; font-family: var(--font);
}
.cad-link-detalhar {
  align-self: center; display: flex; align-items: center; gap: 6px;
  border: none; background: transparent; color: var(--brown-mid);
  font-family: var(--font); font-size: 12.5px; font-weight: 700; cursor: pointer; padding: 6px 10px;
}
.cad-link-detalhar:active { opacity: .7; }

.cad-valor-input-wrap:focus-within { border-color: var(--brown-light); }
.cad-valor-input-wrap--sm { padding: 10px 14px; border-radius: var(--r-md); }
.cad-valor-input--sm { font-size: 22px; }
/* Receber pagamento */
.cad-receber-campo { margin-bottom: 8px; }
.cad-receber-campo .cad-valor-input-wrap { box-shadow: none; transition: border-color var(--t); }
.cad-receber-campo .cad-valor-input-wrap:focus-within { border-color: var(--brown-light); }
.cad-receber-atalhos { display: flex; gap: 6px; margin-top: 4px; }
.cad-receber-feedback { min-height: 38px; margin-bottom: 8px; font-size: 13px; }
.cad-receber-feedback .cad-quitar-resumo,
.cad-receber-feedback .cad-quitar-aviso { margin-top: 0; padding: 6px 2px 0; }
.cad-receber-ok { display: flex; align-items: center; gap: 7px; padding: 6px 2px 0; font-weight: 700; color: var(--green); }
.cad-btn-fechar:disabled { opacity: .4; }
.cad-chip-row--inicio { justify-content: flex-start; margin-bottom: 0; }
.cad-form-group > .cad-nv-data { margin-top: 2px; }
.cad-receber-ok--bloco { padding: 12px 14px; margin-bottom: 14px; border-radius: var(--r-sm); background: var(--green-bg); font-size: 13px; }

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
  display: flex; gap: 6px; margin-top: 10px;
}
.cad-resumo-seg-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 7px 6px 8px; border-radius: var(--r-lg);
  border: 1px solid var(--border); background: var(--surface);
  cursor: pointer; transition: all .18s; font-family: var(--font);
}
.cad-resumo-seg-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
}
.cad-resumo-seg-val {
  font-size: 14px; font-weight: 800; color: var(--brown); font-family: var(--mono);
}
.cad-resumo-seg-val--red { color: var(--red, #dc2626); }
.cad-resumo-seg-btn.active {
  background: var(--brown-dark); border-color: var(--brown-dark);
  box-shadow: 0 1px 4px rgba(61,31,7,.25);
}
.cad-resumo-seg-btn.active .cad-resumo-seg-label { color: var(--cream); opacity: .8; }
.cad-resumo-seg-btn.active .cad-resumo-seg-val { color: var(--cream); }
.cad-resumo-seg-btn.active .cad-resumo-seg-val--red { color: #ffb4b4; }

/* (legado) Seção "Sem vencimento" — card único (mesma linguagem visual do
   cad-cli-card/cad-grupo-loja usados no restante desta tela) */
.cad-secao {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-md); overflow: hidden; margin: 0 0 12px;
}
.cad-secao-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--cream);
}
.cad-secao-ico { font-size: 13px; }
.cad-secao-titulo { flex: 1; font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.cad-secao-badge {
  font-size: 11px; font-weight: 800; background: var(--border2); color: var(--muted);
  padding: 2px 8px; border-radius: var(--r-full);
}

.cad-agend-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-bottom: 1px solid var(--border);
}
.cad-agend-row:last-child { border-bottom: none; }
.cad-agend-row--gray   { background: var(--cream); }

.cad-agend-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: var(--cream-deep); color: var(--brown-mid); font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--border2);
}
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
.cad-loja-local   { display: block; font-size: 11px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.cad-loja-total   { font-size: 13px; font-weight: 800; color: var(--brown); font-family: var(--mono); white-space: nowrap; }
.cad-loja-chevron { color: var(--brown-light); flex-shrink: 0; transition: transform .22s cubic-bezier(.4,0,.2,1); margin-left: 4px; }
.cad-loja-header.colapsado .cad-loja-chevron { transform: rotate(-90deg); }
.cad-grupo-clientes {
  display: flex; flex-direction: column; gap: 4px;
  overflow: hidden; transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease;
  max-height: 9999px; opacity: 1;
  /* folga interna (compensada pela margem negativa) pra o overflow:hidden da
     animação de recolher não cortar a sombra e a borda de baixo dos cards */
  padding: 2px 4px 10px; margin: 0 -4px;
}
.cad-grupo-clientes--indent { margin-left: 10px; padding-left: 8px; }
.cad-grupo-clientes.colapsado { max-height: 0 !important; opacity: 0; padding-top: 0; padding-bottom: 0; }
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
.cad-tag-vencido {
  display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: var(--r-full);
  background: var(--red, #dc2626); color: #fff; font-size: 10px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .03em; vertical-align: middle;
}
.cad-cli-info  { flex: 1; min-width: 0; }
.cad-cli-nome  { font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-cli-tel   { font-size: 12px; color: var(--muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-cli-total { font-size: 15px; font-weight: 800; font-family: var(--mono); white-space: nowrap; flex-shrink: 0; }
.cad-cli-total--red { color: var(--red, #dc2626); }
.cad-cli-total--ok  { color: var(--green); }
.cad-cli-chevron { color: var(--brown-light); flex-shrink: 0; transition: transform .22s; }
.cad-cli-header.colapsado .cad-cli-chevron { transform: rotate(-90deg); }
.cad-cli-btns {
  display: flex; gap: 8px; align-items: center; justify-content: center; padding: 0 12px 10px 12px; flex-wrap: wrap;
  overflow: hidden; transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease, padding .22s ease;
  max-height: 160px; opacity: 1;
}
.cad-cli-btns.colapsado { max-height: 0 !important; opacity: 0; padding-top: 0; padding-bottom: 0; }
.cad-btn-venda, .cad-btn-quitar {
  min-height: 40px; padding: 0 12px; border-radius: var(--r-full); border: none;
  color: #fff; font-size: 12px; font-weight: 800; cursor: pointer;
  font-family: var(--font); display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap;
  flex: 1 1 auto; min-width: 84px;
}
.cad-btn-venda  { background: var(--green); }
.cad-btn-quitar { background: var(--brown); }
.cad-btn-venda:active, .cad-btn-quitar:active { opacity: .8; }
.cad-btn-zap {
  min-height: 40px; padding: 0 12px; border-radius: var(--r-full); border: none;
  background: #25D366; color: #fff;
  font-size: 12px; font-weight: 800; cursor: pointer;
  font-family: var(--font); display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap;
  flex: 1 1 auto; min-width: 84px;
}
.cad-btn-zap:active { opacity: .85; }
.cad-btn-pix {
  min-height: 40px; padding: 0 12px; border-radius: var(--r-full); border: none;
  background: #32BCAD; color: #fff;
  font-size: 12px; font-weight: 800; cursor: pointer;
  font-family: var(--font); display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap;
  flex: 1 1 auto; min-width: 84px;
}
.cad-btn-pix:active { opacity: .85; }

.cad-compras-lista { border-top: 1.5px dashed var(--border2); overflow: hidden; transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease; max-height: 9999px; opacity: 1; }
.cad-compras-lista.colapsado { max-height: 0 !important; opacity: 0; border-top-color: transparent; }
/* Item de compra dentro do card do cliente: já está aninhado em um card
   com sombra, então o "cartão" do swipe fica mais leve aqui (sem sombra,
   borda mais sutil e cantos menores) e ganha respiro em relação à linha
   pontilhada logo acima, pra não parecer grudado. */
.cad-compras-lista .cad-compra-swipe {
  margin: 10px 12px 8px;
  border-radius: var(--r-sm);
  border-color: var(--border);
  box-shadow: none;
}
.cad-compras-lista .cad-compra-swipe:last-child { margin-bottom: 12px; }
.cad-compra-row { display: flex; align-items: flex-start; justify-content: space-between; padding: 8px 12px; gap: 10px; border-bottom: 1px dashed var(--border); min-height: 52px; }
.cad-compra-row:last-child { border-bottom: none; }
.cad-compra-row.atrasada   { background: #fff5f5; }
.cad-compra-esq { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cad-compra-data { font-size: 10.5px; font-weight: 600; color: var(--muted); }
.cad-compra-itens {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  white-space: pre-line;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.cad-compra-pgto { margin-top: 3px; display: flex; flex-direction: column; gap: 3px; max-width: 220px; }
.cad-compra-pgto-linha { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.cad-compra-pgto-recebido {
  font-size: 11px; font-weight: 800; color: var(--green);
  white-space: nowrap; display: inline-flex; align-items: center; gap: 3px;
}
.cad-compra-pgto-recebido i { font-size: 9.5px; }
.cad-compra-pgto-falta { font-size: 10.5px; font-weight: 700; color: var(--orange); white-space: nowrap; }
.cad-compra-pgto-bar { height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
.cad-compra-pgto-bar-fill { height: 100%; border-radius: 999px; background: var(--green); transition: width .25s ease; }
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
.cad-body { padding-bottom: max(18px, env(safe-area-inset-bottom)); }

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

.cad-summary-card {
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 12px 14px;
  margin-bottom: 18px;
}
.cad-summary-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}
.cad-summary-row:last-child { margin-bottom: 0; }
.cad-summary-details {
  margin: 0;
  white-space: pre-line;
  text-align: left;
  font-size: 0.95rem;
  color: var(--brown-dark);
  line-height: 1.4;
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
  -webkit-overflow-scrolling: touch; scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}
.cad-dialog { background: var(--surface); border-radius: 16px; padding: 20px; width: 100%; max-width: 480px; }
.cad-overlay .cad-dialog { margin: 20px; max-height: unset; align-self: center; }
.cad-modal-sheet--tall {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
/* Variante "topo" — usada em Loja, Cliente e Calculadora: a folha nasce
   colada no topo da tela (em vez de bottom sheet) pra não ficar embaixo
   do teclado do celular quando ele abre. */
.cad-modal-overlay--top {
  align-items: flex-start;
  padding-top: env(safe-area-inset-top);
}
.cad-modal-overlay--top .cad-modal-sheet {
  border-radius: 0 0 20px 20px;
  padding-bottom: 20px;
}
.cad-modal-overlay--top .cad-modal-header {
  border-radius: 0;
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
.cad-form-input--erro, .cad-form-input--erro:focus { border-color: #c0392b; }
.cad-form-aviso {
  display: flex; gap: 8px; align-items: flex-start; margin-top: 6px;
  padding: 9px 11px; border-radius: var(--r-sm); font-size: 12px; line-height: 1.45;
  background: rgba(60, 120, 200, .10); color: var(--text);
}
.cad-form-aviso i { margin-top: 2px; color: #2b6cb0; }
.cad-form-aviso--erro { background: rgba(192, 57, 43, .10); }
.cad-form-aviso--erro i { color: #c0392b; }
.cad-btn-primary { width: 100%; padding: 14px; border: none; border-radius: var(--r-md); background: var(--brown); color: #fff; font-family: var(--font); font-size: 15px; font-weight: 800; cursor: pointer; margin-top: 4px; }
.cad-btn-primary:disabled { opacity: .5; cursor: default; }
.cad-dialog-title { font-size: 16px; font-weight: 800; margin-bottom: 6px; }
.cad-dialog-sub   { font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
.cad-dialog-btns  { display: flex; gap: 10px; }
/* Quitar / receber parte */
.cad-quitar-modos { display: flex; gap: 6px; background: var(--bg, #f4efe9); padding: 4px; border-radius: 12px; margin-bottom: 14px; }
.cad-quitar-modo { flex: 1; border: 0; background: transparent; padding: 9px 6px; border-radius: 9px; font-size: 12.5px; font-weight: 800; color: var(--muted); cursor: pointer; }
.cad-quitar-modo.ativo { background: var(--brown); color: #fff; }
.cad-quitar-resumo { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--muted); padding: 8px 2px 0; }
.cad-quitar-resumo strong { color: var(--brown); font-size: 15px; }
.cad-quitar-aviso { font-size: 12px; color: #b3261e; margin-top: 8px; line-height: 1.4; }
.cad-quitar-nota { font-size: 12px; color: var(--muted); margin-top: 8px; line-height: 1.45; }

.cad-btn-cancel   { flex: 1; padding: 12px; border: 1.5px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--text); font-family: var(--font); font-size: 14px; font-weight: 700; cursor: pointer; }
.cad-btn-confirm  { flex: 1; padding: 12px; border: none; border-radius: var(--r-md); background: var(--brown); color: #fff; font-family: var(--font); font-size: 14px; font-weight: 700; cursor: pointer; }
.cad-btn-confirm.danger { background: var(--red, #dc2626); }
.cad-btn-confirm:disabled { opacity: .4; cursor: default; }

/* chip.ativo */
:deep(.chip.ativo), .chip.ativo {
  background: var(--brown); color: #fff; border-color: var(--brown);
  box-shadow: 0 2px 8px rgba(61,31,7,.2);
}

/* SwipeItem layout — SwipeRow compartilhado: o "cartão" (borda, cantos
   arredondados, sombra, espaçamento entre itens) já vem do padrão do
   componente .swipe-wrap (mesmo usado no Estoque via AppListRow). Aqui só
   definimos o layout interno do conteúdo (.swipe-front). */
:deep(.swipe-front) {
  position: relative; z-index: 2; background: var(--surface);
  display: flex; align-items: center; gap: 12px;
  padding: 13px 14px; cursor: pointer; min-height: 64px;
}
:deep(.swipe-front:active) { background: var(--cream); }
:deep(.swipe-action-btn) {
  flex: 1; border: none; color: #fff; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
  font-family: var(--font); font-size: 10px; font-weight: 800; cursor: pointer; transition: opacity .15s;
}
:deep(.swipe-action-btn:active) { opacity: .85; }
:deep(.swipe-action-btn.receipt) { background: #25D366; }
:deep(.swipe-action-btn.receive) { background: var(--green); }
:deep(.swipe-action-btn.edit) { background: var(--brown-light); }
:deep(.swipe-action-btn.del)  { background: var(--red, #dc2626); }

.cad-list-icon {
  width: 42px; height: 42px; border-radius: 50%; background: var(--gold-bg); color: var(--gold);
  display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
}
.cad-list-icon.pessoa { background: var(--cream-deep); color: var(--brown-mid); }

/* ── Calculadora UI (modal) ──
   Compactada: menos respiro entre os blocos, taxa embutida na mesma linha
   do tipo (em vez de linha própria) e ícones/valores menores — mas o valor
   final continua sendo o maior número da folha, que é o que a Bete
   realmente veio buscar aqui. */
.calc-modal-overlay {
  z-index: 9200; /* acima do FAB (9100) */
}
.calc-modal-sheet {
  padding: 8px 18px calc(16px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 32px rgba(61,31,7,.18);
}
.cad-modal-overlay--top .calc-modal-sheet {
  border-radius: 0 0 20px 20px;
  box-shadow: 0 8px 32px rgba(61,31,7,.18);
}
.calc-modal-header { margin-top: 0; margin-bottom: 10px; }
.calc-modal-subtitle { font-size: 12.5px; color: var(--muted); line-height: 1.45; margin: -4px 0 16px; }

.calc-input-wrap {
  background: linear-gradient(180deg, var(--cream) 0%, var(--surface) 100%);
  border: 2px solid var(--border2);
  border-radius: var(--r-md); padding: 8px 16px 7px;
  box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 3px;
  margin-bottom: 10px;
}
.calc-input-label { font-size: 10px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; text-align: center; }
.calc-input-linha { display: flex; align-items: baseline; justify-content: center; gap: 5px; }
.calc-input-prefixo { font-family: var(--mono); font-size: 15px; font-weight: 800; color: var(--muted); }
.calc-input-field {
  border: none; background: transparent;
  font-family: var(--mono) !important; font-size: 26px !important; font-weight: 800;
  color: var(--brown); outline: none; min-height: 38px; text-align: center;
  line-height: 1; max-width: 220px;
}

.calc-results { display: flex; flex-direction: column; gap: 7px; }
.calc-result-card {
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-md); padding: 9px 12px;
  box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 10px;
}
.calc-result-card.debito  { border-left: 3px solid var(--blue); }
.calc-result-card.credito { border-left: 3px solid var(--green); }
.calc-result-icon {
  width: 30px; height: 30px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
}
.calc-result-card.debito  .calc-result-icon { background: var(--blue-bg); color: var(--blue); }
.calc-result-card.credito .calc-result-icon { background: var(--green-bg); color: var(--green); }
.calc-result-info  { flex: 1; min-width: 0; }
.calc-result-tipo  { font-size: 12px; font-weight: 800; color: var(--brown); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.calc-result-taxa  { font-size: 10.5px; color: var(--muted); font-weight: 600; }
.calc-result-val   { font-family: var(--mono); font-size: 18px; font-weight: 800; white-space: nowrap; margin-left: auto; flex-shrink: 0; }
.calc-result-val.debito  { color: var(--blue); }
.calc-result-val.credito { color: var(--green); }

.calc-clear-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  align-self: center; padding: 8px 20px; margin-top: 10px;
  border-radius: var(--r-full); border: 1.5px solid var(--border2);
  background: var(--surface); color: var(--muted);
  font-family: var(--font); font-size: 12.5px; font-weight: 700; cursor: pointer;
  transition: all .15s;
}
.calc-clear-btn:active { background: var(--cream-deep); transform: scale(0.96); }

/* Entrada/saída suave do modal: fundo esmaece e a folha desliza de cima */
.calc-modal-enter-active .calc-modal-sheet,
.calc-modal-leave-active .calc-modal-sheet {
  transition: transform .32s cubic-bezier(.16,1,.3,1);
}
.calc-modal-enter-from .calc-modal-sheet,
.calc-modal-leave-to .calc-modal-sheet {
  transform: translateY(-100%);
}
.calc-modal-enter-active,
.calc-modal-leave-active {
  transition: background-color .28s ease;
}
.calc-modal-enter-from,
.calc-modal-leave-to {
  background-color: rgba(0,0,0,0) !important;
}
/* Resultado troca de valor com um fade suave em vez de "piscar" */
.calc-fade-enter-active, .calc-fade-leave-active { transition: opacity .16s ease; }
.calc-fade-enter-from, .calc-fade-leave-to { opacity: 0; }


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
.cad-edit-datetime .cad-nv-data { padding: 0 12px; gap: 8px; min-width: 0; }
.cad-edit-datetime .cad-nv-data:first-child { flex: 1; }
.cad-edit-datetime .cad-nv-data-txt { font-size: 15px; flex-wrap: wrap; gap: 0 6px; }
.cad-edit-datetime .cad-nv-data--hora { flex: 0 0 auto; }
/* Formulário longo: rodapé com total + salvar sempre visível */
.cad-modal-overlay--top .cad-modal-sheet--form { padding-bottom: 0; }
.cad-modal-foot {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px;
  margin: 8px -20px 0; padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  background: var(--surface); border-top: 1px solid var(--border);
}
.cad-modal-foot .cad-btn-salvar { height: 48px; padding: 0 18px; font-size: 14px; flex: 1; }
.cad-edit-pago {
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;
  padding: 10px 14px; border-radius: var(--r-sm); background: var(--cream); font-size: 13px; color: var(--muted);
}
.cad-edit-pago-linha { display: flex; justify-content: space-between; align-items: center; }
.cad-edit-pago-linha strong { font-family: var(--mono); color: var(--brown); }
.cad-edit-pago .cad-quitar-aviso { margin-top: 4px; }
.cad-edit-total {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; background: var(--cream); border-radius: var(--r-sm);
  margin-bottom: 14px;
}
.cad-edit-total-label { font-size: 12px; font-weight: 700; color: var(--muted); }
.cad-edit-total-val   { font-size: 22px; font-weight: 800; color: var(--brown); font-family: var(--mono); }

/* ── Modal de detalhe do fiado (somente leitura) ── */
.cad-det-itens { margin-bottom: 14px; }
.cad-det-lista {
  border: 1.5px solid var(--border); border-radius: var(--r-sm);
  overflow: hidden; background: var(--surface);
}
.cad-det-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-bottom: 1px dashed var(--border);
  font-size: 12.5px;
}
.cad-det-item:last-child { border-bottom: none; }
.cad-det-item-emoji { font-size: 15px; flex-shrink: 0; }
.cad-det-item-nome  { flex: 1; min-width: 0; font-weight: 700; color: var(--text); overflow-wrap: break-word; }
.cad-det-item-qtd   { color: var(--muted); font-weight: 700; flex-shrink: 0; }
.cad-det-item-tag   { flex-shrink: 0; white-space: nowrap; padding: 2px 8px; border-radius: var(--r-full); background: var(--cream); border: 1px solid var(--border); color: var(--brown-mid); font-family: var(--mono); font-size: 11.5px; font-weight: 800; }
.cad-det-item-sub   { font-family: var(--mono); font-weight: 800; color: var(--brown); flex-shrink: 0; white-space: nowrap; }
.cad-det-livre {
  font-size: 13px; color: var(--text); line-height: 1.5; white-space: pre-line;
  background: var(--cream); border-radius: var(--r-sm); padding: 10px 12px; margin: 0;
}
.cad-det-pagtos { margin-bottom: 14px; }
.cad-det-pagtos-titulo {
  font-size: 11.5px; font-weight: 800; color: var(--muted); text-transform: uppercase;
  letter-spacing: .04em; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
}
.cad-det-pagto-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12.5px; color: var(--text); padding: 6px 2px; border-bottom: 1px dashed var(--border);
}
.cad-det-pagto-row:last-child { border-bottom: none; }
.cad-det-pagto-val { font-family: var(--mono); font-weight: 800; color: var(--green); }
.cad-det-pagto-dir { display: flex; align-items: center; gap: 10px; }
.cad-det-pagto-estornar {
  border: 1px solid var(--border); background: transparent; color: var(--muted);
  font-family: var(--font); font-size: 11px; font-weight: 700; padding: 4px 8px;
  border-radius: 999px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
}
.cad-det-pagto-estornar:active { opacity: .7; }
.cad-det-saldo {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-radius: var(--r-sm); margin-bottom: 10px;
  background: #fff5f5; font-size: 13px; font-weight: 700; color: var(--red, #dc2626);
}
.cad-det-saldo--ok { background: var(--green-bg); color: var(--green); }
.cad-det-saldo-val { font-family: var(--mono); font-size: 17px; font-weight: 800; }
.cad-det-venc {
  display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--muted);
  font-weight: 600; padding: 0 2px;
}
.cad-det-venc--red { color: var(--red, #dc2626); font-weight: 800; }

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

/* Função da cliente: etiqueta ao lado do nome (listas) e seletor no cadastro */
.cad-funcao-tag {
  display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: var(--r-full);
  background: var(--cream); color: var(--brown-dark); border: 1px solid var(--border);
  font-size: 10.5px; font-weight: 800; letter-spacing: .02em; vertical-align: middle; white-space: nowrap;
}
.cad-form-label-aux { font-weight: 600; color: var(--muted); }
.cad-funcao-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.cad-funcao-chip {
  padding: 8px 14px; border-radius: var(--r-full); border: 1.5px solid var(--border);
  background: var(--surface); color: var(--text); font-family: var(--font); font-size: 14px; font-weight: 700; cursor: pointer;
}
.cad-funcao-chip.ativo { background: var(--brown); border-color: var(--brown); color: #fff; }
.cad-funcao-chip--nova { border-style: dashed; color: var(--brown); }
.cad-funcao-chip:active { transform: scale(0.96); }
.cad-btn-agenda {
  width: 48px; border: 1.5px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface); color: var(--brown); font-size: 1.1rem;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.cad-btn-agenda:active { background: var(--cream); transform: scale(0.95); }

/* ══ NOVA VENDA — tela única simplificada ══ */
.cad-nv-body { gap: 20px; }
.cad-nv-bloco { display: flex; flex-direction: column; gap: 10px; }
.cad-nv-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 800; color: var(--brown-dark);
  letter-spacing: .01em;
}
.cad-nv-num {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  background: var(--brown); color: #fff; font-size: 12px; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
}
.cad-nv-precos-btn {
  margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  min-height: 32px; padding: 0 12px; border-radius: var(--r-full);
  background: var(--surface); border: 1.5px solid var(--border);
  color: var(--brown-mid); font-family: var(--font); font-size: 12px; font-weight: 800; cursor: pointer;
}
.cad-nv-precos-btn:active { transform: scale(.96); }

/* Já lançado — linha de consulta + folha com as últimas compras em aberto */
.cad-nv-jalancado {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 10px 14px; border-radius: var(--r-md); cursor: pointer;
  background: var(--cream); border: 1.5px dashed var(--brown-light);
  color: var(--brown-dark); font-family: var(--font); font-size: 13px; font-weight: 700;
}
.cad-nv-jalancado:active { opacity: .85; }
.cad-nv-jalancado > i:first-child { color: var(--brown-mid); }
.cad-nv-jalancado > i:last-child { color: var(--brown-mid); font-size: 11px; }
.cad-nv-jalancado-txt { flex: 1; min-width: 0; }
.cad-jl-lista { display: flex; flex-direction: column; margin-bottom: 8px; }
.cad-jl-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.cad-jl-info { flex: 1; min-width: 0; }
.cad-jl-data { font-size: 14px; font-weight: 800; color: var(--text); }
.cad-jl-desc { font-size: 12.5px; color: var(--muted); margin-top: 2px; overflow-wrap: break-word; }
.cad-jl-valor { font-family: var(--mono); font-weight: 800; color: var(--brown); white-space: nowrap; text-align: right; }
.cad-jl-valor small { display: block; font-size: 11px; font-weight: 600; color: var(--muted); }
.cad-jl-mais { font-size: 12px; color: var(--muted); text-align: center; margin: 4px 0 10px; }


.cad-nv-data {
  position: relative; display: flex; align-items: center; gap: 12px;
  min-height: 56px; padding: 0 16px; cursor: pointer;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  color: var(--brown-dark); box-shadow: var(--shadow);
}
.cad-nv-data > i:first-child { color: var(--brown-mid); font-size: 18px; width: 20px; text-align: center; }
.cad-nv-data--ok { background: var(--cream); border-color: var(--brown-light); }
.cad-nv-data--ok > i:first-child { color: var(--brown); }
.cad-nv-data-txt { flex: 1; font-size: 17px; font-weight: 800; font-family: var(--mono); display: flex; align-items: baseline; gap: 8px; }
.cad-nv-data-txt small { font-family: var(--font); font-size: 12.5px; font-weight: 700; color: var(--brown-mid); }
.cad-nv-data-seta { color: var(--brown-mid); font-size: 12px; }
.cad-nv-data-input {
  position: absolute; inset: 0; width: 100%; height: 100%;
  opacity: 0; cursor: pointer; border: 0; padding: 0; margin: 0;
}
.cad-nv-data:active { opacity: .85; }

/* Categorias */
.cad-nv-cats { display: flex; flex-direction: column; gap: 10px; }
.cad-nv-cat {
  display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 14px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  box-shadow: var(--shadow); transition: border-color var(--t), background var(--t);
}
.cad-nv-cat.ativo { border-color: var(--green); background: var(--green-bg); }
.cad-nv-cat-emoji {
  width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0;
  background: var(--cream); display: flex; align-items: center; justify-content: center; font-size: 26px;
}
.cad-nv-cat.ativo .cad-nv-cat-emoji { background: #fff; }
.cad-nv-cat-info { flex: 1; min-width: 0; }
.cad-nv-cat-nome { font-size: 17px; font-weight: 800; color: var(--brown-dark); }
.cad-nv-cat-preco { font-size: 12.5px; color: var(--muted); font-family: var(--mono); margin-top: 2px; }
.cad-nv-cat-subtotal { font-size: 14px; font-weight: 800; color: var(--green); font-family: var(--mono); margin-top: 1px; }
.cad-nv-cat-defpreco {
  margin-top: 3px; padding: 0; border: 0; background: none; cursor: pointer;
  font-family: var(--font); font-size: 12.5px; font-weight: 800; color: var(--red);
  display: inline-flex; align-items: center; gap: 5px;
}
.cad-nv-cat .cad-stepper-btn { width: 44px; height: 44px; font-size: 22px; }
.cad-nv-cat .cad-stepper-qty { min-width: 30px; font-size: 18px; }

/* Modal de preços */
.cad-nv-precos-dica { font-size: 13px; color: var(--muted); margin: -4px 0 12px; line-height: 1.4; }
.cad-nv-preco-linha {
  display: flex; align-items: center; gap: 10px; padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.cad-nv-preco-linha:last-of-type { margin-bottom: 14px; }
.cad-nv-preco-emoji { font-size: 22px; width: 30px; text-align: center; }
.cad-nv-preco-nome { flex: 1; font-size: 15px; font-weight: 800; color: var(--brown-dark); }
.cad-nv-preco-campo {
  display: flex; align-items: center; gap: 6px; width: 130px; padding: 0 12px; height: 46px;
  background: var(--cream); border: 1.5px solid var(--border); border-radius: var(--r-sm);
  color: var(--brown-mid); font-weight: 800; font-size: 14px;
}
.cad-nv-preco-campo:focus-within { border-color: var(--brown); }
.cad-nv-preco-campo input {
  flex: 1; min-width: 0; width: 100%; border: 0; background: transparent; outline: none;
  font-family: var(--mono); font-size: 17px; font-weight: 800; color: var(--brown-dark); text-align: right;
}

/* Resumo ao confirmar */
.cad-nv-ok-topo { text-align: center; padding: 6px 16px 4px; }
.cad-nv-ok-check {
  width: 64px; height: 64px; margin: 4px auto 10px; border-radius: 50%;
  background: var(--green); color: #fff; font-size: 28px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 22px rgba(26,122,69,.3); animation: nvPop .35s var(--t-spring, ease-out);
}
@keyframes nvPop { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.cad-nv-ok-titulo { margin: 0; font-family: var(--font-hand); font-size: 26px; font-weight: 800; color: var(--brown-dark); }
.cad-nv-ok-sub { margin: 2px 0 0; font-size: 13.5px; font-weight: 700; color: var(--brown-mid); }

.cad-nv-recibo {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
  box-shadow: var(--shadow); padding: 6px 16px 14px;
}
.cad-nv-recibo-linha { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px dashed var(--border); }
.cad-nv-recibo-emoji { font-size: 24px; width: 32px; text-align: center; }
.cad-nv-recibo-desc { flex: 1; min-width: 0; }
.cad-nv-recibo-nome { font-size: 16px; font-weight: 800; color: var(--brown-dark); }
.cad-nv-recibo-unit { font-size: 12px; color: var(--muted); font-family: var(--mono); margin-top: 1px; }
.cad-nv-recibo-val { font-size: 16px; font-weight: 800; color: var(--brown-dark); font-family: var(--mono); }
.cad-nv-recibo-total {
  display: flex; align-items: baseline; justify-content: space-between; padding-top: 14px;
  font-size: 14px; font-weight: 800; color: var(--brown-mid); text-transform: uppercase; letter-spacing: .04em;
}
.cad-nv-recibo-total strong { font-size: 26px; color: var(--green); font-family: var(--mono); letter-spacing: 0; }

.cad-nv-datas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cad-nv-datas-item {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  background: var(--cream); border: 1px solid var(--border); border-radius: var(--r-md);
}
.cad-nv-datas-item > i { font-size: 18px; color: var(--brown-mid); }
.cad-nv-datas-item small { display: block; font-size: 11px; font-weight: 700; color: var(--muted); }
.cad-nv-datas-item b { font-size: 15px; font-weight: 800; color: var(--brown-dark); font-family: var(--mono); }
.cad-nv-datas-item--cobr { background: var(--gold-bg, #fff8e1); border-color: rgba(200,137,10,.3); }
.cad-nv-datas-item--cobr > i { color: var(--gold, #b8860b); }

.cad-nv-desfazer {
  align-self: center; border: 0; background: none; cursor: pointer; padding: 8px 12px;
  font-family: var(--font); font-size: 13px; font-weight: 700; color: var(--brown-mid);
  text-decoration: underline; text-underline-offset: 3px;
}
.cad-nv-desfazer:active { opacity: .7; }

/* ══ Cartão Cobrar Pix (painel) ══ */
.cad-pix-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 22px;
  box-shadow: var(--shadow-md); overflow: hidden; margin-bottom: 18px;
}
.cad-pix-card-topo {
  background: linear-gradient(155deg, var(--brown-dark) 0%, var(--brown) 70%, var(--brown-mid) 100%);
  padding: 16px 16px 18px; display: flex; flex-direction: column; align-items: center; text-align: center;
}
.cad-pix-card-titulo {
  display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.78);
}
.cad-pix-card-titulo i { color: var(--gold-light, #f2c14e); font-size: 14px; }
.cad-pix-valor-hero {
  display: flex; align-items: baseline; justify-content: center; gap: 8px;
  width: 100%; margin-top: 8px; padding: 6px 0 2px; cursor: text;
  border-bottom: 2px dashed rgba(255,255,255,.28);
}
.cad-pix-valor-hero:focus-within { border-bottom-color: var(--gold-light, #f2c14e); }
.cad-pix-valor-hero-prefixo { font-size: 22px; font-weight: 800; color: rgba(255,255,255,.7); }
.cad-pix-valor-hero-input {
  max-width: 100%; border: none; outline: none; background: transparent; padding: 0; text-align: center;
  font-family: var(--mono); font-size: 46px; line-height: 1.15; font-weight: 800; color: #fff;
  caret-color: var(--gold-light, #f2c14e);
}
.cad-pix-valor-hero-input::placeholder { color: rgba(255,255,255,.35); }
.cad-pix-valor-hero-limpar {
  margin-top: 10px; padding: 5px 12px; border: 0; border-radius: var(--r-full); cursor: pointer;
  background: rgba(255,255,255,.14); color: #fff; font-family: var(--font); font-size: 12px; font-weight: 700;
  display: inline-flex; align-items: center; gap: 6px;
}
.cad-pix-valor-hero-limpar:active { background: rgba(255,255,255,.25); }
.cad-pix-valor-hero-dica { margin: 10px 0 0; font-size: 12px; font-weight: 600; color: rgba(255,255,255,.6); }

.cad-pix-card-corpo { padding: 18px 16px 16px; display: flex; flex-direction: column; align-items: center; }
.cad-pix-card-corpo .cad-pix-qr-wrap { max-width: 230px; box-shadow: none; border: 1.5px solid var(--border); }
.cad-pix-card-corpo .cad-pix-hint { margin-top: 12px; }
.cad-pix-card-corpo .cad-pix-copiar { max-width: none; background: var(--brown-dark); border-color: var(--brown-dark); color: #fff; }
.cad-pix-card-corpo .cad-pix-copiar.copiado { background: var(--green); border-color: var(--green); }
.cad-cobr-vazio--card { margin: 0; border: 0; border-radius: 0; }

/* ── Arquivadas e cadastros repetidos ── */
.cad-arq-lista { margin: 8px 0; display: flex; flex-direction: column; gap: 6px; }
.cad-arq-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: var(--cream); border-radius: var(--r-sm); opacity: .9;
}
.cad-arq-btn {
  flex-shrink: 0; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface); color: var(--text); font-family: var(--font); font-size: 12px; font-weight: 700; cursor: pointer;
}
.cad-arq-rodape { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 0 20px; }
.cad-arq-link {
  background: none; border: none; color: var(--muted); font-family: var(--font);
  font-size: 12px; font-weight: 700; cursor: pointer; padding: 6px 10px;
}
.cad-rep-grupo { margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
.cad-rep-titulo { font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.cad-dialog-btns--col { flex-direction: column; }

/* Aviso de backup no início */
.cad-alerta-backup {
  display: flex; align-items: center; gap: 10px; margin: 8px 14px 0; padding: 10px 12px;
  background: #fff4e0; color: #8a4b00; border-radius: var(--r-sm); font-size: 12px; font-weight: 700; line-height: 1.35;
}
.cad-alerta-backup span { flex: 1; }
.cad-alerta-backup button {
  flex-shrink: 0; padding: 7px 10px; border: none; border-radius: var(--r-sm);
  background: #8a4b00; color: #fff; font-family: var(--font); font-size: 12px; font-weight: 800; cursor: pointer;
}
.cad-alerta-backup button:disabled { opacity: .6; }

/* ══ Cobranças · redesign dos cards (Aberto / Vencidos / Histórico) ══ */
.cad-resumo-seg-btn { min-width: 0; }
.cad-cli-card.atrasado { border-color: #fecaca; background: var(--surface); }
.cad-cli-faixa {
  display: flex; align-items: center; gap: 6px; padding: 6px 12px;
  background: var(--red-bg); color: var(--red); font-size: 12px; font-weight: 800;
  border-bottom: 1px solid #fecaca;
}
.cad-cli-sub { font-size: 12px; color: var(--muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-cli-valor { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; line-height: 1.15; }
.cad-cli-valor b { font-size: 16px; font-weight: 800; font-family: var(--mono); }
.cad-cli-valor small { font-size: 11px; color: var(--muted); font-weight: 600; }
.cad-cli-valor--red b { color: var(--red); }

.cad-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--r-full);
  font-size: 11px; font-weight: 800; white-space: nowrap; flex-shrink: 0;
}
.cad-chip i { font-size: 10px; }
.cad-chip--ok      { background: var(--green-bg);  color: var(--green); }
.cad-chip--warn    { background: var(--orange-bg); color: var(--orange); }
.cad-chip--red     { background: var(--red-bg);    color: var(--red); }
.cad-chip--neutral { background: var(--cream);     color: var(--muted); border: 1px solid var(--border); }

.cad-cli-kpis {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 0 12px 10px;
  overflow: hidden; transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease, padding .22s ease;
  max-height: 80px; opacity: 1;
}
.cad-cli-kpis.colapsado { max-height: 0 !important; opacity: 0; padding-top: 0; padding-bottom: 0; }
.cad-cli-kpis > div { background: var(--cream); border-radius: 8px; padding: 6px 8px; min-width: 0; }
.cad-cli-kpis small { display: block; font-size: 11px; color: var(--muted); font-weight: 600; }
.cad-cli-kpis b { font-size: 13px; font-weight: 800; font-family: var(--mono); color: var(--brown); white-space: nowrap; }

.cad-cli-btns { flex-wrap: nowrap; gap: 6px; }
.cad-btn-quitar { min-height: 44px; }
.cad-btn-zap { min-height: 44px; background: var(--surface); color: var(--green); border: 1.5px solid var(--green-dim); }
.cad-btn-venda.cad-btn-icone, .cad-btn-pix.cad-btn-icone {
  flex: 0 0 44px; width: 44px; min-width: 44px; min-height: 44px; padding: 0;
  background: var(--surface); border: 1.5px solid var(--border2); color: var(--brown); font-size: 15px;
}
.cad-btn-pix.cad-btn-icone { color: var(--teal); }

.cad-mes {
  font-size: 11px; font-weight: 700; color: var(--muted); padding: 6px 12px; margin-top: 4px;
  background: var(--cream); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.cad-compra-vence, .cad-compra-pgto-bar { margin-top: 0; }

.cad-hist-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 2px 0; }
.cad-hist-ico {
  width: 30px; height: 30px; border-radius: 50%; flex: none;
  display: flex; align-items: center; justify-content: center; font-size: 12px;
}
.cad-hist-ico--ok   { background: var(--green-bg);  color: var(--green); }
.cad-hist-ico--warn { background: var(--orange-bg); color: var(--orange); }
.cad-hist-meio { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cad-hist-estorno { font-size: 11px; font-weight: 700; color: var(--orange); }
.cad-hist-dir { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
.cad-hist-dir .cad-compra-valor { color: var(--text); }
.cad-hist-mais {
  display: block; width: 100%; background: none; border: none; cursor: pointer;
  padding: 10px 12px 12px; font-family: var(--font); font-size: 12px; font-weight: 700; color: var(--muted);
}
.cad-hist-mais:active { background: var(--cream); }

.cad-hist-info {
  display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 8px;
  border: 1px dashed var(--border2); background: var(--surface); font-size: 12px; color: var(--muted); line-height: 1.4;
}
.cad-hist-info i { margin-top: 2px; }
.cad-hist-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: -4px; }
/* Cobranças · cabeçalho fixo (Todos/Vencidos + busca), loja e cliente */
.cad-hdr-pill {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; min-height: 36px; padding: 0 14px;
  border-radius: var(--r-full); border: 1.5px solid var(--border2); background: var(--surface); color: var(--brown-mid);
  font-family: var(--font); font-size: 13px; font-weight: 800; cursor: pointer;
}
.cad-hdr-pill:active { background: var(--cream); }
.cad-hdr .cad-resumo-seg-btn {
  flex-direction: row; flex-wrap: wrap; justify-content: center; align-content: center; align-items: baseline;
  column-gap: 6px; row-gap: 0; min-height: 44px; padding: 6px 8px;
}
.cad-hdr .cad-resumo-seg-label { font-size: 12px; text-transform: none; letter-spacing: 0; font-weight: 800; }
.cad-hdr .search-wrap { margin: 8px 0 0; }
.cad-hdr .search-input { min-height: 42px; padding-top: 8px; padding-bottom: 8px; font-size: .86rem; }
.cad-sit-chips { display: flex; gap: 6px; overflow-x: auto; margin-top: 10px; scrollbar-width: none; }
.cad-sit-chips::-webkit-scrollbar { display: none; }
.cad-loja-nome small { margin-top: 1px; }
.cad-loja-dir { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.cad-cli-status { font-weight: 600; }
.cad-cli-status--red { color: var(--red); font-weight: 800; }
.cad-cli-status--warn { color: var(--orange); font-weight: 800; }
.cad-cli-zap {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 19px;
  background: var(--surface); color: var(--green); border: 1.5px solid var(--green-dim);
}
.cad-cli-zap:active { background: var(--green-bg); }
.cad-chip-btn {
  display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 2px; border: none; background: none;
  color: var(--brown); font-family: var(--font); font-size: 11px; font-weight: 800; cursor: pointer;
}
.cad-hist-chip {
  min-height: 34px; padding: 0 14px; border-radius: var(--r-full); border: 1px solid var(--border);
  background: var(--surface); color: var(--muted); font-family: var(--font); font-size: 12px; font-weight: 700; cursor: pointer;
}
.cad-hist-chip.active { background: var(--brown-dark); border-color: var(--brown-dark); color: var(--cream); }

.cad-det-estornos .cad-det-pagtos-titulo { color: var(--orange); }
.cad-det-est-sub { display: block; font-size: 11px; color: var(--muted); font-weight: 600; }
.cad-det-pagto-val--est { color: var(--orange); }
.cad-det-sem-pagto { font-size: 12px; color: var(--muted); margin: 8px 2px 0; }

/* ── Telas pequenas / números grandes (ex.: 1.000+ compras, R$ 12.345,67) ── */
.cad-resumo-seg-btn { overflow: hidden; }
.cad-resumo-seg-val {
  max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: clamp(11px, 3.7vw, 14px);
}
.cad-cli-kpis { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 1fr); }
.cad-cli-kpis b { display: block; overflow: hidden; text-overflow: ellipsis; font-size: clamp(11px, 3.4vw, 13px); }
.cad-cli-nome { min-width: 0; }
.cad-hist-meio, .cad-hist-row { min-width: 0; }
.cad-hist-meio { overflow-wrap: anywhere; }
.cad-hist-dir { max-width: 48%; }
.cad-hist-dir .cad-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.cad-hist-dir .cad-compra-valor { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 360px) {
  .cad-chip-extra { display: none; }
  .cad-cli-header { gap: 8px; padding: 10px; }
  .cad-cli-avatar { width: 36px; height: 36px; }
  .cad-cli-valor b { font-size: 15px; }
}
</style>