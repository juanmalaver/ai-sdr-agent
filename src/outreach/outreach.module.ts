import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';
import { LeadsModule } from '../leads/leads.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';

@Module({
  imports: [AiModule, EmailModule, LeadsModule],
  controllers: [OutreachController],
  providers: [OutreachService],
})
export class OutreachModule {}
