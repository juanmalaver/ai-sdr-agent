import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LeadsController],
  providers: [LeadsRepository, LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
