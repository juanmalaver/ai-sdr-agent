import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { ImportLeadInput, ImportLeadsDto } from './dto/import-leads.dto';
import { LeadStatus } from './lead-status.enum';
import { Lead } from './lead.model';
import { LeadsRepository } from './leads.repository';

type ImportSource = 'json' | 'csv';

export interface InvalidLead {
  row: number;
  reason: string;
  lead: ImportLeadInput;
}

export interface ImportLeadsResult {
  source: ImportSource;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  imported: Lead[];
  duplicates: ImportLeadInput[];
  invalid: InvalidLead[];
}

export interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class LeadsService {
  private readonly maxCsvRows = 10000;

  constructor(private readonly leadsRepository: LeadsRepository) {}

  listLeads(): Promise<Lead[]> {
    return this.leadsRepository.list();
  }

  importLeads(dto: ImportLeadsDto): Promise<ImportLeadsResult> {
    if (!Array.isArray(dto?.leads)) {
      throw new BadRequestException(
        'Body must include a leads array, or upload a CSV file using multipart field "file".',
      );
    }

    return this.importLeadInputs(dto.leads, 'json', 0);
  }

  importLeadCsv(file: UploadedCsvFile): Promise<ImportLeadsResult> {
    this.validateCsvFile(file);

    const rows = this.parseCsvRows(file);

    if (rows.length === 0) {
      throw new BadRequestException('CSV must include at least one lead row.');
    }

    if (!this.hasAnyHeader(rows[0], ['email', 'email address', 'provider email', 'work email'])) {
      throw new BadRequestException('CSV must include an email column.');
    }

    if (rows.length > this.maxCsvRows) {
      throw new BadRequestException(`CSV imports are limited to ${this.maxCsvRows} rows.`);
    }

    return this.importLeadInputs(
      rows.map((row) => this.mapCsvRowToLead(row)),
      'csv',
      2,
    );
  }

  private async importLeadInputs(
    leads: ImportLeadInput[],
    source: ImportSource,
    firstRowNumber: number,
  ): Promise<ImportLeadsResult> {
    const imported: Lead[] = [];
    const duplicates: ImportLeadInput[] = [];
    const invalid: InvalidLead[] = [];
    const seenEmails = new Set<string>();

    for (const [index, leadInput] of leads.entries()) {
      const email = this.normalizeEmail(leadInput.email);

      if (!email || !this.isValidEmail(email)) {
        invalid.push({
          row: firstRowNumber + index,
          reason: 'Missing or invalid email.',
          lead: leadInput,
        });
        continue;
      }

      if (seenEmails.has(email)) {
        duplicates.push(leadInput);
        continue;
      }

      seenEmails.add(email);
      const created = await this.leadsRepository.create(this.toLead(leadInput, email));

      if (created) {
        imported.push(created);
      } else {
        duplicates.push(leadInput);
      }
    }

    return {
      source,
      importedCount: imported.length,
      duplicateCount: duplicates.length,
      invalidCount: invalid.length,
      imported,
      duplicates,
      invalid,
    };
  }

  async findLead(id: string): Promise<Lead> {
    const lead = await this.leadsRepository.findById(id);

    if (!lead) {
      throw new NotFoundException(`Lead ${id} was not found.`);
    }

    return lead;
  }

  findLeadByEmail(email: string): Promise<Lead | undefined> {
    return this.leadsRepository.findByEmail(this.normalizeEmail(email));
  }

  async updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    if (!Object.values(LeadStatus).includes(status)) {
      throw new BadRequestException(`Unsupported status: ${status}`);
    }

    const updated = await this.leadsRepository.update(id, { status });

    if (!updated) {
      throw new NotFoundException(`Lead ${id} was not found.`);
    }

    return updated;
  }

  async recordTouch(
    id: string,
    touchedAt: Date,
    followUpDelayDays: number,
    maxTouches: number,
  ): Promise<Lead> {
    const lead = await this.findLead(id);
    const touches = lead.touches + 1;
    const nextFollowupAt =
      touches < maxTouches ? this.addDays(touchedAt, followUpDelayDays).toISOString() : undefined;

    const updated = await this.leadsRepository.update(id, {
      status: LeadStatus.Contacted,
      touches,
      lastContactedAt: touchedAt.toISOString(),
      nextFollowupAt,
    });

    if (!updated) {
      throw new NotFoundException(`Lead ${id} was not found.`);
    }

    return updated;
  }

  private validateCsvFile(file: UploadedCsvFile): void {
    if (!file.buffer?.length) {
      throw new BadRequestException('Uploaded CSV file is empty.');
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Lead import file must use a .csv extension.');
    }
  }

  private parseCsvRows(file: UploadedCsvFile): Record<string, string>[] {
    try {
      return parse(file.buffer.toString('utf8'), {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to parse CSV.';
      throw new BadRequestException(`Unable to parse CSV: ${message}`);
    }
  }

  private mapCsvRowToLead(row: Record<string, string>): ImportLeadInput {
    const knownHeaders = new Set<string>();
    const get = (aliases: string[]): string | undefined => {
      const aliasKeys = new Set(aliases.map((alias) => this.toHeaderKey(alias)));
      const header = Object.keys(row).find((key) => aliasKeys.has(this.toHeaderKey(key)));

      if (!header) {
        return undefined;
      }

      knownHeaders.add(header);
      return this.clean(row[header]);
    };

    const email = get(['email', 'email address', 'provider email', 'work email']);
    const firstName = get(['firstName', 'first name', 'first_name', 'first']);
    const lastName = get(['lastName', 'last name', 'last_name', 'last']);
    const practiceName = get([
      'practiceName',
      'practice name',
      'practice',
      'name',
      'business',
      'company',
      'business name',
      'clinic name',
    ]);
    const city = get(['city', 'address2', 'area', 'town', 'locality']);
    const state = get(['state', 'region', 'province']);
    const website = get(['website', 'website url', 'site', 'url']);
    const metadata = Object.fromEntries(
      Object.entries(row)
        .filter(([key, value]) => !knownHeaders.has(key) && this.clean(value))
        .map(([key, value]) => [key, value.trim()]),
    );

    return {
      email,
      firstName,
      lastName,
      practiceName,
      city,
      state,
      website,
      metadata,
    };
  }

  private hasAnyHeader(row: Record<string, string>, aliases: string[]): boolean {
    const aliasKeys = new Set(aliases.map((alias) => this.toHeaderKey(alias)));
    return Object.keys(row).some((key) => aliasKeys.has(this.toHeaderKey(key)));
  }

  private toLead(input: ImportLeadInput, email: string): Lead {
    const now = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      email,
      firstName: this.clean(input.firstName),
      lastName: this.clean(input.lastName),
      practiceName: this.clean(input.practiceName),
      city: this.clean(input.city),
      state: this.clean(input.state),
      website: this.clean(input.website),
      status: LeadStatus.New,
      touches: 0,
      nextFollowupAt: now,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata ?? {},
    };
  }

  private normalizeEmail(email?: string): string {
    return email?.trim().toLowerCase() ?? '';
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private clean(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private toHeaderKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }
}
