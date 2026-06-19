import 'dotenv/config';
import { Pool } from 'pg';
import { createDatabasePoolConfig } from './database.config';
import { runMigrations } from './migrations';

async function main(): Promise<void> {
  const pool = new Pool(createDatabasePoolConfig());

  try {
    await runMigrations(pool);
    console.log('Database migrations complete.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
