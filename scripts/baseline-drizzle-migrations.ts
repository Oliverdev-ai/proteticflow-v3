#!/usr/bin/env tsx
/**
 * Baselines Drizzle migration history for databases that already contain
 * the full schema but have an empty drizzle.__drizzle_migrations table.
 *
 * This prevents duplicate object errors (for example, existing ENUM types)
 * when running `drizzle-kit migrate` on long-lived local databases.
 */

import 'dotenv/config';

import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface JournalFile {
  entries: JournalEntry[];
}

interface MigrationEntry {
  tag: string;
  when: number;
  hash: string;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DRIZZLE_DIR = resolve(REPO_ROOT, 'apps/server/drizzle');
const JOURNAL_PATH = resolve(DRIZZLE_DIR, 'meta/_journal.json');
const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';
const SENTINEL_TABLES = [
  'tenants',
  'feature_usage_logs',
  'ai_sessions',
  'timesheets',
];

const DEFAULT_DATABASE_URL =
  'postgresql://proteticflow:proteticflow_dev@127.0.0.1:5432/proteticflow_dev';

function assertEnvDatabaseUrl(): string {
  return process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL;
}

async function readMigrationsFromJournal(): Promise<MigrationEntry[]> {
  if (!existsSync(JOURNAL_PATH)) {
    throw new Error(`[db:baseline] Missing journal file: ${JOURNAL_PATH}`);
  }

  const journalRaw = await readFile(JOURNAL_PATH, 'utf-8');
  const journal = JSON.parse(journalRaw) as JournalFile;

  return Promise.all(
    journal.entries.map(async (entry) => {
      const migrationPath = resolve(DRIZZLE_DIR, `${entry.tag}.sql`);
      if (!existsSync(migrationPath)) {
        throw new Error(`[db:baseline] Missing migration file: ${migrationPath}`);
      }

      const sql = await readFile(migrationPath, 'utf-8');
      return {
        tag: entry.tag,
        when: entry.when,
        hash: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}

async function countRows(
  client: pg.Client,
  query: string,
  values: readonly unknown[] = [],
): Promise<number> {
  const result = await client.query<{ c: number }>(query, values as unknown[]);
  return Number(result.rows[0]?.c ?? 0);
}

async function ensureMigrationTable(client: pg.Client): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      "id" serial PRIMARY KEY,
      "hash" text NOT NULL,
      "created_at" bigint
    )
  `);
}

async function getMissingSentinels(client: pg.Client): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [SENTINEL_TABLES],
  );

  const present = new Set(result.rows.map((row) => row.table_name));
  return SENTINEL_TABLES.filter((table) => !present.has(table));
}

async function baselineIfNeeded(): Promise<void> {
  const databaseUrl = assertEnvDatabaseUrl();
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await ensureMigrationTable(client);

    const migrationRows = await countRows(
      client,
      `SELECT COUNT(*)::int AS c FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
    );

    if (migrationRows > 0) {
      console.log(`[db:baseline] Migration table already initialized (${migrationRows} rows).`);
      return;
    }

    const appTables = await countRows(
      client,
      `
        SELECT COUNT(*)::int AS c
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
      `,
    );

    if (appTables === 0) {
      console.log('[db:baseline] Fresh database detected (no public tables). Skipping baseline.');
      return;
    }

    const missingSentinels = await getMissingSentinels(client);
    if (missingSentinels.length > 0) {
      throw new Error(
        `[db:baseline] Refusing automatic baseline: database has existing tables but is missing sentinel tables (${missingSentinels.join(
          ', ',
        )}).`,
      );
    }

    const migrations = await readMigrationsFromJournal();
    await client.query('BEGIN');

    for (const migration of migrations) {
      await client.query(
        `
          INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at")
          VALUES ($1, $2)
        `,
        [migration.hash, migration.when],
      );
    }

    await client.query('COMMIT');
    console.log(`[db:baseline] Inserted ${migrations.length} migration history rows.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

baselineIfNeeded().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
