import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralsService, CreateReferralPartnerDto } from './referrals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('19. Referral Management')
@Controller('referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post('partners')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.ADMISSIONS_FRONT_DESK)
  @AuditLog({ action: 'REGISTER_REFERRAL_PARTNER', resource: 'REFERRAL' })
  @ApiOperation({ summary: 'Register medical or community referral partner' })
  async createPartner(@Body() dto: CreateReferralPartnerDto) {
    return this.referralsService.createPartner(dto);
  }

  @Get('partners')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List all referral partner organizations and lead conversion stats' })
  async getPartners() {
    return this.referralsService.getPartners();
  }
}
