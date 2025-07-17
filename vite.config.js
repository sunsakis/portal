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
        name: 'Local Events',
        short_name: 'Portal',
        description: 'Find and host local events.',
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
        // Skip large JS files from precaching for better performance
        globPatterns: ['**/*.{css,html,ico,png,svg,webp}'],
        globIgnores: ['**/index-*.js', '**/assets/*.js'], // Skip JS bundles
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
                maxAgeSeconds: 24 * 60 * 60 * 7, // 7 days
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
                maxAgeSeconds: 24 * 60 * 60 * 30, // 30 days
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
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],

  // Ensure proper base path for Vercel
  base: '/',

  define: {
    global: 'globalThis',
  },

  worker: {
    format: 'es',
  },

  // Production optimizations for Vercel
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: false, // Disable sourcemaps for smaller bundle size on Vercel
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // More predictable chunk names for Vercel deployments
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor: ['react', 'react-dom'],
          maps: ['leaflet', 'react-leaflet'],
          ui: ['framer-motion', '@use-gesture/react'],
          crypto: ['eth-crypto', 'viem', 'buffer', 'crypto-browserify'],
          waku: ['@waku/sdk'], // Separate Waku into its own chunk
        },
      },
    },
    // Increase chunk size warning limit for large crypto/Waku dependencies
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

  resolve: { 
    alias: { 
      buffer: 'buffer/' 
    } 
  },

  server: {
    host: true,
    port: 3000,
  },

  preview: {
    host: true,
    port: 4173,
  },
});