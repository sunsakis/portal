import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico', 
        'apple-touch-icon.png', 
        'masked-icon.svg',
        'robots.txt',
        'ios/*.png',
        'android/*.png',
        'splash/*.jpg',
        'icons/*.png'
      ],
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff,woff2,ttf,eot}'
        ],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024, // 50MB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          // MapTiler API
          {
            urlPattern: /^https:\/\/api\.maptiler\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maptiler-api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60 * 7, // 7 days
                purgeOnQuotaError: true
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                // Remove API key from cache key for better hit rate
                const url = new URL(request.url)
                url.searchParams.delete('key')
                return url.href
              }
            }
          },
          // MapTiler Tiles
          {
            urlPattern: /^https:\/\/api\.maptiler\.com\/maps\/[^\/]+\/[0-9]+\/[0-9]+\/[0-9]+\.(png|jpg|webp)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maptiler-tiles-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 24 * 60 * 60 * 30, // 30 days
                purgeOnQuotaError: true
              }
            }
          },
          // OpenStreetMap Tiles
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/[0-9]+\/[0-9]+\/[0-9]+\.png/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles-cache',
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 24 * 60 * 60 * 30, // 30 days
                purgeOnQuotaError: true
              }
            }
          },
          // Images and static assets
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true
              }
            }
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          // Socket.IO and API calls
          {
            urlPattern: /^https?:\/\/.*\/socket\.io\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'socketio-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              }
            }
          },
          // API calls (your server)
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 10 * 60 // 10 minutes
              }
            }
          },
          // HTML pages
          {
            urlPattern: /\.(?:html)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              }
            }
          },
          // CSS and JS
          {
            urlPattern: /\.(?:css|js)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              }
            }
          }
        ],
        // Add background sync
        backgroundSync: {
          name: 'location-sync',
          options: {
            maxRetentionTime: 24 * 60 // 24 hours in minutes
          }
        },
        // Offline fallback
        offlineFallback: {
          pageFallback: '/offline.html'
        }
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  server: {
    host: true,
    port: 3000,
    https: false, // Set to true for HTTPS in development
    open: true,
    cors: true
  },
  preview: {
    host: true,
    port: 4173,
    https: false
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          maps: ['leaflet', 'react-leaflet', '@maptiler/leaflet-maptilersdk'],
          socket: ['socket.io-client'],
          motion: ['framer-motion', '@use-gesture/react']
        }
      }
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'leaflet',
      'react-leaflet',
      'socket.io-client',
      'framer-motion'
    ],
    exclude: ['@maptiler/leaflet-maptilersdk']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})