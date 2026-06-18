import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';
import { LeadsModule } from '../leads/leads.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';
import { SchedulerSecretGuard } from './scheduler-secret.guard';

@Module({
  imports: [AiModule, EmailModule, LeadsModule],
  controllers: [OutreachController],
  providers: [OutreachService, SchedulerSecretGuard],
})
export class OutreachModule {}
