import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('Audit & Compliance (KDPA 2019)')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.MEDICAL_DIRECTOR)
  @ApiOperation({ summary: 'Retrieve immutable audit trail (restricted to Administrators)' })
  async listLogs(
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getAuditLogs({ resource, action, actorId, limit });
  }
}
