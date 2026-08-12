/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // Cast to any to avoid a peer-dep type mismatch between
  // vitest 2.1's expected vite version and the actually-installed
  // vite 6. The runtime is fine.
  plugins: [react() as never],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@db': path.resolve(__dirname, './src/db'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@overview': path.resolve(__dirname, './src/overview'),
      '@sync': path.resolve(__dirname, './src/sync'),
      '@export': path.resolve(__dirname, './src/export'),
      '@components': path.resolve(__dirname, './src/components'),
      '@tests': path.resolve(__dirname, './src/tests'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/tests/**',
        'src/main.tsx',
        'src/routeTree.gen.ts',
      ],
    },
  },
});
