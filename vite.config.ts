import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // The Firebase vendor chunk is inherently large (~650 kB) but cached
      // independently, so raise the warning threshold above it.
      chunkSizeWarningLimit: 800,
      // Split heavy third-party bundles so the initial load stays lean and
      // caches vendor code independently across deploys.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'motion'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            markdown: ['react-markdown'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
