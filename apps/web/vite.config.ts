/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * En développement, l'API est servie derrière le même origine via le proxy Vite : le cookie de
 * refresh token (SameSite=Strict, httpOnly) fonctionne sans configuration CORS, exactement comme
 * en production où un reverse proxy route /api vers l'API (chapitre 8, déploiement cible).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    // Sobriété (ch. 8) : découpage du code par route et cible navigateurs récents.
    target: 'es2022',
    sourcemap: false,
    // Seul le fichier des bibliothèques React (~97 Ko compressé) dépasse 300 Ko non compressé.
    chunkSizeWarningLimit: 350,
    // Bibliothèques isolées dans des fichiers stables : mis en cache longtemps par le navigateur
    // et non retéléchargés à chaque livraison applicative.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router', 'react-router/dom'],
          requetes: ['@tanstack/react-query'],
          dialogue: ['@radix-ui/react-dialog'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
});
