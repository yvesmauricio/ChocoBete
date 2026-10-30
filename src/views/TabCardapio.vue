<template>
  <div class="tab-caderneta cardapio-tab" :class="{ 'cp-bete': props.standalone }">

    <!-- Cabeçalho: no perfil da Bete usa a identidade "caderninho" (mesma
         do Início); no perfil do Yves mantém o cabeçalho padrão das abas.
         O seletor de cardápio (Dia a dia/Festa) saiu daqui — competia
         espaço com o título — e virou a faixa de abas .cp-tabs logo
         abaixo, que também responde a swipe no conteúdo. -->
    <template v-if="props.standalone">
      <div class="cad-spiral">
        <span v-for="n in 12" :key="n"></span>
      </div>
      <div class="cad-hdr">
        <div class="cad-hdr-row">
          <div class="cad-hdr-titulo-group">
            <button class="cad-hdr-icon-btn" @click="emit('fechar')" title="Voltar">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div>
              <h2 class="cad-hdr-titulo"><i class="fas fa-book-bookmark"></i> Cardápio</h2>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-book-bookmark"></i> Cardápio Digital</h2>
      </div>
    </div>

    <div class="cad-body cp-body">

      <!-- ── Enviar / compartilhar (GLOBAL, fora das abas Festa/Dia a dia) ── 
           Modo balcão + enviar + link + atalhos. Ficam antes das abas porque
           são ações gerais; as abas abaixo só tratam do conteúdo de cada cardápio.
          
           "Enviar cardápio" já atualiza o link (se a publicação estiver configurada) e abre o
           compartilhamento. "Atualizar link" só republica, sem enviar a ninguém: serve pra quem
           já divulgou o link (bio do Instagram, status) e quer que ele mostre as mudanças de agora. -->
      <section class="cx-compartilhar">
        <button class="cx-balcao" @click="telaCheiaAberta = true">
          <span class="cx-balcao-ico"><i class="fas fa-expand"></i></span>
          <span class="cx-balcao-txt"><strong>Abrir cardápio em tela cheia</strong><small>Para mostrar ao cliente no balcão</small></span>
          <i class="fas fa-chevron-right cx-balcao-seta"></i>
        </button>

        <div class="cx-card">
          <div class="cx-card-cab">
            <span class="cx-tile cx-tile--ouro"><i class="fas fa-share-nodes"></i></span>
            <div class="cx-card-tit">
              <h3>Enviar ao cliente</h3>
              <p>{{ publicacaoDisponivel ? 'Atualiza o link do cardápio e abre o WhatsApp (ou outro app) para você enviar.' : 'Gera o cardápio e abre o WhatsApp (ou outro app) para você enviar.' }}</p>
            </div>
          </div>
          <button class="cx-btn-enviar" :disabled="gerandoPedidoInterativo" @click="gerarCardapioInterativo">
            <i class="fas" :class="gerandoPedidoInterativo ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
            {{ gerandoPedidoInterativo ? 'Preparando…' : 'Enviar cardápio' }}
          </button>

          <div v-if="publicacaoDisponivel" class="cx-link">
            <div class="cx-link-cab">
              <span class="cx-link-lbl"><i class="fas fa-link"></i> Link do cardápio</span>
              <span v-if="linkStatus === 'publicando'" class="cx-status cx-status--espera"><i class="fas fa-spinner fa-spin"></i> Atualizando…</span>
              <span v-else-if="linkStatus === 'aguardando'" class="cx-status cx-status--espera"><i class="fas fa-clock"></i> Propagando</span>
              <span v-else-if="linkStatus === 'pronto'" class="cx-status cx-status--ok"><i class="fas fa-circle-check"></i> Atualizado</span>
            </div>
            <div class="cx-link-seg" role="tablist" aria-label="Tipo de link">
              <button v-for="o in opcoesLink" :key="o.id" type="button" role="tab" class="cx-link-seg-btn"
                :class="{ 'cx-link-seg-btn--on': tipoLink === o.id }" :aria-selected="tipoLink === o.id" @click="escolherTipoLink(o.id)">{{ o.label }}</button>
            </div>
            <a v-if="urlLinkAtual" :href="urlLinkAtual" class="cx-link-url" @click.prevent="abrirCardapioPublicado">
              <span>{{ urlLinkAtual.replace('https://', '').replace('http://', '') }}</span>
              <i class="fas fa-arrow-up-right-from-square"></i>
            </a>
            <p class="cx-link-dica">{{ opcoesLink.find(o => o.id === tipoLink)?.dica }}</p>
            <p v-if="linkStatus === 'aguardando'" class="cx-link-aviso">Publicado! Espere um pouquinho antes de mandar o link ao cliente.</p>
            <p v-else-if="linkStatus === 'pronto'" class="cx-link-aviso cx-link-aviso--ok">Pronto! O link já deve estar atualizado, pode enviar.</p>
            <div class="cx-link-btns">
              <button class="cx-btn-sec" :disabled="!urlLinkAtual" @click="copiarLinkPublicado">
                <i class="fas fa-copy"></i> Copiar link
              </button>
              <button class="cx-btn-sec" :disabled="publicandoLink || linkStatus === 'aguardando'" @click="publicarLinkCardapioInterativo"
                title="Atualiza o link que você já divulgou (bio, status) com as mudanças de agora, sem enviar nada a ninguém">
                <i class="fas" :class="publicandoLink ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'"></i>
                {{ publicandoLink ? 'Atualizando…' : linkStatus === 'aguardando' ? `Atualizar (${linkSegundosRestantes}s)` : 'Atualizar link' }}
              </button>
            </div>
            <p class="cx-nota">Mudou preço ou item? Toque em <strong>Atualizar link</strong>: quem já tem o link (bio do Instagram, status) passa a ver a versão nova. Suas edições ficam salvas aqui na hora, mas só vão para o link quando você atualiza.</p>
          </div>
          <p v-else class="cx-nota cx-nota--solta">Para enviar um <strong>link</strong> em vez de um arquivo, configure a publicação em <button type="button" class="cp-link-inline" @click="s.setTab('ajustes')">Ajustes → Sistema</button>.</p>
        </div>

        <div class="cx-atalhos">
          <button class="cx-atalho" @click="abrirPainelPedidos">
            <i class="fas fa-clipboard-list"></i><span>Pedidos</span>
            <span v-if="pedidosPendentesCount" class="cx-badge">{{ pedidosPendentesCount }}</span>
          </button>
          <button class="cx-atalho" @click="configModalAberto = true">
            <i class="fas fa-gear"></i><span>Configurações</span>
          </button>
        </div>
      </section>

    <!-- ── Abas do cardápio ── indicador claro de qual cardápio está
         aberto (nome + ícone + traço embaixo), e ao mesmo tempo o "alvo"
         visual do swipe: arrasta o dedo pra esquerda/direita em qualquer
         ponto do conteúdo abaixo pra trocar. Tocar na aba também troca,
         pra quem prefere/usa mouse. -->
    <div class="cp-tabs cp-tabs--sticky" :style="{ '--cp-seg-count': CARDAPIOS.length, '--cp-seg-index': cardapioAtivoIndex }">
      <span class="cp-tabs-underline"></span>
      <button v-for="c in CARDAPIOS" :key="c.id" class="cp-tab" :class="{ active: cardapioAtivo === c.id }"
        @click="trocarCardapio(c.id)">
        <i class="fas" :class="c.icone"></i> {{ c.label }}
      </button>
    </div>


      <div class="cp-conteudo" @touchstart.passive="onSwipeStart" @touchend="onSwipeEnd">


      <p v-if="!todosItensAtivos.length" class="cp-aviso">
        <i class="fas fa-circle-info"></i> Nenhum item ativo ainda — ative pelo menos uma receita na lista abaixo pra gerar o cardápio.
      </p>

      <!-- ── Busca ── -->
      <div class="cad-search-bar">
        <div class="cad-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="cad-search-input" placeholder="Buscar receita..." v-model="busca">
        </div>
      </div>

      <div v-if="!gruposFiltrados.length" class="cad-empty">
        <div class="cad-empty-ico"><i class="fas fa-cookie-bite"></i></div>
        <p v-if="!todosGrupos.length">Nenhuma receita cadastrada ainda. Cadastre na aba Receitas pra montar seu cardápio.</p>
        <p v-else>Nenhum sabor encontrado.</p>
      </div>

      <!-- ── Lista por categoria ── -->
      <div v-else class="cp-grupos">
        <div v-for="grupo in gruposFiltrados" :key="grupo.categoria" class="cp-grupo">
          <div class="cp-grupo-cabecalho">
            <div class="cp-grupo-titulo-bloco">
              <div class="cp-grupo-titulo">{{ grupo.categoria }}</div>
              <div v-if="categoriaTemMinimo(grupo.categoria) || grupoEstado(grupo) !== 'ativa'" class="cp-grupo-tags">
                <span v-if="categoriaTemMinimo(grupo.categoria)" class="cp-grupo-selo-minimo">
                  <i class="fas fa-sack-dollar"></i> mín. {{ categoriaMinimoLabel(grupo.categoria) }}
                </span>
                <span v-if="grupoEstado(grupo) === 'parcial'" class="cp-grupo-selo-estado cp-grupo-selo-estado--parcial">
                  {{ grupoEstadoLabel(grupo) }}
                </span>
                <span v-else-if="grupoEstado(grupo) === 'oculta'" class="cp-grupo-selo-estado cp-grupo-selo-estado--oculta">
                  Categoria oculta
                </span>
              </div>
            </div>
            <div class="cp-grupo-cabecalho-acoes">
              <button type="button" class="cp-grupo-opcoes-btn" @click="abrirOpcoesGrupo(grupo)" title="Opções da categoria (mínimo e preço em massa)">
                <i class="fas fa-ellipsis-vertical"></i>
              </button>
              <button type="button" class="cp-switch-btn" @click="alternarGrupo(grupo)" :title="grupoEstadoLabel(grupo)">
                <span class="cp-switch" :class="{ on: grupoEstado(grupo) !== 'oculta', partial: grupoEstado(grupo) === 'parcial' }"><span class="cp-switch-bola"></span></span>
              </button>
            </div>
          </div>

          <div v-for="r in grupo.itens" :key="r.uuid" class="cp-item" :class="{ 'cp-item--inativo': !itemCfg(r.uuid).ativo }">
            <div class="cp-item-topo">
              <button class="cp-switch-btn" @click="itemCfg(r.uuid).ativo = !itemCfg(r.uuid).ativo; salvar()">
                <span class="cp-switch" :class="{ on: itemCfg(r.uuid).ativo }"><span class="cp-switch-bola"></span></span>
              </button>

              <!-- Tocar na foto já abre a escolha de imagem: o caminho mais curto pra trocar a foto -->
              <label class="cp-item-avatar cx-avatar" :title="itemCfg(r.uuid).foto ? 'Trocar foto' : 'Adicionar foto'">
                <input type="file" accept="image/*" hidden @change="e => onFotoSelecionada(r, e)">
                <img v-if="itemCfg(r.uuid).foto" :src="itemCfg(r.uuid).foto" alt="">
                <span v-else>{{ itemCfg(r.uuid).emoji || '🍫' }}</span>
                <span class="cx-avatar-cam"><i class="fas fa-camera"></i></span>
              </label>

              <button class="cp-item-corpo" @click="expandido = expandido === r.uuid ? null : r.uuid">
                <div class="cp-item-linha1">
                  <span class="cp-item-nome">{{ r.nome }}</span>
                  <span class="cp-item-preco">{{ R$(precoExibido(r)) }}</span>
                </div>
                <div v-if="itemCfg(r.uuid).destaque || itemCfg(r.uuid).sob_encomenda" class="cp-item-selos">
                  <span v-if="itemCfg(r.uuid).destaque" class="cp-item-selo-destaque"><i class="fas fa-star"></i> Mais pedido</span>
                  <span v-if="itemCfg(r.uuid).sob_encomenda" class="cp-item-selo-encomenda"><i class="fas fa-clock"></i> Sob encomenda</span>
                </div>
                <div v-if="itemCfg(r.uuid).descricao" class="cp-item-desc">{{ itemCfg(r.uuid).descricao }}</div>
              </button>

              <button class="cp-item-expand" @click="expandido = expandido === r.uuid ? null : r.uuid">
                <i class="fas" :class="expandido === r.uuid ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
              </button>
            </div>

<!-- Painel expandido: blocos curtos e rotulados, na ordem em que a pessoa mexe -->
            <div v-if="expandido === r.uuid" class="cp-item-painel cx-painel">

              <div class="cx-bloco">
                <div class="cx-bloco-tit"><i class="fas fa-camera"></i> Foto</div>
                <div class="cx-foto">
                  <div class="cx-foto-prev">
                    <img v-if="itemCfg(r.uuid).foto" :src="itemCfg(r.uuid).foto" alt="">
                    <span v-else>{{ itemCfg(r.uuid).emoji || '🍫' }}</span>
                  </div>
                  <div class="cx-foto-btns">
                    <label class="cx-btn-sec cx-btn-upload">
                      <input type="file" accept="image/*" hidden @change="e => onFotoSelecionada(r, e)">
                      <i class="fas fa-camera"></i> {{ itemCfg(r.uuid).foto ? 'Trocar foto' : 'Adicionar foto' }}
                    </label>
                    <button v-if="itemCfg(r.uuid).foto" class="cx-btn-sec cx-btn-perigo" @click="itemCfg(r.uuid).foto = null; salvar()">
                      <i class="fas fa-trash"></i> Remover
                    </button>
                  </div>
                </div>
                <details class="cx-saiba">
                  <summary>Quais fotos funcionam?</summary>
                  <p>JPG, PNG ou WEBP, qualquer tamanho — é redimensionada e comprimida automaticamente. Fotos de iPhone em HEIC podem não abrir; se der problema, exporte como JPG antes.</p>
                </details>
                <label v-if="!itemCfg(r.uuid).foto" class="cp-field cx-emoji-campo">
                  <span>Sem foto? Escolha um emoji</span>
                  <input v-model="itemCfg(r.uuid).emoji" maxlength="4" @change="salvar">
                </label>
              </div>

              <div class="cx-bloco">
                <div class="cp-field-cabecalho">
                  <div class="cx-bloco-tit"><i class="fas fa-align-left"></i> Descrição curta</div>
                  <span class="cx-contador">{{ (itemCfg(r.uuid).descricao || '').length }}/120</span>
                </div>
                <textarea v-model="itemCfg(r.uuid).descricao" maxlength="120" rows="2" class="cx-textarea"
                  placeholder="Ex: trufa de chocolate belga com recheio de doce de leite"
                  @change="salvar"></textarea>
                <div class="cp-field-cabecalho-btns">
                  <button type="button" class="cp-copiar-btn" @click="abrirCopiarDeOutroItem(r)">
                    <i class="fas fa-copy"></i> Copiar de outro item
                  </button>
                  <button type="button" class="cp-ia-btn" @click="copiarPromptDescricao(r)">
                    <i class="fas fa-wand-magic-sparkles"></i> Pedir ideia à IA
                  </button>
                </div>
              </div>

              <div class="cx-bloco">
                <label class="cp-field">
                  <span class="cx-bloco-tit">
                    <i class="fas fa-tag"></i> Preço no cardápio
                    <button type="button" class="cp-hist-preco-btn" title="Ver histórico de preços" aria-label="Ver histórico de preços" @click="abrirHistoricoPreco(r)">
                      <i class="fas fa-clock-rotate-left"></i>
                    </button>
                  </span>
                  <div class="input-with-prefix">
                    <span class="input-prefix">R$</span>
                    <input
                      :value="maskMoney(precoExibido(r))"
                      @input="e => digitarPreco(r, e.target.value)"
                      @change="confirmarPreco(r)"
                      @blur="confirmarPreco(r)"
                      @keyup.enter="e => e.target.blur()"
                      @focus="e => e.target.select()"
                      class="input input-prefixed" type="text" inputmode="numeric" placeholder="0,00"
                    >
                  </div>
                  <div class="cx-nota">Esse preço também atualiza o preço de venda sugerido na receita.</div>
                </label>
              </div>

              <div class="cx-bloco cx-bloco--lista">
                <label class="cx-linha-switch">
                  <span class="cx-linha-txt"><strong><i class="fas fa-star"></i> Marcar como “Mais pedido”</strong><small>Aparece com uma estrelinha no cardápio.</small></span>
                  <input type="checkbox" role="switch" class="cx-switch" v-model="itemCfg(r.uuid).destaque" @change="salvar">
                </label>
                <label class="cx-linha-switch">
                  <span class="cx-linha-txt"><strong><i class="fas fa-clock"></i> Sob encomenda</strong><small>Sem entrega na hora: o cliente vê o aviso.</small></span>
                  <input type="checkbox" role="switch" class="cx-switch" v-model="itemCfg(r.uuid).sob_encomenda" @change="salvar">
                </label>
                <details v-if="itemCfg(r.uuid).sob_encomenda" class="cx-saiba cx-saiba--dentro">
                  <summary>Como isso funciona?</summary>
                  <p>Continua visível e pedível no cardápio, só que com o aviso “Sob encomenda” — o cliente já sabe que precisa esperar. Usa o mesmo prazo e sinal configurados em Configurações → Pedidos e pagamento deste cardápio.</p>
                </details>
              </div>

              <div class="cx-ordem">
                <span class="cx-ordem-lbl">Posição na lista</span>
                <div class="cx-ordem-btns">
                  <button type="button" class="cx-btn-sec" @click="mover(r, -1)"><i class="fas fa-arrow-up"></i> Subir</button>
                  <button type="button" class="cx-btn-sec" @click="mover(r, 1)"><i class="fas fa-arrow-down"></i> Descer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- ══ CONFIGURAÇÕES DO CARDÁPIO (modal) ══════════════════════════
         Tudo que se configura uma vez e raramente se mexe de novo — fica
         separado da lista de itens, que é o que se usa no dia a dia. -->
    <BaseModal v-if="configModalAberto" @close="configModalAberto = false">
      <template #title>
        <span class="cp-modal-titulo">
          Configurações
          <span class="cp-modal-titulo-badge"><i class="fas" :class="cardapioAtivoObj?.icone"></i> {{ cardapioAtivoObj?.label }}</span>
        </span>
      </template>
      <div class="cp-modal-config-body">

        <!-- ── Capa e textos ── -->
        <div class="cx-sec">
          <button class="cx-sec-cab" :aria-expanded="configAberta" @click="configAberta = !configAberta">
            <span class="cx-tile"><i class="fas fa-pen"></i></span>
            <span class="cx-sec-txt"><strong>Capa e textos</strong><small>{{ config.nome_cardapio || s.company.nome || 'Meu cardápio' }}</small></span>
            <i class="fas cx-seta" :class="configAberta ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>
          <div v-if="configAberta" class="cx-sec-corpo">
            <label class="cp-field">
              <span>Nome do cardápio</span>
              <input v-model="config.nome_cardapio" :placeholder="s.company.nome || 'Meu cardápio'" @change="salvar">
            </label>
            <label class="cp-field">
              <span>Subtítulo</span>
              <input v-model="config.subtitulo" placeholder="Chocolates Artesanais" @change="salvar">
            </label>
            <label class="cp-field">
              <span>Mensagem no rodapé</span>
              <input v-model="config.mensagem_rodape" placeholder="Peça já e encomende o seu! 🍫" @change="salvar">
            </label>
            <p class="cx-nota">O contato do rodapé é o mesmo texto configurado em Ajustes → dados usados na etiqueta.</p>
          </div>
        </div>

        <!-- ── Pedidos e pagamento ── -->
        <div class="cx-sec">
          <button class="cx-sec-cab" :aria-expanded="politicaAberta" @click="politicaAberta = !politicaAberta">
            <span class="cx-tile"><i class="fas fa-clock"></i></span>
            <span class="cx-sec-txt">
              <strong>Pedidos e pagamento</strong>
              <small>{{ config.antecedencia_dias ? config.antecedencia_dias + ' dia(s) de antecedência' : 'Sem aviso de prazo' }}{{ config.sinal_ativo ? ' · sinal de ' + config.sinal_percentual + '%' : '' }}</small>
            </span>
            <i class="fas cx-seta" :class="politicaAberta ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>
          <div v-if="politicaAberta" class="cx-sec-corpo">
            <label class="cp-field cp-field--dias">
              <span>Antecedência mínima para encomendas</span>
              <div class="cp-dias-linha">
                <input class="input" type="number" min="0" v-model.number="config.antecedencia_dias" @change="salvar">
                <span class="cp-dias-sufixo">dia(s) — 0 pra não mostrar aviso</span>
              </div>
            </label>

            <div class="cx-bloco--lista">
              <label class="cx-linha-switch">
                <span class="cx-linha-txt"><strong>Exigir sinal para confirmar</strong><small>O cliente paga uma parte antes.</small></span>
                <input type="checkbox" role="switch" class="cx-switch" v-model="config.sinal_ativo" @change="salvar">
              </label>
              <label class="cx-linha-switch">
                <span class="cx-linha-txt"><strong>Pagamento no cardápio</strong><small>Mostra recebimento, pagamento e Pix ao cliente.</small></span>
                <input type="checkbox" role="switch" class="cx-switch" v-model="config.pagamento_ativo" @change="salvar">
              </label>
            </div>
            <details class="cx-saiba">
              <summary>E se eu desligar o pagamento?</summary>
              <p>Desligado, o cliente apenas seleciona os produtos, confere o total e envia o pedido pelo WhatsApp. Não aparecem as etapas de recebimento, pagamento ou Pix.</p>
            </details>

            <label v-if="config.sinal_ativo && config.pagamento_ativo" class="cp-field cp-field--dias">
              <span>Porcentagem cobrada como sinal via Pix</span>
              <div class="cp-dias-linha">
                <input class="input" type="number" min="1" max="100" v-model.number="config.sinal_percentual" @change="salvar">
                <span class="cp-dias-sufixo">% do total — o valor do sinal e o código Pix são calculados sozinhos</span>
              </div>
            </label>

            <label v-if="config.sinal_ativo && config.pagamento_ativo" class="cp-field">
              <span>Texto explicando o sinal (aparece no cardápio)</span>
              <textarea v-model="config.sinal_texto" maxlength="220" rows="3"
                placeholder="Ex: Encomendas confirmadas mediante pagamento de um sinal de 50%. Após a confirmação, o sinal não é reembolsável, pois é usado para a compra dos insumos da sua encomenda."
                @change="salvar"></textarea>
            </label>

            <details class="cx-saiba">
              <summary>Onde esse aviso aparece? E o Pix?</summary>
              <p>Esse aviso aparece automaticamente: como uma caixa destacada no cardápio completo (PDF e tela cheia), como um resumo curto no rodapé de cada foto compartilhada, e como uma foto extra só com essas regras no fim do álbum enviado pro WhatsApp.</p>
              <p v-if="config.pagamento_ativo"><i class="fas fa-credit-card"></i> O botão de Pix no cardápio interativo usa sua chave do tipo telefone — o mesmo número de WhatsApp para receber pedidos, sem cadastro extra. {{ config.sinal_ativo ? 'Com o sinal ativo, ele cobra só a porcentagem definida acima; o restante fica combinado pra entrega.' : 'Sem sinal ativo, ele cobra o valor total do pedido.' }}</p>
            </details>
          </div>
        </div>

        <!-- ── Retirada e entrega (só existe no cardápio Dia a dia) ── -->
        <div v-if="cardapioAtivo === 'diaadia'" class="cx-sec">
          <button class="cx-sec-cab" :aria-expanded="entregaAberta" @click="entregaAberta = !entregaAberta">
            <span class="cx-tile"><i class="fas fa-motorcycle"></i></span>
            <span class="cx-sec-txt"><strong>Retirada e entrega</strong><small>Taxa de entrega: R$ {{ maskMoney(config.taxa_entrega) || '0,00' }}</small></span>
            <i class="fas cx-seta" :class="entregaAberta ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>
          <div v-if="entregaAberta" class="cx-sec-corpo">
            <label class="cp-field cp-field--dias">
              <span>Taxa de entrega</span>
              <div class="cp-dias-linha">
                <span class="cp-dias-sufixo">R$</span>
                <input
                  class="input" type="text" inputmode="numeric" placeholder="0,00"
                  :value="maskMoney(config.taxa_entrega)"
                  @input="e => config.taxa_entrega = parseMoney(e.target.value)"
                  @change="salvar"
                >
              </div>
            </label>
            <details class="cx-saiba">
              <summary>Como a taxa aparece pro cliente?</summary>
              <p>Esse valor aparece pro cliente quando ele escolhe “Receber em casa” no cardápio interativo. Deixe 0 se ainda não tiver um valor definido — nesse caso o cardápio mostra “a combinar” em vez de cobrar errado.</p>
            </details>
          </div>
        </div>

        <!-- ── Aparência e comportamento ── -->
        <div class="cx-sec">
          <button class="cx-sec-cab" :aria-expanded="aparenciaAberta" @click="aparenciaAberta = !aparenciaAberta">
            <span class="cx-tile"><i class="fas fa-sliders"></i></span>
            <span class="cx-sec-txt"><strong>Aparência e comportamento</strong><small>Fotos nos itens: {{ config.mostrar_foto_itens !== false ? 'sim' : 'não' }}</small></span>
            <i class="fas cx-seta" :class="aparenciaAberta ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>
          <div v-if="aparenciaAberta" class="cx-sec-corpo">
            <div class="cx-bloco--lista">
              <button type="button" class="cx-linha-switch" role="switch" :aria-checked="!!config.abrir_tela_cheia_padrao" @click="config.abrir_tela_cheia_padrao = !config.abrir_tela_cheia_padrao; salvar()">
                <span class="cx-linha-txt"><strong><i class="fas fa-store"></i> Abrir sempre em tela cheia</strong><small>Ideal pra deixar o celular no balcão. Pra editar, toque no X da tela cheia.</small></span>
                <span class="cp-switch" :class="{ on: config.abrir_tela_cheia_padrao }"><span class="cp-switch-bola"></span></span>
              </button>
              <button type="button" class="cx-linha-switch" role="switch" :aria-checked="config.mostrar_foto_itens !== false" @click="config.mostrar_foto_itens = config.mostrar_foto_itens === false; salvar()">
                <span class="cx-linha-txt"><strong><i class="fas fa-image"></i> Mostrar foto em cada sabor</strong><small>Desligado, só o banner da categoria aparece. As fotos continuam guardadas.</small></span>
                <span class="cp-switch" :class="{ on: config.mostrar_foto_itens !== false }"><span class="cp-switch-bola"></span></span>
              </button>
            </div>

            <div class="cx-linha-fixa">
              <span class="cx-linha-txt"><strong><i class="fas fa-thumbtack"></i> Cardápio que abre primeiro</strong><small>Qual já vem selecionado quando você entra aqui.</small></span>
              <div class="cp-aba-padrao-grupo">
                <button
                  v-for="c in CARDAPIOS" :key="c.id"
                  type="button" class="cp-aba-padrao-btn" :class="{ active: abaPadrao === c.id }"
                  @click="definirAbaPadrao(c.id)"
                >{{ c.label }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Avançado: PDF ── -->
        <div class="cx-sec">
          <button class="cx-sec-cab" :aria-expanded="avancadoAberta" @click="avancadoAberta = !avancadoAberta">
            <span class="cx-tile"><i class="fas fa-toolbox"></i></span>
            <span class="cx-sec-txt"><strong>Avançado</strong><small>Resumo em PDF</small></span>
            <i class="fas cx-seta" :class="avancadoAberta ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>
          <div v-if="avancadoAberta" class="cx-sec-corpo">
            <div class="cx-linha-fixa">
              <span class="cx-linha-txt"><strong><i class="fas fa-file-pdf"></i> Resumo em PDF</strong><small>Folha única (A5) com QR code pro cardápio online. Para quem prefere ver tudo numa folha só.</small></span>
              <button class="cx-btn-sec" :disabled="gerandoPdf" @click="baixarPdf">
                <i class="fas" :class="gerandoPdf ? 'fa-spinner fa-spin' : 'fa-file-pdf'"></i> {{ gerandoPdf ? 'Gerando…' : 'Baixar' }}
              </button>
            </div>
            <p v-if="!urlCardapioPublicado" class="cx-nota">
              O QR code só aparece se o cardápio online estiver publicado — sem isso, sai só o rodapé de texto. <button type="button" class="cp-link-inline" @click="s.setTab('ajustes')">Configurar publicação</button>
            </p>
          </div>
        </div>

      </div>
    </BaseModal>

    <!-- ══ OPÇÕES DA CATEGORIA (pedido mínimo + preço em massa) ══ -->
    <BaseModal v-if="opcoesGrupoAberto" :title="opcoesGrupoAberto.categoria" @close="fecharOpcoesGrupo">
      <div class="cp-opcoes-grupo">
        <section class="cp-opcoes-secao">
          <div class="cp-opcoes-secao-titulo"><i class="fas fa-pen"></i> Nome da categoria</div>
          <p class="cp-opcoes-secao-hint">Muda o nome em tudo que usa essa categoria: aqui no editor, no PDF, na imagem, no link publicado e no cardápio enviado pro cliente.</p>
          <label class="cp-grupo-minimo-campo cp-opcoes-campo-preco">
            <span>Nome</span>
            <input
              v-model="novoNomeCategoria"
              class="input" type="text" maxlength="40"
              @keyup.enter="renomearCategoria(opcoesGrupoAberto)"
            >
          </label>
          <button
            type="button" class="cp-acao cp-acao--principal cp-opcoes-btn-aplicar"
            :disabled="!novoNomeCategoria.trim() || novoNomeCategoria.trim() === opcoesGrupoAberto.categoria"
            @click="renomearCategoria(opcoesGrupoAberto)"
          >
            Salvar nome
          </button>
        </section>

        <div class="cp-opcoes-divisor"></div>

        <section class="cp-opcoes-secao">
          <div class="cp-opcoes-secao-titulo"><i class="fas fa-image"></i> Imagem da categoria</div>
          <p class="cp-opcoes-secao-hint">Aparece como banner com o título no cardápio digital. Sem imagem aqui, usa a foto do primeiro sabor que tiver foto.</p>
          <div class="cp-capa-previa" :class="{ vazio: !imagemDaCategoria(opcoesGrupoAberto) }">
            <img v-if="imagemDaCategoria(opcoesGrupoAberto)" :src="imagemDaCategoria(opcoesGrupoAberto)" alt="">
            <div v-else class="cp-capa-previa-vazio"><i class="fas fa-image"></i><span>Sem imagem escolhida</span></div>
            <div class="cp-capa-previa-titulo">{{ opcoesGrupoAberto.categoria }}</div>
          </div>
          <div class="cp-capa-acoes">
            <label class="cp-acao cp-acao--principal cp-capa-btn">
              <input type="file" accept="image/*" hidden @change="e => onImagemCategoria(opcoesGrupoAberto, e)">
              <i class="fas fa-camera"></i> {{ config.categorias_img?.[opcoesGrupoAberto.categoria] ? 'Trocar imagem' : 'Escolher imagem' }}
            </label>
            <button v-if="config.categorias_img?.[opcoesGrupoAberto.categoria]" type="button" class="cp-remover-foto" @click="removerImagemCategoria(opcoesGrupoAberto)">
              Remover
            </button>
          </div>
        </section>

        <div class="cp-opcoes-divisor"></div>

        <section class="cp-opcoes-secao">
          <div class="cp-opcoes-secao-titulo"><i class="fas fa-sack-dollar"></i> Pedido mínimo</div>
          <p class="cp-opcoes-secao-hint">O cliente precisa atingir esse valor ou essa quantidade só de itens desta categoria pra poder fechar o pedido.</p>
          <div class="cp-grupo-minimo-form">
            <label class="cp-grupo-minimo-campo">
              <span>R$ mínimo</span>
              <input
                type="number" min="0" step="1" class="cp-grupo-minimo-input"
                :value="categoriaMinimo(opcoesGrupoAberto.categoria)?.valor || ''"
                placeholder="0"
                @change="e => definirCategoriaMinimo(opcoesGrupoAberto.categoria, 'valor', e.target.value)"
              >
            </label>
            <label class="cp-grupo-minimo-campo">
              <span>Unidades mín.</span>
              <input
                type="number" min="0" step="1" class="cp-grupo-minimo-input"
                :value="categoriaMinimo(opcoesGrupoAberto.categoria)?.unidades || ''"
                placeholder="0"
                @change="e => definirCategoriaMinimo(opcoesGrupoAberto.categoria, 'unidades', e.target.value)"
              >
            </label>
          </div>
          <button v-if="categoriaTemMinimo(opcoesGrupoAberto.categoria)" type="button" class="cp-link cp-link--perigo" @click="removerCategoriaMinimo(opcoesGrupoAberto.categoria)">
            remover pedido mínimo
          </button>
        </section>

        <div class="cp-opcoes-divisor"></div>

        <!-- Preço em massa: define um preço só e aplica pra todos os itens
             dessa categoria de uma vez (ex: toda a categoria "Barra" passa a
             custar R$ 12 — sem editar item por item). Dá pra ajustar algum
             item específico depois, individualmente, como sempre. -->
        <section class="cp-opcoes-secao">
          <div class="cp-opcoes-secao-titulo"><i class="fas fa-tags"></i> Preço em massa</div>
          <p class="cp-opcoes-secao-hint">Define um preço só e aplica de uma vez pra todos os {{ opcoesGrupoAberto.itens.length }} {{ opcoesGrupoAberto.itens.length === 1 ? 'item' : 'itens' }} desta categoria.</p>
          <label class="cp-grupo-minimo-campo cp-opcoes-campo-preco">
            <span>Novo preço pra todos</span>
            <div class="input-with-prefix">
              <span class="input-prefix">R$</span>
              <input
                :value="precoCategoriaValor"
                @input="e => precoCategoriaValor = maskMoney(e.target.value)"
                @keyup.enter="aplicarPrecoCategoria(opcoesGrupoAberto)"
                class="input input-prefixed" type="text" inputmode="numeric" placeholder="0,00"
              >
            </div>
          </label>
          <button type="button" class="cp-acao cp-acao--principal cp-opcoes-btn-aplicar" @click="aplicarPrecoCategoria(opcoesGrupoAberto)">
            Aplicar a {{ opcoesGrupoAberto.itens.length }} {{ opcoesGrupoAberto.itens.length === 1 ? 'item' : 'itens' }}
          </button>
        </section>
      </div>
    </BaseModal>

    <!-- ══ COPIAR DE OUTRO ITEM ══════════════════════════════════════
         Pensado pro caso comum de itens "irmãos" — a mesma receita usada
         nos dois cardápios, ou uma variação (ex: trufa normal x trufa
         "Festa" com peso diferente, que são receitas separadas) — pra não
         reescrever a mesma descrição/foto do zero em cada um. Busca em
         TODOS os itens com conteúdo preenchido nos dois cardápios, não só
         no que está aberto agora. -->
    <BaseModal v-if="copiarDeAberto" title="Copiar de outro item" @close="fecharCopiarDeOutroItem">
      <div class="cp-copiar-modal">
        <p class="cp-copiar-hint">
          Escolha de onde puxar o conteúdo pra <b>{{ copiarDeAberto.nome }}</b>. Só o que estiver marcado abaixo é copiado — o resto do item não muda.
        </p>

        <div class="cp-copiar-campos">
          <label class="cp-copiar-campo-check">
            <input type="checkbox" v-model="copiarCampos.descricao"> Descrição
          </label>
          <label class="cp-copiar-campo-check">
            <input type="checkbox" v-model="copiarCampos.emoji"> Emoji
          </label>
          <label class="cp-copiar-campo-check">
            <input type="checkbox" v-model="copiarCampos.foto"> Foto
          </label>
        </div>

        <input
          v-model="copiarBusca" class="input cp-copiar-busca" type="text"
          placeholder="Buscar item pelo nome..."
        >

        <div v-if="candidatosCopia.length" class="cp-copiar-lista">
          <button
            v-for="c in candidatosCopia" :key="c.uuid + c.origemId"
            type="button" class="cp-copiar-item" @click="aplicarCopiaDeOutroItem(c)"
          >
            <div class="cp-copiar-item-avatar">
              <img v-if="c.foto" :src="c.foto" alt="">
              <span v-else>{{ c.emoji || '🍫' }}</span>
            </div>
            <div class="cp-copiar-item-corpo">
              <div class="cp-copiar-item-nome">
                {{ c.nome }}
                <span v-if="c.mesmoItem" class="cp-copiar-item-selo">mesmo item, {{ c.origemLabel }}</span>
                <span v-else class="cp-copiar-item-selo cp-copiar-item-selo--outro">{{ c.origemLabel }}</span>
              </div>
              <div v-if="c.descricao" class="cp-copiar-item-desc">{{ c.descricao }}</div>
            </div>
          </button>
        </div>
        <p v-else class="cp-copiar-vazio">
          Nenhum item com descrição, emoji ou foto preenchidos ainda {{ copiarBusca ? 'pra essa busca' : 'nos dois cardápios' }}.
        </p>
      </div>
    </BaseModal>

    <!-- ══ TELA CHEIA ══════════════════════════ -->
    <Teleport to="body">
      <div v-if="telaCheiaAberta" class="cp-fullscreen" :class="{ 'cp-fs-bete': props.standalone }">
        <div v-if="props.standalone" class="cad-spiral cp-fs-spiral">
          <span v-for="n in 12" :key="n"></span>
        </div>
        <div class="cp-fullscreen-barra">
          <div class="cp-fs-esquerda">
            <button class="cp-fs-btn" title="Fechar" @click="fecharTelaCheia"><i class="fas fa-xmark"></i></button>
            <h2 v-if="props.standalone" class="cp-fs-titulo">Cardápio</h2>
          </div>
          <div class="cp-fs-switch" :style="{ '--cp-seg-count': CARDAPIOS.length, '--cp-seg-index': cardapioAtivoIndex }">
            <span class="cp-fs-switch-thumb"></span>
            <button v-for="c in CARDAPIOS" :key="c.id" class="cp-fs-switch-btn" :class="{ active: cardapioAtivo === c.id }"
              :title="c.label" :aria-label="c.label" @click="trocarCardapio(c.id)">
              <i class="fas" :class="c.icone"></i>
            </button>
          </div>
          <div class="cp-fs-acoes">
            <button class="cp-fs-btn" title="Enviar pro cliente" :disabled="gerandoPedidoInterativo" @click="gerarCardapioInterativo"><i class="fas fa-share-nodes"></i></button>
            <button class="cp-fs-btn cp-fs-btn--editar" @click="telaCheiaAberta = false"><i class="fas fa-pen"></i> Editar</button>
          </div>
        </div>
        <iframe class="cp-fullscreen-iframe" :key="`${telaCheiaRecarga}-${htmlBalcao}`" :srcdoc="htmlBalcao"></iframe>
      </div>

      <div v-if="pedidosPainelAberto" class="cp-fullscreen cp-fullscreen--claro" :class="{ 'cp-fs-bete': props.standalone }">
        <div class="cp-fullscreen-barra cp-fullscreen-barra--clara">
          <button
            :class="props.standalone ? 'cad-hdr-icon-btn' : 'cp-fs-btn cp-fs-btn--editar'"
            title="Voltar"
            @click="fecharPainelPedidos"
          >
            <i class="fas fa-arrow-left"></i><span v-if="!props.standalone">Voltar</span>
          </button>
          <div class="cp-pedidos-titulo">Pedidos do balcão</div>
          <div :style="{ width: props.standalone ? '36px' : '70px' }"></div>
        </div>

        <div class="cp-pedidos-corpo">
          <div v-if="!pedidosSalvos.length" class="cp-pedidos-vazio">
            <i class="fas fa-clipboard-list"></i>
            <p>Nenhum pedido salvo ainda.<br>Abra a "Tela cheia", monte um pedido junto com o cliente e toque em "Finalizar pedido".</p>
          </div>

          <template v-else>
            <div v-for="pedido in pedidosSalvos" :key="pedido.uuid" class="cp-pedido-card" :class="'is-' + pedido.status">
              <div class="cp-pedido-topo">
                <div class="cp-pedido-cliente">
                  <strong>{{ pedido.clienteNome || 'Venda de balcão' }}</strong>
                  <span class="cp-pedido-data">{{ formatarDataPedido(pedido.criadoEm) }}</span>
                </div>
                <span class="cp-pedido-status" :class="'is-' + pedido.status">
                  <i class="fas" :class="{ 'fa-clock': pedido.status === 'pendente', 'fa-calendar-check': pedido.status === 'agendado', 'fa-circle-check': pedido.status === 'entregue' }"></i>
                  {{ pedido.status === 'agendado' ? 'Agendado' : pedido.status === 'entregue' ? 'Entregue' : 'Pendente' }}
                </span>
              </div>

              <div class="cp-pedido-itens">
                <div v-for="item in pedido.itens" :key="item.nome">{{ item.qtd }}x {{ item.nome }}</div>
                <div v-if="pedido.entregaValor">Entrega: {{ R$(pedido.entregaValor) }}</div>
              </div>

              <div class="cp-pedido-pagamento">
                <span>Total: <strong>{{ R$(pedido.total) }}</strong></span>
                <span v-if="pedido.cobrarSinal">Sinal Pix: {{ R$(pedido.valorPix) }} · Falta: {{ R$(pedido.valorRestante) }}</span>
                <span v-else-if="pedido.valorPix">Pago via Pix: {{ R$(pedido.valorPix) }}</span>
              </div>

              <!-- Agendado — mostra a data/hora combinada. Só quando não está sendo editada agora. -->
              <div v-if="pedido.status === 'agendado' && pedidoAgendando !== pedido.uuid" class="cp-pedido-agenda-info">
                <i class="fas fa-calendar-check"></i>
                <span>Agendado para <strong>{{ formatarDataAgendada(pedido.agendadoPara) }}</strong><template v-if="pedido.horaAgendada"> às <strong>{{ pedido.horaAgendada }}</strong></template></span>
              </div>

              <!-- Editor de agendamento — abre inline ao tocar em "Agendar"/"Alterar agendamento". -->
              <div v-if="pedidoAgendando === pedido.uuid" class="cp-pedido-agenda-editor">
                <div class="cp-pedido-agenda-editor-titulo"><i class="fas fa-calendar-days"></i> Combinar com o cliente</div>
                <div class="cp-pedido-agenda-editor-campos">
                  <label class="cp-pedido-agenda-campo">
                    <span>Data</span>
                    <input type="date" class="cp-pedido-agenda-input" v-model="dataAgendamentoEdicao">
                  </label>
                  <label class="cp-pedido-agenda-campo cp-pedido-agenda-campo--hora">
                    <span>Hora <em>(opcional)</em></span>
                    <input type="time" class="cp-pedido-agenda-input" v-model="horaAgendamentoEdicao">
                  </label>
                </div>
                <div class="cp-pedido-agenda-editor-acoes">
                  <button class="cp-acao cp-acao--principal" :disabled="!dataAgendamentoEdicao" @click="confirmarAgendamento(pedido)">
                    <i class="fas fa-check"></i> Confirmar
                  </button>
                  <button class="cp-acao" @click="cancelarEdicaoAgendamento">Cancelar</button>
                </div>
              </div>

              <template v-if="pedidoAgendando !== pedido.uuid">
                <div v-if="pedido.status !== 'entregue'" class="cp-pedido-acoes cp-pedido-acoes--secundarias">
                  <a v-if="pedido.clienteTelefone" class="cp-acao" :href="linkWhatsAppCliente(pedido)" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                  <button class="cp-acao" @click="iniciarAgendamento(pedido)">
                    <i class="fas" :class="pedido.status === 'agendado' ? 'fa-calendar' : 'fa-calendar-plus'"></i>
                    {{ pedido.status === 'agendado' ? 'Alterar agendamento' : 'Agendar' }}
                  </button>
                  <button v-if="pedido.status === 'agendado'" class="cp-acao cp-acao--icone" title="Voltar pra pendente" @click="desmarcarAgendamento(pedido)">
                    <i class="fas fa-rotate-left"></i>
                  </button>
                </div>

                <div class="cp-pedido-acoes">
                  <button v-if="pedido.status !== 'entregue'" class="cp-acao cp-acao--entregue" @click="marcarEntregue(pedido)">
                    <i class="fas fa-circle-check"></i> Marcar como entregue
                  </button>
                  <button v-else class="cp-acao" @click="reabrirPedido(pedido)">
                    <i class="fas fa-rotate-left"></i> Reabrir pedido
                  </button>
                  <button class="cp-acao cp-acao--perigo cp-acao--icone" title="Remover" @click="removerPedido(pedido)"><i class="fas fa-trash"></i></button>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- ─── Modal Histórico de Preço de Venda ──────────────────── -->
    <Teleport to="body">
      <div v-if="modalHistoricoPreco" class="bottom-sheet-overlay" @click.self="modalHistoricoPreco = null">
        <div class="lc-modal">
          <div class="lc-modal-hdr">
            <span class="lc-modal-titulo"><i class="fas fa-chart-line"></i> {{ modalHistoricoPreco.nome }}</span>
            <button class="lc-modal-close" @click="modalHistoricoPreco = null"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="lc-modal-body">
            <div v-if="loadingHistoricoPreco" class="loading-box"><div class="spinner spinner-sm"></div></div>
            <template v-else-if="historicoPrecoVenda.length === 0">
              <div class="lc-hist-empty">
                <i class="fas fa-clock-rotate-left"></i>
                <p>Nenhum registro ainda.<br>O histórico é criado quando o preço muda.</p>
              </div>
            </template>
            <template v-else>
              <div class="lc-hist-resumo">
                <div class="lc-hist-kpi">
                  <span class="lc-hist-kpi-lbl">Atual</span>
                  <span class="lc-hist-kpi-val">{{ maskMoney(historicoPrecoVenda[historicoPrecoVenda.length-1].preco) }}</span>
                </div>
                <div class="lc-hist-kpi" v-if="historicoPrecoVenda.length > 1">
                  <span class="lc-hist-kpi-lbl">Variação</span>
                  <span class="lc-hist-kpi-val" :class="variacaoHistoricoPreco >= 0 ? 'c-red' : 'c-green'">
                    {{ variacaoHistoricoPreco >= 0 ? '+' : '' }}{{ variacaoHistoricoPreco.toFixed(1) }}%
                  </span>
                </div>
              </div>
              <div class="lc-hist-chart-wrap">
                <svg class="lc-hist-svg" viewBox="0 0 300 90" preserveAspectRatio="none">
                  <template v-for="(h, idx) in historicoPrecoVenda" :key="idx">
                    <rect
                      :x="idx * (300 / historicoPrecoVenda.length) + 3"
                      :y="90 - (h.preco / maxHistoricoPreco * 75)"
                      :width="(300 / historicoPrecoVenda.length) - 6"
                      :height="(h.preco / maxHistoricoPreco * 75)"
                      rx="3" fill="var(--brown)" opacity="0.8"
                    />
                  </template>
                </svg>
              </div>
              <div class="lc-hist-tabela">
                <div v-for="(h, idx) in [...historicoPrecoVenda].reverse()" :key="idx" class="lc-hist-row">
                  <span class="lc-hist-data">{{ new Date(h.data).toLocaleDateString('pt-BR') }}</span>
                  <span class="lc-hist-preco">{{ maskMoney(h.preco) }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useStore } from '../store.js'
import { normalizar, maskMoney, parseMoney } from '../utils.js'
import {
  carregarConfigCardapio, salvarConfigCardapio, ITEM_DEFAULT, CARDAPIOS,
  carregarAbaPadraoCardapio, salvarAbaPadraoCardapio,
  montarItensCardapio, agruparPorCategoria, redimensionarImagem,
  gerarPdfCardapioCompacto, numeroWhatsAppFormatado,
  gerarHtmlPedidoInterativo, compartilharArquivo, extrairTelefoneDeTexto,
  garantirFontesCarregadas,
} from '../composables/useCardapio.js'
import { publicarArquivoGitHub, carregarConfigPublicacao, publicacaoConfigurada, urlPublicaFinal } from '../services/githubPublish.js'
import { salvarPedidoCardapio, listarPedidosCardapio, atualizarStatusPedidoCardapio, excluirPedidoCardapio } from '../db.js'
import BaseModal from '../components/BaseModal.vue'

const s = useStore()

// Quando usado dentro do perfil da Bete (embutido na tela dela, sem o menu
// "Mais" do Yves), o componente é montado/desmontado a cada navegação —
// diferente do perfil "ym", onde fica sempre montado (v-show) e a aba ativa
// é controlada por s.tab. standalone=true avisa que "montou = a pessoa
// acabou de entrar aqui agora", sem precisar checar s.tab.
const props = defineProps({
  standalone: { type: Boolean, default: false },
  // true = ignora "abrir sempre em tela cheia" e vai direto pro editor —
  // usado quando a pessoa toca em "Editar no Cardápio" a partir de outra
  // tela (ex: Lançar novo fiado), onde a intenção é claramente editar.
  forcarEdicao: { type: Boolean, default: false },
  // true = ao montar, pula direto pro painel "Pedidos do balcão" — usado
  // pelo atalho de acesso rápido do dashboard da Bete.
  abrirPedidos: { type: Boolean, default: false },
})
const emit = defineEmits(['fechar'])

const R$ = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const config = reactive({ nome_cardapio: '', subtitulo: 'Chocolates Artesanais', mensagem_rodape: 'Peça já e encomende o seu! 🍫', abrir_tela_cheia_padrao: false, pagamento_ativo: true, antecedencia_dias: 2, sinal_ativo: true, sinal_texto: 'Encomendas confirmadas mediante pagamento de um sinal. Após a confirmação, o sinal não é reembolsável, pois é usado para a compra dos insumos da sua encomenda.', taxa_entrega: 0, categorias_min: {}, categorias_img: {}, mostrar_foto_itens: true, itens: {} })
const cardapioAtivo = ref('festa') // 'festa' | 'diaadia' — cada um é um cardápio 100% independente (itens, capa, regras, link)
const abaPadrao = ref('festa') // qual dos dois abre por padrão ao entrar aqui (configurável em "Mais opções")
const cardapioAtivoIndex = computed(() => Math.max(0, CARDAPIOS.findIndex(c => c.id === cardapioAtivo.value)))
// Objeto completo (label + ícone) do cardápio ativo — usado pra deixar
// claro, no título do modal de Configurações, qual dos dois está sendo
// editado (cada um tem capa/prazo/sinal/link totalmente independentes).
const cardapioAtivoObj = computed(() => CARDAPIOS.find(c => c.id === cardapioAtivo.value))
const configModalAberto = ref(false) // "Configurações do cardápio" — capa/rodapé, prazo/sinal, WhatsApp, aparência e avançado
const configAberta = ref(false)
const politicaAberta = ref(false)
const entregaAberta = ref(false)
const aparenciaAberta = ref(false)
const avancadoAberta = ref(false)
const gerandoPedidoInterativo = ref(false)
const publicandoLink = ref(false)
const configPublicacao = ref(null)
// Status do link permanente nesta sessão: 'idle' (nada feito ainda) →
// 'publicando' (chamando o GitHub) → 'aguardando' (commit ok, mas o
// Cloudflare ainda pode estar propagando a versão nova) → 'pronto' (tempo
// estimado de propagação já passou). Não é uma confirmação real de que o
// Cloudflare já atualizou (isso exigiria checar o conteúdo do link, o que
// esbarra em CORS pro domínio publicado) — é uma estimativa de tempo
// exibida de forma clara, em vez de um único aviso genérico depois do fato.
const linkStatus = ref('idle')
const linkSegundosRestantes = ref(0)
let linkTimerId = null

function pararContagemLink() {
  if (linkTimerId) { clearInterval(linkTimerId); linkTimerId = null }
}

function iniciarContagemLink(segundos = 75) {
  pararContagemLink()
  linkSegundosRestantes.value = segundos
  linkStatus.value = 'aguardando'
  linkTimerId = setInterval(() => {
    linkSegundosRestantes.value -= 1
    if (linkSegundosRestantes.value <= 0) {
      pararContagemLink()
      linkStatus.value = 'pronto'
    }
  }, 1000)
}

onUnmounted(pararContagemLink)
const opcoesGrupoAberto = ref(null)
const novoNomeCategoria = ref('')

// Renomeia a categoria pra todos os itens do grupo (ativos e ocultos). O nome
// fica salvo como "adereço" de cada item (cfg.categoria) — só vale pra este
// cardápio, sem mexer na categoria da receita em si (usada nas outras abas).
// Como o nome exibido (categoriaExibicao) é a mesma fonte usada no PDF, na
// imagem, na tela cheia, no link publicado e no HTML do GitHub, renomear
// aqui já reflete em tudo isso — não precisa mudar em mais nenhum lugar.
function renomearCategoria(grupo) {
  const novoNome = novoNomeCategoria.value.trim()
  if (!novoNome || novoNome === grupo.categoria) { fecharOpcoesGrupo(); return }
  for (const item of grupo.itens) {
    itemCfg(item.uuid).categoria = novoNome
  }
  // Migra o pedido mínimo configurado (se houver) pro novo nome, senão a
  // regra ficaria "presa" no nome antigo, que não existe mais.
  if (config.categorias_min?.[grupo.categoria]) {
    config.categorias_min[novoNome] = config.categorias_min[grupo.categoria]
    delete config.categorias_min[grupo.categoria]
  }
  // Idem pra imagem do banner da categoria.
  if (config.categorias_img?.[grupo.categoria]) {
    config.categorias_img[novoNome] = config.categorias_img[grupo.categoria]
    delete config.categorias_img[grupo.categoria]
  }
  salvar()
  s.notify?.(`Categoria renomeada para "${novoNome}".`)
  fecharOpcoesGrupo()
}

function abrirOpcoesGrupo(grupo) {
  novoNomeCategoria.value = grupo.categoria
  precoCategoriaValor.value = ''
  opcoesGrupoAberto.value = grupo
}
function fecharOpcoesGrupo() {
  opcoesGrupoAberto.value = null
}
// numeroSugerido: fallback pro contato já cadastrado na etiqueta, caso o
// WhatsApp de pedidos (Ajustes → Identidade) ainda não tenha sido definido.
const numeroSugerido = computed(() => extrairTelefoneDeTexto(s.company.contato_etiqueta))
const numeroEfetivoPedido = computed(() => s.company.whatsapp_pedidos || numeroSugerido.value)
const urlCardapioPublicado = computed(() => {
  if (!configPublicacao.value?.dominio) return ''
  return urlPublicaFinal({ ...configPublicacao.value, caminho: `public/pedido-${cardapioAtivo.value}.html` })
})
// Qual link mostrar/copiar: geral (/pedido, cliente escolhe) ou direto.
const tipoLink = ref('escolha')
const opcoesLink = [
  { id: 'escolha',  label: 'Geral',     caminho: 'public/pedido',             dica: 'Para bio, status e primeira conversa: o cliente escolhe entre Dia a dia e Festas.' },
  { id: 'diaadia',  label: 'Dia a dia', caminho: 'public/pedido-diaadia.html', dica: 'Vai direto ao cardápio do dia a dia. Use quando o cliente já disse o que quer.' },
  { id: 'festa',    label: 'Festas',    caminho: 'public/pedido-festa.html',   dica: 'Vai direto ao cardápio de festas e encomendas.' },
]
function escolherTipoLink(id) {
  tipoLink.value = id
  // Link direto de um cardápio = aquele cardápio fica ativo (é ele que "Enviar"/"Atualizar" publicam)
  if (id !== 'escolha') trocarCardapio(id)
}
watch(cardapioAtivo, (id) => { if (tipoLink.value !== 'escolha') tipoLink.value = id })
const urlLinkAtual = computed(() => {
  if (!configPublicacao.value?.dominio) return ''
  const o = opcoesLink.find(x => x.id === tipoLink.value) || opcoesLink[0]
  return urlPublicaFinal({ ...configPublicacao.value, caminho: o.caminho })
})
const publicacaoDisponivel = computed(() => publicacaoConfigurada(configPublicacao.value))

const busca = ref('')
const expandido = ref(null)
const telaCheiaAberta = ref(false)


// ── Recuperação da tela cheia após um tempo em segundo plano ──
// No celular, se o app fica minimizado (ou processando algo pesado, tipo
// gerar um PDF/imagem em outra tela) por um tempo, o navegador às vezes
// libera a memória do <iframe> da tela cheia pra aliviar o app — e ele não
// volta sozinho, fica em branco até algo forçar o Vue a recriar o elemento
// do zero (foi o que "trocar de perfil e voltar" estava fazendo without
// querer). Esse contador força a mesma recriação sempre que o app volta a
// ficar visível, sem precisar trocar de perfil.
const telaCheiaRecarga = ref(0)
function aoVoltarVisivel() {
  if (document.visibilityState === 'visible' && telaCheiaAberta.value) {
    telaCheiaRecarga.value++
  }
}
document.addEventListener('visibilitychange', aoVoltarVisivel)
onUnmounted(() => document.removeEventListener('visibilitychange', aoVoltarVisivel))

// "Fechar" (X) sai de vez da tela cheia — direto pro painel/dashboard, sem
// passar pela edição do cardápio. "Editar" (o outro botão) só fecha a tela
// cheia e deixa a pessoa na edição, como já era antes.
function fecharTelaCheia() {
  telaCheiaAberta.value = false
  if (props.standalone) emit('fechar')
  else s.setTab('painel')
}

onMounted(async () => {
  garantirFontesCarregadas() // dispara em paralelo, sem bloquear — só "esquenta" o cache
  abaPadrao.value = await carregarAbaPadraoCardapio()
  cardapioAtivo.value = abaPadrao.value
  const [, publicacao] = await Promise.all([carregarCardapioAtivo(), carregarConfigPublicacao(), carregarPedidosSalvos()])
  configPublicacao.value = publicacao
  await nextTick()
  // Modo "mostrar pro cliente": abre direto na tela cheia. Pra editar o
  // cardápio, é só tocar em "Editar cardápio" — volta pra esta tela normalmente.
  // forcarEdicao pula esse modo — a pessoa veio de outra tela justamente
  // pra editar (ex: "Editar no Cardápio" ao lançar um fiado). abrirPedidos
  // também pula — a intenção ali é ver os pedidos salvos, não o cardápio.
  if (config.abrir_tela_cheia_padrao && (props.standalone || s.tab === 'cardapio') && !props.forcarEdicao && !props.abrirPedidos) {
    telaCheiaAberta.value = true
  }
  if (props.abrirPedidos) pedidosPainelAberto.value = true
})

// ── Pedidos do balcão ───────────────────────────────────────────────────
// A tela cheia roda o cardápio interativo dentro de um <iframe>. Quando o
// pedido é finalizado por lá (modo balcão), o próprio HTML manda um
// postMessage pro app pai — é assim que o pedido chega até aqui pra ser
// salvo no banco local (o iframe não tem acesso direto ao IndexedDB do app).
const pedidosPainelAberto = ref(false)
const pedidosSalvos = ref([])

async function carregarPedidosSalvos() {
  pedidosSalvos.value = await listarPedidosCardapio()
}

async function onMensagemJanela(event) {
  if (event.data === 'cardapio-recarregar') { telaCheiaRecarga.value++; return }
  if (event.data?.tipo !== 'cardapio:pedido-balcao' || !event.data?.pedido) return
  const pedido = event.data.pedido
  try {
    await salvarPedidoCardapio(pedido)
    sincronizarDepois(true)
    s.notify?.(`Pedido de ${pedido.clienteNome || 'balcão'} salvo!`, 'success')
    if (pedidosPainelAberto.value) await carregarPedidosSalvos()
  } catch {
    s.notify?.('Não deu pra salvar o pedido — tente de novo.')
  }
}
window.addEventListener('message', onMensagemJanela)
onUnmounted(() => window.removeEventListener('message', onMensagemJanela))

async function abrirPainelPedidos() {
  pedidosPainelAberto.value = true
  await carregarPedidosSalvos()
}

// Se chegou aqui direto pelo atalho "Pedidos" (dashboard da Bete), "Voltar"
// deve levar de volta pro dashboard — a pessoa nunca esteve no editor do
// cardápio nesta visita, então cair lá seria confuso. Se abriu a partir do
// editor (link "Ver" em Configurações → Avançado), volta só pro editor.
function fecharPainelPedidos() {
  pedidosPainelAberto.value = false
  if (props.abrirPedidos) emit('fechar')
}

// ── Agendamento e entrega do pedido do balcão ──
// Essa tela não tem ligação nenhuma com a produção (isso é a aba
// Produção). Três status possíveis:
//   'pendente'  → ainda sem nada combinado
//   'agendado'  → tem data (e opcionalmente hora) combinada com o cliente
//   'entregue'  → já foi retirado/entregue (fim de linha)
const pedidoAgendando = ref(null) // uuid do pedido com o editor de data/hora aberto agora, ou null
const dataAgendamentoEdicao = ref('')
const horaAgendamentoEdicao = ref('')

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function iniciarAgendamento(pedido) {
  pedidoAgendando.value = pedido.uuid
  dataAgendamentoEdicao.value = pedido.agendadoPara || hojeISO()
  horaAgendamentoEdicao.value = pedido.horaAgendada || ''
}

function cancelarEdicaoAgendamento() {
  pedidoAgendando.value = null
  dataAgendamentoEdicao.value = ''
  horaAgendamentoEdicao.value = ''
}

async function confirmarAgendamento(pedido) {
  if (!dataAgendamentoEdicao.value) return
  const hora = horaAgendamentoEdicao.value || null
  pedido.status = 'agendado' // otimista — atualiza a tela na hora
  pedido.agendadoPara = dataAgendamentoEdicao.value
  pedido.horaAgendada = hora
  await atualizarStatusPedidoCardapio(pedido.uuid, 'agendado', { agendadoPara: dataAgendamentoEdicao.value, horaAgendada: hora })
  sincronizarDepois(true)
  cancelarEdicaoAgendamento()
}

async function desmarcarAgendamento(pedido) {
  pedido.status = 'pendente' // otimista
  pedido.agendadoPara = null
  pedido.horaAgendada = null
  await atualizarStatusPedidoCardapio(pedido.uuid, 'pendente', { agendadoPara: null, horaAgendada: null })
  sincronizarDepois(true)
}

// Marca como entregue/retirado — não mexe na data/hora combinada, só no
// status, então o histórico de quando ficou combinado continua salvo.
async function marcarEntregue(pedido) {
  pedido.status = 'entregue' // otimista
  await atualizarStatusPedidoCardapio(pedido.uuid, 'entregue')
  sincronizarDepois(true)
}

// Reabre um pedido marcado como entregue por engano — volta pra "agendado"
// se já tinha data combinada, senão volta pra "pendente".
async function reabrirPedido(pedido) {
  const novoStatus = pedido.agendadoPara ? 'agendado' : 'pendente'
  pedido.status = novoStatus // otimista
  await atualizarStatusPedidoCardapio(pedido.uuid, novoStatus)
  sincronizarDepois(true)
}

async function removerPedido(pedido) {
  if (!confirm(`Remover o pedido de ${pedido.clienteNome || 'balcão'}?`)) return
  await excluirPedidoCardapio(pedido.uuid)
  sincronizarDepois(true)
  pedidosSalvos.value = pedidosSalvos.value.filter(p => p.uuid !== pedido.uuid)
}

// Badge do atalho "Pedidos": conta o que ainda está em aberto (não
// entregue ainda) — inclui pendente e agendado, já que os dois ainda
// precisam de alguma ação da Bete.
const pedidosPendentesCount = computed(() => pedidosSalvos.value.filter(p => p.status !== 'entregue').length)

function formatarDataPedido(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// pedido.agendadoPara vem de <input type="date"> no formato "YYYY-MM-DD".
// Monta a data local "na unha" (em vez de `new Date(string)`) pra não
// correr risco do fuso horário empurrar um dia pra trás/frente.
function formatarDataAgendada(dataStr) {
  if (!dataStr) return ''
  const [ano, mes, dia] = dataStr.split('-').map(Number)
  const d = new Date(ano, (mes || 1) - 1, dia || 1)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function linkWhatsAppCliente(pedido) {
  const numero = numeroWhatsAppFormatado(pedido.clienteTelefone)
  return numero ? `https://wa.me/${numero}` : '#'
}

// As abas do perfil "ym" usam v-show (montam uma única vez quando o app
// abre), então onMounted() acima só cobre o primeiro carregamento — não toda
// vez que a pessoa toca em "Cardápio" no menu. Esse watch cobre as próximas
// vezes: toda vez que a aba ativa vira "cardapio", reabre a tela cheia (se o
// modo estiver ligado), mesmo que ela tenha sido fechada antes pra editar.
// (No modo standalone da Bete isso não é necessário — lá o componente é
// remontado a cada visita, então o onMounted acima já cobre tudo.)
watch(() => s.tab, (aba) => {
  if (!props.standalone && aba === 'cardapio' && config.abrir_tela_cheia_padrao) telaCheiaAberta.value = true
})

// Estado real da categoria, considerando os 3 cenários possíveis:
// 'ativa'   -> todos os itens ligados
// 'parcial' -> pelo menos 1 ligado e pelo menos 1 desligado
// 'oculta'  -> nenhum item ligado (é o único caso em que nada dessa
//              categoria aparece de fato no cardápio publicado)
function grupoEstado(grupo) {
  if (!grupo.itens.length) return 'oculta'
  const ativos = grupo.itens.filter(i => itemCfg(i.uuid).ativo).length
  if (ativos === 0) return 'oculta'
  if (ativos === grupo.itens.length) return 'ativa'
  return 'parcial'
}

function grupoEstadoLabel(grupo) {
  const estado = grupoEstado(grupo)
  if (estado === 'ativa') return 'Categoria ativa'
  if (estado === 'parcial') {
    const ativos = grupo.itens.filter(i => itemCfg(i.uuid).ativo).length
    return `Parcial (${ativos}/${grupo.itens.length})`
  }
  return 'Categoria oculta'
}

// Enquanto houver qualquer item ligado (ativa OU parcial), o botão oculta
// tudo de uma vez. Só quando a categoria já estiver 100% oculta é que o
// botão passa a ligar tudo de novo.
function alternarGrupo(grupo) {
  const estaOculta = grupoEstado(grupo) === 'oculta'
  const ligar = estaOculta
  grupo.itens.forEach(i => { itemCfg(i.uuid).ativo = ligar })
  salvar()
}

// Resolve o nome de um ingrediente (produto ou sub-receita) a partir do id salvo na receita
function resolverNomeIngrediente(ing) {
  if (ing.tipo === 'produto') return s.produtos?.find(p => p.uuid === ing.id)?.nome || null
  if (ing.tipo === 'receita') return s.receitas?.find(rec => rec.uuid === ing.id)?.nome || null
  return null
}

function gerarPromptDescricao(r) {
  const receitaCompleta = s.receitas?.find(rec => rec.uuid === r.uuid)
  const ingredientes = (receitaCompleta?.ingredientes || [])
    .map(resolverNomeIngrediente)
    .filter(Boolean)
  const partes = [
    `Crie uma descrição de venda curta (máximo 120 caracteres) para um doce artesanal chamado "${r.nome}", categoria "${r.categoria || 'doces'}".`,
    ingredientes.length ? `Principais ingredientes: ${ingredientes.join(', ')}.` : null,
    'A descrição vai aparecer num cardápio digital pro cliente final: use um tom convidativo e apetitoso, sem exageros e sem emojis. Responda só com o texto da descrição, sem aspas.',
  ]
  return partes.filter(Boolean).join(' ')
}

async function copiarPromptDescricao(r) {
  const prompt = gerarPromptDescricao(r)
  try {
    await navigator.clipboard.writeText(prompt)
    s.notify?.('Prompt copiado! Cole numa IA (ChatGPT, Gemini...) e traga a resposta pra cá.')
  } catch {
    window.prompt('Copie o prompt abaixo e cole numa IA:', prompt)
  }
}

// ── Copiar de outro item (descrição/emoji/foto) ──────────────────────────
// Cada item do cardápio é um "adereço" preso a UMA receita, num cardápio só
// (ver comentário no topo de useCardapio.js) — então nada é compartilhado
// automaticamente entre "Festa" e "Dia a dia", nem entre receitas "irmãs"
// (ex: uma trufa normal e a mesma trufa em versão Festa de 19g, que são
// receitas separadas porque o peso muda o rendimento). Isso é intencional
// (cada canal pode ter um texto de venda diferente), mas pra quando o
// conteúdo É o mesmo, este picker busca nos itens preenchidos dos DOIS
// cardápios (não só no que está aberto) e copia só os campos marcados.
const copiarDeAberto = ref(null) // receita (r) sendo editada agora, ou null
const copiarBusca = ref('')
const copiarCampos = reactive({ descricao: true, emoji: true, foto: true })
const outroCardapioConfigCache = ref(null)

async function abrirCopiarDeOutroItem(r) {
  copiarDeAberto.value = r
  copiarBusca.value = ''
  const outroId = CARDAPIOS.find(c => c.id !== cardapioAtivo.value)?.id
  outroCardapioConfigCache.value = outroId ? await carregarConfigCardapio(outroId) : null
}
function fecharCopiarDeOutroItem() {
  copiarDeAberto.value = null
}

const candidatosCopia = computed(() => {
  if (!copiarDeAberto.value) return []
  const outroObj = CARDAPIOS.find(c => c.id !== cardapioAtivo.value)
  const fontes = [
    { id: cardapioAtivo.value, label: cardapioAtivoObj.value?.label || '', itens: config.itens },
    { id: outroObj?.id, label: outroObj?.label || '', itens: outroCardapioConfigCache.value?.itens || {} },
  ]
  const buscaNorm = normalizar(copiarBusca.value)
  const lista = []
  for (const receita of (s.receitas || [])) {
    for (const fonte of fontes) {
      const cfg = fonte.itens?.[receita.uuid]
      if (!cfg || !(cfg.descricao || cfg.foto)) continue
      // Não lista a própria origem — copiar o item pra ele mesmo não faz sentido
      if (fonte.id === cardapioAtivo.value && receita.uuid === copiarDeAberto.value.uuid) continue
      if (buscaNorm && !normalizar(receita.nome).includes(buscaNorm)) continue
      lista.push({
        uuid: receita.uuid,
        origemId: fonte.id,
        origemLabel: fonte.label,
        mesmoItem: receita.uuid === copiarDeAberto.value.uuid,
        nome: receita.nome,
        descricao: cfg.descricao || '',
        emoji: cfg.emoji || '',
        foto: cfg.foto || null,
      })
    }
  }
  // Mesma receita no outro cardápio primeiro (o caso mais comum — o mesmo
  // doce vendido nos dois canais), depois o resto em ordem alfabética.
  lista.sort((a, b) => {
    if (a.mesmoItem !== b.mesmoItem) return a.mesmoItem ? -1 : 1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
  return lista
})

function aplicarCopiaDeOutroItem(c) {
  const alvo = itemCfg(copiarDeAberto.value.uuid)
  if (copiarCampos.descricao) alvo.descricao = c.descricao
  if (copiarCampos.emoji && c.emoji) alvo.emoji = c.emoji
  if (copiarCampos.foto) alvo.foto = c.foto
  salvar()
  s.notify?.(`Copiado de "${c.nome}".`)
  fecharCopiarDeOutroItem()
}

function itemCfg(uuid) {
  if (!config.itens[uuid]) config.itens[uuid] = ITEM_DEFAULT()
  return config.itens[uuid]
}

function precoExibido(r) {
  // O preço mostrado no Cardápio é sempre o preco_sugerido atual da receita
  // (fonte única de verdade) — se estiver digitando neste item agora, mostra
  // o rascunho local em vez do valor salvo, pra não "brigar" com o que a
  // pessoa está digitando.
  if (precoDraft[r.uuid] !== undefined) return precoDraft[r.uuid]
  return Number(r.preco || 0)
}

// Preço do Cardápio e preço da Receita são a MESMA coisa (não duas cópias
// que precisam ficar sincronizadas): editar aqui grava direto no
// preco_sugerido da receita, e editar na tela de Receitas aparece aqui na
// hora, porque os itens do cardápio são computados a partir de s.receitas.
// Fica um rascunho local (precoDraft) enquanto a pessoa digita, e só quando
// ela termina (sai do campo) é que o valor é de fato salvo — evita registrar
// um preço "pela metade" (ex: só o primeiro dígito digitado) no histórico.
const precoDraft = reactive({})

function digitarPreco(r, valor) {
  precoDraft[r.uuid] = valor === '' ? 0 : parseMoney(valor)
}

async function confirmarPreco(r) {
  const preco = precoDraft[r.uuid]
  delete precoDraft[r.uuid]
  if (preco == null || preco <= 0 || preco === Number(r.preco || 0)) return
  await s.sincronizarPrecoReceita(r.uuid, preco, `cardapio:${cardapioAtivo.value}`)
  // Garante que não sobra um preco_exibido "congelado": o cardápio passa a
  // sempre refletir o preco_sugerido da receita, então uma alteração futura
  // feita direto na receita aparece aqui automaticamente também.
  if (itemCfg(r.uuid).preco_exibido != null) {
    itemCfg(r.uuid).preco_exibido = null
    salvar()
  }
}

const precoCategoriaValor = ref('')

async function aplicarPrecoCategoria(grupo) {
  const preco = parseMoney(precoCategoriaValor.value)
  if (!preco || preco <= 0) {
    s.notify?.('Digite um preço válido antes de aplicar.')
    return
  }
  await Promise.all(grupo.itens.map(item => s.sincronizarPrecoReceita(item.uuid, preco, `cardapio:${cardapioAtivo.value}`)))
  let mudouConfig = false
  for (const item of grupo.itens) {
    if (itemCfg(item.uuid).preco_exibido != null) {
      itemCfg(item.uuid).preco_exibido = null
      mudouConfig = true
    }
  }
  if (mudouConfig) salvar()
  s.notify?.(`Preço atualizado em ${grupo.itens.length} ${grupo.itens.length === 1 ? 'item' : 'itens'} de "${grupo.categoria}". Pode ajustar algum item específico depois, se precisar.`)
  fecharOpcoesGrupo()
  precoCategoriaValor.value = ''
}

// ── Histórico de Preços (venda) ──
const modalHistoricoPreco = ref(null)
const historicoPrecoVenda = ref([])
const loadingHistoricoPreco = ref(false)
const maxHistoricoPreco = computed(() => Math.max(...historicoPrecoVenda.value.map(h => h.preco), 0.01))
const variacaoHistoricoPreco = computed(() => {
  if (historicoPrecoVenda.value.length < 2) return 0
  const p = historicoPrecoVenda.value[0].preco
  const u = historicoPrecoVenda.value[historicoPrecoVenda.value.length - 1].preco
  return p ? ((u - p) / p) * 100 : 0
})

async function abrirHistoricoPreco(r) {
  modalHistoricoPreco.value = r
  loadingHistoricoPreco.value = true
  try {
    historicoPrecoVenda.value = await s.historicoPrecoVenda(r.uuid)
  } finally {
    loadingHistoricoPreco.value = false
  }
}

// ── Sincronização com o Drive ────────────────────────────────────────────
// O cardápio grava direto no banco local (db.js), sem passar pela store —
// então a store nunca ficava sabendo que havia alteração pendente e o app
// não enviava nada ao Drive (e o próximo sync só baixava). Depois de cada
// gravação avisamos a store (agendarSync marca "pendente") e disparamos o
// envio: com pequena espera nas edições em sequência (digitação), e na hora
// nas ações pontuais (pedido, sair da tela).
let syncTimer = null
function sincronizarDepois(imediato = false) {
  s.agendarSync?.()
  clearTimeout(syncTimer)
  if (imediato) {
    syncTimer = null
    s.syncImediato?.()
    return
  }
  syncTimer = setTimeout(() => { syncTimer = null; s.syncImediato?.() }, 3000)
}
onUnmounted(() => {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; s.syncImediato?.() }
})

let salvando = null

function salvar() {
  clearTimeout(salvando)
  const idAlvo = cardapioAtivo.value
  const configCopia = JSON.parse(JSON.stringify(config))
  salvando = setTimeout(async () => {
    salvando = null
    await salvarConfigCardapio(idAlvo, configCopia)
    sincronizarDepois()
  }, 250)
}

async function flushSalvar() {
  const haviaEdicaoPendente = salvando !== null
  clearTimeout(salvando)
  salvando = null
  const idAlvo = cardapioAtivo.value
  const configCopia = JSON.parse(JSON.stringify(config))
  await salvarConfigCardapio(idAlvo, configCopia)
  if (haviaEdicaoPendente || syncTimer) sincronizarDepois(true)
}

async function carregarCardapioAtivo() {
  const carregado = await carregarConfigCardapio(cardapioAtivo.value)
  Object.assign(config, carregado)
  // Migração: preços salvos como "override" (preco_exibido) num cardápio
  // antigo ficam presos naquele valor mesmo se a receita mudar depois. A
  // partir de agora o preço é um só (o da receita): joga o último valor que
  // estava salvo como override pra dentro da receita (se ainda não estiver
  // lá) e limpa o override, pra passar a herdar sempre o preco_sugerido atual.
  let mudou = false
  for (const uuid of Object.keys(config.itens || {})) {
    const override = config.itens[uuid].preco_exibido
    if (override == null) continue
    const receita = s.receitas.find(r => r.uuid === uuid)
    if (receita && Number(receita.preco_sugerido || 0) !== Number(override)) {
      await s.sincronizarPrecoReceita(uuid, override, `cardapio:${cardapioAtivo.value}`)
    }
    config.itens[uuid].preco_exibido = null
    mudou = true
  }
  if (mudou) salvar()
}

async function trocarCardapio(id) {
  if (id === cardapioAtivo.value) return
  flushSalvar() // garante que nenhuma edição recente do cardápio anterior se perca
  cardapioAtivo.value = id
  expandido.value = null
  await carregarCardapioAtivo()
}

// ── Swipe pra trocar de cardápio ──
// Substitui o antigo seletor fixo no cabeçalho: arrastar o dedo pra
// esquerda/direita em qualquer lugar do conteúdo troca entre "Dia a dia" e
// "Festa", como aba de app. Só dispara com um gesto claramente horizontal
// (maior que o deslocamento vertical) e acima de um mínimo de distância,
// pra não atrapalhar o scroll normal da lista nem toques em botões.
const SWIPE_MIN_DIST = 55
let swipeStartX = 0
let swipeStartY = 0
function onSwipeStart(e) {
  const t = e.touches[0]
  swipeStartX = t.clientX
  swipeStartY = t.clientY
}
function onSwipeEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - swipeStartX
  const dy = t.clientY - swipeStartY
  if (Math.abs(dx) < SWIPE_MIN_DIST || Math.abs(dx) < Math.abs(dy) * 1.4) return
  const proximoIndex = cardapioAtivoIndex.value + (dx < 0 ? 1 : -1)
  const alvo = CARDAPIOS[proximoIndex]
  if (alvo) trocarCardapio(alvo.id)
}

async function definirAbaPadrao(id) {
  if (id === abaPadrao.value) return
  abaPadrao.value = id
  await salvarAbaPadraoCardapio(id)
  sincronizarDepois()
}

function categoriaMinimo(nomeCategoria) {
  return config.categorias_min?.[nomeCategoria] || null
}
function categoriaTemMinimo(nomeCategoria) {
  const m = categoriaMinimo(nomeCategoria)
  return !!(m && (m.valor > 0 || m.unidades > 0))
}
function categoriaMinimoLabel(nomeCategoria) {
  const m = categoriaMinimo(nomeCategoria)
  if (!m) return ''
  const partes = []
  if (m.valor > 0) partes.push(R$(m.valor))
  if (m.unidades > 0) partes.push(`${m.unidades} un.`)
  return partes.join(' · ')
}
function definirCategoriaMinimo(nomeCategoria, campo, valorBruto) {
  if (!config.categorias_min) config.categorias_min = {}
  const atual = config.categorias_min[nomeCategoria] || { valor: 0, unidades: 0 }
  const novoValor = Math.max(0, Number(valorBruto) || 0)
  const atualizado = { ...atual, [campo]: novoValor }
  if (atualizado.valor > 0 || atualizado.unidades > 0) config.categorias_min[nomeCategoria] = atualizado
  else delete config.categorias_min[nomeCategoria]
  salvar()
}
function removerCategoriaMinimo(nomeCategoria) {
  if (!config.categorias_min) return
  delete config.categorias_min[nomeCategoria]
  salvar()
}

// Imagem escolhida pra categoria, ou (na falta) a foto do primeiro sabor que tiver.
function imagemDaCategoria(grupo) {
  if (!grupo) return ''
  return config.categorias_img?.[grupo.categoria]
    || grupo.itens.map(r => itemCfg(r.uuid).foto).find(Boolean)
    || ''
}
async function onImagemCategoria(grupo, evento) {
  const arquivo = evento.target.files?.[0]
  evento.target.value = ''
  if (!arquivo) return
  try {
    const dataUrl = await redimensionarImagem(arquivo, { maxLado: 900, qualidade: 0.78 })
    if (!config.categorias_img) config.categorias_img = {}
    config.categorias_img[grupo.categoria] = dataUrl
    salvar()
  } catch (err) {
    s.notify?.(err.message || 'Não foi possível processar a imagem.')
  }
}
function removerImagemCategoria(grupo) {
  if (!config.categorias_img) return
  delete config.categorias_img[grupo.categoria]
  salvar()
}

async function onFotoSelecionada(r, evento) {
  const arquivo = evento.target.files?.[0]
  evento.target.value = ''
  if (!arquivo) return
  try {
    const dataUrl = await redimensionarImagem(arquivo)
    itemCfg(r.uuid).foto = dataUrl
    salvar()
  } catch (err) {
    s.notify?.(err.message || 'Não foi possível processar a imagem.')
  }
}

const ordemCategorias = ['Trufa', 'Cone', 'Barra', 'Bolo', 'Brownie']

function ordenarGruposCardapio(grupos) {
  return [...grupos].sort((a, b) => {
    const indiceA = ordemCategorias.indexOf(a.categoria)
    const indiceB = ordemCategorias.indexOf(b.categoria)
    const posicaoA = indiceA === -1 ? ordemCategorias.length : indiceA
    const posicaoB = indiceB === -1 ? ordemCategorias.length : indiceB
    return posicaoA - posicaoB || a.categoria.localeCompare(b.categoria, 'pt-BR')
  })
}

// Todas as receitas (inclui inativas) — pra edição
const todosGrupos = computed(() => ordenarGruposCardapio(agruparPorCategoria(montarItensCardapio(s.receitas, config, { apenasAtivos: false }))))
// Só as ativas — pra gerar o cardápio de verdade (PDF/tela/imagem)
const todosItensAtivos = computed(() => montarItensCardapio(s.receitas, config, { apenasAtivos: true }))
const gruposAtivos = computed(() => ordenarGruposCardapio(agruparPorCategoria(todosItensAtivos.value)))

const gruposFiltrados = computed(() => {
  const termo = normalizar(busca.value)
  if (!termo) return todosGrupos.value
  return todosGrupos.value
    .map(g => ({ categoria: g.categoria, itens: g.itens.filter(i => normalizar(i.nome).includes(termo)) }))
    .filter(g => g.itens.length)
})

function mover(r, direcao) {
  const grupo = todosGrupos.value.find(g => g.itens.some(i => i.uuid === r.uuid))
  if (!grupo) return
  const idx = grupo.itens.findIndex(i => i.uuid === r.uuid)
  const alvoIdx = idx + direcao
  if (alvoIdx < 0 || alvoIdx >= grupo.itens.length) return
  const atual = itemCfg(r.uuid)
  const vizinho = itemCfg(grupo.itens[alvoIdx].uuid)
  const ordemAtual = atual.ordem
  atual.ordem = vizinho.ordem
  vizinho.ordem = ordemAtual
  if (atual.ordem === vizinho.ordem) atual.ordem += direcao < 0 ? -1 : 1
  salvar()
}

// Tela cheia agora é a MESMA experiência interativa que é enviada pro
// cliente (mesmo visual, monta pedido tocando em +/−) — só que em "modo
// balcão": o botão final não tenta abrir o WhatsApp (não faz sentido
// quando é você segurando o celular), em vez disso pede nome/telefone do
// cliente e salva o pedido pra consultar depois em "Pedidos do balcão".
const htmlBalcao = computed(() => {
  try {
    const empresaComNumero = { ...s.company, whatsapp_pedidos: numeroEfetivoPedido.value }
    return gerarHtmlPedidoInterativo({
      config, grupos: gruposAtivos.value, empresa: empresaComNumero,
      modoBalcao: true, cardapioId: cardapioAtivo.value,
    })
  } catch (err) {
    console.warn('Falha ao montar a tela cheia do cardápio:', err)
    return `<!doctype html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#f7f3ee;color:#3d1f07;text-align:center;padding:24px;box-sizing:border-box;">
      <div>
        <p style="font-size:16px;margin-bottom:12px;">Não deu pra carregar o cardápio agora.</p>
        <button onclick="parent.postMessage('cardapio-recarregar','*')" style="font-size:15px;padding:10px 18px;border-radius:999px;border:none;background:#3d1f07;color:#fff;">Tentar de novo</button>
      </div>
    </body></html>`
  }
})

function slugNome() {
  if (config.nome_cardapio) return config.nome_cardapio.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const base = s.company.nome || 'cardapio'
  const sufixo = CARDAPIOS.find(c => c.id === cardapioAtivo.value)?.label || cardapioAtivo.value
  return `${base}-${sufixo}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const gerandoPdf = ref(false)
async function baixarPdf() {
  if (!todosItensAtivos.value.length) { s.notify?.('Ative pelo menos uma receita antes de gerar o cardápio.'); return }
  gerandoPdf.value = true
  try {
    await gerarPdfCardapioCompacto({ config, grupos: gruposAtivos.value, empresa: s.company, linkOnline: urlCardapioPublicado.value || null })
  } catch (err) {
    s.notify?.(err.message || 'Não foi possível gerar o PDF.')
  } finally {
    gerandoPdf.value = false
  }
}


async function compartilharLinkCardapio(url, { title, text } = {}) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'compartilhado'
    } catch {
      // Continua para fallback
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url)
      return 'copiado'
    } catch {
      // Continua para fallback
    }
  }

  return 'falha'
}

// Abre o cardápio público NA MESMA janela do app (sem target="_blank").
// Com _blank, o app instalado (PWA) abre uma janela nova sem histórico e o
// botão Voltar do Android fechava tudo. Na mesma janela, o Voltar retorna
// pra cá; a aba é guardada pra o app reabrir direto no Cardápio.
function abrirCardapioPublicado() {
  const url = urlLinkAtual.value
  if (!url) return
  try { sessionStorage.setItem('chocobete:voltarParaAba', s.tab) } catch { /* sem storage: volta pro Painel */ }
  window.location.href = url
}

async function copiarLinkPublicado() {
  const url = urlLinkAtual.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    s.notify?.('Link copiado! Cole no WhatsApp ou na bio do Instagram.')
  } catch {
    s.notify?.('Não consegui copiar sozinho. O link é: ' + url)
  }
}

async function gerarCardapioInterativo() {
  if (!todosItensAtivos.value.length) { s.notify?.('Ative pelo menos uma receita antes de gerar o cardápio.'); return }
  if (!numeroEfetivoPedido.value) {
    s.notify?.('Preencha seu número de WhatsApp antes de gerar o cardápio interativo.')
    return
  }
  gerandoPedidoInterativo.value = true
  try {
    const empresaComNumero = { ...s.company, whatsapp_pedidos: numeroEfetivoPedido.value }
    const html = gerarHtmlPedidoInterativo({ config, grupos: gruposAtivos.value, empresa: empresaComNumero, cardapioId: cardapioAtivo.value })

    const cfgPub = await carregarConfigPublicacao()
    const linkPublicacao = urlPublicaFinal({ ...cfgPub, caminho: `public/pedido-${cardapioAtivo.value}.html` })
    const textoCompartilhamento = `Confira o cardápio de ${config.nome_cardapio || s.company.nome || 'Cardápio'} e monte seu pedido aqui:`

    if (publicacaoConfigurada(cfgPub) && linkPublicacao.startsWith('http')) {
      try {
        const { url } = await publicarArquivoGitHub(html, { caminho: `public/pedido-${cardapioAtivo.value}.html` })
        configPublicacao.value = cfgPub
        const urlParaCompartilhar = urlLinkAtual.value || url || linkPublicacao
        const resultado = await compartilharLinkCardapio(urlParaCompartilhar, {
          title: `Cardápio ${config.nome_cardapio || s.company.nome || 'Cardápio'}`,
          text: `${textoCompartilhamento} ${urlParaCompartilhar}`,
        })

        if (resultado === 'copiado') {
          s.notify?.('Link copiado para a área de transferência. Cole no WhatsApp do cliente.')
        } else if (resultado === 'falha') {
          s.notify?.('Link pronto, mas não foi possível compartilhar automaticamente. Cole o link no WhatsApp do cliente: ' + urlParaCompartilhar)
        }
        return
      } catch (err) {
        s.notify?.('Não foi possível publicar o cardápio no GitHub. Enviando HTML como alternativa.')
      }
    }

    const blob = new Blob([html], { type: 'text/html' })
    const resultado = await compartilharArquivo(blob, {
      nomeArquivo: `pedido-${slugNome()}.html`,
      titulo: `Monte seu pedido — ${config.nome_cardapio || s.company.nome || 'Cardápio'}`,
      texto: 'Toque no arquivo pra montar seu pedido! 🍫',
    })
    if (resultado === 'baixado') {
      s.notify?.('Arquivo baixado — envie-o pro cliente pelo WhatsApp (como anexo de arquivo).')
    }
  } catch (err) {
    s.notify?.(err.message || 'Não foi possível gerar o cardápio interativo.')
  } finally {
    gerandoPedidoInterativo.value = false
  }
}

/**
 * Publica o cardápio interativo num link fixo (via GitHub → Cloudflare Pages)
 * em vez de gerar um arquivo pra anexar. Depois de publicar, já oferece
 * compartilhar o link (WhatsApp/qualquer app) ou copia pro clipboard.
 */
/**
 * Publica o cardápio interativo num link fixo (via GitHub → Cloudflare Pages)
 * em vez de gerar um arquivo pra anexar. Só cuida de publicar e mostrar o
 * andamento (com um tempo estimado de propagação) — quem decide se e quando
 * enviar o link pro cliente são os botões "Abrir"/"Copiar" logo abaixo, pra
 * não sair compartilhando um link que ainda pode estar desatualizado.
 */
async function publicarLinkCardapioInterativo() {
  if (!todosItensAtivos.value.length) { s.notify?.('Ative pelo menos uma receita antes de gerar o cardápio.'); return }
  if (!numeroEfetivoPedido.value) {
    s.notify?.('Preencha seu número de WhatsApp antes de gerar o cardápio interativo.')
    return
  }
  const cfgPub = await carregarConfigPublicacao()
  if (!publicacaoConfigurada(cfgPub)) {
    s.notify?.('Configure a publicação em Ajustes → Sistema (token do GitHub) antes de gerar o link.')
    return
  }
  publicandoLink.value = true
  linkStatus.value = 'publicando'
  pararContagemLink()
  try {
    const empresaComNumero = { ...s.company, whatsapp_pedidos: numeroEfetivoPedido.value }
    const html = gerarHtmlPedidoInterativo({ config, grupos: gruposAtivos.value, empresa: empresaComNumero, cardapioId: cardapioAtivo.value })
    await publicarArquivoGitHub(html, { caminho: `public/pedido-${cardapioAtivo.value}.html` })
    configPublicacao.value = cfgPub
    iniciarContagemLink()
  } catch (err) {
    linkStatus.value = 'idle'
    s.notify?.(err.message || 'Não foi possível publicar o cardápio.')
  } finally {
    publicandoLink.value = false
  }
}

</script>

<style scoped>
/* ── Base do corpo da aba ──────────────────────────────
   As classes "cad-body", "cad-search-bar/wrap/input" e "cad-empty*" vêm do
   padrão visual da Caderneta, mas o CSS delas está definido só dentro do
   <style scoped> de TabCaderneta.vue — como cada componente Vue "scoped"
   recebe um atributo data-v-xxxx próprio, essas regras nunca chegavam a
   valer aqui. Resultado: corpo sem padding, busca e estado vazio sem
   estilo nenhum. Redefinindo localmente para esta aba. */
.cad-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 14px 16px calc(20px + env(safe-area-inset-bottom)); }

/* ── Identidade "caderninho" (perfil da Bete) ──────────
   Mesmos elementos de assinatura visual do Início (TabCaderneta.vue):
   lombada perfurada + cabeçalho com fonte manuscrita. Redefinidos aqui
   pelo mesmo motivo do bloco de comentário acima — <style scoped> não
   atravessa componentes. Só aparecem quando standalone (perfil da Bete);
   no perfil do Yves o Cardápio continua com o cabeçalho .tab-hdr padrão. */
.cad-spiral {
  display: flex; justify-content: space-evenly; align-items: center;
  padding: 8px 22px 0; background: var(--surface); flex-shrink: 0;
}
.cad-spiral span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--bg); border: 1.5px solid var(--border2);
  box-shadow: inset 0 1px 2px rgba(61,31,7,.15);
}
.cad-hdr {
  background: var(--surface); padding: 4px 16px 14px; flex-shrink: 0;
  border-bottom: 1.5px dashed var(--border2);
}
.cad-hdr-titulo {
  font-family: var(--font-hand); font-size: 24px; font-weight: 700; color: var(--brown-dark);
  margin: 0; display: flex; align-items: center; gap: 8px;
}
.cad-hdr-titulo i { font-size: 18px; color: var(--gold-dark); }
.cad-hdr-date { font-size: 13px; color: var(--muted); font-weight: 700; margin: 3px 0 0; }
.cad-hdr-titulo-group { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.cad-hdr-titulo-group > div { min-width: 0; }
.cad-hdr-titulo-group .cad-hdr-titulo { font-size: 23px; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.cad-hdr-titulo-group .cad-hdr-date { text-transform: none; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.cad-hdr-icon-btn {
  width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid var(--border2);
  background: var(--surface); color: var(--brown-mid); display: flex; align-items: center; justify-content: center;
  font-size: 14px; cursor: pointer; padding: 0; flex-shrink: 0;
}

/* ── Abas do cardápio (Dia a dia / Festa) ──
   Faixa fina e full-width logo abaixo do cabeçalho — troca de lugar com o
   antigo seletor em pílula, que ficava espremido ao lado do título e
   comia largura da tela. Aqui o nome do cardápio ativo fica em destaque
   (cor + traço embaixo) e a faixa inteira serve de "trilho" visual pro
   swipe no conteúdo logo abaixo. */
.cp-tabs {
  position: relative; display: grid; grid-template-columns: repeat(var(--cp-seg-count, 2), 1fr);
  background: var(--surface); border-bottom: 1.5px solid var(--border2); flex-shrink: 0;
}
.cp-tabs-underline {
  position: absolute; bottom: -1.5px; left: 0; height: 2.5px;
  width: calc(100% / var(--cp-seg-count, 2));
  background: var(--gold-dark); border-radius: 2px 2px 0 0;
  transform: translateX(calc(var(--cp-seg-index, 0) * 100%));
  transition: transform .24s cubic-bezier(.4,0,.2,1);
}
.cp-tab {
  border: none; background: transparent; padding: 11px 6px; font-size: 13px; font-weight: 700;
  color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 7px;
  cursor: pointer; transition: color .18s; font-family: var(--font);
}
.cp-tab i { font-size: 12px; opacity: .8; }
.cp-tab.active { color: var(--brown-dark); }
.cp-bete .cp-tab.active { color: var(--gold-dark); }

/* Título do modal "Configurações" com o badge do cardápio ativo — deixa
   claro, mesmo depois de aberto por cima da tela, se é Dia a dia ou
   Festa que está sendo editado. */
.cp-modal-titulo { display: inline-flex; align-items: center; gap: 7px; }
.cp-modal-titulo-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; color: var(--gold-dark);
  background: var(--gold-bg); border: 1px solid var(--gold-light); border-radius: 999px;
  padding: 3px 9px 3px 8px;
}
.cp-modal-titulo-badge i { font-size: 10px; }

/* CTA "Enviar cardápio" no perfil da Bete — mesmo canhoto/ticket do CTA
   "Lançar novo fiado" do Início, pra manter a mesma linguagem visual. */

.cad-search-bar { padding: 0 0 2px; display: flex; align-items: center; gap: 8px; }
.cad-search-wrap {
  display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: var(--r-full); padding: 0 14px; height: 44px;
  color: var(--muted);
}
.cad-search-input {
  flex: 1; border: none; background: transparent; font-size: 15px;
  color: var(--text); outline: none; font-family: var(--font);
}

.cad-empty { text-align: center; padding: 60px 20px; color: var(--muted); }
.cad-empty-ico { font-size: 40px; margin-bottom: 10px; }

.cp-body { display: flex; flex-direction: column; gap: 14px; }
.cp-conteudo { display: flex; flex-direction: column; gap: 14px; }
.cp-tabs--sticky { position: sticky; top: -14px; z-index: 3; margin: 0 -16px; flex-shrink: 0; }


/* Ação principal do dia a dia: abrir o cardápio em tela cheia (modo balcão).
   Fica sozinha, grande e sem disputar espaço com o resto — é o botão que
   quem atende o cliente (ex: a esposa) precisa achar de primeira. */

.cp-acao {
  flex: 1; min-width: 104px; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 11px 10px; border-radius: var(--r-lg); border: 1px solid var(--border2);
  background: var(--surface); color: var(--brown); font-weight: 700; font-size: 12.5px;
  transition: var(--t);
}
.cp-acao:disabled { opacity: .6; }
.cp-acao--principal { background: var(--brown); color: #fff; border-color: var(--brown); }
/* "Atualizar link online" e a engrenagem de Configurações formam a dupla
   secundária/terciária ao lado do CTA principal — antes usavam estilos
   sem relação entre si (um contorno sólido, outro tracejado), o que dava
   uma sensação de "três botões de apps diferentes" na mesma barra. Agora
   os dois dividem a mesma linguagem (contorno + peso), só distinguindo
   por conteúdo: texto+ícone vs. só ícone. */
.cp-acao--icone { flex: 0 0 auto; min-width: 0; width: 44px; padding: 11px; }



/* ── Corpo do modal "Configurações do cardápio" ──
   O BaseModal não tem padding próprio no body (pra caber conteúdos que
   precisam de scroll/largura total), então o padding fica por conta de
   quem usa — igual ao cp-body da tela principal. */
.cp-modal-config-body { display: flex; flex-direction: column; gap: 14px; padding: 14px; }
.cp-link-inline { color: var(--brown); font-weight: 700; text-decoration: underline; background: none; border: none; padding: 0; font-size: inherit; }

.cp-aviso {
  display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--gold-dark);
  background: var(--gold-bg); border: 1px solid var(--gold-light); border-radius: var(--r-md);
  padding: 9px 12px;
}



.cp-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); font-weight: 600; min-width: 0; }
.cp-hist-preco-btn { background: none; border: none; color: var(--brown-mid); padding: 0 0 0 4px; cursor: pointer; font-size: 12px; vertical-align: middle; }
.cp-hist-preco-btn:hover { color: var(--brown-dark); }
.cp-field > input, .cp-field > textarea {
  width: 100%; font: inherit; font-size: 13.5px; color: var(--text); padding: 9px 10px; border-radius: var(--r-md);
  border: 1px solid var(--border2); background: var(--bg); resize: vertical; box-sizing: border-box;
}
.cp-field .input-with-prefix { min-height: 40px; }
.cp-field .input-with-prefix input { font-size: 13.5px; padding: 9px 10px; min-height: auto; }
.cp-field-cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.cp-field-cabecalho-btns { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cp-ia-btn {
  display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
  font-size: 11px; font-weight: 700; color: var(--gold-dark); background: var(--gold-bg);
  border: 1px solid var(--gold-light); border-radius: var(--r-full); padding: 4px 10px;
}
.cp-copiar-btn {
  display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
  font-size: 11px; font-weight: 700; color: var(--terracota-escuro, #7a4520); background: var(--surface);
  border: 1px solid var(--border2); border-radius: var(--r-full); padding: 4px 10px;
}

.cp-dias-linha { display: flex; align-items: center; gap: 8px; }
.cp-dias-linha input {
  width: 64px; flex: 0 0 64px; font: inherit; font-size: 13.5px; color: var(--text);
  padding: 9px 10px; border-radius: var(--r-md); border: 1px solid var(--border2);
  background: var(--bg); text-align: center; box-sizing: border-box;
}
.cp-dias-sufixo { font-size: 11px; color: var(--muted); font-weight: 500; }

.cp-numero-detectado {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 13.5px; color: var(--text); font-weight: 600;
  padding: 9px 10px; border-radius: var(--r-md); border: 1px solid var(--border2); background: var(--bg);
}
.cp-link {
  background: none; border: none; padding: 0; font: inherit; font-size: 11.5px; font-weight: 600;
  color: var(--gold-dark); text-decoration: underline; cursor: pointer; white-space: nowrap;
}

/* seletor de cardápio agora usa .seg-control/.seg-btn globais (main.css) */
.cad-hdr-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }

.cp-grupos { display: flex; flex-direction: column; gap: 18px; }
.cp-grupo-cabecalho { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.cp-grupo-titulo-bloco { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; flex: 1; padding-top: 4px; }
.cp-grupo-titulo {
  font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase;
  color: var(--gold-dark); padding-left: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cp-grupo-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-left: 2px; }
.cp-grupo-selo-minimo {
  display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 700;
  letter-spacing: normal; text-transform: none; color: #0e0c0a; background: var(--gold);
  border-radius: 999px; padding: 2px 8px; white-space: nowrap;
}
.cp-grupo-selo-estado {
  display: inline-flex; align-items: center; font-size: 9.5px; font-weight: 700;
  letter-spacing: normal; text-transform: none; border-radius: 999px; padding: 2px 8px; white-space: nowrap;
}
.cp-grupo-selo-estado--parcial { background: var(--orange-bg); color: var(--orange); }
.cp-grupo-selo-estado--oculta { background: var(--border2); color: var(--muted); }
.cp-grupo-cabecalho-acoes { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cp-grupo-opcoes-btn {
  width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; border: none; background: var(--bg); color: var(--brown-mid); font-size: 13px; transition: var(--t);
}
.cp-grupo-opcoes-btn:active { background: var(--border2); }
.cp-aba-padrao-grupo { display: flex; gap: 6px; flex-shrink: 0; }
.cp-aba-padrao-btn {
  border: 1px solid var(--border); background: var(--surface); color: var(--brown-mid);
  font-size: 11.5px; font-weight: 700; padding: 7px 12px; border-radius: 999px; transition: var(--t);
  white-space: nowrap;
}
.cp-aba-padrao-btn.active { border-color: var(--gold); background: var(--gold); color: #fff; }
.cp-grupo-minimo-form { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.cp-grupo-minimo-campo { display: flex; flex-direction: column; gap: 3px; }
.cp-grupo-minimo-campo span { font-size: 10px; font-weight: 700; color: var(--muted); }
.cp-grupo-minimo-input {
  width: 76px; font: inherit; font-size: 13px; color: var(--text); padding: 6px 8px;
  border-radius: var(--r-md); border: 1px solid var(--border2); background: var(--bg);
}

/* ── Modal "Opções da categoria" ── */
.cp-opcoes-grupo { padding: 16px; display: flex; flex-direction: column; gap: 18px; }
.cp-opcoes-secao { display: flex; flex-direction: column; gap: 10px; }
.cp-opcoes-secao-titulo { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 800; color: var(--text); }
.cp-opcoes-secao-titulo i { color: var(--gold-dark); font-size: 12px; }
.cp-opcoes-secao-hint { font-size: 12px; color: var(--muted); line-height: 1.45; margin: -2px 0 2px; }
.cp-opcoes-divisor { height: 1px; background: var(--border); }
.cp-opcoes-campo-preco { width: 100%; }
.cp-opcoes-btn-aplicar { width: 100%; justify-content: center; margin-top: 2px; }
.cp-link--perigo { color: var(--red, #c0392b); align-self: flex-start; }

/* ── Modal "Copiar de outro item" ── */
.cp-copiar-modal { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.cp-copiar-hint { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.cp-copiar-campos { display: flex; gap: 14px; flex-wrap: wrap; }
.cp-copiar-campo-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--text); }
.cp-copiar-busca { width: 100%; box-sizing: border-box; font: inherit; font-size: 13.5px; color: var(--text); padding: 9px 10px; border-radius: var(--r-md); border: 1px solid var(--border2); background: var(--bg); }
.cp-copiar-lista { display: flex; flex-direction: column; gap: 6px; max-height: 50vh; overflow-y: auto; }
.cp-copiar-item {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); padding: 8px 10px;
}
.cp-copiar-item:active { background: var(--gold-bg); }
.cp-copiar-item-avatar {
  flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
  background: var(--gold-bg); border: 1px solid var(--gold-light);
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.cp-copiar-item-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cp-copiar-item-corpo { flex: 1; min-width: 0; }
.cp-copiar-item-nome { font-size: 13px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cp-copiar-item-selo {
  font-size: 9.5px; font-weight: 700; color: var(--gold-dark); background: var(--gold-bg);
  border: 1px solid var(--gold-light); border-radius: var(--r-full); padding: 1px 7px; text-transform: none;
}
.cp-copiar-item-selo--outro { color: var(--muted); background: var(--bg); border-color: var(--border2); }
.cp-copiar-item-desc { font-size: 11.5px; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
.cp-copiar-vazio { font-size: 12.5px; color: var(--muted); text-align: center; padding: 20px 0; }

.cp-item { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); margin-bottom: 8px; overflow: hidden; }
.cp-item--inativo { opacity: .5; }
.cp-item-topo { display: flex; align-items: center; gap: 8px; padding: 10px; }

.cp-switch-btn { flex-shrink: 0; border: none; background: none; padding: 0; }
.cp-switch { display: inline-flex; align-items: center; width: 34px; height: 20px; border-radius: 999px; background: var(--border2); padding: 2px; transition: var(--t); }
.cp-switch.on { background: var(--gold); }
.cp-switch.on.partial { background: var(--orange); }
.cp-switch-bola { width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: var(--t); }
.cp-switch.on .cp-switch-bola { transform: translateX(14px); }

.cp-item-avatar {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; overflow: hidden;
  background: var(--gold-bg); border: 1px solid var(--gold-light);
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.cp-item-avatar img { width: 100%; height: 100%; object-fit: cover; }

.cp-item-corpo { flex: 1; min-width: 0; text-align: left; border: none; background: none; padding: 0; }
.cp-item-linha1 { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
.cp-item-nome { font-weight: 700; font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-item-selos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 3px; }
.cp-item-selo-destaque {
  display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700;
  color: #fff; background: linear-gradient(135deg, var(--gold-light), var(--gold-dark));
  border-radius: 999px; padding: 1px 7px; width: fit-content;
}
.cp-item-selo-destaque i { font-size: 9px; }
.cp-item-selo-encomenda {
  display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700;
  color: #8a5a00; background: #fdf0d5; border: 1px solid #e8c179; border-radius: 999px;
  padding: 1px 7px; width: fit-content;
}
.cp-item-preco { font-weight: 800; font-size: 13px; color: var(--gold-dark); white-space: nowrap; }
.cp-item-desc { font-size: 11.5px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cp-item-expand { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--muted); border: none; background: none; padding: 0; }

.cp-item-painel { padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 10px; border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 12px; }

.cp-remover-foto { font-size: 12px; color: var(--red); font-weight: 700; padding: 6px 8px; border: none; background: none; }



/* ── Tela cheia ──
   Usa as variáveis do design system do app — o cardápio interativo
   (CSS_PEDIDO) agora usa essa mesma paleta, então a moldura já bate com o
   conteúdo do iframe desde o primeiro carregamento. */
.cp-fullscreen { position: fixed; inset: 0; z-index: 2000; background: var(--bg); display: flex; flex-direction: column; }
.cp-fullscreen-barra {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: max(10px, env(safe-area-inset-top)) 10px 10px; background: #fff;
  border-bottom: 1px solid var(--border);
}
.cp-fs-esquerda { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cp-fs-acoes { display: flex; gap: 6px; flex-shrink: 0; }
.cp-fs-btn {
  width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: var(--gold-bg); border: 1px solid var(--gold-light); color: var(--gold-dark); font-size: 14px;
  flex-shrink: 0;
}
.cp-fs-btn--editar {
  width: auto; height: 36px; border-radius: 999px; padding: 0 12px; gap: 6px;
  font-size: 12px; font-weight: 700; white-space: nowrap;
}
.cp-fs-btn:disabled { opacity: .5; }
.cp-fs-switch {
  position: relative; display: grid; grid-template-columns: repeat(var(--cp-seg-count, 2), 1fr);
  gap: 0; background: var(--gold-bg); border: 1px solid var(--gold-light); border-radius: 999px; padding: 3px;
  flex-shrink: 0;
}
.cp-fs-switch-thumb {
  position: absolute; top: 3px; bottom: 3px; left: 3px;
  width: calc((100% - 6px) / var(--cp-seg-count, 2));
  background: #fff; border-radius: 999px; box-shadow: 0 1px 3px rgba(0,0,0,.15);
  transform: translateX(calc(var(--cp-seg-index, 0) * 100%));
  transition: transform .22s cubic-bezier(.4,0,.2,1);
}
.cp-fs-switch-btn {
  position: relative; z-index: 1; width: 34px; height: 30px; border: none; background: transparent;
  color: var(--gold-dark); font-size: 13px; display: flex; align-items: center; justify-content: center;
  opacity: .6; transition: opacity .22s;
}
.cp-fs-switch-btn.active { opacity: 1; }
.cp-fullscreen-iframe { flex: 1; width: 100%; border: none; background: var(--bg); }

.cp-badge {
  display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px;
  border-radius: 999px; background: var(--red, #c0392b); color: #fff; font-size: 10.5px; font-weight: 700; padding: 0 5px; margin-left: 4px;
}

/* "Pedidos do balcão" usa o tema claro normal do app — é uma tela interna,
   não o cardápio que o cliente vê — só reaproveita a estrutura de overlay
   em tela cheia. */
.cp-fullscreen--claro { background: var(--surface, #fff); }
.cp-fullscreen-barra--clara {
  background: var(--surface, #fff); border-bottom: 1px solid var(--border);
}
.cp-fullscreen-barra--clara .cp-fs-btn--editar { background: transparent; border: 1px solid var(--border); color: var(--brown-dark); }
.cp-pedidos-titulo { font-weight: 700; font-size: 14px; color: var(--brown-dark); }
.cp-pedidos-corpo { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }

/* ── Identidade "caderninho" na barra da Tela cheia (perfil da Bete) ──
   A barra é controle da Bete (fechar/trocar cardápio/enviar/editar), não
   parte do que o cliente vê dentro do iframe — por isso recebe a mesma
   linguagem visual do resto do perfil dela. No perfil do Yves a barra
   mantém a paleta neutra original. */
.cp-fs-bete .cp-fullscreen-barra:not(.cp-fullscreen-barra--clara) {
  background: var(--surface); border-bottom: 1.5px dashed var(--border2);
}
.cp-fs-bete .cp-fs-btn { background: var(--gold-bg); border-color: var(--gold); color: var(--gold-dark); }
.cp-fs-bete .cp-fs-btn--editar { background: var(--brown); border-color: var(--brown); color: #fff; }
.cp-fs-bete .cp-fs-switch { background: var(--cream); border-color: var(--border2); }
.cp-fs-bete .cp-fs-switch-thumb { background: var(--surface); }
.cp-fs-bete .cp-fs-switch-btn { color: var(--brown-mid); }
.cp-fs-bete .cp-fs-switch-btn.active { color: var(--gold-dark); }
.cp-fs-bete .cp-pedidos-titulo {
  font-family: var(--font-hand); font-size: 22px; font-weight: 700; color: var(--brown-dark);
}

/* Título "Cardápio" na barra da Tela cheia — mesma fonte manuscrita e o
   mesmo botão quadrado-arredondado usados nos cabeçalhos das outras telas
   (Lojas, Resumo, Cardápio editor), pra fechar a identidade visual. */
.cp-fs-spiral { background: var(--surface); padding-top: max(6px, env(safe-area-inset-top)); }
.cp-fs-titulo {
  font-family: var(--font-hand); font-size: 22px; font-weight: 700; color: var(--brown-dark);
  margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 34vw;
}
.cp-fs-bete .cp-fs-btn {
  border-radius: 9px;
}

.cp-pedidos-vazio { text-align: center; color: var(--muted); padding: 60px 24px; font-size: 13px; line-height: 1.6; }
.cp-pedidos-vazio i { font-size: 30px; opacity: .5; display: block; margin-bottom: 10px; }

.cp-pedido-card { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); padding: 12px 14px; transition: opacity var(--t); }
.cp-pedido-card.is-agendado { border-color: var(--blue); border-left-width: 3px; }
.cp-pedido-card.is-entregue { opacity: .62; }
.cp-pedido-topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.cp-pedido-cliente { display: flex; flex-direction: column; }
.cp-pedido-cliente strong { font-size: 13.5px; color: var(--brown-dark); }
.cp-pedido-data { font-size: 10.5px; color: var(--muted); }
.cp-pedido-status {
  display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700;
  padding: 4px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0;
}
.cp-pedido-status i { font-size: 9px; }
.cp-pedido-status.is-pendente { background: var(--gold-bg); color: var(--gold-dark); }
.cp-pedido-status.is-agendado { background: var(--blue-bg); color: var(--blue); }
.cp-pedido-status.is-entregue { background: var(--green-bg); color: var(--green); }
.cp-pedido-itens { font-size: 12.5px; color: var(--brown-mid); margin-top: 8px; line-height: 1.6; }
.cp-pedido-pagamento { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--muted); margin-top: 8px; }
.cp-pedido-acoes { display: flex; gap: 8px; margin-top: 10px; }
.cp-pedido-acoes .cp-acao { flex: 1; justify-content: center; padding: 8px 10px; font-size: 11.5px; }
.cp-pedido-acoes--secundarias .cp-acao { background: transparent; }
.cp-acao--perigo { color: var(--red); border-color: var(--red-dim, #f0c4c0); }
.cp-pedido-acoes .cp-acao--icone { flex: 0 0 auto !important; width: 38px; padding: 8px; }
.cp-acao--entregue { background: var(--green) !important; border-color: var(--green) !important; color: #fff !important; font-weight: 700; }
.cp-acao--entregue:active { background: #145c35 !important; }

/* ── Agendamento do pedido — data/hora combinada com o cliente (não tem
     relação nenhuma com produção, é só "pra quando ficou combinado"). ── */
.cp-pedido-agenda-info {
  display: flex; align-items: center; gap: 7px; margin-top: 10px; font-size: 12.5px;
  color: var(--blue); background: var(--blue-bg); border-radius: var(--r-sm);
  padding: 9px 11px;
}
.cp-pedido-agenda-info i { font-size: 13px; flex-shrink: 0; }
.cp-pedido-agenda-editor {
  margin-top: 10px; padding: 12px; border-radius: var(--r-sm); background: var(--blue-bg);
  border: 1px solid #cfe0fb;
}
.cp-pedido-agenda-editor-titulo {
  display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
  color: var(--blue); margin-bottom: 10px;
}
.cp-pedido-agenda-editor-campos { display: flex; gap: 8px; }
.cp-pedido-agenda-campo { display: flex; flex-direction: column; gap: 4px; flex: 1.3; font-size: 10.5px; color: var(--muted); font-weight: 700; }
.cp-pedido-agenda-campo--hora { flex: 1; }
.cp-pedido-agenda-campo em { font-weight: 500; font-style: normal; opacity: .75; }
.cp-pedido-agenda-input {
  width: 100%; padding: 9px 10px; border: 1.5px solid var(--border); border-radius: var(--r-sm);
  font-size: 14px; font-family: var(--font); color: var(--text); background: var(--surface);
}
.cp-pedido-agenda-input:focus { outline: none; border-color: var(--blue); }
.cp-pedido-agenda-editor-acoes { display: flex; gap: 8px; margin-top: 10px; }
.cp-pedido-agenda-editor-acoes .cp-acao { flex: 1; justify-content: center; padding: 9px 14px; font-size: 12px; }
.cp-pedido-agenda-editor-acoes .cp-acao--principal { flex: 1.4; }

/* Prévia do banner da categoria (modal de opções) */
.cp-capa-previa { position: relative; height: 112px; border-radius: 14px; overflow: hidden; background: linear-gradient(135deg, #5a3016, #2a1504); margin-top: 8px; }
.cp-capa-previa img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cp-capa-previa::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,10,3,.1), rgba(20,10,3,.8)); }
.cp-capa-previa-vazio { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: rgba(255,255,255,.55); font-size: 12px; font-weight: 700; }
.cp-capa-previa-vazio i { font-size: 22px; }
.cp-capa-previa-titulo { position: absolute; left: 14px; bottom: 12px; z-index: 1; color: #fff; font-weight: 800; font-size: 17px; text-transform: uppercase; letter-spacing: .06em; text-shadow: 0 2px 6px rgba(0,0,0,.4); }
.cp-capa-acoes { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.cp-capa-btn { cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }

/* ══════════════════════════════════════════════════════════════
   Cardápio no app (classes cx-*)
══════════════════════════════════════════════════════════════ */
.cp-body, .cp-conteudo { gap: 16px; }
.cx-compartilhar { display: flex; flex-direction: column; gap: 12px; }

/* Modo balcão: o botão que quem atende precisa achar de primeira */
.cx-balcao { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 70px; padding: 12px 14px; border: none; border-radius: 20px; background: linear-gradient(135deg, var(--gold) 0%, #e0a21d 100%); color: #2b1a06; text-align: left; box-shadow: 0 6px 16px rgba(200, 137, 10, .28); cursor: pointer; font-family: var(--font); transition: transform var(--t); }
.cx-balcao:active { transform: scale(.985); }
.cx-balcao-ico { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: rgba(255, 255, 255, .38); font-size: 1.15rem; }
.cx-balcao-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.cx-balcao-txt strong { font-size: 1rem; font-weight: 800; }
.cx-balcao-txt small { margin-top: 2px; font-size: .8rem; font-weight: 600; opacity: .8; }
.cx-balcao-seta { font-size: .8rem; opacity: .65; }

/* Cartões */
.cx-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow-sm); padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.cx-card-cab { display: flex; align-items: center; gap: 12px; }
.cx-tile { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: var(--cream); color: var(--brown-mid); font-size: 1.05rem; }
.cx-tile--ouro { background: var(--gold-bg); color: var(--gold-dark); }
.cx-card-tit h3 { margin: 0; font-size: 1.05rem; font-weight: 800; line-height: 1.25; color: var(--brown-dark); }
.cx-card-tit p { margin: 2px 0 0; font-size: .84rem; line-height: 1.4; color: var(--muted); }

/* Botões */
.cx-btn-enviar { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 54px; border: none; border-radius: 16px; background: var(--brown-dark); color: #fff; font-family: var(--font); font-size: 1.02rem; font-weight: 800; cursor: pointer; transition: transform var(--t); }
.cx-btn-enviar:active { transform: scale(.98); }
.cx-btn-enviar:disabled { opacity: .65; }
.cx-btn-sec { flex: 1; min-height: 46px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1.5px solid var(--border2); border-radius: 14px; background: var(--surface); color: var(--brown); font-family: var(--font); font-size: .88rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background var(--t); }
.cx-btn-sec:active { background: var(--cream); }
.cx-btn-sec:disabled { opacity: .55; }
.cx-btn-perigo { color: var(--red); border-color: var(--red-dim, #f3b4b4); }
.cx-btn-sec:focus-visible, .cx-btn-enviar:focus-visible, .cx-balcao:focus-visible, .cx-atalho:focus-visible, .cx-sec-cab:focus-visible, .cx-linha-switch:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }

/* Link do cardápio */
.cx-link { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border); }
.cx-link-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cx-link-lbl { font-size: .88rem; font-weight: 800; color: var(--brown-dark); display: inline-flex; align-items: center; gap: 7px; }
.cx-link-lbl i { color: var(--gold-dark); }
.cx-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--r-full); font-size: .76rem; font-weight: 800; }
.cx-status--ok { background: var(--green-bg); color: var(--green); }
.cx-status--espera { background: var(--gold-bg); color: var(--gold-dark); }
.cx-link-url { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-radius: 14px; background: var(--cream); border: 1px solid var(--border); color: var(--brown); font-size: .86rem; font-weight: 700; text-decoration: none; min-width: 0; }
.cx-link-url span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.cx-link-url i { flex-shrink: 0; font-size: .75rem; opacity: .6; }
.cx-link-aviso { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--gold-bg); color: var(--gold-dark); font-size: .84rem; font-weight: 700; line-height: 1.4; }
.cx-link-aviso--ok { background: var(--green-bg); color: var(--green); }
.cx-link-btns { display: flex; gap: 8px; }
.cx-link-seg { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--cream); border: 1px solid var(--border); }
.cx-link-seg-btn { flex: 1; min-height: 38px; border: 0; border-radius: 10px; background: transparent; color: var(--brown); font-family: var(--font); font-size: .86rem; font-weight: 700; cursor: pointer; }
.cx-link-seg-btn--on { background: var(--surface); box-shadow: 0 1px 3px rgba(0,0,0,.12); color: var(--brown-dark); }
.cx-link-dica { margin: 0; font-size: .8rem; line-height: 1.4; color: var(--brown); opacity: .8; }
.cx-nota { margin: 0; font-size: .8rem; line-height: 1.5; color: var(--muted); }
.cx-nota--solta { padding-top: 2px; }

/* Atalhos */
.cx-atalhos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cx-atalho { position: relative; display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 56px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-sm); color: var(--brown-dark); font-family: var(--font); font-size: .88rem; font-weight: 800; cursor: pointer; }
.cx-atalho:active { background: var(--cream); }
.cx-atalho i { font-size: 1.05rem; color: var(--gold-dark); }
.cx-badge { min-width: 22px; height: 22px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; background: var(--red); color: #fff; font-size: .74rem; font-weight: 800; }

/* Configurações: seções com resumo do estado atual */
.cp-modal-config-body { gap: 12px; }
.cx-sec { border: 1px solid var(--border); border-radius: 18px; background: var(--surface); overflow: hidden; }
.cx-sec-cab { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 68px; padding: 12px 14px; background: none; border: none; text-align: left; cursor: pointer; font-family: var(--font); }
.cx-sec-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cx-sec-txt strong { font-size: .96rem; font-weight: 800; color: var(--brown-dark); }
.cx-sec-txt small { font-size: .8rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cx-seta { font-size: .75rem; color: var(--muted); }
.cx-sec-corpo { display: flex; flex-direction: column; gap: 14px; padding: 14px 14px 16px; border-top: 1px solid var(--border); }
.cx-sec-corpo .cp-field > input, .cx-sec-corpo .cp-field > textarea { padding: 12px; min-height: 48px; border-radius: 12px; border-width: 1.5px; }
.cx-sec-corpo .cp-field > textarea { min-height: 80px; }
.cx-sec-corpo .cp-field { font-size: .84rem; color: var(--brown-mid); font-weight: 700; gap: 6px; }

/* Linhas com interruptor */
.cx-bloco--lista { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--surface); display: flex; flex-direction: column; gap: 0; }
.cx-linha-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 62px; padding: 12px 14px; border: none; border-top: 1px solid var(--border); background: none; text-align: left; cursor: pointer; font-family: var(--font); }
.cx-linha-switch:first-child { border-top: none; }
.cx-linha-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cx-linha-txt strong { font-size: .92rem; font-weight: 800; color: var(--brown-dark); display: flex; align-items: center; gap: 7px; }
.cx-linha-txt strong i { color: var(--gold-dark); font-size: .85rem; }
.cx-linha-txt small { font-size: .8rem; line-height: 1.4; color: var(--muted); }
.cx-linha-fixa { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cx-linha-fixa .cx-btn-sec { flex: 0 0 auto; }
.cx-switch { -webkit-appearance: none; appearance: none; position: relative; flex-shrink: 0; margin: 0; width: 50px; height: 30px; border-radius: var(--r-full); background: var(--border2); cursor: pointer; transition: background var(--t); }
.cx-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform var(--t); }
.cx-switch:checked { background: var(--gold); }
.cx-switch:checked::after { transform: translateX(20px); }
.cx-switch:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }

/* Explicações longas recolhidas */
.cx-saiba { border-radius: 12px; background: var(--bg); }
.cx-saiba > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 12px; font-size: .84rem; font-weight: 700; color: var(--brown-mid); }
.cx-saiba > summary::-webkit-details-marker { display: none; }
.cx-saiba > summary::before { content: '?'; width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--border2); color: var(--brown-dark); font-size: .72rem; font-weight: 800; }
.cx-saiba > p { margin: 0; padding: 0 12px 12px; font-size: .82rem; line-height: 1.55; color: var(--muted); }
.cx-saiba--dentro { border-radius: 0; border-top: 1px solid var(--border); }

/* Edição do item */
.cp-item { border-radius: 18px; margin-bottom: 10px; box-shadow: var(--shadow-sm); }
.cp-item-topo { gap: 10px; padding: 12px; }
.cp-item-avatar { width: 54px; height: 54px; border-radius: 14px; overflow: visible; font-size: 1.5rem; }
.cp-item-avatar img { border-radius: 13px; }
.cx-avatar { position: relative; cursor: pointer; }
.cx-avatar-cam { position: absolute; right: -4px; bottom: -4px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--brown-dark); color: #fff; font-size: .6rem; border: 2px solid var(--surface); }
.cx-painel { gap: 18px; padding: 14px 14px 16px; }
.cx-bloco { display: flex; flex-direction: column; gap: 10px; }
.cx-bloco--lista { gap: 0; }
.cx-bloco-tit { font-size: .9rem; font-weight: 800; color: var(--brown-dark); display: flex; align-items: center; gap: 7px; }
.cx-bloco-tit > i { color: var(--gold-dark); font-size: .85rem; }
.cx-foto { display: flex; align-items: center; gap: 14px; }
.cx-foto-prev { width: 92px; height: 92px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 18px; background: var(--gold-bg); border: 1px solid var(--gold-light); font-size: 2.3rem; }
.cx-foto-prev img { width: 100%; height: 100%; object-fit: cover; }
.cx-foto-btns { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.cx-foto-btns .cx-btn-sec { width: 100%; flex: none; }
.cx-emoji-campo input { width: 88px; text-align: center; }
.cx-contador { font-size: .78rem; font-weight: 700; color: var(--muted); }
.cx-textarea { width: 100%; font: inherit; padding: 12px; min-height: 76px; border-radius: 12px; border: 1.5px solid var(--border2); background: var(--bg); color: var(--text); resize: vertical; box-sizing: border-box; }
.cx-painel .input-with-prefix { min-height: 48px; border: 1.5px solid var(--border2); border-radius: 12px; }
.cx-painel .input-with-prefix input { min-height: 46px; }
.cx-ordem { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.cx-ordem-lbl { font-size: .86rem; font-weight: 700; color: var(--muted); }
.cx-ordem-btns { display: flex; gap: 8px; }
.cx-ordem-btns .cx-btn-sec { flex: 0 0 auto; }

/* Lista por categoria: título legível, alvos de toque maiores */
.cp-grupos { gap: 20px; }
.cp-grupo-titulo { font-size: 1.02rem; font-weight: 800; letter-spacing: 0; text-transform: none; color: var(--brown-dark); }
.cp-grupo-selo-minimo, .cp-grupo-selo-estado { font-size: .72rem; padding: 3px 9px; }
.cp-grupo-opcoes-btn { width: 40px; height: 40px; font-size: .95rem; }
.cp-switch-btn { padding: 4px; }
.cp-switch { width: 46px; height: 28px; padding: 3px; }
.cp-switch-bola { width: 22px; height: 22px; }
.cp-switch.on .cp-switch-bola { transform: translateX(18px); }
.cp-item-nome { font-size: .97rem; max-width: 100%; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.25; }
.cp-item-preco { font-size: .92rem; }
.cp-item-desc { font-size: .82rem; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.cp-item-expand { width: 40px; height: 40px; }
.cp-tab { padding: 14px 6px; font-size: .92rem; }
.cp-aba-padrao-btn { min-height: 40px; font-size: .84rem; padding: 0 14px; }
@media (prefers-reduced-motion: reduce) { .cx-switch, .cx-switch::after, .cx-balcao, .cx-btn-enviar { transition: none; } }
</style>