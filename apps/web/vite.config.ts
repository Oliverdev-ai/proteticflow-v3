import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'recharts'],
          trpc: ['@trpc/client', '@trpc/react-query', '@tanstack/react-query'],
        },
      },
    },
  },
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
