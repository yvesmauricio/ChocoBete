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
      <!-- ── SEÇÃO 0: PERFIS ── -->
      <section v-if="abaAtiva === 'perfis'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-user-gear"></i> Perfis de uso</div>
          <p class="hint mb-12">Organize como o ChocoBete abre e como cada perfil é apresentado. Admin concentra a administração; Vendas permanece no fluxo simples de clientes e pedidos.</p>

          <div class="fg">
            <label class="label">Perfil ao abrir o sistema</label>
            <select v-model="perfilConfig.inicial" class="input">
              <option value="selecao">Mostrar seleção de perfil</option>
              <option value="ym">Abrir direto no perfil Admin</option>
              <option value="bete">Abrir direto no perfil Vendas</option>
              <option v-for="e in perfilConfig.extras" :key="e.id" :value="e.id">Abrir direto no perfil {{ e.nome }}</option>
            </select>
          </div>

          <div v-for="perfilId in ['ym', 'bete']" :key="perfilId" class="perfil-config-bloco">
            <div class="section-label">
              <i class="fas" :class="perfilId === 'ym' ? 'fa-chart-line' : 'fa-book-open'"></i>
              Perfil {{ perfilId === 'ym' ? 'Admin' : 'Vendas' }}
            </div>
            <div class="form-grid">
              <div class="fg">
                <label class="label">Nome amigável</label>
                <input v-model="perfilConfig[perfilId].nome" class="input" maxlength="30" />
              </div>
              <div class="fg">
                <label class="label">Descrição</label>
                <input v-model="perfilConfig[perfilId].descricao" class="input" maxlength="80" />
              </div>
            </div>

            <div v-if="perfilId === 'ym'" class="fg mt-12">
              <label class="label">Módulos visíveis no perfil Admin</label>
              <label v-for="modulo in modulosYves" :key="modulo.id" class="cp-check">
                <input v-model="perfilConfig.ym.modulos" type="checkbox" :value="modulo.id">
                <span><i class="fas" :class="modulo.icon"></i> {{ modulo.label }}</span>
              </label>
              <p class="hint mt-4">Ajustes e Painel permanecem disponíveis para evitar que você fique sem acesso à configuração do sistema.</p>
            </div>
            <p v-else class="hint mt-8">O perfil Vendas usa o Caderninho como área principal. O Cardápio continua acessível pelos atalhos de vendas.</p>
          </div>

          <!-- ── Perfis extras (livres) — criados pelo usuário ── -->
          <div class="section-label mt-24">
            <i class="fas fa-layer-group"></i> Perfis adicionais
          </div>
          <p class="hint mb-12">Crie um perfil para cada função (ex.: Produção, Financeiro) e escolha livremente quais telas cada um enxerga.</p>

          <div v-for="extra in perfilConfig.extras" :key="extra.id" class="perfil-config-bloco">
            <div class="section-label">
              <i class="fas fa-user-tag" :style="{ color: extra.cor }"></i>
              {{ extra.nome || 'Perfil sem nome' }}
              <button class="btn-remover-perfil" title="Remover perfil" @click="removerExtra(extra.id)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <div class="form-grid">
              <div class="fg">
                <label class="label">Nome amigável</label>
                <input v-model="extra.nome" class="input" maxlength="30" />
              </div>
              <div class="fg">
                <label class="label">Descrição</label>
                <input v-model="extra.descricao" class="input" maxlength="80" />
              </div>
            </div>
            <div class="fg mt-12">
              <label class="label">Módulos visíveis neste perfil</label>
              <label v-for="modulo in modulosYves" :key="modulo.id" class="cp-check">
                <input v-model="extra.modulos" type="checkbox" :value="modulo.id">
                <span><i class="fas" :class="modulo.icon"></i> {{ modulo.label }}</span>
              </label>
              <p v-if="!extra.modulos.length" class="hint mt-4 hint-alerta">Selecione pelo menos um módulo, ou este perfil fica sem tela para abrir.</p>
            </div>
          </div>

          <!-- ── Adicionar novo perfil ── -->
          <div v-if="!mostrarNovoPerfil" class="mt-12">
            <button class="btn-add-outline" @click="mostrarNovoPerfil = true">
              <i class="fas fa-plus"></i> Adicionar novo perfil
            </button>
          </div>
          <div v-else class="perfil-novo-bloco mt-12">
            <div class="section-label"><i class="fas fa-user-plus"></i> Novo perfil</div>
            <div class="fg">
              <label class="label">Nome do novo perfil</label>
              <input v-model="novoPerfilNome" class="input" maxlength="30" placeholder="Ex.: Estoque, Entregas..." />
            </div>
            <div class="fg">
              <label class="label">Descrição (opcional)</label>
              <input v-model="novoPerfilDescricao" class="input" maxlength="80" />
            </div>
            <div class="flex-row-actions mt-12">
              <button class="btn btn-secondary" @click="cancelarNovoPerfil">Cancelar</button>
              <button class="btn btn-primary" :disabled="!novoPerfilNome.trim()" @click="confirmarNovoPerfil">
                <i class="fas fa-plus"></i> Criar perfil
              </button>
            </div>
          </div>

          <div class="mt-24">
            <button class="btn btn-primary btn-full" @click="salvarPerfis">
              <i class="fas fa-save"></i> Salvar Perfis
            </button>
          </div>
        </div>
      </section>

      <!-- ── SEÇÃO 1: PERFIL DO NEGÓCIO ── -->
      <section v-if="abaAtiva === 'perfil'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-store"></i> Identidade da Marca</div>
          <p class="hint mb-12">Esses dados aparecem nos cabeçalhos dos documentos e etiquetas.</p>

          <div class="logo-upload-linha">
            <div class="logo-preview" :class="{ 'logo-preview--vazio': !company.logo }">
              <img v-if="company.logo" :src="company.logo" alt="Logotipo">
              <i v-else class="fas fa-cookie-bite"></i>
            </div>
            <div class="logo-upload-acoes">
              <label class="cp-upload">
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onLogoSelecionado">
                <i class="fas fa-upload"></i> {{ company.logo ? 'Trocar logotipo' : 'Enviar logotipo' }}
              </label>
              <button v-if="company.logo" class="cp-remover-foto" @click="removerLogo">
                <i class="fas fa-trash"></i> Remover
              </button>
              <p class="hint">PNG ou JPG, qualquer tamanho — é redimensionado automaticamente. PNG com fundo transparente fica melhor no cabeçalho.</p>
            </div>
          </div>

          <div class="form-grid mt-12">
            <div class="fg">
              <label class="label">Nome da Marca</label>
              <input v-model="company.nome" class="input" placeholder="Ex: ChocoBete" />
            </div>
            <div class="fg">
              <label class="label">CPF do Titular</label>
              <input 
                :value="company.cpf" 
                @input="e => company.cpf = maskCpf(e.target.value)"
                class="input" placeholder="000.000.000-00" />
            </div>
            <div class="fg">
              <label class="label">Razão Social</label>
              <input v-model="company.razao_social" class="input" placeholder="Nome completo ou Razão Social" />
            </div>
            <div class="fg">
              <div class="fg fg-2">
                <label class="label">CNPJ</label>
                <input 
                  :value="company.cnpj" 
                  @input="e => company.cnpj = maskCnpj(e.target.value)"
                  class="input" 
                  placeholder="00.000.000/0001-00" 
                />
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
            <div class="fg">
              <label class="label">WhatsApp para pedidos (Cardápio Digital)</label>
              <input
                :value="maskTelefone(company.whatsapp_pedidos)"
                @input="e => company.whatsapp_pedidos = maskTelefone(e.target.value)"
                class="input" type="tel" inputmode="numeric" placeholder="Ex: (21) 99943-0023" />
              <p class="hint mt-4">Número com DDD, sem +55. É pra onde os pedidos feitos no cardápio interativo são enviados.</p>
            </div>
            <div class="fg">
              <label class="label">Instagram</label>
              <input
                :value="company.instagram ? '@' + company.instagram : ''"
                @input="e => company.instagram = normalizarInstagram(e.target.value)"
                class="input" type="text" autocapitalize="none" autocorrect="off" placeholder="Ex: @chocobete" />
              <p class="hint mt-4">Aparece na aba Meu contato (Caderneta), no QR de contato e no cabeçalho do cardápio interativo (republique o cardápio para atualizar o que já está no ar).</p>
            </div>
          </div>

          <div class="section-label mt-24"><i class="fas fa-receipt"></i> Comprovantes e Cobrança (Caderneta)</div>
          <div class="fg mt-12">
            <label class="cp-check">
              <input v-model="company.mostrar_hora_venda" type="checkbox">
              <span><i class="fas fa-clock"></i> Mostrar horário da venda nas mensagens de WhatsApp</span>
            </label>
            <p class="hint mt-4">Desligue se você costuma lançar vendas fiado fora do horário real (ex: fechando o dia à noite). O comprovante enviado ao cliente passa a mostrar só a data, sem horário.</p>
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

          <div class="section-label mt-24"><i class="fas fa-tags"></i> Categorias de Lançamento</div>
          <p class="hint mt-4 mb-12">
            São as categorias que aparecem ao editar um lançamento. Os nomes aqui
            já batem com o que a importação de extratos usa automaticamente —
            se você editar um nome, os lançamentos antigos com aquela categoria
            são atualizados junto.
          </p>

          <div v-for="grupo in gruposCategorias" :key="grupo.nome" class="contas-list mb-16">
            <p class="hint" style="font-weight:800; text-transform:uppercase; font-size:.7rem; letter-spacing:.05em;">{{ grupo.nome }}</p>
            <div v-for="cat in grupo.categorias" :key="cat.nome" class="conta-item">
              <div class="conta-icon">
                <i class="fas" :class="cat.icon || 'fa-tag'"></i>
              </div>
              <div class="conta-info">
                <strong>{{ cat.nome }}</strong>
                <span>{{ labelNaturezaCategoria(cat.natureza) }}</span>
              </div>
              <div class="conta-item-acts">
                <button class="btn-action-edit" title="Editar categoria" @click="abrirModalCategoria(cat)"><i class="fas fa-pencil"></i></button>
                <button class="btn-action-del" title="Excluir categoria" @click="confirmarExclusaoCategoria(cat)"><i class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>

          <div class="fg-row mt-8">
            <button class="btn-add-outline" style="flex:2" @click="abrirModalCategoria(null)">
              <i class="fas fa-plus"></i> Nova Categoria
            </button>
            <button class="btn-add-outline" @click="confirmarRestaurarCategorias">
              <i class="fas fa-rotate-left"></i> Restaurar Padrão
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
              <p class="hint">Define o preço mínimo e metas de venda na Inteligência. Alterar aqui só muda o mês atual em diante — os meses passados no relatório continuam com o valor que valia na época.</p>
            </div>
            <div class="fg">
              <label class="label">Giro de Segurança Fixo <span class="label-opt">(opcional)</span></label>
              <div class="input-with-prefix">
                <span class="input-prefix">R$</span>
                <input v-model.number="company.reserva_operacional_fixa" type="number" class="input" placeholder="Ex: 600.00" />
              </div>
              <p class="hint">Valor reservado para compras (ex: R$ 600 p/ 2 semanas). Mesma regra: só vale a partir de agora, meses passados não mudam.</p>
            </div>
            <div class="fg">
              <label class="label">Teto de Faturamento MEI Anual</label>
              <div class="input-with-icon">
                <i class="fas fa-arrow-up-wide-short"></i>
                <input v-model.number="company.teto_mei_anual" type="number" class="input" />
              </div>
            </div>
          </div>

          <div class="section-label mt-24"><i class="fas fa-credit-card"></i> Taxas da Máquina</div>
          <p class="hint mb-12">Usadas na calculadora de taxas do caderninho da Bete.</p>
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
            <button class="btn btn-primary btn-full" @click="save">
              <i class="fas fa-save"></i> Salvar
            </button>
          </div>
        </div>
      </section>

      <!-- ── SEÇÃO: BACKUP ── -->
      <section v-if="abaAtiva === 'backup'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label"><i class="fas fa-cloud-arrow-up"></i> Backup</div>

          <!-- 1. Resumo: uma olhada e já sabe se está tudo certo -->
          <div class="bk-resumo" :class="`bk-resumo--${statusBackup}`">
            <div class="bk-resumo-icone">
              <i :class="statusBackup === 'ok' ? 'fas fa-circle-check' : statusBackup === 'warn' ? 'fas fa-triangle-exclamation' : 'fas fa-cloud-slash'"></i>
            </div>
            <div class="bk-resumo-txt">
              <strong v-if="statusBackup === 'ok'">Seus dados estão protegidos</strong>
              <strong v-else-if="statusBackup === 'warn'">Atenção ao backup</strong>
              <strong v-else>Backup no Drive desligado</strong>
              <span v-if="statusBackup === 'warn'">{{ s.alertaBackup.msg }}</span>
              <span v-else-if="s.googleDriveConfigured && s.infoBackupDrive">Último backup: {{ dataHoraBR(s.infoBackupDrive.modifiedTime) }}</span>
              <span v-else-if="!s.googleDriveConfigured">Conecte o Google Drive para não perder seus dados.</span>
              <span v-else>Ainda sem backup no Drive.</span>
            </div>
          </div>

          <!-- 2. Google Drive: o principal -->
          <div class="bk-bloco">
            <div class="bk-linha">
              <div class="bk-icone" :class="{ 'is-on': s.googleDriveConfigured }"><i class="fab fa-google-drive"></i></div>
              <div class="bk-info">
                <div class="bk-titulo">Google Drive</div>
                <div class="bk-sub">
                  <template v-if="s.googleDriveConfigured">
                    <span class="dot-status dot-online"></span> Conectado · sincroniza sozinho
                  </template>
                  <template v-else>
                    <span class="dot-status dot-offline"></span> Desconectado
                  </template>
                </div>
                <div v-if="s.googleDriveConfigured && s.contaGoogle" class="bk-conta" :title="s.contaGoogle.email">
                  <i class="fas fa-user"></i>
                  <span class="bk-conta-nome">{{ s.contaGoogle.nome || s.contaGoogle.email }}</span>
                  <span v-if="s.contaGoogle.nome && s.contaGoogle.email" class="bk-conta-email">{{ s.contaGoogle.email }}</span>
                </div>
              </div>
              <button v-if="!s.googleDriveConfigured" class="btn btn-primary btn-sm" @click="s.conectarGoogleDrive">Conectar</button>
              <button v-else class="btn-icon-sm danger" title="Desconectar" @click="s.desconectarGoogleDrive">
                <i class="fas fa-sign-out-alt"></i>
              </button>
            </div>

            <template v-if="s.googleDriveConfigured">
              <div class="bk-acoes">
                <button class="btn btn-primary btn-sm" @click="s.backupGoogleDrive">
                  <i class="fas fa-cloud-arrow-up"></i> Salvar agora
                </button>
                <button class="btn btn-secondary btn-sm" @click="s.restaurarGoogleDrive">
                  <i class="fas fa-cloud-arrow-down"></i> Restaurar
                </button>
              </div>

              <details class="bk-mais">
                <summary>Como funciona</summary>
                <p>A sincronização é automática: ao abrir o app, ao voltar a ele e a cada alteração. Se dois aparelhos mudarem dados ao mesmo tempo, o app junta o trabalho dos dois.</p>
                <p><strong>Restaurar</strong> troca tudo deste aparelho pelo que está no Drive. Uma cópia de segurança do estado atual fica guardada.</p>
              </details>

              <details class="bk-mais" @toggle="mostrarHistorico = $event.target.open">
                <summary>
                  Versões anteriores
                  <span v-if="s.infoBackupDrive" class="bk-badge">{{ s.infoBackupDrive.versoes }}</span>
                </summary>
                <p v-if="s.carregandoHistoricoDrive" class="hint">Carregando…</p>
                <p v-else-if="!s.historicoDrive.length" class="hint">Ainda não há versões anteriores. Elas aparecem aqui conforme você usa o app.</p>
                <template v-else>
                  <div v-for="item in s.historicoDrive" :key="item.id" class="backup-historico-item">
                    <span><i class="fas fa-file-code"></i> {{ dataHoraBR(item.modifiedTime) }}<span v-if="item.fixada" title="Fixada: não é apagada automaticamente"> 📌</span></span>
                    <button class="btn btn-secondary btn-xs" @click="s.restaurarGoogleDriveVersao(item)">Restaurar</button>
                  </div>
                  <p class="hint">Guardamos as 8 mais recentes, a última de cada dia (14 dias) e a última de cada semana (8 semanas). 📌 = fixada ao resolver um conflito, nunca é apagada sozinha.</p>
                </template>
              </details>
            </template>
          </div>

          <!-- 3. Cópia em arquivo (manual) -->
          <div class="bk-bloco">
            <div class="bk-linha">
              <div class="bk-icone"><i class="fas fa-file-code"></i></div>
              <div class="bk-info">
                <div class="bk-titulo">Arquivo no aparelho</div>
                <div class="bk-sub">Funciona sem internet e sem conta Google</div>
              </div>
            </div>
            <div class="bk-acoes">
              <button class="btn btn-secondary btn-sm" @click="s.backupGeral">
                <i class="fas fa-download"></i> Exportar
              </button>
              <label class="btn btn-secondary btn-sm">
                <i class="fas fa-upload"></i> Importar
                <input type="file" hidden accept=".json" @change="e => { s.restaurarGeral(e.target.files[0]); e.target.value = '' }" />
              </label>
            </div>
          </div>

          <!-- 4. Pasta automática (só Chrome/Edge no computador) -->
          <div v-if="backupLocal.suportado" class="bk-bloco">
            <div class="bk-linha">
              <div class="bk-icone" :class="{ 'is-on': backupLocal.configurada && backupLocal.permissao === 'granted' }"><i class="fas fa-folder-open"></i></div>
              <div class="bk-info">
                <div class="bk-titulo">Pasta automática</div>
                <div class="bk-sub" v-if="backupLocal.configurada && backupLocal.permissao === 'granted'">
                  <span class="dot-status dot-online"></span> “{{ backupLocal.nome }}”<template v-if="backupLocal.ultimo"> · {{ dataHoraBR(backupLocal.ultimo) }}</template>
                </div>
                <div class="bk-sub" v-else-if="backupLocal.configurada">
                  <span class="dot-status dot-offline"></span> “{{ backupLocal.nome }}” precisa de autorização
                </div>
                <div class="bk-sub" v-else>
                  <span class="dot-status dot-offline"></span> Nenhuma pasta escolhida
                </div>
              </div>
            </div>
            <div class="bk-acoes">
              <button v-if="!backupLocal.configurada" class="btn btn-primary btn-sm" @click="escolherPastaLocal">Escolher pasta</button>
              <template v-else>
                <button v-if="backupLocal.permissao !== 'granted'" class="btn btn-primary btn-sm" @click="reautorizarPastaLocal">Autorizar de novo</button>
                <button v-else class="btn btn-secondary btn-sm" @click="gravarPastaLocalAgora">Gravar agora</button>
                <button class="btn btn-secondary btn-sm" @click="desconectarPastaLocal">Desconectar</button>
              </template>
            </div>
            <details class="bk-mais">
              <summary>Como funciona</summary>
              <p>Alguns segundos depois de cada alteração, grava uma cópia completa na pasta escolhida. Prefira uma pasta sincronizada com outro lugar (OneDrive, Google Drive para computador, pendrive).</p>
            </details>
          </div>

          <!-- 5. Cópias de segurança automáticas (só aparece se existirem) -->
          <div v-if="s.snapshotsSeguranca.length" class="bk-bloco bk-bloco--aviso">
            <details class="bk-mais bk-mais--solto">
              <summary>
                <i class="fas fa-shield-halved"></i> Cópias de segurança deste aparelho
                <span class="bk-badge">{{ s.snapshotsSeguranca.length }}</span>
              </summary>
              <p>Guardadas automaticamente antes de os dados serem substituídos (sincronização, restauração ou conflito entre aparelhos). Restaurar troca os dados atuais pelos da cópia, e o estado atual também fica guardado.</p>
              <div v-for="snap in s.snapshotsSeguranca" :key="snap.id" class="backup-historico-item">
                <span><i class="fas fa-file-shield"></i> {{ dataHoraBR(snap.ts) }}<small v-if="snap.motivo"> · {{ snap.motivo }}</small></span>
                <span class="bslot-manual-btns">
                  <button class="btn btn-secondary btn-xs" @click="confirmarRestaurarSnapshotSeguranca(snap)">Restaurar</button>
                  <button class="btn btn-secondary btn-xs" title="Descartar esta cópia" @click="s.descartarSnapshotSeguranca(snap.id)"><i class="fas fa-trash"></i></button>
                </span>
              </div>
            </details>
          </div>

          <p class="bk-rodape">
            <i class="fas fa-database"></i>
            Tamanho dos dados: {{ s.tamanhoDadosBytes != null ? formatarBytes(s.tamanhoDadosBytes) : 'calculando…' }}
            <template v-if="s.googleDriveConfigured && s.infoBackupDrive"> · {{ formatarBytes(s.infoBackupDrive.tamanhoTotal) }} no Drive</template>
          </p>
        </div>
      </section>

      <!-- ── SEÇÃO 4: PREFERÊNCIAS DO SISTEMA ── -->
      <section v-if="abaAtiva === 'sistema'" class="sheet-card fade-in">
        <div class="sheet-body">
          <div class="section-label mb-16"><i class="fas fa-gears"></i> Sistema</div>

          <div class="section-label"><i class="fas fa-desktop"></i> Layout da tela</div>
          <p class="hint mb-12">Escolha como o app se organiza neste aparelho. A escolha vale só aqui. Agora: <strong>{{ isDesktop ? 'desktop' : 'celular' }}</strong>.</p>
          <div class="modo-compras-opcoes mb-16">
            <button
              v-for="m in MODOS_LAYOUT" :key="m.id"
              class="modo-compras-op" :class="{ active: preferenciaLayout === m.id }"
              @click="definirModoLayout(m.id)"
            >
              <i :class="m.icon"></i>
              <div class="modo-compras-op-txt">
                <strong>{{ m.label }}</strong>
                <span>{{ m.desc }}</span>
              </div>
            </button>
          </div>

          <div class="section-label"><i class="fas fa-cart-shopping"></i> Tela de Compras (no Painel)</div>
          <p class="hint mb-12">Como a aba "Compras" do Painel decide o que sugerir.</p>
          <div class="modo-compras-opcoes">
            <button
              class="modo-compras-op" :class="{ active: modoCompras === 'lista' }"
              @click="alterarModoCompras('lista')"
            >
              <i class="fas fa-list-check"></i>
              <div class="modo-compras-op-txt">
                <strong>Lista de planejamento</strong>
                <span>Mostra o que a produção recente consome e o custo estimado, sem depender de quantidade em mãos. Você mesmo risca (remove) o que já tem.</span>
              </div>
            </button>
            <button
              class="modo-compras-op" :class="{ active: modoCompras === 'estoque' }"
              @click="alterarModoCompras('estoque')"
            >
              <i class="fas fa-boxes-stacked"></i>
              <div class="modo-compras-op-txt">
                <strong>Controle de estoque</strong>
                <span>Usa a quantidade em mãos de cada insumo pra avisar só o que realmente está acabando.</span>
              </div>
            </button>
          </div>

          <div class="mt-20">
            <button class="btn btn-primary btn-full" @click="save">
              <i class="fas fa-save"></i> Salvar
            </button>
          </div>

          <!-- Publicação do Cardápio Interativo (GitHub + Cloudflare) -->
          <details class="bk-bloco bk-mais bk-mais--solto mt-24">
            <summary><i class="fab fa-github"></i> Link do Cardápio Interativo</summary>
            <p>Publica o cardápio num link fixo, em vez de enviar o arquivo .html.</p>
            <div class="form-grid mt-12">
              <div class="fg">
                <label class="label">Token do GitHub (fine-grained, só Contents: Read/Write)</label>
                <input v-model="pub.token" class="input" type="password" placeholder="github_pat_..." />
              </div>
              <p v-if="pub.owner && pub.repo" class="hint">
                Publicando em <strong>{{ pub.owner }}/{{ pub.repo }}</strong> (branch <strong>{{ pub.branch }}</strong>)
                → <strong>{{ pub.dominio || 'domínio não definido' }}</strong>.
                Pra mudar, edite o <code>.env</code> e gere um novo build.
              </p>
              <p v-else class="hint" style="color: var(--danger, #c0392b)">
                Repositório/domínio não configurados no <code>.env</code> (VITE_GH_OWNER, VITE_GH_REPO,
                VITE_GH_BRANCH, VITE_GH_DOMINIO). Preencha e gere um novo build antes de publicar.
              </p>
            </div>
            <div class="backup-footer mt-12">
              <button class="btn btn-secondary btn-sm" @click="salvarPublicacao">
                <i class="fas fa-save"></i> Salvar configuração
              </button>
            </div>
          </details>

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
const mostrarHistorico = ref(false) // abre/fecha a lista de versões anteriores do Drive
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
.perfil-config-bloco { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
.perfil-config-bloco .section-label { display: flex; align-items: center; gap: 8px; }
.btn-remover-perfil {
  margin-left: auto;
  background: none; border: none; color: var(--muted);
  font-size: 13px; padding: 4px 8px; cursor: pointer; border-radius: 6px;
}
.btn-remover-perfil:active { background: var(--bg); color: var(--red, #c41c1c); }
.perfil-novo-bloco { background: var(--cream); border-radius: var(--r-md); padding: 14px; }
.perfil-novo-bloco .section-label { color: var(--brown-mid); }
.hint-alerta { color: var(--red, #c41c1c); }
.flex-row-actions { display: flex; gap: 10px; }
.flex-row-actions .btn { flex: 1; }

.modo-compras-opcoes { display: flex; flex-direction: column; gap: 10px; }
.modo-compras-op {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 14px; border: 1.5px solid var(--border); border-radius: var(--r-md);
  background: var(--surface); text-align: left; cursor: pointer;
}
.modo-compras-op i { font-size: 1.05rem; color: var(--muted); margin-top: 2px; flex-shrink: 0; }
.modo-compras-op-txt { display: flex; flex-direction: column; gap: 2px; }
.modo-compras-op-txt strong { font-size: .88rem; color: var(--text); }
.modo-compras-op-txt span { font-size: .76rem; color: var(--muted); line-height: 1.35; }
.modo-compras-op.active { border-color: var(--brown); background: var(--cream); }
.modo-compras-op.active i { color: var(--brown); }
.modo-compras-op.active .modo-compras-op-txt strong { color: var(--brown-dark); }
.cp-check { display: flex; align-items: center; gap: 9px; margin-top: 9px; color: var(--text); font-size: .84rem; font-weight: 600; }
.cp-check input { width: 16px; height: 16px; accent-color: var(--brown); flex-shrink: 0; }

/* ── Logotipo ── */
.logo-upload-linha { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 4px; }
.logo-preview {
  width: 64px; height: 64px; border-radius: var(--r-md); flex-shrink: 0;
  background: var(--cream); border: 1px solid var(--border2);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.logo-preview img { width: 100%; height: 100%; object-fit: contain; }
.logo-preview--vazio { color: var(--gold-dark); font-size: 26px; }
.logo-upload-acoes { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; flex: 1; min-width: 0; }
.cp-upload {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: var(--r-md);
  background: var(--cream); border: 1px solid var(--border2); font-size: 12.5px; font-weight: 700; color: var(--brown);
  white-space: nowrap; flex-shrink: 0; cursor: pointer;
}
.cp-remover-foto { font-size: 12px; color: var(--red); font-weight: 700; padding: 2px 4px; border: none; background: none; }

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
.conta-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: .9rem; background: var(--brown-mid); }
.conta-icon.pagbank { background: var(--gold); color: #000; }
.conta-icon.itau { background: var(--orange); }
.conta-icon.bb { background: var(--gold); color: var(--blue); }
.conta-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.conta-info strong { font-size: .85rem; color: var(--text); }
.conta-info span { font-size: .7rem; color: var(--muted); font-weight: 600; }
.conta-item-acts { display: flex; gap: 4px; }
.btn-action-del { width: 32px; height: 32px; background: transparent; border: none; color: var(--red); font-size: .85rem; }
.btn-action-edit { width: 32px; height: 32px; background: transparent; border: none; color: var(--brown-mid); font-size: .85rem; }

/* ── Backup UI ── */
.backup-stack { display: flex; flex-direction: column; gap: 12px; }
.backup-card { 
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-lg); 
  padding: 16px; transition: all 0.3s ease; 
}
.backup-card.is-connected { border-color: var(--green); background: var(--green-bg); }
.backup-card.local { border-style: dashed; }
.backup-card.seguranca-local { border-color: var(--gold); background: var(--gold-bg); }
.backup-icon.warn { background: var(--gold); color: var(--brown-dark); }
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
.backup-desc { font-size: .7rem; color: var(--muted); line-height: 1.5; margin-top: 8px; }

/* Selo "Sincronização" / "Backup manual" ao lado do nome — deixa claro
   que são duas coisas diferentes: uma é espelho contínuo, a outra é um
   retrato pontual pra emergência. */
.backup-tag {
  display: inline-block; font-size: .58rem; font-weight: 800; text-transform: uppercase;
  letter-spacing: .3px; padding: 2px 7px; border-radius: 999px; margin-left: 6px;
  background: var(--blue-bg); color: var(--blue); vertical-align: middle;
}
.backup-tag--neutro { background: var(--bg); color: var(--muted); border: 1px solid var(--border); }

/* ── Histórico de versões anteriores (Drive) ── */
.backup-historico { margin-top: 4px; }
.backup-historico-toggle {
  width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none;
  padding: 8px 2px; font-size: .74rem; font-weight: 700; color: var(--brown-mid); cursor: pointer;
  font-family: var(--font);
}
.backup-historico-toggle i:first-child { font-size: .8rem; }
.backup-historico-seta { margin-left: auto; font-size: .7rem; transition: transform .2s ease; }
.backup-historico-seta.is-aberta { transform: rotate(180deg); }
.backup-historico-lista {
  display: flex; flex-direction: column; gap: 6px; padding: 8px 2px 2px;
  border-top: 1px dashed var(--border); margin-top: 2px;
}
.backup-historico-item {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 7px 10px; border-radius: var(--r-sm); background: var(--bg); font-size: .72rem; color: var(--brown-dark);
}
.backup-historico-item i { margin-right: 5px; color: var(--muted); }
.btn-xs { padding: 4px 10px; font-size: .68rem; min-height: 26px; }

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

.backup-saude { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; margin-bottom: 14px; background: var(--surface-2, rgba(0,0,0,.04)); border-radius: 10px; font-size: .75rem; }
.backup-saude-linha { display: flex; align-items: center; gap: 8px; color: var(--text); }
.backup-saude-linha i { width: 16px; text-align: center; color: var(--muted); }
.backup-saude-alerta { display: flex; align-items: center; gap: 8px; margin-top: 2px; padding: 8px 10px; border-radius: 8px; background: rgba(217,119,6,.12); color: #b45309; font-weight: 700; }

/* ── Backup (versão simplificada) ── */
.bk-resumo { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: var(--r-lg); margin: 4px 0 14px; border: 1.5px solid var(--border); background: var(--bg); }
.bk-resumo--ok   { background: var(--green-bg); border-color: var(--green); }
.bk-resumo--warn { background: var(--gold-bg);  border-color: var(--gold); }
.bk-resumo-icone { font-size: 1.6rem; color: var(--muted); }
.bk-resumo--ok .bk-resumo-icone   { color: var(--green); }
.bk-resumo--warn .bk-resumo-icone { color: var(--gold-dark, #b45309); }
.bk-resumo-txt { display: flex; flex-direction: column; gap: 2px; }
.bk-resumo-txt strong { font-size: .95rem; color: var(--brown-dark); }
.bk-resumo-txt span { font-size: .74rem; color: var(--muted); font-weight: 600; }

.bk-bloco { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-lg); padding: 14px; margin-bottom: 10px; }
.bk-bloco--aviso { border-color: var(--gold); background: var(--gold-bg); }
.bk-linha { display: flex; align-items: center; gap: 12px; }
.bk-icone { width: 40px; height: 40px; border-radius: 12px; background: var(--bg); color: var(--muted); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
.bk-icone.is-on { background: var(--green); color: #fff; }
.bk-info { flex: 1; min-width: 0; }
.bk-titulo { font-weight: 800; color: var(--brown-dark); font-size: .95rem; }
.bk-sub { font-size: .72rem; font-weight: 600; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.bk-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.bk-acoes .btn { flex: 1; min-width: 110px; font-size: .76rem; }

.bk-mais { margin-top: 8px; border-top: 1px dashed var(--border); }
.bk-mais > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 10px 2px; font-size: .76rem; font-weight: 700; color: var(--brown-mid); }
.bk-mais > summary::-webkit-details-marker { display: none; }
.bk-mais > summary::after { content: '\f078'; font-family: 'Font Awesome 6 Free', 'Font Awesome 5 Free'; font-weight: 900; font-size: .65rem; margin-left: auto; transition: transform .2s ease; }
.bk-mais[open] > summary::after { transform: rotate(180deg); }
.bk-mais > p { font-size: .72rem; color: var(--muted); line-height: 1.5; margin: 0 0 8px; }
.bk-mais .backup-historico-item { margin-bottom: 6px; }
.bk-mais--solto { border-top: none; margin-top: 0; }
.bk-mais--solto > summary { padding-top: 0; padding-bottom: 0; font-size: .85rem; }
.bk-mais--solto[open] > summary { padding-bottom: 8px; }
.bk-badge { background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 0 7px; font-size: .65rem; color: var(--muted); }

.bk-rodape { text-align: center; font-size: .68rem; color: var(--muted); font-weight: 600; margin-top: 12px; }
.bk-rodape i { margin-right: 4px; }

.bk-conta { display: flex; flex-direction: column; margin-top: 4px; font-size: .74rem; line-height: 1.3; min-width: 0; }
.bk-conta i { display: none; }
.bk-conta-nome { font-weight: 800; color: var(--brown-dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bk-conta-email { color: var(--muted); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>