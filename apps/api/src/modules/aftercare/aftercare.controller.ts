import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AftercareService, RecordCheckinDto } from './aftercare.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('17. Aftercare & Recovery')
@Controller('aftercare')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AftercareController {
  constructor(private readonly aftercareService: AftercareService) {}

  @Post('checkins')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.COUNSELLOR,
  )
  @AuditLog({ action: 'RECORD_AFTERCARE_CHECKIN', resource: 'AFTERCARE_CHECKIN' })
  @ApiOperation({ summary: 'Record milestone recovery check-in (Day 7, 14, 30, 60, 90)' })
  async recordCheckin(@Body() dto: RecordCheckinDto) {
    return this.aftercareService.recordCheckin(dto);
  }

  @Get('plans')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.COUNSELLOR,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List active aftercare and relapse prevention follow-ups' })
  async getPlans() {
    return this.aftercareService.getActivePlans();
  }
}
