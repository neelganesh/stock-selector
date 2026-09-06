import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  esbuild: {
    target: 'es2022',
    jsx: 'automatic',
  },
  resolve: {
    preserveSymlinks: false,
  },
  define: {
    // Force React into development mode so react-dom/test-utils exports act
    'process.env.NODE_ENV': '"development"',
  },
  test: {
    globals: true,
    css: false,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Inline react and react-dom so React.act is properly exported in jsdom.
    // Without this, Vite externalizes them and React.act ends up undefined.
    server: {
      deps: {
        inline: [/^react($|\/)/, /^node:/, /^@testing-library\//],
      },
    },
  },
});
