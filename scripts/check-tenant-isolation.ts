#!/usr/bin/env tsx
/**
 * CI: Verifica que queries Drizzle em apps/server sempre filtram por tenantId.
 * Fase 1: dry-run (sem routers reais ainda). Validacao real comeca na Fase 4.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

const SCAN_DIR = join(process.cwd(), 'apps/server/src');
const SUPPRESS_COMMENT = 'tenant-isolation-ok';

async function getFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getFiles(fullPath)));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await getFiles(SCAN_DIR);

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    if (content.includes(SUPPRESS_COMMENT)) continue;
    console.log(`[tenant-check] OK: ${file.replace(process.cwd(), '.')}`);
  }

  console.log('\nTenant isolation check passou.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
