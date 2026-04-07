import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
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

type BundleReportEntry = {
  fileName: string;
  rawSize: number;
  gzipSize: number;
  brotliSize: number;
  imports: number;
  dynamicImports: number;
};

const compressibleExtensions = new Set(['.js', '.mjs', '.css', '.html', '.svg', '.json', '.txt', '.xml']);

function createBundleReportPlugin(): Plugin {
  return {
    name: 'bundle-report',
    apply: 'build',
    generateBundle(_, bundle) {
      const report: BundleReportEntry[] = [];

      for (const artifact of Object.values(bundle)) {
        if (artifact.type === 'chunk') {
          const source = Buffer.from(artifact.code, 'utf8');
          report.push({
            fileName: artifact.fileName,
            rawSize: source.byteLength,
            gzipSize: gzipSync(source).byteLength,
            brotliSize: brotliCompressSync(source).byteLength,
            imports: artifact.imports.length,
            dynamicImports: artifact.dynamicImports.length,
          });
        }

        const extension = extname(artifact.fileName);
        if (!compressibleExtensions.has(extension)) {
          continue;
        }

        const content =
          artifact.type === 'chunk'
            ? Buffer.from(artifact.code, 'utf8')
            : typeof artifact.source === 'string'
              ? Buffer.from(artifact.source, 'utf8')
              : Buffer.from(artifact.source);

        this.emitFile({
          type: 'asset',
          fileName: `${artifact.fileName}.gz`,
          source: gzipSync(content),
        });

        this.emitFile({
          type: 'asset',
          fileName: `${artifact.fileName}.br`,
          source: brotliCompressSync(content),
        });
      }

      report.sort((a, b) => b.rawSize - a.rawSize);
      const outputPath = resolve(currentDir, 'dist', 'bundle-report.json');
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    },
  };
}

function manualChunksByDomain(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/');

  if (!normalizedId.includes('node_modules')) {
    return undefined;
  }

  const modulePath = normalizedId.split('/node_modules/').pop();
  if (!modulePath) {
    return undefined;
  }

  const pathSegments = modulePath.split('/');
  const packageName = modulePath.startsWith('@')
    ? `${pathSegments[0]}/${pathSegments[1] ?? ''}`
    : pathSegments[0] ?? '';

  if (
    packageName === 'react'
    || packageName === 'react-dom'
    || packageName === 'react-router'
    || packageName === 'react-router-dom'
    || packageName === 'scheduler'
  ) {
    return 'vendor-react';
  }

  if (packageName.startsWith('@trpc') || packageName === '@tanstack/react-query') {
    return 'vendor-trpc-query';
  }

  if (packageName.startsWith('@tiptap')) {
    return 'vendor-editor';
  }

  if (packageName === 'three') {
    if (normalizedId.includes('/three/examples/')) {
      return 'vendor-3d-extras';
    }

    return 'vendor-3d-core';
  }

  if (packageName.startsWith('@dnd-kit')) {
    return 'vendor-dnd';
  }

  if (
    packageName === 'recharts'
    || packageName === 'framer-motion'
    || packageName === 'lucide-react'
  ) {
    return 'vendor-ui';
  }

  if (packageName.startsWith('@radix-ui')) {
    return 'vendor-radix';
  }

  if (
    packageName === 'clsx'
    || packageName === 'tailwind-merge'
    || packageName === 'simplebar-react'
    || packageName === 'zod'
  ) {
    return 'vendor-utils';
  }

  const sanitizedPackageName = packageName.replace('@', '').replace('/', '-');
  return `vendor-${sanitizedPackageName}`;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), createBundleReportPlugin()],
  build: {
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: manualChunksByDomain,
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
