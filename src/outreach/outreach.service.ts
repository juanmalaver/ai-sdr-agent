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

  listDueLeads(limit?: number): Lead[] {
    const now = new Date();
    const dueLeads = this.leadsService
      .listLeads()
      .filter((lead) => this.isDueForOutreach(lead, now))
      .sort((a, b) => (a.nextFollowupAt ?? '').localeCompare(b.nextFollowupAt ?? ''));

    return typeof limit === 'number' ? dueLeads.slice(0, limit) : dueLeads;
  }

  runDailyOutreach(limit?: number) {
    const now = new Date();
    const results: OutreachResult[] = this.listDueLeads(limit).map((lead) => {
      const draft = this.aiService.personalizeEmail(lead);
      const email = this.emailProviderService.sendEmail({
        to: lead.email,
        subject: draft.subject,
        body: draft.body,
      });
      const updatedLead = this.leadsService.recordTouch(
        lead.id,
        now,
        this.followUpDelayDays,
        this.maxTouches,
      );

      return {
        lead: updatedLead,
        email,
      };
    });

    return {
      sentCount: results.length,
      maxTouches: this.maxTouches,
      followUpDelayDays: this.followUpDelayDays,
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
}
