import { Injectable } from '@nestjs/common';
import { Lead } from './lead.model';

@Injectable()
export class LeadsRepository {
  private readonly leadsById = new Map<string, Lead>();
  private readonly leadIdByEmail = new Map<string, string>();

  create(lead: Lead): Lead {
    this.leadsById.set(lead.id, lead);
    this.leadIdByEmail.set(lead.email, lead.id);
    return lead;
  }

  list(): Lead[] {
    return [...this.leadsById.values()];
  }

  findById(id: string): Lead | undefined {
    return this.leadsById.get(id);
  }

  findByEmail(email: string): Lead | undefined {
    const id = this.leadIdByEmail.get(email.toLowerCase());
    return id ? this.findById(id) : undefined;
  }

  update(id: string, patch: Partial<Lead>): Lead | undefined {
    const lead = this.findById(id);

    if (!lead) {
      return undefined;
    }

    const updated = {
      ...lead,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.leadsById.set(id, updated);
    return updated;
  }
}
