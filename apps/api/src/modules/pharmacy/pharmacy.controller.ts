import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmacyService, CreatePrescriptionDto, AdministerMedicationDto } from './pharmacy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('08. Pharmacy & Medication (e-MAR)')
@Controller('pharmacy')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get('medications')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PHARMACIST,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.MEDICAL_DIRECTOR,
  )
  @ApiOperation({ summary: 'List medications in formulary with current stock and alert levels' })
  async getMedications() {
    return this.pharmacyService.getMedications();
  }

  @Get('patient/:patientId/medications')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PHARMACIST,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.FINANCE_BILLING,
  )
  @ApiOperation({ summary: 'List medications and prescriptions for one patient' })
  async getPatientMedications(@Param('patientId') patientId: string) {
    return this.pharmacyService.getPatientMedications(patientId);
  }

  @Post('prescriptions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MEDICAL_DIRECTOR, UserRole.DOCTOR_PSYCHIATRIST)
  @AuditLog({ action: 'CREATE_PRESCRIPTION', resource: 'PRESCRIPTION' })
  @ApiOperation({ summary: 'Issue electronic prescription for inpatient or detox protocol' })
  async createPrescription(@Body() dto: CreatePrescriptionDto) {
    return this.pharmacyService.createPrescription(dto);
  }

  @Post('mar/administer')
  @Roles(UserRole.SUPER_ADMIN, UserRole.NURSE, UserRole.MEDICAL_DIRECTOR)
  @AuditLog({ action: 'ADMINISTER_MEDICATION_MAR', resource: 'MEDICATION_ADMINISTRATION' })
  @ApiOperation({ summary: 'Record medication administration on e-MAR chart' })
  async administerMedication(@Body() dto: AdministerMedicationDto) {
    return this.pharmacyService.administerMedication(dto);
  }
}
