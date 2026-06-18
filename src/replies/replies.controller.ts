import { Body, Controller, Post } from '@nestjs/common';
import { RepliesService } from './replies.service';

interface ClassifyReplyDto {
  text?: string;
}

interface TriageReplyDto {
  leadId?: string;
  fromEmail?: string;
  text?: string;
}

@Controller('replies')
export class RepliesController {
  constructor(private readonly repliesService: RepliesService) {}

  @Post('classify')
  classifyReply(@Body() dto: ClassifyReplyDto) {
    return this.repliesService.classifyReply(dto.text ?? '');
  }

  @Post('triage')
  triageReply(@Body() dto: TriageReplyDto) {
    return this.repliesService.triageReply(dto);
  }
}
