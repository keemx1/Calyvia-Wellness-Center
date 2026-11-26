import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionType, ProgramType } from '@calyvia/shared';

export class CreateLeadDto {
  @ApiProperty({ example: 'John Kamau' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: '+254722998877' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'j.kamau@example.ke' })
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'WEBSITE_FORM' })
  @IsString()
  channel!: string;

  @ApiPropertyOptional({ example: 'Alcohol, Cannabis' })
  @IsOptional()
  substancesUsed?: string;

  @ApiPropertyOptional({ example: 'URGENT' })
  @IsOptional()
  urgencyLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  notes?: string;
}

export class UpdateLeadStatusDto {
  @ApiProperty({ example: 'CONTACTED' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  notes?: string;
}

export class CreateAdmissionDto {
  @ApiProperty({ example: 'uuid-patient-id' })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ enum: AdmissionType, example: AdmissionType.VOLUNTARY })
  @IsEnum(AdmissionType)
  admissionType!: AdmissionType;

  @ApiProperty({ enum: ProgramType, example: ProgramType.REHAB_30_DAYS })
  @IsEnum(ProgramType)
  programType!: ProgramType;

  @ApiProperty({ example: 'Alcohol dependence syndrome, severe (F10.2)' })
  @IsString()
  @IsNotEmpty()
  primaryDiagnosis!: string;

  @ApiPropertyOptional({ example: 'Dr. Kevin Kiprotich' })
  @IsOptional()
  @IsString()
  referringDoctor?: string;

  /**
   * @deprecated Kept for compatibility with older clients; maps to
   * referring_doctor when provided. The admitting clinician is taken from the
   * authenticated user by the controller.
   */
  @ApiPropertyOptional({ example: 'Dr. Kevin Kiprotich' })
  @IsOptional()
  @IsString()
  admittingDoctorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryCounsellorName?: string;

  @ApiPropertyOptional({
    description:
      'Authenticated user id is used when omitted (set by the controller).',
  })
  @IsOptional()
  @IsString()
  admittingStaffId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  admissionDate?: string;
}
