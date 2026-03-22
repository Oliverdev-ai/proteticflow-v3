import { db } from './apps/server/src/db/index.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const migrationPath = path.join(process.cwd(), 'apps/server/drizzle/0007_funcionarios_folha.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by ; but skip those inside BEGIN ... END or quotes if necessary.
    // However, the migration 0007 is simple enough for a direct split or even better, execute the whole blob if the driver supports it.
    // node-postgres supports multiple statements if separated by ;
    
    console.log('Applying migration 0007 manually...');
    await db.execute(sql.raw(sqlContent));
    console.log('Migration applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  }
}

main();
