/**
 * scripts/download-fonts.ts
 * Baixa as 3 famílias de fontes do ProteticFlow DS v1.3.0 do Google Fonts
 * e salva em apps/web/public/fonts/
 *
 * Uso:
 *   npx tsx scripts/download-fonts.ts
 *   # ou
 *   pnpm --filter @proteticflow/web exec tsx ../../scripts/download-fonts.ts
 *
 * Requer: Node.js 18+ (fetch nativo)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '../apps/web/public/fonts');

// User-Agent moderno para que o Google Fonts retorne woff2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface FontSpec {
  family: string;
  url: string;
  filename: string;
}

/**
 * Baixa o CSS da URL do Google Fonts e extrai as URLs de woff2.
 * Retorna um array de { url, filename }.
 */
async function extractWoff2Urls(cssUrl: string): Promise<Array<{ url: string; filename: string }>> {
  const res = await fetch(cssUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Falha ao buscar CSS: ${res.status} ${cssUrl}`);
  const css = await res.text();

  // Extrai: font-family, font-style, font-weight, src url(...)
  const faceRegex = /@font-face\s*\{([^}]+)\}/g;
  const results: Array<{ url: string; filename: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = faceRegex.exec(css)) !== null) {
    const block = match[1]!;
    const urlMatch = /src:\s*url\(([^)]+)\)\s*format\(['"]?woff2['"]?\)/.exec(block);
    const familyMatch = /font-family:\s*['"]?([^;'"]+)['"]?/.exec(block);
    const styleMatch  = /font-style:\s*([^;]+)/.exec(block);
    const weightMatch = /font-weight:\s*([^;]+)/.exec(block);

    if (!urlMatch) continue;

    const fontUrl = urlMatch[1]!.trim();
    const family  = (familyMatch?.[1] ?? 'font').trim().replace(/\s+/g, '-').toLowerCase();
    const style   = (styleMatch?.[1] ?? 'normal').trim();
    const weight  = (weightMatch?.[1] ?? '400').trim().replace(/\s+/g, '-');

    results.push({
      url: fontUrl,
      filename: `${family}-${weight}-${style}.woff2`,
    });
  }

  return results;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
  console.log(`  ✓ ${dest.split('/fonts/')[1]}`);
}

async function main() {
  await mkdir(FONTS_DIR, { recursive: true });
  console.log(`\n📂 Destino: ${FONTS_DIR}\n`);

  const fontCssUrls: FontSpec[] = [
    {
      family: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&display=swap',
      filename: 'inter',
    },
    {
      family: 'JetBrains Mono',
      url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap',
      filename: 'jetbrains-mono',
    },
    {
      family: 'Instrument Serif',
      url: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap',
      filename: 'instrument-serif',
    },
  ];

  const allFiles: Array<{ family: string; url: string; filename: string }> = [];

  for (const spec of fontCssUrls) {
    console.log(`⬇  ${spec.family}`);
    try {
      const files = await extractWoff2Urls(spec.url);
      for (const f of files) {
        await download(f.url, join(FONTS_DIR, f.filename));
        allFiles.push({ family: spec.family, ...f });
      }
    } catch (err) {
      console.error(`  ✗ Erro em ${spec.family}:`, (err as Error).message);
    }
  }

  // Gera o fonts.css automaticamente com base nos arquivos baixados
  const fontFaces = allFiles
    .map(({ family, filename }) => {
      const parts = filename.replace('.woff2', '').split('-');
      // filename: family-weight-style.woff2 (weight pode ser "100..900" ou "400", style "normal"/"italic")
      const style  = parts[parts.length - 1] ?? 'normal';
      const weight = parts[parts.length - 2] ?? '400';
      return `@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${filename}') format('woff2');
}`;
    })
    .join('\n\n');

  const fontsCSS = `/* apps/web/src/styles/fonts.css — gerado por scripts/download-fonts.ts */
/* NÃO editar manualmente. Rodar novamente o script para atualizar. */

${fontFaces}
`;

  const cssDest = join(__dirname, '../apps/web/src/styles/fonts.css');
  await mkdir(join(__dirname, '../apps/web/src/styles'), { recursive: true });
  await writeFile(cssDest, fontsCSS, 'utf8');
  console.log(`\n✅ fonts.css gerado em apps/web/src/styles/fonts.css`);
  console.log(`   ${allFiles.length} arquivo(s) baixado(s)\n`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
