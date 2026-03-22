import { db } from './apps/server/src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const result = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('Tables in public schema:');
    console.table(result.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error listing tables:', err);
    process.exit(1);
  }
}

main();
