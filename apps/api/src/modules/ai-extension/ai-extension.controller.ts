import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  AiExtensionService,
  AiSummarizationContract,
  AiFollowUpSuggestionContract,
} from './ai-extension.service';
import { AiChatRequestDto, AiChatResponseDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('28. Calyvia AI Institutional Management Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-extension')
export class AiExtensionController {
  constructor(private readonly aiExtensionService: AiExtensionService) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Process queries for the institutional management copilot with live data grounding',
  })
  async chat(@Body() dto: AiChatRequestDto, @Req() req: any): Promise<AiChatResponseDto> {
    const user = req?.user;
    if (!user?.id || !user?.role) {
      throw new UnauthorizedException('A verified Calyvia session is required for AI assistance.');
    }
    return this.aiExtensionService.processChat(dto, user);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check AI assistant readiness and status' })
  async getStatus() {
    return {
      status: 'ONLINE',
      system: 'Calyvia Institutional Management Copilot',
      database: 'Supabase PostgreSQL Pooler Active',
      compliance: 'KDPA 2019 Compliant',
      version: '1.1.0',
      authentication: 'JWT required',
    };
  }

  @Post('summaries/patient-record')
  @ApiOperation({ summary: 'Extension point: patient clinical record summary interface' })
  async summarizePatient(@Body() contract: AiSummarizationContract) {
    return this.aiExtensionService.generatePatientRecordSummary(contract);
  }

  @Post('recommendations/follow-up')
  @ApiOperation({ summary: 'Extension point: recovery follow-up suggestion interface' })
  async suggestFollowUp(@Body() contract: AiFollowUpSuggestionContract) {
    return this.aiExtensionService.getFollowUpSuggestions(contract);
  }
}
