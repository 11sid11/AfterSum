import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this app at /AfterSum/. Override with
  // VITE_BASE_PATH at build time when deploying elsewhere.
  base: process.env.VITE_BASE_PATH || '/AfterSum/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-64.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
        'robots.txt',
      ],
      manifest: {
        name: 'AfterSum',
        short_name: 'AfterSum',
        description: 'Offline-first personal finance utility for Track, Split, and Lend.',
        theme_color: '#6256e8',
        background_color: '#f7f8fc',
        display: 'standalone',
        orientation: 'portrait',
        scope: process.env.VITE_BASE_PATH || '/AfterSum/',
        start_url: process.env.VITE_BASE_PATH || '/AfterSum/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Hash routing keeps normal app navigation at the PWA scope root.
        // Keep the app-shell fallback relative so Workbox resolves it
        // against the deployed service-worker scope (/AfterSum/ on Pages).
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@db': path.resolve(__dirname, './src/db'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@overview': path.resolve(__dirname, './src/overview'),
      '@export': path.resolve(__dirname, './src/export'),
      '@components': path.resolve(__dirname, './src/components'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
