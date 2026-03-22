import pg from 'pg';
const { Client } = pg;

async function createDb() {
  const client = new Client({
    connectionString: 'postgres://postgres:123456@localhost:5434/postgres',
  });
  await client.connect();
  try {
    await client.query('CREATE DATABASE proteticflow');
    console.log('Database created');
  } catch (e) {
    if (e.code === '42P04') {
      console.log('Database already exists');
    } else {
      console.error(e);
    }
  } finally {
    await client.end();
  }
}

createDb();
