import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { LeadStatus } from './lead-status.enum';
import { LeadsService, UploadedCsvFile } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async listLeads() {
    return this.leadsService.listLeads();
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  async importLeads(@Body() dto: ImportLeadsDto, @UploadedFile() file?: UploadedCsvFile) {
    if (file) {
      return this.leadsService.importLeadCsv(file);
    }

    return this.leadsService.importLeads(dto);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: LeadStatus) {
    return this.leadsService.updateStatus(id, status);
  }
}
