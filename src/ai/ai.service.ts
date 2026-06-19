import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { Lead } from '../leads/lead.model';
import { ReplyClassification, ReplyIntent } from './reply-classification.model';

interface EmailDraft {
  subject: string;
  body: string;
}

interface ClaudeEmailDraft {
  subject?: unknown;
  body?: unknown;
}

interface ClaudeReplyClassification {
  intent?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

type AiProvider = 'MOCK' | 'VERTEX';

@Injectable()
export class AiService {
  private readonly provider: AiProvider;
  private readonly model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
  private readonly maxOutputTokens = this.parsePositiveInteger(
    process.env.CLAUDE_MAX_OUTPUT_TOKENS,
    700,
  );
  private readonly vertexClient?: AnthropicVertex;

  constructor() {
    this.provider = this.parseProvider(process.env.AI_PROVIDER);

    if (this.provider === 'VERTEX') {
      this.assertRequiredEnv('ANTHROPIC_VERTEX_PROJECT_ID');
      this.assertRequiredEnv('CLOUD_ML_REGION');

      this.vertexClient = new AnthropicVertex({
        projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID,
        region: process.env.CLOUD_ML_REGION,
      });
    }
  }

  async personalizeEmail(lead: Lead): Promise<EmailDraft> {
    if (this.provider === 'MOCK') {
      return this.personalizeEmailWithMock(lead);
    }

    const text = await this.createVertexMessage({
      system: [
        'You write concise B2B healthcare outreach emails.',
        'Use only the lead data provided. Do not invent expansions, awards, funding, or recent events.',
        'Keep the tone natural, specific, and low pressure.',
        'Return JSON only with this shape: {"subject":"...","body":"..."}',
      ].join(' '),
      user: [
        'Create one first-touch outreach email for this lead.',
        'The body should be 80 words or fewer and include a simple question.',
        'Lead data:',
        JSON.stringify(this.buildLeadContext(lead), null, 2),
      ].join('\n'),
      maxTokens: this.maxOutputTokens,
    });

    const draft = this.parseJsonObject<ClaudeEmailDraft>(text);
    const subject = typeof draft.subject === 'string' ? draft.subject.trim() : '';
    const body = typeof draft.body === 'string' ? draft.body.trim() : '';

    if (!subject || !body) {
      throw new InternalServerErrorException('Claude returned an invalid email draft.');
    }

    return {
      subject: subject.slice(0, 120),
      body,
    };
  }

  async classifyReply(text: string): Promise<ReplyClassification> {
    if (this.provider === 'MOCK') {
      return this.classifyReplyWithMock(text);
    }

    const responseText = await this.createVertexMessage({
      system: [
        'Classify inbound replies for an outbound email sequence.',
        `Choose exactly one intent: ${Object.values(ReplyIntent).join(', ')}.`,
        'interested means the person asks for pricing, info, a demo, a call, or future follow-up.',
        'not_interested means the person declines, says not now, or says they already use another provider.',
        'unsubscribe means the person asks to stop, unsubscribe, or be removed.',
        'other means unclear, ambiguous, unrelated, or needs human review.',
        'Return JSON only with this shape: {"intent":"interested","confidence":0.9,"reason":"..."}',
      ].join(' '),
      user: ['Reply text:', text].join('\n'),
      maxTokens: 250,
    });

    try {
      return this.normalizeClassification(
        this.parseJsonObject<ClaudeReplyClassification>(responseText),
      );
    } catch {
      return {
        intent: ReplyIntent.Other,
        confidence: 0.3,
        reason: 'Claude returned a reply classification that could not be parsed.',
      };
    }
  }

  private personalizeEmailWithMock(lead: Lead): EmailDraft {
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

  private classifyReplyWithMock(text: string): ReplyClassification {
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

  private async createVertexMessage(input: {
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<string> {
    if (!this.vertexClient) {
      throw new InternalServerErrorException('Vertex AI is not configured.');
    }

    const response = await this.vertexClient.messages.create({
      model: this.model,
      max_tokens: input.maxTokens,
      temperature: 0.2,
      system: input.system,
      messages: [
        {
          role: 'user',
          content: input.user,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) {
      throw new InternalServerErrorException('Claude returned an empty response.');
    }

    return text;
  }

  private buildLeadContext(lead: Lead) {
    return {
      firstName: lead.firstName,
      lastName: lead.lastName,
      practiceName: lead.practiceName,
      city: lead.city,
      state: lead.state,
      website: lead.website,
      metadata: lead.metadata,
    };
  }

  private normalizeClassification(value: ClaudeReplyClassification): ReplyClassification {
    const intent = this.isReplyIntent(value.intent) ? value.intent : ReplyIntent.Other;
    const confidence =
      typeof value.confidence === 'number' && Number.isFinite(value.confidence)
        ? Math.min(Math.max(value.confidence, 0), 1)
        : 0.5;
    const reason =
      typeof value.reason === 'string' && value.reason.trim()
        ? value.reason.trim().slice(0, 240)
        : 'Claude classified the reply without a reason.';

    return {
      intent,
      confidence,
      reason,
    };
  }

  private parseJsonObject<T>(text: string): T {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Response did not contain a JSON object.');
    }

    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }

  private parseProvider(value?: string): AiProvider {
    const provider = (value ?? 'MOCK').toUpperCase();

    if (provider === 'MOCK' || provider === 'VERTEX') {
      return provider;
    }

    throw new Error('AI_PROVIDER must be MOCK or VERTEX.');
  }

  private parsePositiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private assertRequiredEnv(name: string): void {
    if (!process.env[name]) {
      throw new Error(`AI_PROVIDER=VERTEX requires ${name}.`);
    }
  }

  private isReplyIntent(value: unknown): value is ReplyIntent {
    return typeof value === 'string' && Object.values(ReplyIntent).includes(value as ReplyIntent);
  }

  private hasAny(value: string, patterns: string[]): boolean {
    return patterns.some((pattern) => value.includes(pattern));
  }
}
