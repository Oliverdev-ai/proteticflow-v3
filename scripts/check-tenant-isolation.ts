#!/usr/bin/env tsx
/**
 * CI: Verifica que queries Drizzle em apps/server sempre filtram por tenantId.
 *
 * Heurística: detecta chamadas db.select/update/delete e verifica presença de
 * tenantId no bloco da query. Adicione // tenant-isolation-ok na linha para suprimir.
 *
 * Tabelas globais (sem tenantId): tenants, users — não geram violação.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

const SCAN_DIR = join(process.cwd(), 'apps/server/src');
const SUPPRESS_COMMENT = 'tenant-isolation-ok';

// Tabelas sem tenantId — globais ao sistema
const GLOBAL_TABLES = ['tenants', 'users'];

// Detecta início de query Drizzle
const QUERY_START_RE = /\bdb\.(select|update|delete)\s*\(/;

// Confirma presença de filtro tenantId no bloco
const TENANT_FILTER_RE = /tenantId/;

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

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

/** Extrai blocos de query Drizzle (db.select/update/delete até o ';' de fechamento). */
function extractQueryBlocks(content: string): Array<{ startLine: number; block: string }> {
  const lines = content.split('\n');
  const blocks: Array<{ startLine: number; block: string }> = [];

  let inBlock = false;
  let blockStart = 0;
  let blockLines: string[] = [];
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (!inBlock && QUERY_START_RE.test(line)) {
      inBlock = true;
      blockStart = i + 1; // 1-indexed
      blockLines = [line];
      depth =
        (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;

      if (depth <= 0 || line.trimEnd().endsWith(';')) {
        blocks.push({ startLine: blockStart, block: blockLines.join('\n') });
        inBlock = false;
        blockLines = [];
        depth = 0;
      }
      continue;
    }

    if (inBlock) {
      blockLines.push(line);
      depth +=
        (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;

      if (depth <= 0 || line.trimEnd().endsWith(';')) {
        blocks.push({ startLine: blockStart, block: blockLines.join('\n') });
        inBlock = false;
        blockLines = [];
        depth = 0;
      }
    }
  }

  return blocks;
}

function isGlobalTableQuery(block: string): boolean {
  for (const table of GLOBAL_TABLES) {
    const fromRe = new RegExp(`\\.from\\s*\\(\\s*${table}\\b`);
    const updateRe = new RegExp(`db\\.update\\s*\\(\\s*${table}\\b`);
    const deleteRe = new RegExp(`db\\.delete\\s*\\(\\s*${table}\\b`);
    if (fromRe.test(block) || updateRe.test(block) || deleteRe.test(block)) {
      return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  const files = await getFiles(SCAN_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const relPath = file.replace(process.cwd(), '.');
    const blocks = extractQueryBlocks(content);
    let fileOk = true;

    for (const { startLine, block } of blocks) {
      if (block.includes(SUPPRESS_COMMENT)) continue;
      if (isGlobalTableQuery(block)) continue;
      if (TENANT_FILTER_RE.test(block)) continue;

      const snippet = (block.split('\n')[0] ?? block).trim().slice(0, 80);
      violations.push({ file: relPath, line: startLine, snippet });
      console.error(`[tenant-check] VIOLATION ${relPath}:${startLine}`);
      console.error(`  → ${snippet}`);
      fileOk = false;
    }

    if (fileOk) {
      console.log(`[tenant-check] ok  ${relPath}`);
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n❌ ${violations.length} violação(ões) de tenant isolation detectada(s).`,
    );
    console.error(
      'Corrija adicionando .where(eq(table.tenantId, ctx.user.tenantId)) em cada query.',
    );
    console.error(
      'Para suprimir falso positivo: adicione // tenant-isolation-ok na linha.',
    );
    process.exit(1);
  }

  console.log('\n✅ Tenant isolation check passou.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
