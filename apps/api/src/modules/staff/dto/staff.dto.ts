import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@calyvia/shared';

export class CreateStaffAccountDto {
  @ApiProperty({ example: 'Nurse Grace Muthoni' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @ApiProperty({ example: 'grace.muthoni@calyviawellness.co.ke' })
  @IsEmail({}, { message: 'A valid institutional email address is required' })
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: '+254712345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Inpatient Nursing' })
  @IsString()
  @IsNotEmpty({ message: 'Department is required' })
  department!: string;

  @ApiProperty({ example: 'Senior Nursing Officer' })
  @IsString()
  @IsNotEmpty({ message: 'Job title is required' })
  jobTitle!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.NURSE })
  @IsEnum(UserRole, { message: 'A valid institutional system role must be selected' })
  @IsNotEmpty()
  role!: UserRole;

  @ApiProperty({ example: 'Calyvia#2026', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Initial provisioned password must be at least 8 characters' })
  initialPassword!: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['ACTIVE', 'SUSPENDED'] })
  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;

  @ApiPropertyOptional({ example: 'NCK/RN/2024/8892' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Nursing Council of Kenya' })
  @IsString()
  @IsOptional()
  licenseBoard?: string;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsString()
  @IsOptional()
  licenseExpiryDate?: string;
}

export class UpdateStaffAccountDto {
  @ApiPropertyOptional({ example: 'Dr. Faith Mwangi' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '+254722000000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Psychiatry & Detox' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ example: 'Consultant Psychiatrist' })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] })
  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

  @ApiPropertyOptional({ example: 'KMPDC/A/9941' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Kenya Medical Practitioners and Dentists Council' })
  @IsString()
  @IsOptional()
  licenseBoard?: string;

  @ApiPropertyOptional({ example: '2027-06-30' })
  @IsString()
  @IsOptional()
  licenseExpiryDate?: string;
}

export class ResetStaffPasswordDto {
  @ApiProperty({ example: 'NewTemporary#2026', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters in length' })
  newPassword!: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;
}

export class UpdateStaffStatusDto {
  @ApiProperty({ example: 'SUSPENDED', enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] })
  @IsString()
  @IsNotEmpty()
  status!: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

  @ApiPropertyOptional({ example: 'Temporary administrative leave pending license renewal' })
  @IsString()
  @IsOptional()
  reason?: string;
}
