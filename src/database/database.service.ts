import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { createDatabasePoolConfig } from './database.config';
import { runMigrations } from './migrations';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool(createDatabasePoolConfig());

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');

    if (this.isTruthy(process.env.DATABASE_AUTO_MIGRATE)) {
      await runMigrations(this.pool);
    }
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private isTruthy(value: string | undefined): boolean {
    return ['1', 'true', 'yes', 'y', 'on'].includes(value?.trim().toLowerCase() ?? '');
  }
}
