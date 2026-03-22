import { db } from './apps/server/src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const result = await db.execute(sql`SELECT * FROM drizzle.migrations`);
    console.log('Drizzle Migrations:');
    console.table(result.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error listing migrations:', err);
    process.exit(1);
  }
}

main();
