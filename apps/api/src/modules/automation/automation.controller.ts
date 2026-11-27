import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('27. Automation (Manual Evaluation Endpoints)')
@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('jobs/vitals-monitor')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @ApiOperation({ summary: 'Manually trigger detox vitals overdue background monitoring job' })
  async triggerVitalsJob() {
    return this.automationService.triggerScheduledVitalsAlerts();
  }

  @Post('jobs/aftercare-cadence')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @ApiOperation({ summary: 'Manually trigger aftercare follow-up dispatch cadence' })
  async triggerAftercareJob() {
    return this.automationService.triggerAftercareCadenceDispatches();
  }
}
