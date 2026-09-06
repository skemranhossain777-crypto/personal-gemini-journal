import path from 'path';
import { defineConfig } from 'vitest/config';

// Dedicated config for emulator-backed Firestore rules tests, so the plain
// `npm test` (which runs without emulators) never collects these files.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});