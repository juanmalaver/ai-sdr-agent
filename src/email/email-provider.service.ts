import { Injectable, InternalServerErrorException } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { Lead } from '../leads/lead.model';

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

export interface SentEmail {
  id: string;
  provider: 'mock' | 'sendgrid';
  to: string;
  subject: string;
  sentAt: string;
}

@Injectable()
export class EmailProviderService {
  private readonly sentEmails: SentEmail[] = [];
  private readonly driver = (process.env.EMAIL_DRIVER ?? 'LOGGER').toUpperCase();

  async sendEmail(email: OutboundEmail): Promise<SentEmail> {
    if (this.driver === 'SMTP') {
      return this.sendSmtpEmail(email);
    }

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

  async sendBookingLink(lead: Lead): Promise<SentEmail> {
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

  private async sendSmtpEmail(email: OutboundEmail): Promise<SentEmail> {
    const host = process.env.EMAIL_SMTP_HOST ?? 'smtp.sendgrid.net';
    const port = this.parsePort(process.env.EMAIL_SMTP_PORT, 587);
    const user = process.env.EMAIL_SMTP_USER ?? 'apikey';
    const password = this.requireEnv('EMAIL_SMTP_PASSWORD');
    const fromAddress = this.requireEnv('EMAIL_FROM_ADDRESS');
    const fromName = process.env.EMAIL_FROM_NAME;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass: password,
      },
    });
    const sentAt = new Date().toISOString();
    const info = await transporter.sendMail({
      from: this.formatSender(fromAddress, fromName),
      to: email.to,
      subject: email.subject,
      text: email.body,
      html: this.toHtml(email.body),
    });
    const sentEmail: SentEmail = {
      id: typeof info.messageId === 'string' ? info.messageId : crypto.randomUUID(),
      provider: 'sendgrid',
      to: email.to,
      subject: email.subject,
      sentAt,
    };

    this.sentEmails.push(sentEmail);
    return sentEmail;
  }

  private requireEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new InternalServerErrorException(`Email is not configured: set ${name}.`);
    }

    return value;
  }

  private parsePort(value: string | undefined, fallback: number): number {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private formatSender(address: string, name?: string): string {
    return name ? `${name} <${address}>` : address;
  }

  private toHtml(body: string): string {
    return body
      .split('\n')
      .map((line) => this.escapeHtml(line))
      .join('<br>');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
