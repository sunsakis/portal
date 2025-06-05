import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // More aggressive caching for production
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        
        // Cache strategies optimized for mobile
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.maptiler\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maptiler-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60 * 7 // 7 days
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                // Remove query params for better cache hits
                const url = new URL(request.url)
                url.search = ''
                return url.href
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 24 * 60 * 60 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
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
          }
        ]
      },
      manifest: {
        name: 'Portal - Location Chat',
        short_name: 'Portal',
        description: 'Share your location to open a chat portal and connect with people nearby',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['social', 'communication'],
        
        icons: [
          {
            src: '/android/android-launchericon-192-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/android/android-launchericon-512-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  
  // Production optimizations
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          maps: ['leaflet', 'react-leaflet', '@maptiler/leaflet-maptilersdk'],
          ui: ['framer-motion', '@use-gesture/react']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'leaflet', 
      'react-leaflet',
      'framer-motion'
    ]
  },
  
  define: {
    global: 'globalThis'
  },
  
  worker: {
    format: 'es'
  },
  
  server: {
    host: true,
    port: 3000,
    https: false
  },
  
  preview: {
    host: true,
    port: 4173
  }
})