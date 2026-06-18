import { Injectable } from '@nestjs/common';
import { Lead } from '../leads/lead.model';

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

export interface SentEmail {
  id: string;
  provider: 'mock';
  to: string;
  subject: string;
  sentAt: string;
}

@Injectable()
export class EmailProviderService {
  private readonly sentEmails: SentEmail[] = [];

  sendEmail(email: OutboundEmail): SentEmail {
    const sentEmail: SentEmail = {
      id: crypto.randomUUID(),
      provider: 'mock',
      to: email.to,
      subject: email.subject,
      sentAt: new Date().toISOString(),
    };

    this.sentEmails.push(sentEmail);
    return sentEmail;
  }

  sendBookingLink(lead: Lead): SentEmail {
    return this.sendEmail({
      to: lead.email,
      subject: 'Booking link',
      body: [
        `Hi ${lead.firstName || 'there'},`,
        '',
        'Here is a link to grab time with our team: https://example.com/book',
      ].join('\n'),
    });
  }

  listSentEmails(): SentEmail[] {
    return [...this.sentEmails];
  }
}
