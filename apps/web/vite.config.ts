import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const currentDir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(currentDir, '.env'),
  resolve(currentDir, '.env.local'),
  resolve(currentDir, '../server/.env'),
  resolve(currentDir, '../../.env'),
];

for (const candidate of envCandidates) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

const backendPort = process.env.PORT ?? '3001';
const devApiUrl = process.env.VITE_DEV_API_URL ?? `http://localhost:${backendPort}`;

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
      '/trpc': devApiUrl,
      '/health': devApiUrl,
    },
  },
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
});
