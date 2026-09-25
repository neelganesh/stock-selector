import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // /api/* proxies to the local Vercel dev server (`npm run dev:api`),
      // which serves api/*.ts functions. Plain `vite` without it 404s on /api.
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
