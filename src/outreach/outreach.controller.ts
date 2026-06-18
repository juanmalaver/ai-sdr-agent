import { Controller, Get, Post, Query } from '@nestjs/common';
import { OutreachService } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Get('due')
  listDueLeads(@Query('limit') limit?: string) {
    return this.outreachService.listDueLeads(this.parseLimit(limit));
  }

  @Post('run-daily')
  runDailyOutreach(@Query('limit') limit?: string) {
    return this.outreachService.runDailyOutreach(this.parseLimit(limit));
  }

  private parseLimit(limit?: string): number | undefined {
    const parsed = Number(limit);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
}
