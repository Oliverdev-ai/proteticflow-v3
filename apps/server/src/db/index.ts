import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env.js';
import { logger } from '../logger.js';
import * as schema from './schema/index.js';

const connectionString =
  process.platform === 'win32'
    ? env.DATABASE_URL.replace(/@localhost(?=[:/])/i, '@127.0.0.1')
    : env.DATABASE_URL;

if (connectionString !== env.DATABASE_URL) {
  logger.info({ action: 'db.connection.normalize_ipv4' }, 'DATABASE_URL normalizado para IPv4 no Windows');
}

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  // Dashboard + rotas paralelas podem abrir bursts de query no mesmo tick.
  // Evita falso negativo de "timeout exceeded when trying to connect" em pico curto.
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Erro inesperado no pool PostgreSQL');
});

export const db = drizzle(pool, { schema });

export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}
