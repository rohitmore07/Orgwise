import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: {
    // The app uses the automatic JSX runtime (React 19) — no `import React`
    // in source files, so esbuild must transform JSX with jsx: 'automatic'.
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    // @testing-library/react auto-cleanup hooks the global afterEach.
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
