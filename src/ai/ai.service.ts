import { Injectable } from '@nestjs/common';
import { Lead } from '../leads/lead.model';
import { ReplyClassification, ReplyIntent } from './reply-classification.model';

@Injectable()
export class AiService {
  personalizeEmail(lead: Lead): { subject: string; body: string } {
    const name = lead.firstName || 'there';
    const practice = lead.practiceName || 'your practice';
    const market = [lead.city, lead.state].filter(Boolean).join(', ');
    const locationLine = market ? ` in ${market}` : '';

    return {
      subject: `Quick idea for ${practice}`,
      body: [
        `Hi ${name},`,
        '',
        `I noticed ${practice}${locationLine} and thought there may be a fit for helping your team follow up with more patient inquiries automatically.`,
        '',
        'Would it be useful if I sent over a short overview?',
      ].join('\n'),
    };
  }

  classifyReply(text: string): ReplyClassification {
    const normalized = text.toLowerCase();

    if (this.hasAny(normalized, ['unsubscribe', 'stop emailing', 'remove me', 'take me off'])) {
      return {
        intent: ReplyIntent.Unsubscribe,
        confidence: 0.95,
        reason: 'Reply contains a clear opt-out phrase.',
      };
    }

    if (
      this.hasAny(normalized, [
        'pricing',
        'price',
        'send info',
        'send over',
        'demo',
        'book',
        'calendar',
        'call me',
        'interested',
        'tell me more',
        'september',
      ])
    ) {
      return {
        intent: ReplyIntent.Interested,
        confidence: 0.82,
        reason: 'Reply asks for more information or suggests a follow-up conversation.',
      };
    }

    if (
      this.hasAny(normalized, [
        'not interested',
        'no thanks',
        'no thank you',
        'not right now',
        'already using',
        'we have a provider',
      ])
    ) {
      return {
        intent: ReplyIntent.NotInterested,
        confidence: 0.84,
        reason: 'Reply declines or indicates they already have another provider.',
      };
    }

    return {
      intent: ReplyIntent.Other,
      confidence: 0.45,
      reason: 'Reply needs human review.',
    };
  }

  private hasAny(value: string, patterns: string[]): boolean {
    return patterns.some((pattern) => value.includes(pattern));
  }
}
