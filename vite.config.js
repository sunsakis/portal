import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', '*.png'],
      manifest: {
        name: 'Create & Discover Events',
        short_name: 'Portal',
        description:
          'Find and host local events, chats.',
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
            purpose: 'any maskable',
          },
          {
            src: '/android/android-launchericon-512-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // OPTION 2: Skip large JS files from precaching
        globPatterns: ['**/*.{css,html,ico,png,svg,webp}'],
        globIgnores: ['**/index-*.js'], // Skip large JS bundles
        
        // OR OPTION 1: Just increase the limit
        // maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        // globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.maptiler\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maptiler-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60 * 7,
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60 * 30,
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],

  define: {
    global: 'globalThis',
  },

  worker: {
    format: 'es',
  },

  // Production optimizations
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          maps: ['leaflet', 'react-leaflet'],
          ui: ['framer-motion', '@use-gesture/react'],
          // ADD WAKU TO SEPARATE CHUNK
          crypto: ['eth-crypto', 'viem', 'buffer', 'crypto-browserify'],
        },
      },
    },
    // INCREASE CHUNK SIZE WARNING LIMIT
    chunkSizeWarningLimit: 4000, // 4MB instead of 1MB
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'leaflet',
      'react-leaflet',
      'framer-motion',
      'buffer',
    ],
  },
  resolve: { alias: { buffer: 'buffer/' } },
  server: {
    host: true,
    port: 3000,
  },
  preview: {
    host: true,
    port: 4173,
  },
});