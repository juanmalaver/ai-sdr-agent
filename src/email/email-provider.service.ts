import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
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

interface SmtpEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
  fromName?: string;
  noTls: boolean;
  secure: boolean;
}

@Injectable()
export class EmailProviderService {
  private readonly sentEmails: SentEmail[] = [];
  private smtpTransporter?: Transporter<SMTPTransport.SentMessageInfo>;

  async sendEmail(email: OutboundEmail): Promise<SentEmail> {
    if (this.emailDriver() === 'SMTP') {
      return this.sendSmtpEmail(email);
    }

    return this.recordSentEmail({
      id: crypto.randomUUID(),
      provider: 'mock',
      to: email.to,
      subject: email.subject,
    });
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
    const config = this.smtpConfig();
    const info = await this.getSmtpTransporter(config).sendMail({
      from: this.formatFrom(config),
      to: email.to,
      subject: email.subject,
      text: email.body,
      html: this.toHtml(email.body),
    });

    return this.recordSentEmail({
      id: info.messageId || crypto.randomUUID(),
      provider: 'sendgrid',
      to: email.to,
      subject: email.subject,
    });
  }

  private getSmtpTransporter(config: SmtpEmailConfig): Transporter<SMTPTransport.SentMessageInfo> {
    if (!this.smtpTransporter) {
      this.smtpTransporter = createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        ignoreTLS: config.noTls,
        requireTLS: !config.noTls,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });
    }

    return this.smtpTransporter;
  }

  private recordSentEmail(input: Omit<SentEmail, 'sentAt'>): SentEmail {
    const sentEmail: SentEmail = {
      ...input,
      sentAt: new Date().toISOString(),
    };

    this.sentEmails.push(sentEmail);
    return sentEmail;
  }

  private emailDriver(): 'LOGGER' | 'SMTP' {
    const driver = (process.env.EMAIL_DRIVER || 'LOGGER').trim().toUpperCase();

    if (driver === 'LOGGER' || driver === 'SMTP') {
      return driver;
    }

    throw new InternalServerErrorException(`Unsupported EMAIL_DRIVER: ${driver}`);
  }

  private smtpConfig(): SmtpEmailConfig {
    const host = process.env.EMAIL_SMTP_HOST || 'smtp.sendgrid.net';
    const port = Number(process.env.EMAIL_SMTP_PORT || 587);
    const user = process.env.EMAIL_SMTP_USER || 'apikey';
    const password = process.env.EMAIL_SMTP_PASSWORD;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    const fromName = process.env.EMAIL_FROM_NAME;
    const noTls = this.isTruthy(process.env.EMAIL_SMTP_NO_TLS);

    if (!Number.isInteger(port) || port <= 0) {
      throw new InternalServerErrorException('Email is not configured: EMAIL_SMTP_PORT is invalid.');
    }

    if (!password) {
      throw new InternalServerErrorException('Email is not configured: set EMAIL_SMTP_PASSWORD.');
    }

    if (!fromAddress) {
      throw new InternalServerErrorException('Email is not configured: set EMAIL_FROM_ADDRESS.');
    }

    return {
      host,
      port,
      user,
      password,
      fromAddress,
      fromName,
      noTls,
      secure: port === 465 && !noTls,
    };
  }

  private formatFrom(config: SmtpEmailConfig): string {
    return config.fromName ? `${config.fromName} <${config.fromAddress}>` : config.fromAddress;
  }

  private isTruthy(value: string | undefined): boolean {
    return ['1', 'true', 'yes', 'y'].includes(value?.trim().toLowerCase() ?? '');
  }

  private toHtml(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
      .replaceAll('\n', '<br>');
  }
}
