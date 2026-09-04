import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  esbuild: {
    target: 'es2022',
  },
  resolve: {
    preserveSymlinks: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
  },
});