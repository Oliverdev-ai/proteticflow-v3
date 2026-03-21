import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:123456@localhost:5432/proteticflow' });

async function run() {
  try {
    await pool.query('ALTER TABLE accounts_payable DROP COLUMN IF EXISTS amount;');
    await pool.query('ALTER TABLE accounts_receivable DROP COLUMN IF EXISTS amount;');
    console.log('Columns dropped successfully.');
  } catch (e) {
    console.error('Error dropping columns:', e);
  } finally {
    await pool.end();
  }
}

run();
