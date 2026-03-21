import pg from 'pg';

const pool = new pg.Pool({ connectionString: 'postgres://postgres:123456@localhost:5432/postgres' });

async function run() {
  try {
    const res = await pool.query("SELECT 1 FROM pg_database WHERE datname = 'proteticflow'");
    if (res.rowCount === 0) {
      await pool.query('CREATE DATABASE proteticflow;');
      console.log('Database proteticflow created successfully.');
    } else {
      console.log('Database proteticflow already exists.');
    }
  } catch (e) {
    console.error('Error creating database:', e);
  } finally {
    await pool.end();
  }
}

run();
