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

function manualChunksByPackage(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/');
  if (!normalizedId.includes('/node_modules/')) {
    return undefined;
  }

  const modulePath = normalizedId.split('/node_modules/').pop();
  if (!modulePath) {
    return undefined;
  }

  const segments = modulePath.split('/');
  const packageName = modulePath.startsWith('@')
    ? `${segments[0]}/${segments[1] ?? ''}`
    : segments[0] ?? '';

  if (
    packageName === 'react'
    || packageName === 'react-dom'
    || packageName === 'react-router'
    || packageName === 'react-router-dom'
    || packageName === 'scheduler'
  ) {
    return 'vendor-react';
  }

  if (
    packageName === '@trpc/client'
    || packageName === '@trpc/react-query'
    || packageName === '@tanstack/react-query'
    || packageName === '@tanstack/query-core'
  ) {
    return 'vendor-trpc-query';
  }

  if (packageName.startsWith('@tiptap') || packageName.startsWith('prosemirror')) {
    return 'vendor-editor';
  }

  if (packageName === 'three') {
    if (normalizedId.includes('/three/examples/')) {
      return 'vendor-3d-extras';
    }

    return 'vendor-3d-core';
  }

  if (
    packageName === 'recharts'
    || packageName.startsWith('d3-')
    || packageName === 'internmap'
    || packageName === 'victory-vendor'
  ) {
    return 'vendor-charts';
  }

  if (packageName === 'framer-motion' || packageName.startsWith('motion')) {
    return 'vendor-motion';
  }

  if (packageName.startsWith('@dnd-kit')) {
    return 'vendor-dnd';
  }

  if (packageName.startsWith('@radix-ui') || packageName === 'lucide-react') {
    return 'vendor-ui';
  }

  if (
    packageName === 'react-hook-form'
    || packageName === '@hookform/resolvers'
    || packageName === 'zod'
  ) {
    return 'vendor-forms';
  }

  if (
    packageName === 'simplebar-react'
    || packageName === 'simplebar-core'
    || packageName === 'clsx'
    || packageName === 'tailwind-merge'
  ) {
    return 'vendor-utils';
  }

  return 'vendor-misc';
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: manualChunksByPackage,
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
