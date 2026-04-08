#!/usr/bin/env tsx
/**
 * CI guard: verifies Drizzle queries in apps/server include tenant scoping.
 *
 * Notes:
 * - scans db.select/update/delete chains
 * - supports chained queries that start with db.select()
 * - ignores test files (*.test.*, *.spec.*, __tests__)
 * - allows manual suppression with // tenant-isolation-ok
 */

import { readdir, readFile } from 'fs/promises';
import { dirname, extname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SCAN_DIR = resolve(REPO_ROOT, 'apps/server/src');
const SUPPRESS_COMMENT = 'tenant-isolation-ok';
const QUERY_START_RE = /\bdb\.(select|update|delete)\s*\(/;
const TENANT_FILTER_RE = /\btenantId\b/;

const GLOBAL_TABLES = [
  'tenants',
  'users',
  'refreshTokens',
  'passwordResetTokens',
];
const TEST_FILE_RE =
  /(?:^|[\\/])__tests__(?:[\\/]|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const KNOWN_WHERE_HELPERS = new Set([
  'and',
  'or',
  'eq',
  'gt',
  'gte',
  'lt',
  'lte',
  'inArray',
  'isNull',
  'isNotNull',
  'not',
  'sql',
  'exists',
  'notExists',
  'true',
  'false',
  'null',
  'undefined',
]);

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

interface QueryBlock {
  startLine: number;
  endLine: number;
  block: string;
}

interface StatementState {
  parenDepth: number;
  braceDepth: number;
  bracketDepth: number;
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  inTemplateLiteral: boolean;
  inLineComment: boolean;
  inBlockComment: boolean;
  escaping: boolean;
}

function createStatementState(): StatementState {
  return {
    parenDepth: 0,
    braceDepth: 0,
    bracketDepth: 0,
    inSingleQuote: false,
    inDoubleQuote: false,
    inTemplateLiteral: false,
    inLineComment: false,
    inBlockComment: false,
    escaping: false,
  };
}

function isTestFile(filePath: string): boolean {
  return TEST_FILE_RE.test(filePath);
}

async function getFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...(await getFiles(fullPath)));
      continue;
    }

    if (!['.ts', '.tsx'].includes(extname(entry.name))) continue;
    if (isTestFile(fullPath)) continue;
    files.push(fullPath);
  }

  return files;
}

function updateStatementState(line: string, state: StatementState): boolean {
  let statementClosed = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (state.inLineComment) break;

    if (state.inBlockComment) {
      if (ch === '*' && next === '/') {
        state.inBlockComment = false;
        i++;
      }
      continue;
    }

    if (state.inSingleQuote) {
      if (state.escaping) {
        state.escaping = false;
        continue;
      }
      if (ch === '\\') {
        state.escaping = true;
        continue;
      }
      if (ch === "'") {
        state.inSingleQuote = false;
      }
      continue;
    }

    if (state.inDoubleQuote) {
      if (state.escaping) {
        state.escaping = false;
        continue;
      }
      if (ch === '\\') {
        state.escaping = true;
        continue;
      }
      if (ch === '"') {
        state.inDoubleQuote = false;
      }
      continue;
    }

    if (state.inTemplateLiteral) {
      if (state.escaping) {
        state.escaping = false;
        continue;
      }
      if (ch === '\\') {
        state.escaping = true;
        continue;
      }
      if (ch === '`') {
        state.inTemplateLiteral = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      state.inLineComment = true;
      break;
    }

    if (ch === '/' && next === '*') {
      state.inBlockComment = true;
      i++;
      continue;
    }

    if (ch === "'") {
      state.inSingleQuote = true;
      continue;
    }

    if (ch === '"') {
      state.inDoubleQuote = true;
      continue;
    }

    if (ch === '`') {
      state.inTemplateLiteral = true;
      continue;
    }

    if (ch === '(') {
      state.parenDepth++;
      continue;
    }
    if (ch === ')') {
      state.parenDepth = Math.max(0, state.parenDepth - 1);
      continue;
    }
    if (ch === '{') {
      state.braceDepth++;
      continue;
    }
    if (ch === '}') {
      state.braceDepth = Math.max(0, state.braceDepth - 1);
      continue;
    }
    if (ch === '[') {
      state.bracketDepth++;
      continue;
    }
    if (ch === ']') {
      state.bracketDepth = Math.max(0, state.bracketDepth - 1);
      continue;
    }

    if (
      ch === ';' &&
      state.parenDepth === 0 &&
      state.braceDepth === 0 &&
      state.bracketDepth === 0
    ) {
      statementClosed = true;
      break;
    }
  }

  state.inLineComment = false;
  return statementClosed;
}

function extractQueryBlocks(content: string): QueryBlock[] {
  const lines = content.split('\n');
  const blocks: QueryBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!QUERY_START_RE.test(line)) continue;

    const state = createStatementState();
    const blockLines: string[] = [];
    const startLine = i + 1;
    let endLine = startLine;

    for (let j = i; j < lines.length; j++) {
      const currentLine = lines[j] ?? '';
      blockLines.push(currentLine);
      endLine = j + 1;

      const statementClosed = updateStatementState(currentLine, state);
      if (statementClosed) {
        break;
      }
    }

    blocks.push({
      startLine,
      endLine,
      block: blockLines.join('\n'),
    });

    i = endLine - 1;
  }

  return blocks;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function extractWhereArguments(block: string): string[] {
  const args: string[] = [];
  let cursor = 0;

  while (cursor < block.length) {
    const whereIdx = block.indexOf('.where(', cursor);
    if (whereIdx === -1) break;

    let i = whereIdx + '.where('.length;
    let depth = 1;
    const start = i;

    while (i < block.length && depth > 0) {
      const ch = block[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      i++;
    }

    if (depth === 0) {
      args.push(block.slice(start, i - 1));
    }

    cursor = i;
  }

  return args;
}

function findDeclarationExpression(
  fileContent: string,
  beforeLine: number,
  identifier: string,
): string | null {
  const lines = fileContent.split('\n');
  const prefix = lines.slice(0, beforeLine).join('\n');
  const escapedId = escapeRegExp(identifier);

  const declarationPatterns = [
    new RegExp(
      String.raw`(?:const|let|var)\s+${escapedId}\b[\s\S]{0,4000}?;`,
      'gm',
    ),
    new RegExp(String.raw`\b${escapedId}\s*=[\s\S]{0,4000}?;`, 'gm'),
  ];

  for (const pattern of declarationPatterns) {
    let lastMatch: RegExpExecArray | null = null;
    let match = pattern.exec(prefix);
    while (match) {
      lastMatch = match;
      match = pattern.exec(prefix);
    }

    if (lastMatch?.[0]) {
      return lastMatch[0];
    }
  }

  return null;
}

function declarationHasTenantReference(
  fileContent: string,
  beforeLine: number,
  identifier: string,
  visited: Set<string>,
): boolean {
  if (visited.has(identifier)) return false;
  visited.add(identifier);

  const declaration = findDeclarationExpression(fileContent, beforeLine, identifier);
  if (!declaration) return false;
  if (TENANT_FILTER_RE.test(declaration)) return true;

  const nestedIdentifiers = declaration.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  for (const nested of nestedIdentifiers) {
    if (nested === identifier) continue;
    if (KNOWN_WHERE_HELPERS.has(nested)) continue;
    if (/\btenant\b/i.test(nested)) return true;
    if (declarationHasTenantReference(fileContent, beforeLine, nested, visited)) {
      return true;
    }
  }

  return false;
}

function findTenantReferenceInDeclaration(
  fileContent: string,
  beforeLine: number,
  identifier: string,
): boolean {
  const lines = fileContent.split('\n');
  const start = Math.max(0, beforeLine - 250);
  const snippet = lines.slice(start, beforeLine).join('\n');
  const escapedId = escapeRegExp(identifier);

  const declarationRe = new RegExp(
    String.raw`(?:const|let|var)\s+${escapedId}\b[\s\S]{0,1800}\btenantId\b`,
    'm',
  );
  if (declarationRe.test(snippet)) return true;

  const assignmentRe = new RegExp(
    String.raw`\b${escapedId}\s*=[\s\S]{0,1800}\btenantId\b`,
    'm',
  );
  return assignmentRe.test(snippet);
}

function hasTenantFilter(block: QueryBlock, fileContent: string): boolean {
  if (TENANT_FILTER_RE.test(block.block)) return true;

  const whereArgs = extractWhereArguments(block.block);
  for (const arg of whereArgs) {
    if (TENANT_FILTER_RE.test(arg)) return true;
    if (/\btenant\b/i.test(arg)) return true;

    const identifiers = arg.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
    for (const identifier of identifiers) {
      if (KNOWN_WHERE_HELPERS.has(identifier)) continue;
      if (findTenantReferenceInDeclaration(fileContent, block.startLine, identifier)) {
        return true;
      }
      if (
        declarationHasTenantReference(
          fileContent,
          block.startLine,
          identifier,
          new Set<string>(),
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

async function main(): Promise<void> {
  const files = await getFiles(SCAN_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const relPath = `./${relative(REPO_ROOT, file).replace(/\\/g, '/')}`;
    const blocks = extractQueryBlocks(content);
    let fileOk = true;

    for (const block of blocks) {
      if (block.block.includes(SUPPRESS_COMMENT)) continue;
      if (isGlobalTableQuery(block.block)) continue;
      if (hasTenantFilter(block, content)) continue;

      const snippet = (block.block.split('\n')[0] ?? block.block).trim().slice(0, 100);
      violations.push({ file: relPath, line: block.startLine, snippet });
      console.error(`[tenant-check] VIOLATION ${relPath}:${block.startLine}`);
      console.error(`  -> ${snippet}`);
      fileOk = false;
    }

    if (fileOk) {
      console.log(`[tenant-check] ok  ${relPath}`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n[tenant-check] FAIL: ${violations.length} tenant isolation violation(s).`);
    console.error('Add a tenant filter (for example, .where(eq(table.tenantId, ctx.user.tenantId))).');
    console.error('If this is a validated false positive, add // tenant-isolation-ok to suppress it.');
    process.exit(1);
  }

  console.log('\n[tenant-check] PASS');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
