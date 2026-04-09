#!/usr/bin/env tsx
/**
 * ProteticFlow — Setup de ambiente local
 * Roda uma vez na primeira vez, ou sempre que quiser resetar o .env.
 *
 * O que faz:
 * 1. Copia .env.example → .env (se ainda não existir)
 * 2. Gera JWT_SECRET e SETTINGS_SECRET_KEY aleatórios e seguros
 * 3. Aplica o schema no banco de dados
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_EXAMPLE = resolve(ROOT, '.env.example');
const ENV_FILE = resolve(ROOT, '.env');

function log(msg: string) {
  console.log(`\n🔧 ${msg}`);
}

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function warn(msg: string) {
  console.log(`  ⚠️  ${msg}`);
}

function generateSecret(): string {
  return randomBytes(48).toString('base64');
}

// ──────────────────────────────────────────
// 1. Criar .env a partir do .env.example
// ──────────────────────────────────────────
log('Verificando arquivo .env...');

if (existsSync(ENV_FILE)) {
  warn('.env já existe — mantendo valores existentes.');
} else {
  if (!existsSync(ENV_EXAMPLE)) {
    console.error('❌ .env.example não encontrado. Execute a partir da raiz do projeto.');
    process.exit(1);
  }
  writeFileSync(ENV_FILE, readFileSync(ENV_EXAMPLE, 'utf-8'));
  ok('.env criado a partir do .env.example');
}

// ──────────────────────────────────────────
// 2. Gerar secrets se ainda forem placeholders
// ──────────────────────────────────────────
log('Verificando secrets de autenticação...');

let envContent = readFileSync(ENV_FILE, 'utf-8');
let changed = false;

const needsJwt =
  envContent.includes('GERAR_COM_pnpm_local_setup') ||
  envContent.match(/JWT_SECRET=\s*$/m);

if (needsJwt) {
  const jwtSecret = generateSecret();
  const settingsSecret = generateSecret();

  envContent = envContent
    .replace(
      /JWT_SECRET=.*/,
      `JWT_SECRET=${jwtSecret}`,
    )
    .replace(
      /SETTINGS_SECRET_KEY=.*/,
      `SETTINGS_SECRET_KEY=${settingsSecret}`,
    );

  changed = true;
  ok('JWT_SECRET gerado');
  ok('SETTINGS_SECRET_KEY gerado');
} else {
  ok('Secrets já configurados — mantendo.');
}

if (changed) {
  writeFileSync(ENV_FILE, envContent);
}

// ──────────────────────────────────────────
// 3. Aguardar Postgres e aplicar schema
// ──────────────────────────────────────────
log('Aplicando schema no banco de dados...');

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPostgres(maxAttempts = 20): Promise<boolean> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      execSync(
        'docker exec proteticflow_postgres pg_isready -U proteticflow -d proteticflow_dev',
        { stdio: 'pipe' },
      );
      return true;
    } catch {
      process.stdout.write(`  Aguardando Postgres (${i}/${maxAttempts})...\r`);
      await sleep(2000);
    }
  }
  return false;
}

const pgReady = await waitForPostgres();

if (!pgReady) {
  warn(
    'Postgres não respondeu. Certifique-se de rodar:\n  docker compose -f docker/docker-compose.dev.yml up -d\nDepois execute: pnpm local:setup',
  );
  process.exit(1);
}

ok('Postgres está pronto');

try {
  execSync('pnpm --filter @proteticflow/server db:push', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  ok('Schema aplicado com sucesso');
} catch {
  warn('db:push falhou. Verifique se o DATABASE_URL no .env está correto.');
  process.exit(1);
}

// ──────────────────────────────────────────
// Resultado final
// ──────────────────────────────────────────
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ Setup concluído!

  Agora basta rodar:
    pnpm local:up

  Acesse:  http://localhost:5173
  Crie sua conta em /register e comece a usar.

  Para parar:
    pnpm local:stop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
