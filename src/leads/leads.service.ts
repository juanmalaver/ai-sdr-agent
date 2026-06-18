import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportLeadInput, ImportLeadsDto } from './dto/import-leads.dto';
import { LeadStatus } from './lead-status.enum';
import { Lead } from './lead.model';
import { LeadsRepository } from './leads.repository';

export interface InvalidLead {
  row: number;
  reason: string;
  lead: ImportLeadInput;
}

@Injectable()
export class LeadsService {
  constructor(private readonly leadsRepository: LeadsRepository) {}

  listLeads(): Lead[] {
    return this.leadsRepository.list();
  }

  importLeads(dto: ImportLeadsDto) {
    if (!Array.isArray(dto?.leads)) {
      throw new BadRequestException('Body must include a leads array.');
    }

    const imported: Lead[] = [];
    const duplicates: ImportLeadInput[] = [];
    const invalid: InvalidLead[] = [];
    const seenEmails = new Set<string>();

    dto.leads.forEach((leadInput, index) => {
      const email = this.normalizeEmail(leadInput.email);

      if (!email || !this.isValidEmail(email)) {
        invalid.push({
          row: index,
          reason: 'Missing or invalid email.',
          lead: leadInput,
        });
        return;
      }

      if (seenEmails.has(email) || this.leadsRepository.findByEmail(email)) {
        duplicates.push(leadInput);
        return;
      }

      seenEmails.add(email);
      imported.push(this.leadsRepository.create(this.toLead(leadInput, email)));
    });

    return {
      importedCount: imported.length,
      duplicateCount: duplicates.length,
      invalidCount: invalid.length,
      imported,
      duplicates,
      invalid,
    };
  }

  findLead(id: string): Lead {
    const lead = this.leadsRepository.findById(id);

    if (!lead) {
      throw new NotFoundException(`Lead ${id} was not found.`);
    }

    return lead;
  }

  findLeadByEmail(email: string): Lead | undefined {
    return this.leadsRepository.findByEmail(this.normalizeEmail(email));
  }

  updateStatus(id: string, status: LeadStatus): Lead {
    if (!Object.values(LeadStatus).includes(status)) {
      throw new BadRequestException(`Unsupported status: ${status}`);
    }

    const updated = this.leadsRepository.update(id, { status });

    if (!updated) {
      throw new NotFoundException(`Lead ${id} was not found.`);
    }

    return updated;
  }

  recordTouch(id: string, touchedAt: Date, followUpDelayDays: number, maxTouches: number): Lead {
    const lead = this.findLead(id);
    const touches = lead.touches + 1;
    const nextFollowupAt =
      touches < maxTouches ? this.addDays(touchedAt, followUpDelayDays).toISOString() : undefined;

    const updated = this.leadsRepository.update(id, {
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

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }
}
