import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { CreateLeadDto, UpdateLeadStatusDto, CreateAdmissionDto } from './dto/crm.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('02. CRM & Admissions')
@Controller('crm')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post('leads')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.ADMISSIONS_FRONT_DESK)
  @AuditLog({ action: 'CREATE_CRM_LEAD', resource: 'LEAD' })
  @ApiOperation({ summary: 'Log a new client enquiry / recovery lead' })
  async createLead(@Body() dto: CreateLeadDto) {
    return this.crmService.createLead(dto);
  }

  @Get('leads')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.ADMISSIONS_FRONT_DESK, UserRole.MANAGEMENT_EXECUTIVE)
  @ApiOperation({ summary: 'List admissions leads pipeline' })
  async getLeads(@Query('status') status?: string) {
    return this.crmService.getLeads(status);
  }

  @Patch('leads/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.ADMISSIONS_FRONT_DESK)
  @AuditLog({ action: 'UPDATE_LEAD_STATUS', resource: 'LEAD' })
  @ApiOperation({ summary: 'Update lead pipeline stage' })
  async updateLeadStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.crmService.updateLeadStatus(id, dto);
  }

  @Post('admissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.ADMISSIONS_FRONT_DESK, UserRole.MEDICAL_DIRECTOR)
  @AuditLog({ action: 'PROCESS_PATIENT_ADMISSION', resource: 'ADMISSION' })
  @ApiOperation({ summary: 'Process formal admission of a patient into detox or rehabilitation' })
  async processAdmission(
    @Body() dto: CreateAdmissionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.crmService.processAdmission(dto, userId);
  }

  @Get('admissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.ADMISSIONS_FRONT_DESK, UserRole.MEDICAL_DIRECTOR, UserRole.DOCTOR_PSYCHIATRIST, UserRole.NURSE, UserRole.COUNSELLOR, UserRole.MANAGEMENT_EXECUTIVE)
  @ApiOperation({ summary: 'Get list of active and past admissions' })
  async getAdmissions() {
    return this.crmService.getAdmissions();
  }
}
