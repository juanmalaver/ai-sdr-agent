import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { LeadStatus } from './lead-status.enum';
import { Lead } from './lead.model';

interface LeadRow extends QueryResultRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  practice_name: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  status: LeadStatus;
  touches: number;
  next_followup_at: Date | string | null;
  last_contacted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  metadata: Record<string, string>;
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(lead: Lead): Promise<Lead | undefined> {
    const result = await this.database.query<LeadRow>(
      `
        INSERT INTO leads (
          id,
          email,
          first_name,
          last_name,
          practice_name,
          city,
          state,
          website,
          status,
          touches,
          next_followup_at,
          last_contacted_at,
          created_at,
          updated_at,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (email) DO NOTHING
        RETURNING *
      `,
      [
        lead.id,
        lead.email,
        lead.firstName ?? null,
        lead.lastName ?? null,
        lead.practiceName ?? null,
        lead.city ?? null,
        lead.state ?? null,
        lead.website ?? null,
        lead.status,
        lead.touches,
        lead.nextFollowupAt ?? null,
        lead.lastContactedAt ?? null,
        lead.createdAt,
        lead.updatedAt,
        lead.metadata,
      ],
    );

    return result.rows[0] ? this.toLead(result.rows[0]) : undefined;
  }

  async list(): Promise<Lead[]> {
    const result = await this.database.query<LeadRow>(
      'SELECT * FROM leads ORDER BY created_at ASC, email ASC',
    );

    return result.rows.map((row) => this.toLead(row));
  }

  async findById(id: string): Promise<Lead | undefined> {
    const result = await this.database.query<LeadRow>('SELECT * FROM leads WHERE id = $1', [id]);

    return result.rows[0] ? this.toLead(result.rows[0]) : undefined;
  }

  async findByEmail(email: string): Promise<Lead | undefined> {
    const result = await this.database.query<LeadRow>('SELECT * FROM leads WHERE email = $1', [
      email.toLowerCase(),
    ]);

    return result.rows[0] ? this.toLead(result.rows[0]) : undefined;
  }

  async update(id: string, patch: Partial<Lead>): Promise<Lead | undefined> {
    const values: unknown[] = [];
    const assignments: string[] = [];

    this.addAssignment(assignments, values, 'email', patch, 'email');
    this.addAssignment(assignments, values, 'first_name', patch, 'firstName');
    this.addAssignment(assignments, values, 'last_name', patch, 'lastName');
    this.addAssignment(assignments, values, 'practice_name', patch, 'practiceName');
    this.addAssignment(assignments, values, 'city', patch, 'city');
    this.addAssignment(assignments, values, 'state', patch, 'state');
    this.addAssignment(assignments, values, 'website', patch, 'website');
    this.addAssignment(assignments, values, 'status', patch, 'status');
    this.addAssignment(assignments, values, 'touches', patch, 'touches');
    this.addAssignment(assignments, values, 'next_followup_at', patch, 'nextFollowupAt');
    this.addAssignment(assignments, values, 'last_contacted_at', patch, 'lastContactedAt');
    this.addAssignment(assignments, values, 'metadata', patch, 'metadata');

    values.push(new Date().toISOString());
    assignments.push(`updated_at = $${values.length}`);

    values.push(id);
    const result = await this.database.query<LeadRow>(
      `
        UPDATE leads
        SET ${assignments.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `,
      values,
    );

    return result.rows[0] ? this.toLead(result.rows[0]) : undefined;
  }

  private addAssignment<K extends keyof Lead>(
    assignments: string[],
    values: unknown[],
    column: string,
    patch: Partial<Lead>,
    key: K,
  ): void {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) {
      return;
    }

    values.push(patch[key] ?? null);
    assignments.push(`${column} = $${values.length}`);
  }

  private toLead(row: LeadRow): Lead {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      practiceName: row.practice_name ?? undefined,
      city: row.city ?? undefined,
      state: row.state ?? undefined,
      website: row.website ?? undefined,
      status: row.status,
      touches: row.touches,
      nextFollowupAt: this.toOptionalIsoString(row.next_followup_at),
      lastContactedAt: this.toOptionalIsoString(row.last_contacted_at),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
      metadata: row.metadata ?? {},
    };
  }

  private toOptionalIsoString(value: Date | string | null): string | undefined {
    return value ? this.toIsoString(value) : undefined;
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
