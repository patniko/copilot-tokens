import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['src/renderer/**', 'jsdom'],
      ['src/main/**', 'node'],
    ],
    globals: true,
  },
});
