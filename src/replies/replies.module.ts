import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';
import { LeadsModule } from '../leads/leads.module';
import { RepliesController } from './replies.controller';
import { RepliesService } from './replies.service';

@Module({
  imports: [AiModule, EmailModule, LeadsModule],
  controllers: [RepliesController],
  providers: [RepliesService],
})
export class RepliesModule {}
