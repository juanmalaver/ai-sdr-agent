import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { LeadStatus } from './lead-status.enum';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  listLeads() {
    return this.leadsService.listLeads();
  }

  @Post('import')
  importLeads(@Body() dto: ImportLeadsDto) {
    return this.leadsService.importLeads(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: LeadStatus) {
    return this.leadsService.updateStatus(id, status);
  }
}
