/**
 * Gate de tokens de design — proíbe cores hardcoded e anti-patterns React em TSX.
 *
 * Proibido:
 *   - Hex literals: #fff #FFF #ffffff etc.
 *   - rgba/rgb com valores numéricos brutos (não 0 ou 255)
 *   - window.location.pathname em componentes React
 *
 * Supressão inline legítima: adicionar `// design-tokens-ok` na mesma linha
 * Casos válidos: recharts (SVG não aceita var()), THREE.js, color-picker de branding.
 *
 * Uso:
 *   tsx scripts/check-design-tokens.ts                   # audita tudo
 *   tsx scripts/check-design-tokens.ts components/layout # audita escopo restrito
 *
 * No CI/lint:  tsx scripts/check-design-tokens.ts apps/web/src/components/layout apps/web/src/app/(dashboard)/layout.tsx
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const ROOT = process.cwd();
const WEB_SRC = join(ROOT, 'apps/web/src');

// Escopo: argumentos CLI ou src completo
const scopeArgs = process.argv.slice(2);
const SCAN_ROOTS = scopeArgs.length > 0
  ? scopeArgs.map((s) => resolve(ROOT, s))
  : [WEB_SRC];

const FORBIDDEN: Array<{ pattern: RegExp; reason: string; fix: string }> = [
  {
    pattern: /['"`]#(?:[0-9a-fA-F]{3}){1,2}['"`]/,
    reason: 'Cor hex hardcoded',
    fix: 'Use var(--token) ou classe Tailwind semântica',
  },
  {
    // rgba com valores numéricos não-neutros (não 0 nem 255)
    pattern: /rgba\(\s*(?!(?:0|255)\s*,\s*(?:0|255)\s*,\s*(?:0|255))[1-9]\d*\s*,/,
    reason: 'rgba() com valor numérico literal',
    fix: 'Use color-mix(in srgb, var(--token) X%, transparent)',
  },
  {
    pattern: /window\.location\.pathname/,
    reason: 'window.location.pathname (não-reativo em React)',
    fix: 'Use const { pathname } = useLocation() do react-router-dom',
  },
];

function walkTsx(dir: string): string[] {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...walkTsx(full));
      } else if (/\.(tsx|ts)$/.test(full) && !/\.(test|spec|stories)\.(tsx|ts)$/.test(full)) {
        files.push(full);
      }
    } catch { /* skip inacessíveis */ }
  }
  return files;
}

function collectFiles(roots: string[]): string[] {
  const files: string[] = [];
  for (const root of roots) {
    try {
      const stat = statSync(root);
      if (stat.isDirectory()) {
        files.push(...walkTsx(root));
      } else if (/\.(tsx|ts)$/.test(root)) {
        files.push(root);
      }
    } catch { /* path não existe */ }
  }
  return files;
}

let violations = 0;

for (const file of collectFiles(SCAN_ROOTS)) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // pular comentários e linhas com supressão explícita (mesma linha ou linha anterior)
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
    if (line.includes('design-tokens-ok')) continue;
    const prevLine = i > 0 ? (lines[i - 1] ?? '') : '';
    if (prevLine.includes('design-tokens-ok')) continue;

    for (const { pattern, reason, fix } of FORBIDDEN) {
      if (pattern.test(line)) {
        const rel = relative(ROOT, file);
        console.error(`\n[design-tokens] ${rel}:${i + 1}`);
        console.error(`  ❌ ${reason}`);
        console.error(`  ${line.trim()}`);
        console.error(`  💡 ${fix}`);
        console.error(`  (suprimir com: // design-tokens-ok se uso legítimo)`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n[design-tokens] ${violations} violação(ões). Corrija antes do PR.\n`);
  process.exit(1);
} else {
  const scope = scopeArgs.length > 0 ? scopeArgs.join(', ') : 'src completo';
  console.log(`[design-tokens] ✅ Nenhuma violação (escopo: ${scope})`);
}
