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

  async classifyReply(text: string) {
    if (!text.trim()) {
      throw new BadRequestException('Reply text is required.');
    }

    return this.aiService.classifyReply(text);
  }

  async triageReply(input: TriageReplyInput) {
    const text = input.text?.trim();

    if (!text) {
      throw new BadRequestException('Reply text is required.');
    }

    const lead = await this.findLead(input);
    const classification = await this.aiService.classifyReply(text);
    const actions = await this.applyReplyIntent(lead, classification.intent);
    const updatedLead = await this.leadsService.findLead(lead.id);

    return {
      lead: updatedLead,
      classification,
      actions,
    };
  }

  private async findLead(input: TriageReplyInput): Promise<Lead> {
    if (input.leadId) {
      return this.leadsService.findLead(input.leadId);
    }

    if (input.fromEmail) {
      const lead = await this.leadsService.findLeadByEmail(input.fromEmail);

      if (lead) {
        return lead;
      }
    }

    throw new NotFoundException('Lead was not found by leadId or fromEmail.');
  }

  private async applyReplyIntent(lead: Lead, intent: ReplyIntent): Promise<string[]> {
    if (intent === ReplyIntent.Interested) {
      await this.leadsService.updateStatus(lead.id, LeadStatus.Interested);
      await this.emailProviderService.sendBookingLink(lead);
      return ['mark_interested', 'send_booking_link', 'slack_alert', 'monday_item'];
    }

    if (intent === ReplyIntent.NotInterested) {
      await this.leadsService.updateStatus(lead.id, LeadStatus.NotInterested);
      return ['mark_not_interested', 'stop_sequence'];
    }

    if (intent === ReplyIntent.Unsubscribe) {
      await this.leadsService.updateStatus(lead.id, LeadStatus.Unsubscribed);
      return ['mark_unsubscribed', 'stop_sequence', 'never_email_again'];
    }

    return ['send_to_human_review'];
  }
}
