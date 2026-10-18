<template>
  <div class="tab-ajustes">
    <!-- ── Cabeçalho ───────────────────────────────────── -->
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-sliders"></i> Ajustes</h2>
      </div>

      <!-- ── Navegação por Setores (Menus) ── -->
      <div ref="abaStripEl" class="aba-nav">
        <button v-for="m in menus" :key="m.id" class="aba-btn"
          :ref="el => setAbaRef(el, m.id)"
          :class="{ active: abaAtiva === m.id }"
          @click="abaAtiva = m.id">
          <i :class="m.icon"></i> {{ m.label }}
        </button>
      </div>
    </div>

    <div class="ajustes-content">
      <!-- ── SEÇÃO: PERFIS ── -->
      <section v-if="abaAtiva === 'perfis'" class="aj-pagina fade-in">
        <header class="aj-cab">
          <h3 class="aj-titulo">Perfis de uso</h3>
          <p class="aj-desc">Escolha como o ChocoBete abre e quais telas cada perfil enxerga.</p>
        </header>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Ao abrir o app</h4>
            <p class="aj-grupo-desc">Qual perfil aparece quando o ChocoBete é aberto.</p>
          </div>
          <article class="aj-card">
            <div class="aj-form">
              <div class="fg">
                <label class="label" for="aj-inicial">Perfil inicial</label>
                <select id="aj-inicial" v-model="perfilConfig.inicial" class="input">
                  <option value="selecao">Mostrar seleção de perfil</option>
                  <option value="ym">Abrir direto no perfil Admin</option>
                  <option value="bete">Abrir direto no perfil Vendas</option>
                  <option v-for="e in perfilConfig.extras" :key="e.id" :value="e.id">Abrir direto no perfil {{ e.nome }}</option>
                </select>
              </div>
            </div>
          </article>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Perfis do sistema</h4>
            <p class="aj-grupo-desc">Toque para editar. Admin cuida da administração; Vendas é o fluxo simples de clientes e pedidos.</p>
          </div>

          <details v-for="perfilId in ['ym', 'bete']" :key="perfilId" class="aj-card aj-colapso">
            <summary class="aj-row">
              <div class="aj-tile"><i class="fas" :class="perfilId === 'ym' ? 'fa-chart-line' : 'fa-book-open'"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">{{ perfilConfig[perfilId].nome || (perfilId === 'ym' ? 'Admin' : 'Vendas') }}</div>
                <div class="aj-row-sub">{{ perfilConfig[perfilId].descricao || (perfilId === 'ym' ? 'Administração do sistema' : 'Clientes e pedidos') }}</div>
              </div>
            </summary>
            <div class="aj-form">
              <div class="fg">
                <label class="label" :for="`aj-nome-${perfilId}`">Nome do perfil</label>
                <input :id="`aj-nome-${perfilId}`" v-model="perfilConfig[perfilId].nome" class="input" maxlength="30" />
              </div>
              <div class="fg">
                <label class="label" :for="`aj-desc-${perfilId}`">Descrição</label>
                <input :id="`aj-desc-${perfilId}`" v-model="perfilConfig[perfilId].descricao" class="input" maxlength="80" />
              </div>

              <div v-if="perfilId === 'ym'" class="fg">
                <span class="label">Telas que este perfil enxerga</span>
                <div class="aj-lista-switch">
                  <label v-for="modulo in modulosYves" :key="modulo.id" class="aj-switch-linha">
                    <i class="fas aj-item-icone" :class="modulo.icon"></i>
                    <span class="aj-switch-txt">{{ modulo.label }}</span>
                    <input v-model="perfilConfig.ym.modulos" type="checkbox" role="switch" class="aj-switch" :value="modulo.id">
                  </label>
                </div>
                <p class="aj-nota">Ajustes e Painel ficam sempre disponíveis, para você nunca perder o acesso às configurações.</p>
              </div>
              <p v-else class="aj-nota">O perfil Vendas usa o Caderninho como tela principal. O Cardápio continua acessível pelos atalhos de vendas.</p>
            </div>
          </details>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Perfis adicionais</h4>
            <p class="aj-grupo-desc">Crie um perfil para cada função (ex.: Produção, Financeiro) e escolha quais telas cada um enxerga.</p>
          </div>

          <details v-for="extra in perfilConfig.extras" :key="extra.id" class="aj-card aj-colapso">
            <summary class="aj-row">
              <div class="aj-tile" :style="{ color: extra.cor }"><i class="fas fa-user-tag"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-cabeca">
                  <div class="aj-row-titulo">{{ extra.nome || 'Perfil sem nome' }}</div>
                  <span v-if="!extra.modulos.length" class="aj-pill aj-pill--aviso">Sem telas</span>
                </div>
                <div class="aj-row-sub">{{ extra.modulos.length === 0 ? 'Nenhuma tela' : extra.modulos.length === 1 ? '1 tela' : `${extra.modulos.length} telas` }}<template v-if="extra.descricao"> · {{ extra.descricao }}</template></div>
              </div>
            </summary>
            <div class="aj-form">
              <div class="fg">
                <label class="label" :for="`aj-nome-${extra.id}`">Nome do perfil</label>
                <input :id="`aj-nome-${extra.id}`" v-model="extra.nome" class="input" maxlength="30" />
              </div>
              <div class="fg">
                <label class="label" :for="`aj-desc-${extra.id}`">Descrição</label>
                <input :id="`aj-desc-${extra.id}`" v-model="extra.descricao" class="input" maxlength="80" />
              </div>
              <div class="fg">
                <span class="label">Telas que este perfil enxerga</span>
                <div class="aj-lista-switch">
                  <label v-for="modulo in modulosYves" :key="modulo.id" class="aj-switch-linha">
                    <i class="fas aj-item-icone" :class="modulo.icon"></i>
                    <span class="aj-switch-txt">{{ modulo.label }}</span>
                    <input v-model="extra.modulos" type="checkbox" role="switch" class="aj-switch" :value="modulo.id">
                  </label>
                </div>
                <p v-if="!extra.modulos.length" class="aj-nota aj-nota--erro">Escolha pelo menos uma tela, senão este perfil abre em branco.</p>
              </div>
              <button class="btn aj-btn-risco" @click="removerExtra(extra.id)">
                <i class="fas fa-trash"></i> Remover este perfil
              </button>
            </div>
          </details>

          <button v-if="!mostrarNovoPerfil" class="aj-adicionar" @click="mostrarNovoPerfil = true">
            <i class="fas fa-plus"></i> Adicionar novo perfil
          </button>
          <article v-else class="aj-card">
            <div class="aj-row">
              <div class="aj-tile"><i class="fas fa-user-plus"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Novo perfil</div>
                <div class="aj-row-sub">Depois de criar, escolha as telas dele.</div>
              </div>
            </div>
            <div class="aj-form aj-form--sem-topo">
              <div class="fg">
                <label class="label" for="aj-novo-nome">Nome do perfil</label>
                <input id="aj-novo-nome" v-model="novoPerfilNome" class="input" maxlength="30" placeholder="Ex.: Estoque, Entregas..." />
              </div>
              <div class="fg">
                <label class="label" for="aj-novo-desc">Descrição <span class="label-opt">(opcional)</span></label>
                <input id="aj-novo-desc" v-model="novoPerfilDescricao" class="input" maxlength="80" />
              </div>
              <div class="aj-botoes">
                <button class="btn btn-secondary" @click="cancelarNovoPerfil">Cancelar</button>
                <button class="btn btn-primary" :disabled="!novoPerfilNome.trim()" @click="confirmarNovoPerfil">
                  <i class="fas fa-plus"></i> Criar perfil
                </button>
              </div>
            </div>
          </article>
        </div>

        <button class="btn btn-primary aj-salvar" @click="salvarPerfis">
          <i class="fas fa-floppy-disk"></i> Salvar perfis
        </button>
      </section>

      <!-- ── SEÇÃO: IDENTIDADE ── -->
      <section v-if="abaAtiva === 'perfil'" class="aj-pagina fade-in">
        <header class="aj-cab">
          <h3 class="aj-titulo">Identidade da marca</h3>
          <p class="aj-desc">Esses dados aparecem nos cabeçalhos dos documentos e das etiquetas.</p>
        </header>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Logotipo</h4>
          </div>
          <article class="aj-card">
            <div class="aj-row">
              <div class="aj-logo" :class="{ 'aj-logo--vazio': !company.logo }">
                <img v-if="company.logo" :src="company.logo" alt="Logotipo">
                <i v-else class="fas fa-cookie-bite"></i>
              </div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">{{ company.logo ? 'Logotipo atual' : 'Nenhum logotipo ainda' }}</div>
                <div class="aj-row-sub">PNG ou JPG, de qualquer tamanho: o app ajusta sozinho. PNG com fundo transparente fica melhor no cabeçalho.</div>
              </div>
            </div>
            <div class="aj-acoes">
              <label class="btn btn-secondary">
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onLogoSelecionado">
                <i class="fas fa-image"></i> {{ company.logo ? 'Trocar' : 'Enviar logotipo' }}
              </label>
              <button v-if="company.logo" class="btn aj-btn-risco" @click="removerLogo">
                <i class="fas fa-trash"></i> Remover
              </button>
            </div>
          </article>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Dados do negócio</h4>
          </div>
          <article class="aj-card">
            <div class="aj-form">
              <div class="fg">
                <label class="label" for="aj-marca">Nome da marca</label>
                <input id="aj-marca" v-model="company.nome" class="input" placeholder="Ex: ChocoBete" />
              </div>
              <div class="fg">
                <label class="label" for="aj-razao">Razão social</label>
                <input id="aj-razao" v-model="company.razao_social" class="input" placeholder="Nome completo ou razão social" />
              </div>
              <div class="fg">
                <label class="label" for="aj-cpf">CPF do titular</label>
                <input id="aj-cpf" :value="company.cpf" @input="e => company.cpf = maskCpf(e.target.value)"
                  class="input" inputmode="numeric" placeholder="000.000.000-00" />
              </div>
              <div class="fg">
                <label class="label" for="aj-cnpj">CNPJ</label>
                <input id="aj-cnpj" :value="company.cnpj" @input="e => company.cnpj = maskCnpj(e.target.value)"
                  class="input" inputmode="numeric" placeholder="00.000.000/0001-00" />
              </div>
              <div class="fg">
                <label class="label" for="aj-cnae">CNAE principal</label>
                <input id="aj-cnae" :value="company.cnae" @input="e => company.cnae = maskCnae(e.target.value)"
                  class="input" inputmode="numeric" placeholder="Ex: 1091-1/01" />
              </div>
              <div class="aj-form-2">
                <div class="fg">
                  <label class="label" for="aj-municipio">Município</label>
                  <input id="aj-municipio" v-model="company.municipio" class="input" placeholder="Ex: Rio de Janeiro" />
                </div>
                <div class="fg">
                  <label class="label" for="aj-uf">UF</label>
                  <input id="aj-uf" v-model="company.uf" class="input" maxlength="2" placeholder="RJ" autocapitalize="characters" />
                </div>
              </div>
            </div>
          </article>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Contato e pedidos</h4>
          </div>
          <article class="aj-card">
            <div class="aj-form">
              <div class="fg">
                <label class="label" for="aj-whats">WhatsApp para pedidos</label>
                <input id="aj-whats" :value="maskTelefone(company.whatsapp_pedidos)" @input="e => company.whatsapp_pedidos = maskTelefone(e.target.value)"
                  class="input" type="tel" inputmode="numeric" placeholder="Ex: (21) 99943-0023" />
                <span class="aj-nota">Com DDD, sem +55. É para este número que vão os pedidos feitos no cardápio interativo.</span>
              </div>
              <div class="fg">
                <label class="label" for="aj-insta">Instagram</label>
                <input id="aj-insta" :value="company.instagram ? '@' + company.instagram : ''" @input="e => company.instagram = normalizarInstagram(e.target.value)"
                  class="input" type="text" autocapitalize="none" autocorrect="off" placeholder="Ex: @chocobete" />
                <span class="aj-nota">Aparece em Meu contato (Caderneta), no QR de contato e no cabeçalho do cardápio. Para atualizar o cardápio que já está no ar, publique-o de novo.</span>
              </div>
            </div>
          </article>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Comprovantes e cobrança</h4>
            <p class="aj-grupo-desc">Vale para as mensagens de WhatsApp da Caderneta.</p>
          </div>
          <article class="aj-card">
            <label class="aj-switch-linha aj-switch-linha--tile">
              <div class="aj-tile"><i class="fas fa-clock"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Mostrar o horário da venda</div>
                <div class="aj-row-sub">Desligue se você costuma lançar vendas fiado fora do horário real (ex.: fechando o dia à noite). O comprovante passa a mostrar só a data.</div>
              </div>
              <input v-model="company.mostrar_hora_venda" type="checkbox" role="switch" class="aj-switch">
            </label>
          </article>
        </div>

        <button class="btn btn-primary aj-salvar" @click="save">
          <i class="fas fa-floppy-disk"></i> Salvar dados da empresa
        </button>
      </section>

      <!-- ── SEÇÃO: FINANCEIRO ── -->
      <section v-if="abaAtiva === 'financeiro'" class="aj-pagina fade-in">
        <header class="aj-cab">
          <h3 class="aj-titulo">Financeiro</h3>
          <p class="aj-desc">Contas, categorias, metas e taxas usadas nos extratos e nos cálculos de preço.</p>
        </header>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Contas financeiras</h4>
            <p class="aj-grupo-desc">Cadastre as contas para importar extratos do PagBank, Itaú ou Banco do Brasil.</p>
          </div>
          <article class="aj-card">
            <p v-if="!s.contasFinanceiras.length" class="aj-vazio">Nenhuma conta cadastrada ainda. Adicione uma para começar a importar extratos.</p>
            <div v-for="(conta, idx) in s.contasFinanceiras" :key="conta.id" class="aj-linha-item">
              <div class="aj-tile" :class="`aj-tile--${conta.banco}`">
                <i class="fas" :class="conta.banco === 'itau' ? 'fa-landmark' : (conta.banco === 'bb' ? 'fa-building-columns' : 'fa-mobile-screen')"></i>
              </div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">{{ conta.nome }}</div>
                <div class="aj-row-sub">{{ nomeBanco(conta.banco) }} · {{ nomeNatureza(conta.natureza) }}</div>
              </div>
              <button class="aj-icbtn" title="Editar conta" aria-label="Editar conta" @click="abrirModalConta(conta)"><i class="fas fa-pencil"></i></button>
              <button class="aj-icbtn aj-icbtn--perigo" title="Excluir conta" aria-label="Excluir conta" @click="removerConta(idx)"><i class="fas fa-trash-can"></i></button>
            </div>
            <button class="aj-item-btn aj-item-btn--add" @click="abrirModalConta(null)">
              <i class="fas fa-plus aj-item-icone"></i>
              <span>Adicionar conta</span>
            </button>
          </article>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Categorias de lançamento</h4>
            <p class="aj-grupo-desc">Aparecem ao editar um lançamento e já batem com a importação de extratos. Se você mudar um nome, os lançamentos antigos são atualizados junto.</p>
          </div>

          <details v-for="grupo in gruposCategorias" :key="grupo.nome" class="aj-card aj-colapso">
            <summary class="aj-row">
              <div class="aj-tile"><i class="fas fa-tags"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">{{ grupo.nome }}</div>
                <div class="aj-row-sub">{{ grupo.categorias.length === 0 ? 'Nenhuma categoria' : grupo.categorias.length === 1 ? '1 categoria' : `${grupo.categorias.length} categorias` }}</div>
              </div>
            </summary>
            <div class="aj-linha-item" v-for="cat in grupo.categorias" :key="cat.nome">
              <div class="aj-tile"><i class="fas" :class="cat.icon || 'fa-tag'"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">{{ cat.nome }}</div>
                <div class="aj-row-sub">{{ labelNaturezaCategoria(cat.natureza) }}</div>
              </div>
              <button class="aj-icbtn" title="Editar categoria" aria-label="Editar categoria" @click="abrirModalCategoria(cat)"><i class="fas fa-pencil"></i></button>
              <button class="aj-icbtn aj-icbtn--perigo" title="Excluir categoria" aria-label="Excluir categoria" @click="confirmarExclusaoCategoria(cat)"><i class="fas fa-trash-can"></i></button>
            </div>
          </details>

          <div class="aj-botoes">
            <button class="btn btn-secondary" @click="abrirModalCategoria(null)">
              <i class="fas fa-plus"></i> Nova categoria
            </button>
            <button class="btn btn-secondary" @click="confirmarRestaurarCategorias">
              <i class="fas fa-rotate-left"></i> Restaurar padrão
            </button>
          </div>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Metas e valores</h4>
          </div>
          <article class="aj-card">
            <div class="aj-form">
              <div class="fg">
                <label class="label" for="aj-hora">Valor da sua hora de trabalho</label>
                <div class="input-with-prefix">
                  <span class="input-prefix">R$</span>
                  <input id="aj-hora" v-model.number="company.custo_hora_trabalho" type="number" inputmode="decimal" class="input" placeholder="Ex: 25.00" />
                </div>
                <span class="aj-nota">Usado para calcular o custo de mão de obra nas receitas.</span>
              </div>
              <div class="fg">
                <label class="label" for="aj-salario">Meta de retirada mensal (salário)</label>
                <div class="input-with-prefix">
                  <span class="input-prefix">R$</span>
                  <input id="aj-salario" v-model.number="company.meta_salario_mensal" type="number" inputmode="decimal" class="input" placeholder="Ex: 1500.00" />
                </div>
                <span class="aj-nota">Define o preço mínimo e as metas de venda na Inteligência. Mudar aqui vale do mês atual em diante: os meses passados continuam com o valor da época.</span>
              </div>
              <div class="fg">
                <label class="label" for="aj-giro">Giro de segurança fixo <span class="label-opt">(opcional)</span></label>
                <div class="input-with-prefix">
                  <span class="input-prefix">R$</span>
                  <input id="aj-giro" v-model.number="company.reserva_operacional_fixa" type="number" inputmode="decimal" class="input" placeholder="Ex: 600.00" />
                </div>
                <span class="aj-nota">Valor reservado para compras (ex.: R$ 600 para 2 semanas). Mesma regra: vale de agora em diante.</span>
              </div>
              <div class="fg">
                <label class="label" for="aj-mei">Teto de faturamento MEI anual</label>
                <div class="input-with-prefix">
                  <span class="input-prefix">R$</span>
                  <input id="aj-mei" v-model.number="company.teto_mei_anual" type="number" inputmode="decimal" class="input" />
                </div>
              </div>
            </div>
          </article>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Taxas da máquina</h4>
            <p class="aj-grupo-desc">Usadas na calculadora de taxas do Caderninho da Bete.</p>
          </div>
          <article class="aj-card">
            <div class="aj-form">
              <div class="aj-form-2 aj-form-2--iguais">
                <div class="fg">
                  <label class="label" for="aj-debito">Débito (%)</label>
                  <input id="aj-debito" v-model.number="taxasCaderneta.debito" type="number" step="0.01" inputmode="decimal" class="input" />
                </div>
                <div class="fg">
                  <label class="label" for="aj-credito">Crédito à vista (%)</label>
                  <input id="aj-credito" v-model.number="taxasCaderneta.credito_avista" type="number" step="0.01" inputmode="decimal" class="input" />
                </div>
              </div>
            </div>
          </article>
        </div>

        <button class="btn btn-primary aj-salvar" @click="save">
          <i class="fas fa-floppy-disk"></i> Salvar alterações
        </button>
      </section>

      <!-- ── SEÇÃO: BACKUP ── -->
      <section v-if="abaAtiva === 'backup'" class="aj-pagina fade-in">
        <header class="aj-cab">
          <h3 class="aj-titulo">Backup</h3>
          <p class="aj-desc">Cópias dos seus dados para você não perder nada se trocar de celular ou se der algum problema.</p>
        </header>

        <!-- Resumo: uma olhada e já sabe se está tudo certo -->
        <div class="aj-resumo" :class="`aj-resumo--${statusBackup}`" role="status">
          <div class="aj-resumo-icone">
            <i :class="statusBackup === 'ok' ? 'fas fa-check' : statusBackup === 'warn' ? 'fas fa-exclamation' : 'fas fa-cloud-arrow-up'"></i>
          </div>
          <div class="aj-row-txt">
            <strong class="aj-resumo-titulo" v-if="statusBackup === 'ok'">Tudo certo com o seu backup</strong>
            <strong class="aj-resumo-titulo" v-else-if="statusBackup === 'warn'">Seu backup está desatualizado</strong>
            <strong class="aj-resumo-titulo" v-else>Seus dados ainda não estão no Drive</strong>
            <span class="aj-row-sub" v-if="statusBackup === 'warn'">{{ s.alertaBackup.msg }}</span>
            <span class="aj-row-sub" v-else-if="s.googleDriveConfigured && s.infoBackupDrive">Última cópia no Drive: {{ dataHoraBR(s.infoBackupDrive.modifiedTime) }}</span>
            <span class="aj-row-sub" v-else-if="s.googleDriveConfigured">Ainda não há cópia no Drive.</span>
            <span class="aj-row-sub" v-else>Conecte o Google Drive para ter uma cópia automática.</span>
          </div>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Onde guardar suas cópias</h4>
            <p class="aj-grupo-desc">O Google Drive é o mais prático: salva sozinho. As outras opções são extras.</p>
          </div>

          <!-- Google Drive -->
          <article class="aj-card">
            <div class="aj-row">
              <div class="aj-tile" :class="{ 'aj-tile--on': s.googleDriveConfigured }"><i class="fab fa-google-drive"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-cabeca">
                  <div class="aj-row-titulo">Google Drive</div>
                  <span v-if="s.googleDriveConfigured" class="aj-pill aj-pill--ok"><i class="fas fa-circle-check"></i> Conectado</span>
                  <span v-else class="aj-pill aj-pill--rec">Recomendado</span>
                </div>
                <template v-if="s.googleDriveConfigured">
                  <div v-if="s.contaGoogle" class="aj-row-sub aj-row-sub--forte">{{ s.contaGoogle.nome || s.contaGoogle.email }}</div>
                  <div v-if="s.contaGoogle && s.contaGoogle.nome && s.contaGoogle.email" class="aj-row-sub">{{ s.contaGoogle.email }}</div>
                  <div v-if="!s.contaGoogle" class="aj-row-sub">Salva sozinho a cada alteração</div>
                </template>
                <div v-else class="aj-row-sub">Salva sozinho na sua conta Google e deixa abrir o app em outro aparelho.</div>
              </div>
            </div>

            <div v-if="!s.googleDriveConfigured" class="aj-acoes">
              <button class="btn btn-primary" @click="s.conectarGoogleDrive">
                <i class="fab fa-google"></i> Conectar ao Google Drive
              </button>
            </div>

            <template v-else>
              <div class="aj-acoes">
                <button class="btn btn-primary" @click="s.backupGoogleDrive">
                  <i class="fas fa-cloud-arrow-up"></i> Salvar agora
                </button>
                <button class="btn btn-secondary" @click="s.restaurarGoogleDrive">
                  <i class="fas fa-cloud-arrow-down"></i> Restaurar
                </button>
              </div>

              <details class="aj-item">
                <summary>
                  <i class="fas fa-clock-rotate-left aj-item-icone"></i>
                  <span>Versões anteriores</span>
                  <span v-if="s.infoBackupDrive" class="aj-contagem">{{ s.infoBackupDrive.versoes }}</span>
                </summary>
                <div class="aj-item-corpo">
                  <p v-if="s.carregandoHistoricoDrive">Carregando…</p>
                  <p v-else-if="!s.historicoDrive.length">Ainda não há versões anteriores. Elas aparecem aqui conforme você usa o app.</p>
                  <template v-else>
                    <div v-for="item in s.historicoDrive" :key="item.id" class="aj-versao">
                      <span>{{ dataHoraBR(item.modifiedTime) }}<span v-if="item.fixada" title="Fixada: não é apagada automaticamente"> 📌</span></span>
                      <button class="btn btn-secondary btn-sm" @click="s.restaurarGoogleDriveVersao(item)">Restaurar</button>
                    </div>
                    <p>Guardamos as 8 mais recentes, a última de cada dia (14 dias) e a última de cada semana (8 semanas). O 📌 marca versões fixadas ao resolver um conflito: elas nunca são apagadas sozinhas.</p>
                  </template>
                </div>
              </details>

              <details class="aj-item">
                <summary>
                  <i class="fas fa-circle-info aj-item-icone"></i>
                  <span>Como funciona</span>
                </summary>
                <div class="aj-item-corpo">
                  <p>O app confere o Drive ao abrir, ao voltar para ele e a cada alteração. Se dois aparelhos mudarem dados ao mesmo tempo, ele junta o trabalho dos dois.</p>
                  <p><strong>Restaurar</strong> troca tudo deste aparelho pelo que está salvo no Drive. Antes disso, uma cópia de segurança do estado atual fica guardada.</p>
                </div>
              </details>

              <button class="aj-item-btn aj-item-btn--perigo" @click="s.desconectarGoogleDrive">
                <i class="fas fa-right-from-bracket aj-item-icone"></i>
                <span>Desconectar conta</span>
              </button>
            </template>
          </article>

          <!-- Arquivo no aparelho -->
          <article class="aj-card">
            <div class="aj-row">
              <div class="aj-tile"><i class="fas fa-file-arrow-down"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Arquivo no aparelho</div>
                <div class="aj-row-sub">Funciona sem internet e sem conta Google. Guarde o arquivo em lugar seguro, como e-mail ou pendrive.</div>
              </div>
            </div>
            <div class="aj-acoes">
              <button class="btn btn-secondary" @click="s.backupGeral">
                <i class="fas fa-download"></i> Baixar cópia
              </button>
              <label class="btn btn-secondary">
                <i class="fas fa-upload"></i> Restaurar
                <input type="file" hidden accept=".json" @change="e => { s.restaurarGeral(e.target.files[0]); e.target.value = '' }" />
              </label>
            </div>
          </article>

          <!-- Pasta automática (só Chrome/Edge no computador) -->
          <article v-if="backupLocal.suportado" class="aj-card">
            <div class="aj-row">
              <div class="aj-tile" :class="{ 'aj-tile--on': backupLocal.configurada && backupLocal.permissao === 'granted' }"><i class="fas fa-folder-open"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-cabeca">
                  <div class="aj-row-titulo">Pasta automática</div>
                  <span v-if="backupLocal.configurada && backupLocal.permissao === 'granted'" class="aj-pill aj-pill--ok"><i class="fas fa-circle-check"></i> Ativa</span>
                  <span v-else-if="backupLocal.configurada" class="aj-pill aj-pill--aviso">Autorizar</span>
                  <span v-else class="aj-pill aj-pill--off">Desligada</span>
                </div>
                <div class="aj-row-sub" v-if="backupLocal.configurada && backupLocal.permissao === 'granted'">
                  Gravando em “{{ backupLocal.nome }}”<template v-if="backupLocal.ultimo"> · última vez {{ dataHoraBR(backupLocal.ultimo) }}</template>
                </div>
                <div class="aj-row-sub" v-else-if="backupLocal.configurada">A pasta “{{ backupLocal.nome }}” precisa de autorização de novo.</div>
                <div class="aj-row-sub" v-else>Grava uma cópia numa pasta do computador, sozinho.</div>
              </div>
            </div>
            <div class="aj-acoes">
              <button v-if="!backupLocal.configurada" class="btn btn-primary" @click="escolherPastaLocal">
                <i class="fas fa-folder-plus"></i> Escolher pasta
              </button>
              <template v-else>
                <button v-if="backupLocal.permissao !== 'granted'" class="btn btn-primary" @click="reautorizarPastaLocal">Autorizar de novo</button>
                <button v-else class="btn btn-secondary" @click="gravarPastaLocalAgora">Gravar agora</button>
                <button class="btn btn-secondary" @click="desconectarPastaLocal">Desconectar</button>
              </template>
            </div>
            <details class="aj-item">
              <summary>
                <i class="fas fa-circle-info aj-item-icone"></i>
                <span>Como funciona</span>
              </summary>
              <div class="aj-item-corpo">
                <p>Alguns segundos depois de cada alteração, o app grava uma cópia completa na pasta que você escolher e guarda versões anteriores nela. Prefira uma pasta que já sincronize com outro lugar (OneDrive, Google Drive para computador ou pendrive).</p>
              </div>
            </details>
          </article>

          <!-- Cópias de segurança automáticas (só aparece se existirem) -->
          <details v-if="s.snapshotsSeguranca.length" class="aj-card aj-colapso aj-card--aviso">
            <summary class="aj-row">
              <div class="aj-tile aj-tile--warn"><i class="fas fa-shield-halved"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Cópias de segurança do aparelho</div>
                <div class="aj-row-sub">Guardadas antes de seus dados serem substituídos</div>
              </div>
              <span class="aj-contagem">{{ s.snapshotsSeguranca.length }}</span>
            </summary>
            <div class="aj-item-corpo aj-item-corpo--solto">
              <p>Elas são criadas sozinhas antes de uma sincronização, restauração ou escolha num conflito entre aparelhos. Restaurar troca os dados atuais pelos da cópia, e o estado atual também fica guardado.</p>
              <div v-for="snap in s.snapshotsSeguranca" :key="snap.id" class="aj-versao">
                <span class="aj-versao-txt">
                  {{ dataHoraBR(snap.ts) }}
                  <small v-if="snap.motivo">{{ snap.motivo }}</small>
                </span>
                <span class="aj-versao-acoes">
                  <button class="btn btn-secondary btn-sm" @click="confirmarRestaurarSnapshotSeguranca(snap)">Restaurar</button>
                  <button class="btn btn-secondary btn-sm aj-btn-icone" title="Descartar esta cópia" aria-label="Descartar esta cópia" @click="s.descartarSnapshotSeguranca(snap.id)"><i class="fas fa-trash"></i></button>
                </span>
              </div>
            </div>
          </details>
        </div>

        <p class="aj-rodape">
          Tamanho dos seus dados: {{ s.tamanhoDadosBytes != null ? formatarBytes(s.tamanhoDadosBytes) : 'calculando…' }}
          <template v-if="s.googleDriveConfigured && s.infoBackupDrive"> · {{ formatarBytes(s.infoBackupDrive.tamanhoTotal) }} usados no Drive</template>
        </p>
      </section>

      <!-- ── SEÇÃO: SISTEMA ── -->
      <section v-if="abaAtiva === 'sistema'" class="aj-pagina fade-in">
        <header class="aj-cab">
          <h3 class="aj-titulo">Sistema</h3>
          <p class="aj-desc">Preferências do app neste aparelho. As escolhas valem na hora, não precisa salvar.</p>
        </header>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Layout da tela</h4>
            <p class="aj-grupo-desc">Como o app se organiza. Agora está no modo {{ isDesktop ? 'computador' : 'celular' }}.</p>
          </div>
          <div class="aj-card" role="radiogroup" aria-label="Layout da tela">
            <button
              v-for="m in MODOS_LAYOUT" :key="m.id"
              class="aj-opcao" :class="{ 'is-ativa': preferenciaLayout === m.id }"
              role="radio" :aria-checked="preferenciaLayout === m.id"
              @click="definirModoLayout(m.id)"
            >
              <div class="aj-tile"><i :class="m.icon"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">{{ m.label }}</div>
                <div class="aj-row-sub">{{ m.desc }}</div>
              </div>
              <span class="aj-radio" aria-hidden="true"></span>
            </button>
          </div>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Lista de compras</h4>
            <p class="aj-grupo-desc">Como a aba Compras do Painel sugere o que comprar.</p>
          </div>
          <div class="aj-card" role="radiogroup" aria-label="Lista de compras">
            <button
              class="aj-opcao" :class="{ 'is-ativa': modoCompras === 'lista' }"
              role="radio" :aria-checked="modoCompras === 'lista'"
              @click="alterarModoCompras('lista')"
            >
              <div class="aj-tile"><i class="fas fa-list-check"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Lista de planejamento</div>
                <div class="aj-row-sub">Mostra o que a produção recente vai consumir e o custo estimado. Você mesmo risca o que já tem.</div>
              </div>
              <span class="aj-radio" aria-hidden="true"></span>
            </button>
            <button
              class="aj-opcao" :class="{ 'is-ativa': modoCompras === 'estoque' }"
              role="radio" :aria-checked="modoCompras === 'estoque'"
              @click="alterarModoCompras('estoque')"
            >
              <div class="aj-tile"><i class="fas fa-boxes-stacked"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Controle de estoque</div>
                <div class="aj-row-sub">Usa a quantidade que você tem de cada insumo e avisa só o que está acabando.</div>
              </div>
              <span class="aj-radio" aria-hidden="true"></span>
            </button>
          </div>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo">Ferramentas</h4>
          </div>

          <article class="aj-card">
            <div class="aj-row">
              <div class="aj-tile"><i class="fas fa-wand-magic-sparkles"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Reclassificar extratos</div>
                <div class="aj-row-sub">Aplica as regras automáticas de categoria nos lançamentos que você não editou à mão.</div>
              </div>
            </div>
            <div class="aj-acoes">
              <button class="btn btn-secondary" @click="reclassificarLancamentos">
                <i class="fas fa-rotate"></i> Reclassificar agora
              </button>
            </div>
          </article>

          <!-- Publicação do Cardápio Interativo (GitHub + Cloudflare) -->
          <details class="aj-card aj-colapso">
            <summary class="aj-row">
              <div class="aj-tile"><i class="fab fa-github"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-cabeca">
                  <div class="aj-row-titulo">Link do Cardápio Interativo</div>
                  <span class="aj-pill aj-pill--off">Avançado</span>
                </div>
                <div class="aj-row-sub">Publica o cardápio num link fixo, em vez de enviar o arquivo .html.</div>
              </div>
            </summary>
            <div class="aj-form">
              <div class="fg">
                <label class="label" for="aj-token">Token do GitHub</label>
                <input id="aj-token" v-model="pub.token" class="input" type="password" placeholder="github_pat_..." autocomplete="off" />
                <span class="aj-nota">Use um token “fine-grained” com permissão só de Contents: Read/Write.</span>
              </div>
              <p v-if="pub.owner && pub.repo" class="aj-nota">
                Publicando em <strong>{{ pub.owner }}/{{ pub.repo }}</strong> (branch <strong>{{ pub.branch }}</strong>)
                → <strong>{{ pub.dominio || 'domínio não definido' }}</strong>.
                Para mudar, edite o <code>.env</code> e gere um novo build.
              </p>
              <p v-else class="aj-nota aj-nota--erro">
                Repositório e domínio não estão configurados no <code>.env</code> (VITE_GH_OWNER, VITE_GH_REPO,
                VITE_GH_BRANCH, VITE_GH_DOMINIO). Preencha e gere um novo build antes de publicar.
              </p>
              <button class="btn btn-secondary" @click="salvarPublicacao">
                <i class="fas fa-floppy-disk"></i> Salvar configuração
              </button>
            </div>
          </details>
        </div>

        <div class="aj-grupo">
          <div class="aj-grupo-cab">
            <h4 class="aj-grupo-titulo aj-grupo-titulo--risco">Zona de risco</h4>
          </div>
          <article class="aj-card aj-card--risco">
            <div class="aj-row">
              <div class="aj-tile aj-tile--risco"><i class="fas fa-trash-can"></i></div>
              <div class="aj-row-txt">
                <div class="aj-row-titulo">Apagar todos os dados</div>
                <div class="aj-row-sub">Remove para sempre receitas, produtos e histórico financeiro. Não dá para desfazer.</div>
              </div>
            </div>
            <div class="aj-acoes">
              <button class="btn aj-btn-risco" @click="zerarDados">
                <i class="fas fa-trash-can"></i> Apagar tudo
              </button>
            </div>
          </article>
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

    <BaseModal v-if="modalCategoria" :title="formCategoria.nomeOriginal ? 'Editar Categoria' : 'Nova Categoria'" @close="modalCategoria = false">
      <div class="form-section">
        <div class="fg">
          <label class="label">Nome</label>
          <input v-model="formCategoria.nome" class="input" placeholder="Ex: Insumos e Matéria-Prima" />
        </div>
        <div class="fg">
          <label class="label">Grupo</label>
          <input v-model="formCategoria.grupo" class="input" placeholder="Ex: Negócio" list="grupos-categoria" />
          <datalist id="grupos-categoria">
            <option v-for="g in gruposCategorias" :key="g.nome" :value="g.nome" />
          </datalist>
        </div>
        <div class="fg">
          <label class="label">Natureza</label>
          <select v-model="formCategoria.natureza" class="input">
            <option value="entrada">Entrada (receita)</option>
            <option value="operacional">Operacional (custo do negócio)</option>
            <option value="pessoal">Pessoal</option>
            <option value="interna">Interna (transferência)</option>
          </select>
        </div>
        <div class="fg">
          <label class="label">Ícone <span class="label-opt">(Font Awesome, opcional)</span></label>
          <input v-model="formCategoria.icon" class="input" placeholder="Ex: fa-cookie" />
        </div>
      </div>
      <template #foot>
        <div class="spacer"></div>
        <button class="btn btn-secondary" @click="modalCategoria = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="!formCategoria.nome" @click="salvarCategoriaModal">Salvar</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useStore } from '../store.js'
import { maskCpf, maskCnpj, maskCnae, maskTelefone, processarLogo, getMesRef, dataHoraBR, formatarBytes } from '../utils.js'
import { useConfirm as useAppConfirm } from '../composables/useConfirm.js'
import { useTabScroll } from '../composables/useTabScroll.js'
import { normalizarInstagram } from '../services/contatoService.js'
import { 
  getTaxas, 
  salvarTaxas 
} from '../composables/useCaderneta.js'
import { carregarConfigPublicacao, salvarConfigPublicacao } from '../services/githubPublish.js'
import { statusBackupLocal, escolherPastaBackupLocal, reautorizarPastaBackupLocal, desconectarPastaBackupLocal } from '../services/localBackup.js'
import BaseModal from '../components/BaseModal.vue'
import { useLayoutMode, MODOS_LAYOUT } from '../composables/useLayoutMode.js'

const s = useStore()
const confirmar = useAppConfirm()
const company = reactive({ ...s.company })
const perfilConfig = reactive(JSON.parse(JSON.stringify(s.perfis)))
const modoCompras = ref(s.modoListaCompras)
watch(() => s.modoListaCompras, (v) => { modoCompras.value = v })
function alterarModoCompras(modo) {
  modoCompras.value = modo
  s.saveModoListaCompras(modo)
}
const modulosYves = [
  { id: 'painel', label: 'Painel', icon: 'fa-chart-pie' },
  { id: 'cozinha', label: 'Cozinha', icon: 'fa-utensils' },
  { id: 'receitas', label: 'Receitas', icon: 'fa-book-open' },
  { id: 'insumos', label: 'Estoque', icon: 'fa-boxes' },
  { id: 'financeiro', label: 'Financeiro', icon: 'fa-money-check-dollar' },
  { id: 'producao', label: 'Histórico', icon: 'fa-clock-rotate-left' },
  { id: 'inteligencia', label: 'Inteligência', icon: 'fa-brain' },
  { id: 'etiquetas', label: 'Etiquetas', icon: 'fa-tags' },
  { id: 'cardapio', label: 'Cardápio', icon: 'fa-book-bookmark' },
  { id: 'ajustes', label: 'Ajustes', icon: 'fa-cog' },
]

// ── Publicação do Cardápio Interativo ──
// owner/repo/branch/dominio agora só vêm do .env (não são mais editáveis nem
// persistidos aqui) — só o token continua sendo digitado e salvo no app.
const pub = reactive({ token: '', owner: '', repo: '', branch: 'main', caminho: 'public/pedido.html', dominio: '' })
carregarConfigPublicacao().then(cfg => Object.assign(pub, cfg))

async function salvarPublicacao() {
  // Salva o token normalmente, mas owner/repo/branch/dominio são sempre
  // sobrescritos pelo valor atual do .env antes de gravar — assim uma
  // configuração salva antigamente (na versão com os campos editáveis)
  // nunca fica "presa" no IndexedDB por baixo do valor do .env.
  await salvarConfigPublicacao({
    ...pub,
    owner: import.meta.env.VITE_GH_OWNER || '',
    repo: import.meta.env.VITE_GH_REPO || '',
    branch: import.meta.env.VITE_GH_BRANCH || 'main',
    dominio: import.meta.env.VITE_GH_DOMINIO || '',
  })
  s.notify('Configuração de publicação salva!')
}

// 🔄 Sincroniza o formulário local quando os dados são carregados do banco (Store Init)
// Isso evita que a tela mostre dados padrão caso o banco demore a responder
watch(() => s.company, (novoValor) => {
  if (novoValor) {
    // Copia os dados da store para o estado local do formulário
    Object.assign(company, JSON.parse(JSON.stringify(novoValor)))
  }
}, { deep: true, immediate: true })

const { preferencia: preferenciaLayout, isDesktop, definirModo: definirModoLayout } = useLayoutMode()
const abaAtiva = ref('perfil')
// Estado geral do backup: 'ok' (Drive ligado e em dia), 'warn' (Drive ligado com alerta) ou 'off'
const statusBackup = computed(() => !s.googleDriveConfigured ? 'off' : (s.alertaBackup ? 'warn' : 'ok'))

async function confirmarRestaurarSnapshotSeguranca(snap) {
  const quando = snap?.ts ? dataHoraBR(snap.ts) : 'essa cópia'
  const ok = await confirmar.ask(
    `Isso vai substituir os dados atuais deste aparelho pela cópia de ${quando}. O estado atual fica guardado como mais uma cópia, então dá pra desfazer. Deseja continuar?`,
    { title: 'Restaurar cópia local', confirmLabel: 'Restaurar', type: 'warning' }
  )
  if (!ok) return
  const res = await s.restaurarSnapshotSeguranca(snap?.id)
  if (!res.ok) s.notify?.(res.erro || 'Não foi possível restaurar a cópia local.', 'error')
}

// ── Pasta de backup automático (File System Access) ──
const backupLocal = reactive({ suportado: false, configurada: false, nome: null, permissao: null, ultimo: null })
async function atualizarBackupLocal() {
  Object.assign(backupLocal, await statusBackupLocal())
}
async function escolherPastaLocal() {
  try {
    await escolherPastaBackupLocal()
    await s.salvarBackupLocalAgora({ forcar: true })
    s.notify?.('Pasta de backup configurada!')
  } catch (e) {
    if (e?.name !== 'AbortError') s.notify?.(e?.message || 'Não foi possível configurar a pasta.', 'error')
  }
  await atualizarBackupLocal()
}
async function reautorizarPastaLocal() {
  try {
    await reautorizarPastaBackupLocal()
    await s.salvarBackupLocalAgora({ forcar: true })
  } catch (e) {
    s.notify?.(e?.message || 'Não foi possível autorizar a pasta.', 'error')
  }
  await atualizarBackupLocal()
}
async function gravarPastaLocalAgora() {
  await s.salvarBackupLocalAgora({ forcar: true })
  await atualizarBackupLocal()
  s.notify?.('Backup gravado na pasta.')
}
async function desconectarPastaLocal() {
  await desconectarPastaBackupLocal()
  await atualizarBackupLocal()
}
const { stripEl: abaStripEl, setTabRef: setAbaRef } = useTabScroll(abaAtiva)
const menus = [
  { id: 'perfis',      label: 'Perfis',            icon: 'fas fa-user-gear' },
  { id: 'perfil',     label: 'Identidade',       icon: 'fas fa-id-card' },
  { id: 'financeiro', label: 'Financeiro',        icon: 'fas fa-university' },
  { id: 'backup',     label: 'Backup',            icon: 'fas fa-cloud-arrow-up' },
  { id: 'sistema',    label: 'Sistema',           icon: 'fas fa-gears' }
]

watch(() => s.perfis, (novoValor) => {
  if (novoValor) Object.assign(perfilConfig, JSON.parse(JSON.stringify(novoValor)))
}, { deep: true })

// ── Perfis extras (livres) ──────────────────────────────────
const mostrarNovoPerfil = ref(false)
const novoPerfilNome = ref('')
const novoPerfilDescricao = ref('')

function cancelarNovoPerfil() {
  mostrarNovoPerfil.value = false
  novoPerfilNome.value = ''
  novoPerfilDescricao.value = ''
}

function confirmarNovoPerfil() {
  if (!novoPerfilNome.value.trim()) return
  const paleta = ['#b45309', '#15803d', '#1d4ed8', '#a21caf', '#b91c1c', '#0f766e']
  const cor = paleta[perfilConfig.extras.length % paleta.length]
  const idsUsados = perfilConfig.extras.map(e => e.id)
  let id = novoPerfilNome.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'perfil'
  let n = 2
  while (idsUsados.includes(id) || ['ym', 'bete'].includes(id)) { id = `${id}_${n}`; n++ }
  perfilConfig.extras.push({
    id,
    nome: novoPerfilNome.value.trim(),
    descricao: novoPerfilDescricao.value.trim(),
    cor,
    modulos: ['painel']
  })
  cancelarNovoPerfil()
}

function removerExtra(id) {
  perfilConfig.extras = perfilConfig.extras.filter(e => e.id !== id)
  if (perfilConfig.inicial === id) perfilConfig.inicial = 'selecao'
}

function salvarPerfis() {
  if (!perfilConfig.ym.modulos.includes('ajustes')) perfilConfig.ym.modulos.push('ajustes')
  if (!perfilConfig.ym.modulos.includes('painel')) perfilConfig.ym.modulos.push('painel')
  // Nenhum perfil extra pode ficar sem módulo nenhum (senão abre em branco)
  perfilConfig.extras.forEach(e => { if (!e.modulos.length) e.modulos.push('painel') })
  s.savePerfis(JSON.parse(JSON.stringify(perfilConfig)))
  s.notify('Perfis salvos com sucesso!')
}

// Carrega a lista de versões anteriores do Drive só quando a pessoa
// realmente abre a aba Backup (não no mount da tela inteira) — evita uma
// chamada ao Drive que a maioria das visitas em Ajustes nem usa.
watch(abaAtiva, (aba) => {
  if (aba !== 'backup') return
  s.medirTamanhoDados()
  s.carregarSnapshotsSeguranca()
  atualizarBackupLocal()
  if (s.googleDriveConfigured) { s.carregarHistoricoDrive(); s.carregarContaGoogle() }
}, { immediate: true })

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

// ── Taxas da Máquina (usadas na Calculadora do caderninho da Bete) ──
// Carregadas de cara, junto com o resto dos Ajustes — não é mais um item
// de menu à parte (o cadastro de produtos daqui saiu de uso: a Bete
// agora lança fiado a partir do Cardápio/Receitas, então só a taxa
// continua relevante, e faz mais sentido dentro de Financeiro).
const taxasCaderneta = reactive({ debito: 0, credito_avista: 0 })
getTaxas().then(t => Object.assign(taxasCaderneta, t))

/**
 * Meta de retirada e Giro de Segurança são "versionados": mudar o valor
 * hoje não pode alterar como os meses já passados aparecem no relatório
 * (Financeiro > Meta de Retirada). Em vez de guardar só o valor atual,
 * guardamos também um histórico de quando cada mudança aconteceu — assim
 * o sistema sabe qual valor valia em cada mês. Só grava um novo registro
 * quando o valor realmente muda (não em todo salvar).
 */
function proximoHistorico(historicoAntigo, valorAntigo, valorNovo, mesAtual) {
  if (valorNovo === valorAntigo) return historicoAntigo || []
  const lista = Array.isArray(historicoAntigo) ? [...historicoAntigo] : []
  if (!lista.length) {
    // Primeira mudança registrada: preserva o valor que já valia antes de
    // agora, pra não "reescrever" os meses já passados.
    lista.push({ mes: '01/2000', valor: valorAntigo })
  }
  const idx = lista.findIndex(h => h.mes === mesAtual)
  if (idx >= 0) lista[idx] = { mes: mesAtual, valor: valorNovo }
  else lista.push({ mes: mesAtual, valor: valorNovo })
  return lista
}

async function save() {
  const mesAtual = getMesRef(new Date().toISOString().slice(0, 10))
  company.meta_salario_historico = proximoHistorico(
    s.company.meta_salario_historico, s.company.meta_salario_mensal, company.meta_salario_mensal, mesAtual
  )
  company.reserva_operacional_historico = proximoHistorico(
    s.company.reserva_operacional_historico, s.company.reserva_operacional_fixa, company.reserva_operacional_fixa, mesAtual
  )
  s.saveCompany({ ...company })
  await salvarTaxas({ ...taxasCaderneta })
  s.notify('Alterações salvas com sucesso!')
}

async function onLogoSelecionado(evento) {
  const arquivo = evento.target.files?.[0]
  evento.target.value = ''
  if (!arquivo) return
  try {
    const dataUrl = await processarLogo(arquivo)
    company.logo = dataUrl
    s.saveCompany({ logo: dataUrl })
    s.notify('Logotipo atualizado!')
  } catch (err) {
    s.notify(err.message || 'Não foi possível processar a imagem.')
  }
}

function removerLogo() {
  company.logo = null
  s.saveCompany({ logo: null })
  s.notify('Logotipo removido — voltou ao ícone padrão.')
}

// ── Categorias Financeiras ──
const gruposCategorias = computed(() => {
  const map = new Map()
  s.categoriasFinanceiro.forEach(cat => {
    if (!map.has(cat.grupo)) map.set(cat.grupo, { nome: cat.grupo, categorias: [] })
    map.get(cat.grupo).categorias.push(cat)
  })
  return [...map.values()]
})

function labelNaturezaCategoria(natureza) {
  return { entrada: 'Entrada', operacional: 'Operacional', pessoal: 'Pessoal', interna: 'Interna' }[natureza] || natureza
}

const modalCategoria = ref(false)
const formCategoria = reactive({ nomeOriginal: null, nome: '', grupo: 'Negócio', natureza: 'operacional', icon: '' })

function abrirModalCategoria(cat = null) {
  if (cat) {
    Object.assign(formCategoria, { nomeOriginal: cat.nome, nome: cat.nome, grupo: cat.grupo, natureza: cat.natureza, icon: cat.icon || '' })
  } else {
    Object.assign(formCategoria, { nomeOriginal: null, nome: '', grupo: 'Negócio', natureza: 'operacional', icon: '' })
  }
  modalCategoria.value = true
}

async function salvarCategoriaModal() {
  await s.salvarCategoriaFinanceiro(
    { nome: formCategoria.nome.trim(), grupo: formCategoria.grupo.trim() || 'Negócio', natureza: formCategoria.natureza, icon: formCategoria.icon.trim() },
    formCategoria.nomeOriginal
  )
  modalCategoria.value = false
}

async function confirmarExclusaoCategoria(cat) {
  const ok = await confirmar.ask(
    `Deseja remover a categoria "${cat.nome}"? Lançamentos que já usam essa categoria serão movidos para "Outras Despesas"/"Outras Receitas" (nada é apagado).`,
    { title: 'Remover Categoria', confirmLabel: 'Remover', type: 'danger' }
  )
  if (ok) await s.excluirCategoriaFinanceiro(cat.nome)
}

async function confirmarRestaurarCategorias() {
  const ok = await confirmar.ask(
    'Isso substitui suas categorias personalizadas pela lista padrão do app. Lançamentos existentes não são apagados, mas podem ficar com uma categoria que não existe mais na lista até você reclassificá-los. Continuar?',
    { title: 'Restaurar Categorias Padrão', confirmLabel: 'Restaurar', type: 'warning' }
  )
  if (ok) await s.restaurarCategoriasFinanceiroPadrao()
}

const NOMES_BANCO = { pagbank: 'PagBank', itau: 'Itaú', bb: 'Banco do Brasil', outro: 'Outro banco' }
function nomeBanco(banco) { return NOMES_BANCO[banco] || 'Outro banco' }
function nomeNatureza(natureza) { return natureza === 'empresarial' ? 'Empresarial' : natureza === 'pessoal' ? 'Pessoal' : (natureza || '') }

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
</script>

<style scoped>
.tab-ajustes { padding-bottom: 120px; background: var(--bg); }
/* Cabeçalho (título + navegação por Setores) agora usa .tab-hdr/.aba-nav
   globais (main.css) — mesmo padrão do resto do app, sem overrides locais.
   Só zera o padding de baixo do .tab-hdr aqui, porque o menu de abas é o
   último elemento dentro dele (sem isso sobrava um respiro embaixo do menu,
   igual foi ajustado no Financeiro). */
.tab-ajustes .tab-hdr { padding-bottom: 0; }
.ajustes-content { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.fade-in { animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.input-with-prefix { display: flex; align-items: stretch; border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; background: var(--surface); }
.input-prefix { display: flex; align-items: center; padding: 0 12px; background: var(--bg); border-right: 1px solid var(--border); color: var(--muted); font-size: .82rem; font-weight: 700; }
.input-with-prefix .input { border: none !important; border-radius: 0 !important; flex: 1; height: 42px; }
.version-info { text-align: center; font-size: .7rem; color: var(--muted); font-weight: 600; margin-top: 20px; }

/* ══════════════════════════════════════════════════════════════
   Ajustes › Backup e Sistema — um só vocabulário visual
   Espaçamento em múltiplos de 4 (4/8/12/16/24). Cartão = 16px de
   raio; ícone = 12px; botão = 10px. Alvos de toque ≥ 46px.
══════════════════════════════════════════════════════════════ */
.aj-pagina { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 640px; margin: 0 auto; }
.aj-cab { padding: 0 2px; }
.aj-titulo { margin: 0; font-size: 1.3rem; font-weight: 800; line-height: 1.2; color: var(--brown-dark); }
.aj-desc { margin: 4px 0 0; font-size: .88rem; line-height: 1.5; color: var(--muted); }

.aj-grupo { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.aj-grupo-cab { padding: 0 2px; }
.aj-grupo-titulo { margin: 0; font-size: 1.02rem; font-weight: 800; line-height: 1.3; color: var(--brown-dark); }
.aj-grupo-titulo--risco { color: var(--red); }
.aj-grupo-desc { margin: 2px 0 0; font-size: .84rem; line-height: 1.45; color: var(--muted); }

/* Cartão */
.aj-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
.aj-card--aviso { border-color: var(--orange-dim); background: var(--gold-bg); }
.aj-card--risco { border-color: var(--red-dim); background: #fffafa; }

/* Linha padrão: ícone · texto · (selo) */
.aj-row { display: flex; align-items: flex-start; gap: 14px; padding: 16px; }
.aj-row-cabeca { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.aj-row-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.aj-row-titulo { font-size: 1rem; font-weight: 800; line-height: 1.3; color: var(--brown-dark); }
.aj-row-sub { font-size: .84rem; word-break: break-word; line-height: 1.45; font-weight: 500; color: var(--muted); overflow-wrap: anywhere; }
.aj-row-sub--forte { font-weight: 700; color: var(--text); }

.aj-tile { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: var(--r-md); background: var(--cream); color: var(--brown-mid); font-size: 1.15rem; transition: background var(--t), color var(--t); }
.aj-tile--on { background: var(--green-bg); color: var(--green); }
.aj-tile--warn { background: #fff; color: var(--gold-dark); }
.aj-tile--risco { background: var(--red-bg); color: var(--red); }

/* Selos de estado */
.aj-pill { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 5px 11px; border-radius: var(--r-full); font-size: .76rem; font-weight: 700; line-height: 1.2; white-space: nowrap; }
.aj-pill--ok { background: var(--green-bg); color: var(--green); }
.aj-pill--off { background: var(--cream); color: var(--muted); }
.aj-pill--rec, .aj-pill--aviso { background: var(--gold-bg); color: var(--gold-dark); }
.aj-contagem { align-self: center; min-width: 24px; padding: 2px 8px; border-radius: var(--r-full); background: var(--cream); color: var(--brown-mid); font-size: .76rem; font-weight: 800; text-align: center; }

/* Resumo do backup */
.aj-resumo { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: var(--r-lg); border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow-sm); }
.aj-resumo-icone { width: 48px; height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--cream); color: var(--muted); font-size: 1.25rem; }
.aj-resumo-titulo { font-size: 1.02rem; font-weight: 800; line-height: 1.3; color: var(--brown-dark); }
.aj-resumo--off { background: var(--gold-bg); border-color: var(--orange-dim); }
.aj-resumo--off .aj-resumo-icone { background: var(--gold); color: #fff; }
.aj-resumo--ok { background: var(--green-bg); border-color: var(--green-dim); }
.aj-resumo--ok .aj-resumo-icone { background: var(--green); color: #fff; }
.aj-resumo--warn { background: var(--gold-bg); border-color: var(--orange-dim); }
.aj-resumo--warn .aj-resumo-icone { background: var(--gold); color: #fff; }

/* Botões em grade: sempre colunas iguais */
.aj-acoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; padding: 0 16px 16px; }
.aj-acoes .btn { width: 100%; min-height: 46px; padding: 10px 8px; gap: 6px; font-size: .88rem; line-height: 1.25; text-align: center; cursor: pointer; }
.aj-btn-risco { background: transparent; color: var(--red); border: 1.5px solid var(--red); }
.aj-btn-risco:active { background: var(--red-bg); }
.aj-btn-icone { min-width: 38px; padding-left: 0; padding-right: 0; }

/* Itens recolhíveis dentro do cartão */
.aj-item { border-top: 1px solid var(--border); }
.aj-item > summary, .aj-item-btn {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 12px 16px;
  font: inherit; font-size: .92rem; font-weight: 700; color: var(--brown-mid); text-align: left;
  background: none; border: none; cursor: pointer; list-style: none;
}
.aj-item-btn { border-top: 1px solid var(--border); }
.aj-item-btn--perigo { color: var(--red); }
.aj-item > summary::-webkit-details-marker { display: none; }
.aj-item-icone { width: 20px; text-align: center; font-size: .95rem; color: var(--muted); }
.aj-item-btn--perigo .aj-item-icone { color: var(--red); }
.aj-item-corpo { display: flex; flex-direction: column; gap: 8px; padding: 0 16px 16px; }
.aj-item-corpo--solto { padding-top: 4px; border-top: 1px solid var(--border); padding-top: 16px; }
.aj-item-corpo p { margin: 0; font-size: .84rem; line-height: 1.55; color: var(--muted); }

/* Cartão inteiro recolhível (cabeçalho = linha padrão) */
.aj-colapso > summary { list-style: none; cursor: pointer; }
.aj-colapso > summary::-webkit-details-marker { display: none; }

/* Seta de abrir/fechar, feita em CSS (não depende de fonte de ícones) */
.aj-item > summary::after, .aj-colapso > summary::after {
  content: ''; flex-shrink: 0; width: 8px; height: 8px; margin: 0 4px 3px 4px;
  border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted);
  align-self: center; transform: rotate(45deg); transition: transform .2s ease;
}
.aj-item > summary::after { margin-left: auto; }
.aj-item[open] > summary::after, .aj-colapso[open] > summary::after { transform: rotate(-135deg) translate(-2px, -2px); }
.aj-colapso[open] > summary { border-bottom: 1px solid var(--border); }

/* Versões / cópias */
.aj-versao { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--bg); font-size: .86rem; font-weight: 600; color: var(--brown-dark); }
.aj-versao-txt { display: flex; flex-direction: column; min-width: 0; }
.aj-versao-txt small { font-size: .76rem; font-weight: 500; color: var(--muted); }
.aj-versao-acoes { display: flex; gap: 6px; flex-shrink: 0; }
.aj-versao .btn-sm { min-height: 38px; }

/* Opções de escolha única (radio) */
.aj-opcao {
  display: flex; align-items: center; gap: 14px; width: 100%; min-height: 72px; padding: 14px 16px;
  font: inherit; text-align: left; background: none; border: none; border-top: 1px solid var(--border); cursor: pointer;
  transition: background var(--t);
}
.aj-opcao:first-child { border-top: none; }
.aj-opcao .aj-tile { width: 40px; height: 40px; font-size: 1.05rem; }
.aj-opcao.is-ativa { background: var(--cream); }
.aj-opcao.is-ativa .aj-tile { background: var(--brown); color: #fff; }
.aj-radio { position: relative; width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; border: 2px solid var(--border2); background: var(--surface); transition: border-color var(--t), background var(--t); }
.aj-radio::after { content: ''; position: absolute; inset: 5px; border-radius: 50%; background: #fff; opacity: 0; transition: opacity var(--t); }
.aj-opcao.is-ativa .aj-radio { border-color: var(--brown); background: var(--brown); }
.aj-opcao.is-ativa .aj-radio::after { opacity: 1; }

/* Formulário dentro do cartão */
.aj-form { display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.aj-form .fg { margin: 0; }
.aj-form .btn { width: 100%; min-height: 46px; }
.aj-nota { margin: 0; font-size: .82rem; line-height: 1.5; color: var(--muted); }
.aj-nota--erro { color: var(--red); font-weight: 600; }
.aj-nota code { padding: 1px 5px; border-radius: 4px; background: var(--cream); font-size: .78rem; }

.aj-rodape { margin: 0; text-align: center; font-size: .8rem; color: var(--muted); }

/* Foco visível para quem navega por teclado */
.aj-item > summary:focus-visible, .aj-item-btn:focus-visible, .aj-opcao:focus-visible, .aj-colapso > summary:focus-visible {
  outline: 3px solid rgba(122, 69, 32, .4); outline-offset: -3px;
}
@media (prefers-reduced-motion: reduce) {
  .aj-item > summary::after, .aj-colapso > summary::after, .aj-radio, .aj-radio::after, .aj-opcao, .aj-tile { transition: none; }
}

/* ── Complementos para Perfis, Identidade e Financeiro ── */
.aj-form--sem-topo { padding-top: 0; }
.aj-form-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
.aj-form-2--iguais { grid-template-columns: 1fr 1fr; }
.aj-form select.input { min-height: 48px; }
.aj-form .input { min-height: 48px; }
.aj-form .label-opt { font-size: .8rem; }
.aj-form .fg > .aj-nota { margin-top: 0; }
.aj-vazio { margin: 0; padding: 20px 16px; text-align: center; font-size: .86rem; line-height: 1.5; color: var(--muted); }

/* Botão tracejado "Adicionar" */
.aj-adicionar {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 52px; padding: 12px;
  font: inherit; font-size: .92rem; font-weight: 700; color: var(--brown-mid);
  background: transparent; border: 1.5px dashed var(--border2); border-radius: var(--r-lg); cursor: pointer;
}
.aj-adicionar:active { background: var(--cream); }
.aj-item-btn--add { color: var(--brown-mid); }
.aj-item-btn--add:first-child { border-top: none; }

/* Dois botões lado a lado */
.aj-botoes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.aj-botoes .btn { width: 100%; min-height: 46px; padding: 10px 8px; gap: 6px; font-size: .88rem; line-height: 1.25; }
.aj-salvar { width: 100%; min-height: 52px; margin-top: 8px; font-size: .98rem; }
.aj-form .aj-botoes .btn { width: 100%; }

/* Interruptores (liga/desliga) */
.aj-lista-switch { border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; background: var(--surface); }
.aj-switch-linha { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 14px; border-top: 1px solid var(--border); cursor: pointer; }
.aj-switch-linha:first-child { border-top: none; }
.aj-switch-linha--tile { padding: 16px; gap: 14px; align-items: center; }
.aj-switch-txt { flex: 1; font-size: .94rem; font-weight: 700; color: var(--brown-dark); }
.aj-switch {
  -webkit-appearance: none; appearance: none; position: relative; flex-shrink: 0; margin: 0;
  width: 50px; height: 30px; border-radius: var(--r-full); background: var(--border2); cursor: pointer; transition: background var(--t);
}
.aj-switch::after {
  content: ''; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform var(--t);
}
.aj-switch:checked { background: var(--green); }
.aj-switch:checked::after { transform: translateX(20px); }
.aj-switch:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: 2px; }

/* Linhas de lista (contas, categorias) */
.aj-linha-item { display: flex; align-items: center; gap: 12px; padding: 12px 8px 12px 16px; border-top: 1px solid var(--border); }
.aj-linha-item:first-child { border-top: none; }
.aj-colapso > summary + .aj-linha-item { border-top: none; }
.aj-linha-item .aj-tile { width: 40px; height: 40px; font-size: 1.05rem; }
.aj-linha-item .aj-row-titulo { font-size: .95rem; }
.aj-linha-item .aj-row-txt { align-self: center; }
.aj-tile--pagbank { background: var(--gold-bg); color: var(--gold-dark); }
.aj-tile--itau { background: var(--orange-bg); color: var(--orange); }
.aj-tile--bb { background: var(--blue-bg); color: var(--blue); }
.aj-icbtn {
  width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  border: none; border-radius: var(--r-sm); background: transparent; color: var(--brown-mid); font-size: .98rem; cursor: pointer;
}
.aj-icbtn:active { background: var(--cream); }
.aj-icbtn--perigo { color: var(--red); }
.aj-icbtn--perigo:active { background: var(--red-bg); }
.aj-icbtn:focus-visible { outline: 3px solid rgba(122, 69, 32, .4); outline-offset: -3px; }

/* Logotipo */
.aj-logo { width: 64px; height: 64px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: var(--r-md); background: var(--cream); border: 1px solid var(--border2); }
.aj-logo img { width: 100%; height: 100%; object-fit: contain; }
.aj-logo--vazio { color: var(--gold-dark); font-size: 1.6rem; }

/* Campo com prefixo (R$) igual aos demais campos */
.input-with-prefix { border: 1.5px solid var(--border); border-radius: var(--r-sm); }
.input-with-prefix:focus-within { border-color: var(--brown-mid); box-shadow: 0 0 0 3px rgba(122, 69, 32, .12); }
.input-with-prefix .input { height: 48px; min-height: 48px; box-shadow: none !important; }
.input-prefix { padding: 0 14px; font-size: .9rem; }
</style>