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
          manualChunks(id) {
            if (id.includes('node_modules/firebase/auth')) return 'firebase-auth';
            if (id.includes('node_modules/firebase/firestore')) return 'firebase-firestore';
            if (id.includes('node_modules/firebase/app')) return 'firebase-app';
            if (id.includes('node_modules/motion')) return 'vendor-motion';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark') || id.includes('node_modules/unified')) return 'vendor-markdown';
          },
        },
      },
    },
    server: {
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      allowedHosts: true,
    },
  };
});
