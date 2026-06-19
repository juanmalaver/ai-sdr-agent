import type { Pool } from 'pg';

interface Migration {
  name: string;
  sql: string;
}

const migrationLockId = 731942867;

const migrations: Migration[] = [
  {
    name: '001_create_leads',
    sql: `
      CREATE TABLE IF NOT EXISTS leads (
        id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        first_name text,
        last_name text,
        practice_name text,
        city text,
        state text,
        website text,
        status text NOT NULL CHECK (
          status IN ('new', 'active', 'contacted', 'interested', 'not_interested', 'unsubscribed')
        ),
        touches integer NOT NULL DEFAULT 0 CHECK (touches >= 0),
        next_followup_at timestamptz,
        last_contacted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      );

      CREATE INDEX IF NOT EXISTS leads_status_next_followup_idx
        ON leads (status, next_followup_at);

      CREATE INDEX IF NOT EXISTS leads_created_at_idx
        ON leads (created_at);
    `,
  },
];

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  let transactionStarted = false;
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock($1)', [migrationLockId]);
    lockAcquired = true;
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const migration of migrations) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [
        migration.name,
      ]);

      if (applied.rowCount) {
        continue;
      }

      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
    }

    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }

    throw error;
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [migrationLockId]);
    }

    client.release();
  }
}
