import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Violation = {
  category: string;
  file: string;
  line: number;
  message: string;
};

type Rule = {
  category: string;
  includeRoots: string[];
  extensions: string[];
  pattern: RegExp;
  allow?: (filePath: string, lineText: string) => boolean;
  message: string;
};

type BundleEntry = {
  fileName: string;
  rawSize: number;
  gzipSize: number;
  brotliSize: number;
  imports: number;
  dynamicImports: number;
};

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(currentDir, '..');
const MAX_CHUNK_SIZE_BYTES = 500_000;

const protectedProcedureAllowedFiles = new Set<string>([
  normalizePath(resolve(projectRoot, 'apps/server/src/modules/auth/router.ts')),
  normalizePath(resolve(projectRoot, 'apps/server/src/modules/tenants/router.ts')),
]);

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}

function listFilesRecursively(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.turbo') {
        continue;
      }

      const absolute = resolve(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else {
        files.push(absolute);
      }
    }
  }

  return files;
}

function matchesExtension(filePath: string, extensions: string[]): boolean {
  return extensions.some((extension) => filePath.endsWith(extension));
}

function collectViolations(rule: Rule): Violation[] {
  const violations: Violation[] = [];

  for (const root of rule.includeRoots) {
    const absoluteRoot = resolve(projectRoot, root);
    const files = listFilesRecursively(absoluteRoot);

    for (const file of files) {
      if (!matchesExtension(file, rule.extensions)) {
        continue;
      }

      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!rule.pattern.test(line)) {
          return;
        }

        if (rule.allow && rule.allow(file, line)) {
          return;
        }

        violations.push({
          category: rule.category,
          file: normalizePath(file),
          line: index + 1,
          message: rule.message,
        });
      });
    }
  }

  return violations;
}

function checkBundleSize(): Violation[] {
  const reportPath = resolve(projectRoot, 'apps/web/dist/bundle-report.json');
  if (!existsSync(reportPath)) {
    return [
      {
        category: 'bundle-size',
        file: normalizePath(reportPath),
        line: 1,
        message: 'bundle-report.json nao encontrado. Rode pnpm --filter @proteticflow/web build antes do gate de bundle.',
      },
    ];
  }

  const parsed = JSON.parse(readFileSync(reportPath, 'utf8')) as BundleEntry[];
  const oversized = parsed.filter((entry) => entry.rawSize > MAX_CHUNK_SIZE_BYTES);

  return oversized.map((entry) => ({
    category: 'bundle-size',
    file: `apps/web/dist/${entry.fileName}`,
    line: 1,
    message: `Chunk acima de 500KB (${entry.rawSize} bytes).`,
  }));
}

function printViolations(violations: Violation[]): void {
  if (violations.length === 0) {
    console.log('[g1] PASS: todos os gates de Go-Live validaram.');
    return;
  }

  console.error(`[g1] FAIL: ${violations.length} violacao(oes) encontrada(s).`);
  for (const violation of violations) {
    console.error(`- [${violation.category}] ${violation.file}:${violation.line} -> ${violation.message}`);
  }
}

function main(): void {
  const checkBundle = process.argv.includes('--check-bundle');
  const rules: Rule[] = [
    {
      category: 'skip-tests',
      includeRoots: ['apps', 'packages'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      pattern: /\b(it|test)\.skip\(|\bxit\(|\bxdescribe\(/,
      allow: (_filePath, line) =>
        line.includes('Defina E2E_')
        || line.includes('MISSING_MANAGER_ENV_MESSAGE')
        || line.includes('MISSING_RECEPCAO_ENV_MESSAGE'),
      message: 'Skip de teste nao permitido fora de condicionais de ambiente E2E.',
    },
    {
      category: 'typescript-any',
      includeRoots: ['apps', 'packages'],
      extensions: ['.ts', '.tsx'],
      pattern: /:\s*any\b|\bas any\b|<any>/,
      message: 'Uso de any nao permitido.',
    },
    {
      category: 'typescript-ignore',
      includeRoots: ['apps', 'packages'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      pattern: /@ts-ignore|@ts-nocheck/,
      message: 'Uso de @ts-ignore/@ts-nocheck nao permitido.',
    },
    {
      category: 'design-colors',
      includeRoots: ['apps/web/src'],
      extensions: ['.ts', '.tsx', '.css', '.scss', '.md'],
      pattern: /\bviolet\b|\bindigo\b|\bneutral-[0-9]+\b/,
      message: 'Cor fora do design system Go-Live (violet/indigo/neutral-*).',
    },
    {
      category: 'tenant-procedure',
      includeRoots: ['apps/server/src/modules'],
      extensions: ['.ts'],
      pattern: /\bprotectedProcedure\b/,
      allow: (filePath) => protectedProcedureAllowedFiles.has(normalizePath(filePath)),
      message: 'protectedProcedure encontrado em modulo sem excecao aprovada.',
    },
  ];

  const allViolations = rules.flatMap((rule) => collectViolations(rule));
  if (checkBundle) {
    allViolations.push(...checkBundleSize());
  }

  printViolations(allViolations);
  if (allViolations.length > 0) {
    process.exit(1);
  }
}

main();
