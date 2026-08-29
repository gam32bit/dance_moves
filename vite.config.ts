import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Deployed under a subpath on GitHub Pages? set base to '/dance_moves/'.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Dance Moves',
        short_name: 'Dance Moves',
        description: 'Practice and track your dance moves',
        theme_color: '#151019',
        background_color: '#151019',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Videos are large and cached on demand at runtime.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['**/clips/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/clips\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/clips/') && url.pathname.endsWith('.jpg'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'clip-posters',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/clips/') && url.pathname.endsWith('.mp4'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'clip-videos',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 180 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/clips/index.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'clip-index' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
