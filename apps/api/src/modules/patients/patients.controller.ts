import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  UploadPatientPhotoDto,
} from './dto/patient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('01. Patient Management')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.MEDICAL_DIRECTOR,
  )
  @AuditLog({ action: 'REGISTER_NEW_PATIENT', resource: 'PATIENT' })
  @ApiOperation({ summary: 'Register a new patient into Calyvia Master Patient Index' })
  @ApiResponse({ status: 201, description: 'Patient registered successfully' })
  async create(@Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(createPatientDto);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.COUNSELLOR,
    UserRole.PHARMACIST,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.FINANCE_BILLING,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @AuditLog({ action: 'LIST_PATIENTS', resource: 'PATIENT' })
  @ApiOperation({ summary: 'Retrieve patient directory with filtering' })
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.patientsService.findAll({ search, status, limit });
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.COUNSELLOR,
    UserRole.PHARMACIST,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.FINANCE_BILLING,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @AuditLog({ action: 'VIEW_PATIENT_CHART', resource: 'PATIENT' })
  @ApiOperation({ summary: 'Get full clinical and demographic patient details by UUID' })
  async findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Get(':id/photos')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.COUNSELLOR,
    UserRole.PHARMACIST,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.FINANCE_BILLING,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @AuditLog({ action: 'VIEW_PATIENT_PHOTOS', resource: 'PATIENT' })
  @ApiOperation({ summary: 'List patient passport photos as time-limited signed URLs' })
  async listPhotos(@Param('id') id: string) {
    return this.patientsService.listPatientPhotos(id);
  }

  @Post(':id/photos')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
  )
  @AuditLog({ action: 'UPLOAD_PATIENT_PHOTO', resource: 'PATIENT' })
  @ApiOperation({ summary: 'Store a patient passport photo in private Supabase storage' })
  async uploadPhoto(@Param('id') id: string, @Body() dto: UploadPatientPhotoDto) {
    return this.patientsService.uploadPatientPhoto(id, dto);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.MEDICAL_DIRECTOR,
  )
  @AuditLog({ action: 'UPDATE_PATIENT_DETAILS', resource: 'PATIENT' })
  @ApiOperation({ summary: 'Update patient demographic or contact details' })
  async update(@Param('id') id: string, @Body() updateDto: UpdatePatientDto) {
    return this.patientsService.update(id, updateDto);
  }
}
