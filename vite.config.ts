/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Two builds:
//   npm run build         → installable offline PWA in dist/ (host it, then "Add to Home Screen")
//   npm run build:single  → one self-contained my-ledger.html in dist-single/ (shareable file)
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    resolve: single ? { alias: { 'virtual:pwa-register': '/src/stubs/pwa-register.ts' } } : undefined,
    define: { 'import.meta.env.VITE_PWA': JSON.stringify(single ? '0' : '1') },
    plugins: [
      react(),
      tailwindcss(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            injectRegister: null,
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'MY LEDGER',
              short_name: 'My Ledger',
              description: 'Private personal expense tracker and money ledger',
              start_url: './',
              scope: './',
              display: 'standalone',
              orientation: 'portrait',
              background_color: '#f8fafc',
              theme_color: '#0f172a',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              navigateFallback: 'index.html',
              cleanupOutdatedCaches: true,
            },
          }),
    ],
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000 } : { outDir: 'dist' },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  }
})
