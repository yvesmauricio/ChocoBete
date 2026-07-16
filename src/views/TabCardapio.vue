<template>
  <div class="tab-caderneta cardapio-tab">
    <div class="tab-hdr">
      <div class="tab-hdr-top">
        <h2 class="tab-title"><i class="fas fa-book-bookmark"></i> Cardápio Digital</h2>
      </div>
      <p class="tab-subtitle">Monte um cardápio bonito com suas receitas pra mostrar e enviar aos clientes</p>
    </div>

    <div class="cad-body cp-body">

      <!-- ── Ações principais ── -->
      <div class="cp-acoes">
        <button class="cp-acao cp-acao--principal" @click="telaCheiaAberta = true">
          <i class="fas fa-expand"></i> Tela cheia
        </button>
        <button class="cp-acao" @click="baixarPdf">
          <i class="fas fa-file-pdf"></i> Baixar PDF
        </button>
        <button class="cp-acao" :disabled="gerandoImagem === 'completo'" @click="compartilharCompleto">
          <i class="fas fa-share-nodes"></i> {{ gerandoImagem === 'completo' ? 'Gerando...' : 'Compartilhar' }}
        </button>
      </div>

      <p v-if="!todosItensAtivos.length" class="cp-aviso">
        <i class="fas fa-circle-info"></i> Nenhum item ativo ainda — ative pelo menos uma receita na lista abaixo pra gerar o cardápio.
      </p>

      <!-- ── Modo "mostrar pro cliente" ── -->
      <div class="cp-modo-cliente">
        <div class="cp-modo-cliente-texto">
          <strong><i class="fas fa-store"></i> Abrir direto em tela cheia</strong>
          <span>Ideal pra deixar o celular no balcão mostrando o cardápio. Pra editar, toque no X da tela cheia pra voltar aqui.</span>
        </div>
        <button class="cp-grupo-switch-btn" @click="config.abrir_tela_cheia_padrao = !config.abrir_tela_cheia_padrao; salvar()">
          <span class="cp-switch" :class="{ on: config.abrir_tela_cheia_padrao }"><span class="cp-switch-bola"></span></span>
        </button>
      </div>

      <!-- ── Personalizar capa/rodapé ── -->
      <div class="cp-config-card">
        <button class="cp-config-toggle" @click="configAberta = !configAberta">
          <span><i class="fas fa-pen"></i> Personalizar capa e rodapé</span>
          <i class="fas" :class="configAberta ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
        </button>
        <div v-if="configAberta" class="cp-config-corpo">
          <label class="cp-field">
            <span>Nome do cardápio</span>
            <input v-model="config.nome_cardapio" :placeholder="s.company.nome || 'ChocoBete'" @change="salvar">
          </label>
          <label class="cp-field">
            <span>Subtítulo</span>
            <input v-model="config.subtitulo" placeholder="Chocolates Artesanais" @change="salvar">
          </label>
          <label class="cp-field">
            <span>Mensagem no rodapé</span>
            <input v-model="config.mensagem_rodape" placeholder="Peça já e encomende o seu! 🍫" @change="salvar">
          </label>
          <p class="cp-hint">O contato do rodapé é o mesmo texto configurado em Ajustes → dados usados na etiqueta.</p>
        </div>
      </div>

      <!-- ── Busca ── -->
      <div class="cad-search-bar">
        <div class="cad-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="cad-search-input" placeholder="Buscar receita..." v-model="busca">
        </div>
      </div>

      <div v-if="todosGrupos.length" class="cp-bulk-acoes">
        <button class="cp-bulk-btn" @click="marcarTodos(true)"><i class="fas fa-check-double"></i> Marcar todos</button>
        <button class="cp-bulk-btn" @click="marcarTodos(false)"><i class="fas fa-xmark"></i> Desmarcar todos</button>
      </div>

      <div v-if="!gruposFiltrados.length" class="cad-empty">
        <div class="cad-empty-ico">🍫</div>
        <p v-if="!todosGrupos.length">Nenhuma receita cadastrada ainda. Cadastre na aba Receitas pra montar seu cardápio.</p>
        <p v-else>Nenhum sabor encontrado.</p>
      </div>

      <!-- ── Lista por categoria ── -->
      <div v-else class="cp-grupos">
        <div v-for="grupo in gruposFiltrados" :key="grupo.categoria" class="cp-grupo">
          <div class="cp-grupo-cabecalho">
            <div class="cp-grupo-titulo">{{ grupo.categoria }}</div>
            <button class="cp-grupo-switch-btn" @click="alternarGrupo(grupo)">
              <span>{{ grupoAtivo(grupo) ? 'Categoria ativa' : 'Categoria oculta' }}</span>
              <span class="cp-switch" :class="{ on: grupoAtivo(grupo) }"><span class="cp-switch-bola"></span></span>
            </button>
          </div>

          <div v-for="r in grupo.itens" :key="r.uuid" class="cp-item" :class="{ 'cp-item--inativo': !itemCfg(r.uuid).ativo }">
            <div class="cp-item-topo">
              <button class="cp-switch-btn" @click="itemCfg(r.uuid).ativo = !itemCfg(r.uuid).ativo; salvar()">
                <span class="cp-switch" :class="{ on: itemCfg(r.uuid).ativo }"><span class="cp-switch-bola"></span></span>
              </button>

              <div class="cp-item-avatar">
                <img v-if="itemCfg(r.uuid).foto" :src="itemCfg(r.uuid).foto" alt="">
                <span v-else>{{ itemCfg(r.uuid).emoji || '🍫' }}</span>
              </div>

              <button class="cp-item-corpo" @click="expandido = expandido === r.uuid ? null : r.uuid">
                <div class="cp-item-linha1">
                  <span class="cp-item-nome">{{ r.nome }}</span>
                  <span class="cp-item-preco">{{ R$(precoExibido(r)) }}</span>
                </div>
                <div v-if="itemCfg(r.uuid).descricao" class="cp-item-desc">{{ itemCfg(r.uuid).descricao }}</div>
              </button>

              <button class="cp-item-expand" @click="expandido = expandido === r.uuid ? null : r.uuid">
                <i class="fas" :class="expandido === r.uuid ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
              </button>
            </div>

            <!-- Painel expandido -->
            <div v-if="expandido === r.uuid" class="cp-item-painel">
              <div class="cp-field">
                <div class="cp-field-cabecalho">
                  <span>Descrição de venda (curta)</span>
                  <button type="button" class="cp-ia-btn" @click="copiarPromptDescricao(r)">
                    <i class="fas fa-wand-magic-sparkles"></i> Pedir ideia à IA
                  </button>
                </div>
                <textarea v-model="itemCfg(r.uuid).descricao" maxlength="120" rows="2"
                  placeholder="Ex: trufa de chocolate belga com recheio de doce de leite"
                  @change="salvar"></textarea>
              </div>

              <div class="cp-field-linha">
                <label class="cp-field">
                  <span>Preço no cardápio</span>
                  <div class="input-with-prefix">
                    <span class="input-prefix">R$</span>
                    <input
                      :value="maskMoney(precoExibido(r))"
                      @input="e => atualizarPreco(r, e.target.value)"
                      class="input input-prefixed" type="text" inputmode="numeric" placeholder="0,00"
                    >
                  </div>
                </label>
                <label class="cp-field cp-field--emoji">
                  <span>Emoji</span>
                  <input v-model="itemCfg(r.uuid).emoji" maxlength="4" @change="salvar">
                </label>
              </div>

              <div class="cp-foto-linha">
                <label class="cp-upload">
                  <input type="file" accept="image/*" hidden @change="e => onFotoSelecionada(r, e)">
                  <i class="fas fa-camera"></i> {{ itemCfg(r.uuid).foto ? 'Trocar foto' : 'Adicionar foto' }}
                </label>
                <button v-if="itemCfg(r.uuid).foto" class="cp-remover-foto" @click="itemCfg(r.uuid).foto = null; salvar()">
                  <i class="fas fa-trash"></i> Remover
                </button>
              </div>
              <p class="cp-hint">Foto: JPG, PNG ou WEBP, qualquer tamanho — é redimensionada e comprimida automaticamente. Fotos de iPhone em HEIC podem não abrir; se der problema, exporte como JPG antes.</p>

              <label class="cp-check">
                <input type="checkbox" v-model="itemCfg(r.uuid).destaque" @change="salvar">
                <span>Marcar como "Mais pedido" ⭐</span>
              </label>

              <div class="cp-item-acoes">
                <button class="cp-btn-mini" @click="mover(r, -1)"><i class="fas fa-arrow-up"></i> Subir</button>
                <button class="cp-btn-mini" @click="mover(r, 1)"><i class="fas fa-arrow-down"></i> Descer</button>
                <button class="cp-btn-mini cp-btn-mini--ouro" :disabled="!!gerandoImagem" @click="compartilharItem(r)">
                  <i class="fas fa-share-nodes"></i> {{ gerandoImagem === r.uuid ? 'Gerando...' : 'Compartilhar este' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ TELA CHEIA ══════════════════════════ -->
    <Teleport to="body">
      <div v-if="telaCheiaAberta" class="cp-fullscreen">
        <div class="cp-fullscreen-barra">
          <button class="cp-fs-btn cp-fs-btn--editar" @click="telaCheiaAberta = false"><i class="fas fa-pen"></i> Editar cardápio</button>
          <span class="cp-fs-titulo">{{ config.nome_cardapio || s.company.nome || 'Cardápio' }}</span>
          <div class="cp-fs-acoes">
            <button class="cp-fs-btn" title="Baixar PDF" @click="baixarPdf"><i class="fas fa-file-pdf"></i></button>
            <button class="cp-fs-btn" title="Compartilhar" :disabled="gerandoImagem === 'completo'" @click="compartilharCompleto"><i class="fas fa-share-nodes"></i></button>
          </div>
        </div>
        <iframe class="cp-fullscreen-iframe" :srcdoc="htmlCompleto"></iframe>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useStore } from '../store.js'
import { normalizar, maskMoney, parseMoney } from '../utils.js'
import {
  carregarConfigCardapio, salvarConfigCardapio, ITEM_DEFAULT,
  montarItensCardapio, agruparPorCategoria, redimensionarImagem,
  gerarHtmlCardapio, gerarPdfCardapio, gerarImagemCardapioCompleto, gerarImagemItem,
  compartilharImagem, garantirFontesCarregadas,
} from '../composables/useCardapio.js'

const s = useStore()

// Quando usado dentro do perfil da Bete (embutido na tela dela, sem o menu
// "Mais" do Yves), o componente é montado/desmontado a cada navegação —
// diferente do perfil "ym", onde fica sempre montado (v-show) e a aba ativa
// é controlada por s.tab. standalone=true avisa que "montou = a pessoa
// acabou de entrar aqui agora", sem precisar checar s.tab.
const props = defineProps({ standalone: { type: Boolean, default: false } })

const R$ = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const config = reactive({ nome_cardapio: '', subtitulo: 'Chocolates Artesanais', mensagem_rodape: 'Peça já e encomende o seu! 🍫', abrir_tela_cheia_padrao: false, itens: {} })
const configAberta = ref(false)
const busca = ref('')
const expandido = ref(null)
const telaCheiaAberta = ref(false)
const gerandoImagem = ref(null) // null | 'completo' | uuid do item

onMounted(async () => {
  garantirFontesCarregadas() // dispara em paralelo, sem bloquear — só "esquenta" o cache
  const carregado = await carregarConfigCardapio()
  Object.assign(config, carregado)
  // Modo "mostrar pro cliente": abre direto na tela cheia. Pra editar o
  // cardápio, é só tocar em "Editar cardápio" — volta pra esta tela normalmente.
  if (config.abrir_tela_cheia_padrao && (props.standalone || s.tab === 'cardapio')) {
    telaCheiaAberta.value = true
  }
})

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

function marcarTodos(valor) {
  for (const grupo of todosGrupos.value) {
    for (const item of grupo.itens) {
      itemCfg(item.uuid).ativo = valor
    }
  }
  salvar()
}

function grupoAtivo(grupo) {
  return grupo.itens.length > 0 && grupo.itens.every(i => itemCfg(i.uuid).ativo)
}

function alternarGrupo(grupo) {
  const ligar = !grupoAtivo(grupo)
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

function itemCfg(uuid) {
  if (!config.itens[uuid]) config.itens[uuid] = ITEM_DEFAULT()
  return config.itens[uuid]
}

function precoExibido(r) {
  // `r` já vem de montarItensCardapio() com o campo "preco" pronto: usa o
  // preco_exibido salvo se houver, senão o preco_sugerido da própria receita.
  // (Bug anterior: líamos "r.preco_sugerido", campo que não existe nesse
  // objeto — por isso o valor sempre caía pra 0 em vez de vir da receita.)
  return Number(r.preco || 0)
}

function atualizarPreco(r, valor) {
  itemCfg(r.uuid).preco_exibido = valor === '' ? null : parseMoney(valor)
  salvar()
}

let salvando = null
function salvar() {
  clearTimeout(salvando)
  salvando = setTimeout(() => {
    salvarConfigCardapio(JSON.parse(JSON.stringify(config)))
  }, 250)
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

// Todas as receitas (inclui inativas) — pra edição
const todosGrupos = computed(() => agruparPorCategoria(montarItensCardapio(s.receitas, config, { apenasAtivos: false })))
// Só as ativas — pra gerar o cardápio de verdade (PDF/tela/imagem)
const todosItensAtivos = computed(() => montarItensCardapio(s.receitas, config, { apenasAtivos: true }))
const gruposAtivos = computed(() => agruparPorCategoria(todosItensAtivos.value))

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

const htmlCompleto = computed(() => gerarHtmlCardapio({ config, grupos: gruposAtivos.value, empresa: s.company }))

function slugNome() {
  return (config.nome_cardapio || s.company.nome || 'cardapio').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function baixarPdf() {
  if (!todosItensAtivos.value.length) { s.notify?.('Ative pelo menos uma receita antes de gerar o cardápio.'); return }
  gerarPdfCardapio({ config, grupos: gruposAtivos.value, empresa: s.company })
}

async function compartilharCompleto() {
  if (!todosItensAtivos.value.length) { s.notify?.('Ative pelo menos uma receita antes de gerar o cardápio.'); return }
  gerandoImagem.value = 'completo'
  try {
    const blob = await gerarImagemCardapioCompleto({ config, grupos: gruposAtivos.value, empresa: s.company })
    await compartilharImagem(blob, {
      nomeArquivo: `cardapio-${slugNome()}.png`,
      titulo: config.nome_cardapio || s.company.nome || 'Cardápio',
      texto: 'Confira nosso cardápio! 🍫',
    })
  } catch (err) {
    s.notify?.(err.message || 'Não foi possível gerar a imagem do cardápio.')
  } finally {
    gerandoImagem.value = null
  }
}

async function compartilharItem(r) {
  gerandoImagem.value = r.uuid
  try {
    const item = todosItensAtivos.value.find(i => i.uuid === r.uuid) || { ...r, preco: precoExibido(r), descricao: itemCfg(r.uuid).descricao, emoji: itemCfg(r.uuid).emoji, foto: itemCfg(r.uuid).foto, destaque: itemCfg(r.uuid).destaque }
    const blob = await gerarImagemItem(item, { empresa: s.company })
    await compartilharImagem(blob, {
      nomeArquivo: `${slugNome()}-${(r.nome || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
      titulo: r.nome,
      texto: `${r.nome} — ${R$(precoExibido(r))} 🍫`,
    })
  } catch (err) {
    s.notify?.(err.message || 'Não foi possível gerar a imagem do item.')
  } finally {
    gerandoImagem.value = null
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
.cad-body { padding: 14px 16px calc(20px + env(safe-area-inset-bottom)); }

.cad-search-bar { padding: 0 0 2px; }
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

.cad-empty { text-align: center; padding: 60px 20px; color: var(--muted); }
.cad-empty-ico { font-size: 40px; margin-bottom: 10px; }

.cp-body { display: flex; flex-direction: column; gap: 14px; }

.cp-acoes { display: flex; gap: 8px; flex-wrap: wrap; }
.cp-acao {
  flex: 1; min-width: 104px; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 11px 10px; border-radius: var(--r-lg); border: 1px solid var(--border2);
  background: var(--surface); color: var(--brown); font-weight: 700; font-size: 12.5px;
  transition: var(--t);
}
.cp-acao:disabled { opacity: .6; }
.cp-acao--principal { background: var(--brown); color: #fff; border-color: var(--brown); }

.cp-aviso {
  display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--gold-dark);
  background: var(--gold-bg); border: 1px solid var(--gold-light); border-radius: var(--r-md);
  padding: 9px 12px;
}

.cp-modo-cliente {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; border-radius: var(--r-lg); border: 1px solid var(--gold-light);
  background: var(--gold-bg);
}
.cp-modo-cliente-texto { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cp-modo-cliente-texto strong { font-size: 13px; color: var(--brown-dark); display: flex; align-items: center; gap: 6px; }
.cp-modo-cliente-texto span { font-size: 11px; color: var(--brown-mid); line-height: 1.4; }

.cp-config-card { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; }
.cp-config-toggle {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; font-weight: 700; font-size: 13px; color: var(--brown); background: var(--cream);
  border: none; text-align: left;
}
.cp-config-corpo { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
.cp-hint { font-size: 11px; color: var(--muted); line-height: 1.4; }

.cp-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); font-weight: 600; min-width: 0; }
.cp-field > input, .cp-field > textarea {
  width: 100%; font: inherit; font-size: 13.5px; color: var(--text); padding: 9px 10px; border-radius: var(--r-md);
  border: 1px solid var(--border2); background: var(--bg); resize: vertical; box-sizing: border-box;
}
.cp-field .input-with-prefix { min-height: 40px; }
.cp-field .input-with-prefix input { font-size: 13.5px; padding: 9px 10px; min-height: auto; }
.cp-field-cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.cp-ia-btn {
  display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
  font-size: 11px; font-weight: 700; color: var(--gold-dark); background: var(--gold-bg);
  border: 1px solid var(--gold-light); border-radius: var(--r-full); padding: 4px 10px;
}
.cp-field-linha { display: flex; gap: 8px; }
.cp-field-linha .cp-field { flex: 1; min-width: 0; }
.cp-field--emoji { flex: 0 0 76px; }
.cp-field--emoji input { text-align: center; font-size: 18px; padding: 9px 4px; }

.cp-bulk-acoes { display: flex; gap: 8px; }
.cp-bulk-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 8px; border-radius: var(--r-md); border: 1px solid var(--border2);
  background: var(--surface); color: var(--brown-mid); font-weight: 700; font-size: 11.5px;
}

.cp-grupos { display: flex; flex-direction: column; gap: 18px; }
.cp-grupo-cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.cp-grupo-titulo {
  font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase;
  color: var(--gold-dark); padding-left: 2px;
}
.cp-grupo-switch-btn {
  display: flex; align-items: center; gap: 6px; border: none; background: none; padding: 2px;
  font-size: 10.5px; font-weight: 700; color: var(--muted);
}

.cp-item { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); margin-bottom: 8px; overflow: hidden; }
.cp-item--inativo { opacity: .5; }
.cp-item-topo { display: flex; align-items: center; gap: 8px; padding: 10px; }

.cp-switch-btn { flex-shrink: 0; border: none; background: none; padding: 0; }
.cp-switch { display: inline-flex; align-items: center; width: 34px; height: 20px; border-radius: 999px; background: var(--border2); padding: 2px; transition: var(--t); }
.cp-switch.on { background: var(--gold); }
.cp-switch-bola { width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: var(--t); }
.cp-switch.on .cp-switch-bola { transform: translateX(14px); }

.cp-item-avatar {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; overflow: hidden;
  background: var(--gold-bg); border: 1px solid var(--gold-light);
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.cp-item-avatar img { width: 100%; height: 100%; object-fit: cover; }

.cp-item-corpo { flex: 1; min-width: 0; text-align: left; border: none; background: none; padding: 0; }
.cp-item-linha1 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.cp-item-nome { font-weight: 700; font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-item-preco { font-weight: 800; font-size: 13px; color: var(--gold-dark); white-space: nowrap; }
.cp-item-desc { font-size: 11.5px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cp-item-expand { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--muted); border: none; background: none; padding: 0; }

.cp-item-painel { padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 10px; border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 12px; }

.cp-foto-linha { display: flex; align-items: center; gap: 8px; }
.cp-upload {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: var(--r-md);
  background: var(--cream); border: 1px solid var(--border2); font-size: 12.5px; font-weight: 700; color: var(--brown);
  white-space: nowrap; flex-shrink: 0;
}
.cp-remover-foto { font-size: 12px; color: var(--red); font-weight: 700; padding: 6px 8px; border: none; background: none; }

.cp-check { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text); }

.cp-item-acoes { display: flex; gap: 6px; flex-wrap: wrap; }
.cp-btn-mini {
  flex: 1; min-width: 88px; padding: 8px 6px; border-radius: var(--r-md); border: 1px solid var(--border2);
  background: var(--surface); font-size: 11.5px; font-weight: 700; color: var(--brown);
}
.cp-btn-mini--ouro { background: var(--gold-bg); border-color: var(--gold-light); color: var(--gold-dark); }
.cp-btn-mini:disabled { opacity: .6; }

/* ── Tela cheia ── */
.cp-fullscreen { position: fixed; inset: 0; z-index: 2000; background: #0e0c0a; display: flex; flex-direction: column; }
.cp-fullscreen-barra {
  display: flex; align-items: center; gap: 8px;
  padding: max(10px, env(safe-area-inset-top)) 10px 10px; background: #17130f;
  border-bottom: 1px solid rgba(212,175,55,.25);
}
.cp-fs-titulo { flex: 1; min-width: 0; text-align: center; color: #d4af37; font-weight: 700; font-size: 13px; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-fs-acoes { display: flex; gap: 6px; flex-shrink: 0; }
.cp-fs-btn {
  width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: rgba(212,175,55,.12); border: 1px solid rgba(212,175,55,.4); color: #d4af37; font-size: 14px;
  flex-shrink: 0;
}
.cp-fs-btn--editar {
  width: auto; height: 36px; border-radius: 999px; padding: 0 12px; gap: 6px;
  font-size: 12px; font-weight: 700; white-space: nowrap;
}
.cp-fs-btn:disabled { opacity: .5; }
.cp-fullscreen-iframe { flex: 1; width: 100%; border: none; background: #0e0c0a; }
</style>
