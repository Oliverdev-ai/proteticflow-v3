import pg from 'pg';
const { Client } = pg;

async function resetDb() {
  const client = new Client({
    connectionString: 'postgres://postgres:123456@localhost:5434/postgres',
  });
  await client.connect();
  try {
    // Terminate other connections if any (important in some environments)
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'proteticflow' AND pid <> pg_backend_pid()");
    await client.query('DROP DATABASE IF EXISTS proteticflow');
    await client.query('CREATE DATABASE proteticflow');
    console.log('Database reset successfully');
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

resetDb();
