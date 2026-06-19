import type { PoolConfig } from 'pg';

export function createDatabasePoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for PostgreSQL persistence.');
  }

  return {
    connectionString,
    max: parsePositiveInteger(process.env.DATABASE_POOL_MAX, 10),
    ssl: parseSsl(process.env.DATABASE_SSL),
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSsl(value: string | undefined): PoolConfig['ssl'] {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || ['0', 'false', 'no', 'off'].includes(normalized)) {
    return undefined;
  }

  return { rejectUnauthorized: !['1', 'true', 'yes', 'on', 'require'].includes(normalized) };
}
