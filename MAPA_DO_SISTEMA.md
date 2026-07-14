# 🗺️ Mapa do Sistema ChocoBete

## 📋 Resumo Executivo

**ChocoBete** é uma aplicação PWA (Progressive Web App) construída com **Vue 3** + **Pinia** + **Dexie**, desenvolvida para gerenciar:
- 🧁 **Receitas** e formulas de produção
- 📊 **Produção** com cronometragem e análise
- 💰 **Financeiro** com importação bancária
- 🍽️ **Cozinha** com agenda/lote de produção
- 🏷️ **Etiquetas** para produtos
- 📦 **Insumos/Produtos** com histórico de preços
- 📈 **Inteligência** com análise de vendas
- ⚙️ **Ajustes** e configurações

---

## 🎯 Arquitetura Geral

```
📦 ChocoBete (PWA Vue 3 + Pinia + Dexie)
├── 🔧 Configuração & Build
│   ├── package.json           → Dependências e scripts
│   ├── vite.config.js         → Configuração Vite + PWA
│   ├── pnpm-lock.yaml         → Lock file
│   └── pnpm-workspace.yaml    → Workspace config
├── 💾 Dados & Estado
│   ├── src/db.js              → IndexedDB (Dexie) - Banco local
│   ├── src/store.js           → Pinia store - Estado global
│   └── src/utils.js           → Utilitários (formatação, parsing)
├── 🎨 Interface
│   ├── src/App.vue            → Componente raiz
│   ├── src/main.js            → Entry point
│   ├── src/assets/            → CSS global
│   └── src/components/        → Componentes reutilizáveis
├── 📄 Telas (Tabs)
│   └── src/views/             → Cada tab é uma view
├── 🔌 Lógica Reutilizável
│   ├── src/composables/       → Composables (custom hooks)
│   └── src/services/          → Serviços externos (Drive, PDF, etc)
└── 📱 PWA
    └── public/                → Assets estáticos
```

---

## 📁 Estrutura de Pastas Detalhada

### **1. Raiz do Projeto**

| Arquivo | Descrição | Modificar quando... |
|---------|-----------|----------------------|
| `package.json` | Dependências, versão, scripts | Adicionar nova lib, mudar versão, novo script |
| `vite.config.js` | Configuração Vite + PWA | Mudar porta, build, PWA service worker |
| `index.html` | HTML base | Mudar meta tags, favicon, title |
| `pnpm-lock.yaml` | Lock file | **NÃO EDITAR** (gerado automaticamente) |

**Scripts disponíveis:**
```bash
npm run dev       # Inicia dev server (localhost:5173)
npm run build     # Build de produção
npm run preview   # Preview da build
```

---

### **2. `src/db.js` - Banco de Dados Local**

**Função:** Configurar schemas do IndexedDB com Dexie

**O que contém:**
- Definição de versões do banco
- Schemas das tabelas (produtos, receitas, producoes, financeiro, etc)
- Funções de importação/exportação de dados
- Migrations de versão antiga

**Tabelas principais:**
```javascript
db.version(N).stores({
  produtos:         'uuid, nome'           // Ingredientes e produtos
  receitas:         'uuid, nome'           // Receitas de produção
  producoes:        'uuid, data_producao'  // Registros de produção
  financeiro:       '++id, data, valor, tipo, categoria, ...' // Movimentações
  historico_precos: '++id, produto_id, data' // Histórico de valores
  config:           'chave'                // Configurações do app
})
```

**Modificar quando:**
- ✅ Adicionar novo tipo de dado (ex: novo objeto para armazenar)
- ✅ Adicionar campos a um registro existente
- ✅ Criar índices para melhor busca
- ❌ Editar dados do usuário (faça isso em `store.js`)

---

### **3. `src/store.js` - Estado Global (Pinia)**

**Função:** Gerenciar estado reativo da aplicação

**Estado principal:**
```javascript
// UI
tab                    // Aba atual ('receitas', 'producao', 'painel', etc)
loading                // Estado de carregamento
toast                  // Notificações

// Dados
produtos               // Array de produtos
receitas               // Array de receitas
producoes              // Array de produções
financeiro             // Array de movimentações financeiras
contasFinanceiras      // Contas bancárias configuradas

// Produção
producaoFantasma       // Diferenças e inconsistências
cozinhaLote            // Agenda/rascunho de produção
cozinhaChecklist       // Checklist da cozinha

// Filtros
producaoFiltroAtivo    // Filtro ativo ('7dias', etc)
producaoBusca          // Termo de busca

// Google Drive
backup integrations    // Configuração de backup
```

**Ações principais:**
```javascript
// CRUD de produtos
async criarProduto(dados)
async atualizarProduto(uuid, dados)
async deletarProduto(uuid)

// CRUD de receitas
async criarReceita(dados)
async atualizarReceita(uuid, dados)
async deletarReceita(uuid)

// CRUD de produção
async criarProducao(dados)
async atualizarProducao(uuid, dados)

// Financeiro
async adicionarMovimentacao(dados)
async importarExtrato(arquivo)
async exportarDados()
async importarDados(arquivo)

// UI
mudarTab(novaTab)
mostrarToast(mensagem, tipo)
abrirModal(nome, dados)
```

**Modificar quando:**
- ✅ Adicionar novo estado global
- ✅ Criar ações de CRUD
- ✅ Adicionar lógica de negócio complexa
- ✅ Integrar com serviços externos

---

### **4. `src/utils.js` - Funções Utilitárias**

**Função:** Centralize funções reutilizáveis (formatação, parsing, validação)

**Categorias de funções:**

**Formatação de Valores:**
```javascript
R$(valor, compact)           // Formata moeda (R$ 1.234,56)
fmtQtd(valor, unidade)       // Formata quantidade com unidade
maskMoney(valor)             // Máscara monetária
formatarData(dataIso)        // Formata data (DD/MM/YYYY)
dataHoraBR(iso)              // Formata data+hora
labelNatureza(tipo)          // Labels para tipos de movimento
```

**Parsing & Conversão:**
```javascript
toNumber(valor)              // Converte para número com segurança
roundMoney(valor)            // Arredonda moeda
parseMoney(texto)            // Parse moeda (centavos)
parseValorBr(texto)          // Parse valor BR format
parseDataBr(texto)           // Parse data DD/MM/YYYY → ISO
```

**CSV & Importação:**
```javascript
detectarDelimitadorCsv(texto) // Detecta ; , ou \t
dividirLinhaCsv(linha, delim) // Split de linha respeitando aspas
```

**Modificar quando:**
- ✅ Criar nova função de formatação
- ✅ Adicionar novo tipo de parsing
- ✅ Função reutilizável em múltiplos lugares

---

### **5. `src/main.js` - Entry Point**

**Função:** Inicializar aplicação, registrar plugins, PWA

**Faz:**
- Cria instância Vue
- Registra Pinia (state management)
- Registra PWA service worker
- Importa CSS global

**Modificar quando:**
- ✅ Adicionar novo plugin Vue
- ✅ Registrar nova dependência global
- ✅ Alterar comportamento de PWA

---

### **6. `src/App.vue` - Componente Raiz**

**Função:** Shell principal, define layout geral

**Estrutura:**
```
<div class="shell">
  ├── SelecaoPerfil (modal inicial)
  ├── AppHeader (cabeçalho)
  ├── <main>
  │   ├── TabReceitas       (view)
  │   ├── TabProducao       (view)
  │   ├── TabPainel         (view)
  │   ├── TabInsumos        (view)
  │   ├── TabInteligencia   (view)
  │   ├── TabFinanceiro     (view)
  │   ├── TabCozinha        (view)
  │   ├── TabBriefing       (view)
  │   ├── TabAjustes        (view)
  │   └── TabEtiquetas      (view)
  ├── AppNav (navegação inferior)
  ├── FAB (botão flutuante contextual)
  ├── Floating Timer (cronômetro)
  └── Modal Stack (pilha de modais)
</div>
```

**Lógica:**
- Renderiza view baseada em `store.tab`
- Renderiza FAB contextual baseado na aba atual
- Gerencia cronômetro flutuante
- Sistema de modal com pilha (stack)

**Modificar quando:**
- ✅ Adicionar nova aba/view
- ✅ Mudar layout geral
- ✅ Adicionar novo componente global (header, nav, etc)

---

### **7. `src/components/` - Componentes Reutilizáveis**

Componentes que aparecem em múltiplas views.

| Componente | Uso | Modificar quando |
|-----------|-----|------------------|
| `AppHeader.vue` | Cabeçalho da app | Mudar logo, menu top, nome |
| `AppNav.vue` | Navegação inferior (tabs) | Adicionar aba, mudar ícones |
| `BaseModal.vue` | Modal genérico | Mudar estilos, animações |
| `SwipeRow.vue` | Linha com gesto de swipe | Mudar gestos, ações |
| `CadernetaSwipeItem.vue` | Item de caderneta com swipe | Lógica de caderneta |
| `ConfirmDialog.vue` | Diálogo de confirmação | Mudar textos, estilos |
| `EditarCategoriaModal.vue` | Modal para editar categorias | Lógica de categorias |
| `FinanceListRow.vue` | Linha de financeiro | Formatação, cores |
| `ModalCompra.vue` | Modal de compra | Lógica de compra |
| `CategoryFilter.vue` | Filtro de categorias | Filtros ativos |
| `AppListRow.vue` | Linha genérica de lista | Template de linha |
| `Importadores` | Parsers bancários | Adicionar novo banco |

**Modificar quando:**
- ✅ Reutilizar componente em nova view
- ✅ Adicionar nova prop ou evento
- ✅ Mudar estilo global

---

### **8. `src/views/` - Telas Principais (Tabs)**

Cada aba da navegação é uma view completa.

| View | Função | O que mexer |
|------|--------|------------|
| `SelecaoPerfil.vue` | Tela inicial de seleção de perfil | Perfis disponíveis, roteamento |
| `TabReceitas.vue` | Gerenciar receitas | CRUD de receitas, formatação |
| `TabProducao.vue` | Registro de produção | Lógica de produção, cronômetro |
| `TabPainel.vue` | Dashboard com resumos | KPIs, gráficos, métricas |
| `TabInsumos.vue` | Gerenciar produtos/insumos | CRUD de produtos |
| `TabInteligencia.vue` | Análise de vendas e dados | Analytics, gráficos |
| `TabFinanceiro.vue` | Movimentações financeiras | CRUD, importação, análise |
| `TabCozinha.vue` | Agenda de produção | Lote de produção, checklist |
| `TabBriefing.vue` | Resumo/briefing do dia | Dashboard customizado |
| `TabAjustes.vue` | Configurações e preferências | Config do app, backup, export |
| `TabEtiquetas.vue` | Gerador de etiquetas | Layouts de etiqueta, impressão |

**Padrão de uma view:**
```vue
<template>
  <div class="tab">
    <!-- Lista, formulário, etc -->
  </div>
</template>

<script setup>
import { useStore } from '@/store'
// Imports de composables e componentes
const store = useStore()

// Lógica reativa
</script>

<style scoped>
/* Estilos específicos da view */
</style>
```

**Modificar quando:**
- ✅ Adicionar novo campo/coluna
- ✅ Adicionar novo botão/ação
- ✅ Mudar fluxo de uma tela
- ✅ Adicionar nova visualização/filtro

---

### **9. `src/composables/` - Custom Hooks (Lógica Reutilizável)**

Extractos de lógica reativa que podem ser usados em múltiplos componentes.

| Composable | Função |
|-----------|--------|
| `useModalStack.js` | Gerenciar pilha de modais |
| `useSwipe.js` | Detectar gestos de swipe |
| `useConfirm.js` | Exibir modal de confirmação |
| `useDeleteConfirm.js` | Confirmação com delete |
| `useCaderneta.js` | Lógica de caderneta |
| `useEtiquetas.js` | Lógica de etiquetas |
| `useKitFesta.js` | Lógica de kit de festa |
| `useModalCompra.js` | Modal de compra |
| `useListFilter.js` | Filtrar listas |
| `useTabScroll.js` | Sincronizar scroll entre abas |
| `useGerarDocumento.js` | Gerar PDF/Word |
| `useAnaliseReceitas.js` | Análise de receitas |
| `useAndroidBackGuard.js` | Interceptar botão back Android |
| `overlayHistory.js` | Histórico de overlays |

**Padrão:**
```javascript
export function useX() {
  const state = ref(...)
  const action = () => { ... }
  return { state, action }
}
```

**Modificar quando:**
- ✅ Criar lógica reutilizável entre 2+ componentes
- ✅ Abstrair lógica complexa para ficar legível
- ✅ Compartilhar estado entre diferentes views

---

### **10. `src/services/` - Integrações Externas**

Serviços que conectam com sistemas externos.

| Serviço | Função | Modificar quando |
|---------|--------|------------------|
| `googleDriveBackup.js` | Backup/restore no Google Drive | Alterar integração Drive, auth |
| `pdfService.js` | Gerar PDFs | Mudar template, layout PDF |
| `nfeArquivoService.js` | Processar arquivos NFe | Alterar parsing NFe |

**Exemplo `googleDriveBackup.js`:**
```javascript
export async function conectarGoogleDriveBackup()    // Autenticar
export async function salvarBackupNoDrive()          // Upload
export async function restaurarBackupDoDrive()       // Download
export async function desconectarGoogleDriveBackup() // Logout
```

**Modificar quando:**
- ✅ Integrar novo serviço externo
- ✅ Mudar provider (ex: Dropbox em vez de Drive)
- ✅ Alterar formato de backup

---

### **11. `src/assets/` - Estilos Globais**

| Arquivo | Função |
|---------|--------|
| `main.css` | Estilos globais da app |
| `checklist.css` | Estilos de checklist |

**Modificar quando:**
- ✅ Mudar cores, temas
- ✅ Adicionar classe global reutilizável
- ✅ Mudar responsividade

---

### **12. `public/` - Assets Estáticos PWA**

| Arquivo | Função |
|---------|--------|
| `offline.html` | Página quando offline |
| `manifest.json` | Metadata PWA |
| Ícones (favicon, apple-touch-icon, etc) | Icons da app |

---

## 🔄 Fluxo de Dados

```
User Input (Componente Vue)
    ↓
Action no Store (Pinia)
    ↓
State é atualizado
    ↓
Componente re-renderiza
    ↓
Optional: Salvar em DB (Dexie)
```

### Exemplo: Criar um novo produto

```
1. Usuário clica "Novo Produto" em TabInsumos.vue
2. Abre ModalCompra.vue
3. Usuário preenche forma
4. Clica "Salvar"
5. Chama store.criarProduto(dados)  ← store.js
6. Store valida e chama db.produtos.add()  ← db.js
7. Dexie salva em IndexedDB
8. Store atualiza array `produtos`
9. Vue re-renderiza com novo item
```

---

## 🎯 Guia Prático: Como Adicionar Novas Funcionalidades

### **Cenário 1: Adicionar novo campo a um objeto existente**

Exemplo: Adicionar campo "margem" aos produtos

**Passo 1:** Atualizar schema em `db.js`
```javascript
db.version(X).stores({
  produtos: 'uuid, nome'  // Índices continuam iguais
})
// O novo campo é adicionado nos objetos sem mexer em índices
```

**Passo 2:** Atualizar `store.js` para manipular o novo campo
```javascript
async atualizarProduto(uuid, dados) {
  // dados pode conter { margem: 0.25 }
  await db.produtos.update(uuid, dados)
  this.produtos = await db.produtos.toArray()
}
```

**Passo 3:** Atualizar component que exibe/edita
```vue
<!-- Em TabInsumos.vue ou ModalCompra.vue -->
<input v-model="produto.margem" type="number" />
```

---

### **Cenário 2: Adicionar nova aba completa**

Exemplo: Criar aba "TabClientes"

**Passo 1:** Criar `src/views/TabClientes.vue`
```vue
<template>
  <div class="tab tab-clientes">
    <!-- Conteúdo da aba -->
  </div>
</template>

<script setup>
import { useStore } from '@/store'
const store = useStore()
// Sua lógica
</script>
```

**Passo 2:** Adicionar novo tab ao store em `store.js`
```javascript
const tab = ref('painel')  // Adicionar 'clientes' como opção

// Adicionar estado para clientes
const clientes = ref([])
```

**Passo 3:** Importar e renderizar em `App.vue`
```vue
<script setup>
import TabClientes from '@/views/TabClientes.vue'
</script>

<template>
  <TabClientes v-show="s.tab === 'clientes'" />
</template>
```

**Passo 4:** Adicionar botão em `AppNav.vue`
```vue
<button 
  :class="{ active: s.tab === 'clientes' }"
  @click="store.mudarTab('clientes')"
>
  <i class="fas fa-users"></i>
  <span>Clientes</span>
</button>
```

**Passo 5:** Adicionar schema em `db.js` (se armazenar dados)
```javascript
db.version(X).stores({
  clientes: 'uuid, nome'
})
```

---

### **Cenário 3: Adicionar integração com serviço externo**

Exemplo: Integrar com WhatsApp

**Passo 1:** Criar `src/services/whatsappService.js`
```javascript
export async function enviarMensagemWhatsapp(numero, mensagem) {
  // Integração com API do WhatsApp
}
```

**Passo 2:** Usar em `store.js`
```javascript
import { enviarMensagemWhatsapp } from '@/services/whatsappService'

export const useStore = defineStore('choco', () => {
  async notificarClienteWhatsapp(clienteId, mensagem) {
    const cliente = this.clientes.find(c => c.id === clienteId)
    await enviarMensagemWhatsapp(cliente.whatsapp, mensagem)
  }
})
```

**Passo 3:** Usar em componente
```vue
<button @click="store.notificarClienteWhatsapp(123, 'Seu pedido saiu!')">
  Notificar
</button>
```

---

### **Cenário 4: Adicionar novo tipo de filtro/busca**

Exemplo: Filtrar receitas por dificuldade

**Passo 1:** Adicionar ao store em `store.js`
```javascript
const receitasFiltro = ref({
  dificuldade: null,
  tempo: null,
  busca: ''
})

const receitasFiltradas = computed(() => {
  return this.receitas.filter(r => {
    const filtroDificuldade = !this.receitasFiltro.dificuldade || 
                              r.dificuldade === this.receitasFiltro.dificuldade
    const filtroBusca = !this.receitasFiltro.busca || 
                        r.nome.includes(this.receitasFiltro.busca)
    return filtroDificuldade && filtroBusca
  })
})
```

**Passo 2:** Usar em `TabReceitas.vue`
```vue
<select v-model="store.receitasFiltro.dificuldade">
  <option :value="null">Todas</option>
  <option value="facil">Fácil</option>
  <option value="medio">Médio</option>
  <option value="dificil">Difícil</option>
</select>

<div v-for="receita in store.receitasFiltradas" :key="receita.uuid">
  {{ receita.nome }}
</div>
```

---

## 📊 Dependências Principais

```json
{
  "vue": "^3.4.0",              // Framework
  "pinia": "^2.1.7",            // State management
  "dexie": "^4.0.7",            // IndexedDB
  "jspdf": "^4.2.1",            // Gerar PDF
  "docxtemplater": "^3.68.5",   // Gerar Word
  "pdfjs-dist": "^4.10.38",     // Visualizar PDF
  "file-saver": "^2.0.5",       // Download de arquivos
  "@fortawesome/fontawesome-free": "^7.2.0"  // Ícones
}
```

---

## 🔐 Segurança & Performance

### ✅ Boas Práticas

1. **Nunca edite índices do Dexie sem migration** → Cria novo schema version
2. **Centralize formatação em `utils.js`** → Evita duplicação
3. **Use composables para lógica complexa** → Facilita teste e reuso
4. **Mantenha store.js limpo** → Apenas estado + ações, lógica de UI em componentes
5. **Validators no store** → Validar antes de salvar em DB
6. **Backup automático** → Implementado com Google Drive

---

## 🚀 Checklist para Adicionar Feature

```
[ ] 1. Criar/atualizar schema em db.js (se novo dado)
[ ] 2. Adicionar estado em store.js
[ ] 3. Criar ações (CRUD) em store.js
[ ] 4. Criar view ou atualizar view existente
[ ] 5. Adicionar componentes necessários em components/
[ ] 6. Criar composables se lógica complexa
[ ] 7. Testes manuais na dev
[ ] 8. Build e testar produção
[ ] 9. Documentar em comentários
[ ] 10. Update MAPA_DO_SISTEMA.md se mudança significativa
```

---

## 📝 Notas Importantes

### Perfis de Usuário
O app suporta múltiplos perfis:
- **YM** (Receitas completo) - View principal atual
- **Bete** (Simplificado)

Selecionado em `SelecaoPerfil.vue` no boot.

### PWA
- Funciona offline
- Service worker registrado em `main.js`
- Manifesto em `public/manifest.json`
- Auto-update silencioso

### Banco de Dados
- **IndexedDB** via Dexie
- Rodas localmente (sem backend)
- Backup manual via Google Drive
- Suporta export/import JSON

---

## 📞 Quick Reference

| Preciso... | Editar arquivo | Função/Componente |
|-----------|-----------------|-------------------|
| Adicionar novo campo | `db.js` + `store.js` | `db.version()` + state |
| Criar novo botão/ação | `src/components/*.vue` ou `src/views/*.vue` | `@click="action"` |
| Adicionar nova aba | `App.vue` + `AppNav.vue` + `views/*.vue` | `TabX.vue` |
| Formatar texto/número | `utils.js` | `R$()`, `fmtQtd()`, etc |
| Lógica de UI complexa | `composables/useX.js` | Composable novo |
| Integração externa | `services/xService.js` | Service novo |
| Salvar dados em DB | `store.js` | Action com `db.tabela.add/update` |
| Mudar estilo global | `assets/main.css` | CSS class ou variável |
| Gerenciar modais | `useModalStack.js` | Composable existente |

---

## 🎓 Arquitetura Padrão Vue 3 Composition API + Pinia

```
Component.vue
├── <template>        ← HTML com v-if/v-for/v-model
├── <script setup>    ← Reactive state (ref, computed)
│   ├── Imports
│   ├── const store = useStore()
│   ├── Refs e composables
│   └── Methods
└── <style scoped>    ← CSS isolado
```

---

**Versão:** 3.0.0  
**Última atualização:** 2024  
**Tech Stack:** Vue 3 + Pinia + Dexie + Vite + PWA

