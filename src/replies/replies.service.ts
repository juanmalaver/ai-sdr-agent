import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ReplyIntent } from '../ai/reply-classification.model';
import { EmailProviderService } from '../email/email-provider.service';
import { LeadStatus } from '../leads/lead-status.enum';
import { Lead } from '../leads/lead.model';
import { LeadsService } from '../leads/leads.service';

interface TriageReplyInput {
  leadId?: string;
  fromEmail?: string;
  text?: string;
}

@Injectable()
export class RepliesService {
  constructor(
    private readonly aiService: AiService,
    private readonly leadsService: LeadsService,
    private readonly emailProviderService: EmailProviderService,
  ) {}

  classifyReply(text: string) {
    if (!text.trim()) {
      throw new BadRequestException('Reply text is required.');
    }

    return this.aiService.classifyReply(text);
  }

  triageReply(input: TriageReplyInput) {
    const text = input.text?.trim();

    if (!text) {
      throw new BadRequestException('Reply text is required.');
    }

    const lead = this.findLead(input);
    const classification = this.aiService.classifyReply(text);
    const actions = this.applyReplyIntent(lead, classification.intent);
    const updatedLead = this.leadsService.findLead(lead.id);

    return {
      lead: updatedLead,
      classification,
      actions,
    };
  }

  private findLead(input: TriageReplyInput): Lead {
    if (input.leadId) {
      return this.leadsService.findLead(input.leadId);
    }

    if (input.fromEmail) {
      const lead = this.leadsService.findLeadByEmail(input.fromEmail);

      if (lead) {
        return lead;
      }
    }

    throw new NotFoundException('Lead was not found by leadId or fromEmail.');
  }

  private applyReplyIntent(lead: Lead, intent: ReplyIntent): string[] {
    if (intent === ReplyIntent.Interested) {
      this.leadsService.updateStatus(lead.id, LeadStatus.Interested);
      this.emailProviderService.sendBookingLink(lead);
      return ['mark_interested', 'send_booking_link', 'slack_alert', 'monday_item'];
    }

    if (intent === ReplyIntent.NotInterested) {
      this.leadsService.updateStatus(lead.id, LeadStatus.NotInterested);
      return ['mark_not_interested', 'stop_sequence'];
    }

    if (intent === ReplyIntent.Unsubscribe) {
      this.leadsService.updateStatus(lead.id, LeadStatus.Unsubscribed);
      return ['mark_unsubscribed', 'stop_sequence', 'never_email_again'];
    }

    return ['send_to_human_review'];
  }
}
