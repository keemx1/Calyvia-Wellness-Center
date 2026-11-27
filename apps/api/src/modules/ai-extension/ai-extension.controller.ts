import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  AiExtensionService,
  AiSummarizationContract,
  AiFollowUpSuggestionContract,
} from './ai-extension.service';
import { AiChatRequestDto, AiChatResponseDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { canAccessModule, UserRole } from '@calyvia/shared';

@ApiTags('28. Calyvia AI Institutional Management Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...Object.values(UserRole))
@Controller('ai-extension')
export class AiExtensionController {
  constructor(private readonly aiExtensionService: AiExtensionService) {}

  private assertAiAccess(user: any) {
    if (!user?.id || !user?.role) {
      throw new UnauthorizedException('A verified Calyvia session is required for AI assistance.');
    }
    if (!canAccessModule(user.role, 'ai_extension')) {
      throw new ForbiddenException(`Access denied for role ${user.role}. The AI module is not available to this role.`);
    }
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Process queries for the institutional management copilot with live data grounding',
  })
  async chat(@Body() dto: AiChatRequestDto, @Req() req: any): Promise<AiChatResponseDto> {
    const user = req?.user;
    this.assertAiAccess(user);
    return this.aiExtensionService.processChat(dto, user);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check AI assistant readiness and status' })
  async getStatus(@Req() req: any) {
    this.assertAiAccess(req?.user);
    const extensionsEnabled = process.env.ENABLE_AI_EXTENSIONS === 'true';
    return {
      status: 'ONLINE',
      system: 'Calyvia Institutional Management Copilot',
      dataGrounding: 'Live database reads through role-scoped institutional tools',
      compliance: 'NOT_VERIFIED',
      version: '1.1.0',
      authentication: 'JWT required; ai_extension module role required',
      extensions: extensionsEnabled ? 'ENABLED' : 'DISABLED',
    };
  }

  @Post('summaries/patient-record')
  @ApiOperation({ summary: 'Extension point: patient clinical record summary interface' })
  async summarizePatient(@Body() contract: AiSummarizationContract, @Req() req: any) {
    this.assertAiAccess(req?.user);
    return this.aiExtensionService.generatePatientRecordSummary(contract);
  }

  @Post('recommendations/follow-up')
  @ApiOperation({ summary: 'Extension point: recovery follow-up suggestion interface' })
  async suggestFollowUp(@Body() contract: AiFollowUpSuggestionContract, @Req() req: any) {
    this.assertAiAccess(req?.user);
    return this.aiExtensionService.getFollowUpSuggestions(contract);
  }
}
