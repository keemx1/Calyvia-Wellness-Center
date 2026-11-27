import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService, CreateConsentDto } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('15. Documents & Forms')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('consents')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.COUNSELLOR,
    UserRole.ADMISSIONS_FRONT_DESK,
  )
  @AuditLog({ action: 'SIGN_CONSENT_FORM', resource: 'CONSENT' })
  @ApiOperation({ summary: 'Record digital signature on admission or KDPA data consent' })
  async createConsent(@Body() dto: CreateConsentDto) {
    return this.documentsService.createConsent(dto);
  }

  @Get('patient/:patientId/consents')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.COUNSELLOR,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @ApiOperation({ summary: 'Retrieve signed legal consents and clinical agreements for a patient' })
  async getConsents(@Param('patientId') patientId: string) {
    return this.documentsService.getConsents(patientId);
  }
}
