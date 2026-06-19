import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { EmailProviderService, SentEmail } from '../email/email-provider.service';
import { LeadStatus } from '../leads/lead-status.enum';
import { Lead } from '../leads/lead.model';
import { LeadsService } from '../leads/leads.service';

export interface OutreachResult {
  lead: Lead;
  email: SentEmail;
}

@Injectable()
export class OutreachService {
  private readonly maxTouches = 4;
  private readonly followUpDelayDays = 3;
  private readonly outreachConcurrency = this.parsePositiveInteger(
    process.env.OUTREACH_CONCURRENCY,
    3,
  );
  private readonly outreachEligibleStatuses = new Set<LeadStatus>([
    LeadStatus.New,
    LeadStatus.Active,
    LeadStatus.Contacted,
  ]);

  constructor(
    private readonly leadsService: LeadsService,
    private readonly aiService: AiService,
    private readonly emailProviderService: EmailProviderService,
  ) {}

  async listDueLeads(limit?: number): Promise<Lead[]> {
    const now = new Date();
    const leads = await this.leadsService.listLeads();
    const dueLeads = leads
      .filter((lead) => this.isDueForOutreach(lead, now))
      .sort((a, b) => (a.nextFollowupAt ?? '').localeCompare(b.nextFollowupAt ?? ''));

    return typeof limit === 'number' ? dueLeads.slice(0, limit) : dueLeads;
  }

  async runDailyOutreach(limit?: number) {
    const now = new Date();
    const dueLeads = await this.listDueLeads(limit);
    const results: OutreachResult[] = [];

    for (let index = 0; index < dueLeads.length; index += this.outreachConcurrency) {
      const batch = dueLeads.slice(index, index + this.outreachConcurrency);
      const batchResults = await Promise.all(
        batch.map(async (lead) => {
          const draft = await this.aiService.personalizeEmail(lead);
          const email = await this.emailProviderService.sendEmail({
            to: lead.email,
            subject: draft.subject,
            body: draft.body,
          });
          const updatedLead = await this.leadsService.recordTouch(
            lead.id,
            now,
            this.followUpDelayDays,
            this.maxTouches,
          );

          return {
            lead: updatedLead,
            email,
          };
        }),
      );

      results.push(...batchResults);
    }

    return {
      sentCount: results.length,
      maxTouches: this.maxTouches,
      followUpDelayDays: this.followUpDelayDays,
      outreachConcurrency: this.outreachConcurrency,
      results,
    };
  }

  private isDueForOutreach(lead: Lead, now: Date): boolean {
    return (
      this.outreachEligibleStatuses.has(lead.status) &&
      lead.touches < this.maxTouches &&
      Boolean(lead.nextFollowupAt) &&
      new Date(lead.nextFollowupAt as string).getTime() <= now.getTime()
    );
  }

  private parsePositiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
