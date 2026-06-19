import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/receitas-v3/', // 👈 ESSENCIAL pro GitHub Pages

  plugins: [
    vue(),

    VitePWA({
      registerType: 'autoUpdate',

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
        background_color: '#fdf5e8',
        display: 'standalone',
        start_url: '/receitas-v3/',
        scope: '/receitas-v3/',

        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },

      workbox: {

        additionalManifestEntries: [
          { url: '/receitas-v3/offline.html', revision: null }
        ],

        // Use the SPA shell for navigation requests. Pointing this to
        // offline.html makes GitHub Pages open the offline screen as the app entry.
        navigateFallback: '/receitas-v3/index.html',
        navigateFallbackDenylist: [/^\/assets\//],

        skipWaiting: true,
        clientsClaim: true,

        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],

        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 2
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
              cacheableResponse: { statuses: [0, 200] }
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
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
