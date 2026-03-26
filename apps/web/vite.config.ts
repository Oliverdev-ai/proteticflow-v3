import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/trpc': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
});
