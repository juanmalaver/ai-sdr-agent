import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getOverview() {
    return {
      service: 'ai-sdr-agent',
      message: 'Workflow engine with AI services for personalization and reply triage.',
      endpoints: {
        leads: ['GET /leads', 'POST /leads/import'],
        outreach: ['GET /outreach/due', 'POST /outreach/run-daily'],
        replies: ['POST /replies/classify', 'POST /replies/triage'],
      },
    };
  }
}
