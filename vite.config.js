import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Detecta automaticamente o ambiente de publicação
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true'

// Base usada por todo o projeto
const BASE = isGitHubPages ? '/ChocoBete/' : '/'

// Muda a cada build → força o Service Worker a baixar de novo o index.html
// (com revision: null ele nunca era atualizado nos aparelhos).
const BUILD_ID = Date.now().toString()

// Caminhos das páginas públicas do cardápio (o link que vai pro cliente).
// O Cloudflare Pages serve essas páginas TANTO com ".html" no final quanto
// sem (URL "limpa" — ex: /pedido-diaadia funciona igual a
// /pedido-diaadia.html) — então qualquer regra que trate essas páginas
// como especiais (fora do cache do app) precisa cobrir as duas formas,
// senão sobra uma brecha exatamente na forma que não foi coberta.
const PUBLIC_MENU_PATHS = /\/pedido(-diaadia|-festa)?(\.html)?$/

export default defineConfig({
  base: BASE,

  plugins: [
    vue(),

    VitePWA({
      registerType: 'prompt',

      devOptions: {
        enabled: false
      },

      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'maskable-icon.png'
      ],

      manifest: {
        name: 'chocobete',
        short_name: 'chocobete',
        description: 'Gestão de Confeitaria Local-Only',
        theme_color: '#3d2008',
        background_color: '#3d2008',
        display: 'standalone',
        // Ao instalar no computador (Chrome/Edge), abre como janela própria de app
        display_override: ['standalone', 'minimal-ui'],
        categories: ['business', 'productivity'],

        start_url: BASE,
        scope: BASE,

        icons: [
          { src: 'icon-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },

      workbox: {
        additionalManifestEntries: [
          {
            url: `${BASE}offline.html`,
            revision: BUILD_ID
          },
          // index.html (a "casca" do app) fica garantido no cache desde a
          // instalação do Service Worker — sem isso, ele só entrava no
          // cache depois da 1ª navegação bem-sucedida com internet (via
          // runtimeCaching "pages" abaixo). Isso cobria quase todo mundo,
          // mas deixava uma brecha: se por qualquer motivo essa 1ª visita
          // não tivesse concluído, ou o cache dela fosse perdido, o app
          // não tinha uma cópia de reserva pra abrir offline.
          {
            url: `${BASE}index.html`,
            revision: BUILD_ID
          }
        ],

        // SPA
        navigateFallback: `${BASE}index.html`,
        // Além de /assets/, qualquer .html publicado à parte (ex: o cardápio
        // interativo em /pedido.html) também precisa ficar de fora — senão o
        // Service Worker devolve o index.html do app no lugar dele, achando
        // que é uma rota interna do SPA.
        // Além de /assets/ e das páginas do cardápio, qualquer .html
        // publicado à parte fica de fora do fallback do app (ex: se algum
        // dia existir outro .html estático solto em /public).
        navigateFallbackDenylist: [/^\/assets\//, PUBLIC_MENU_PATHS, /\.html$/],

        skipWaiting: false,
        clientsClaim: false,

        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2,docx}'],

        runtimeCaching: [
          {
            // Páginas públicas do cardápio (/pedido-diaadia.html,
            // /pedido-festa.html, /pedido.html) NUNCA devem passar pela
            // regra de navegação abaixo. Elas não são rotas do app — são
            // arquivos publicados à parte, direto pro GitHub/Cloudflare,
            // e o cliente que abre o link deve sempre ver a versão mais
            // recente. Sem essa exceção, qualquer celular que em algum
            // momento também tenha aberto o app principal (o mesmo domínio
            // hospeda os dois) ficava com esse Service Worker guardando
            // uma cópia da página do cardápio e servindo ela por cache
            // (StaleWhileRevalidate = mostra o que já tem salvo primeiro,
            // sempre um passo atrás) — se essa cópia salva tivesse sido
            // feita antes do arquivo existir (ou por engano abrindo o link
            // raiz do domínio), o "cardápio" que aparecia era o sistema
            // interno, preso ali até o cache ser limpo. Aqui garantimos
            // que essas páginas sempre vão direto pra rede, sem cache.
            // "sem essa exceção" — ver PUBLIC_MENU_PATHS no topo do arquivo:
            // cobre tanto /pedido-diaadia.html quanto /pedido-diaadia (a
            // versão sem extensão que o Cloudflare também serve).
            urlPattern: ({ url }) => PUBLIC_MENU_PATHS.test(url.pathname),
            handler: 'NetworkOnly'
          },
          {
            // App local-only: a "casca" do app (index.html) tem que abrir
            // na hora, sempre a partir do cache — rede só é usada em segundo
            // plano pra buscar uma versão mais nova pra próxima abertura.
            // Antes era NetworkFirst (tentava rede por até 2s antes de cair
            // pro cache), o que deixava a tela em branco alguns segundos
            // sempre que o app reabria com sinal fraco/instável.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pages'
            }
          },
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-awesome-assets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
})