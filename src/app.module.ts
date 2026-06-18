import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { EmailModule } from './email/email.module';
import { LeadsModule } from './leads/leads.module';
import { OutreachModule } from './outreach/outreach.module';
import { RepliesModule } from './replies/replies.module';

@Module({
  imports: [AiModule, EmailModule, LeadsModule, OutreachModule, RepliesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
