import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, PatientStatus } from '@calyvia/shared';

export class CreatePatientDto {
  @ApiProperty({ example: 'James' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Mwangi' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({ example: 'Jimmy' })
  @IsString()
  @IsOptional()
  preferredName?: string;

  @ApiPropertyOptional({ example: '28471930' })
  @IsString()
  @IsOptional()
  nationalIdNumber?: string;

  @ApiProperty({ example: '1990-05-14' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: '+254712345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'j.mwangi@example.ke' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'Kiambu' })
  @IsString()
  @IsNotEmpty()
  county!: string;

  @ApiProperty({ example: 'Ruiru Kimbo, near Spur Mall' })
  @IsString()
  @IsNotEmpty()
  residentialAddress!: string;

  @ApiPropertyOptional({ example: 'O+' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ example: 'Penicillin, Aspirin' })
  @IsString()
  @IsOptional()
  knownAllergies?: string;

  @ApiPropertyOptional({ example: 'Alcohol (12 units daily, 8 years)' })
  @IsString()
  @IsOptional()
  substanceHistory?: string;

  @ApiPropertyOptional({ example: 'Mary Wanjiku', description: 'Parent or guardian responsible for the client' })
  @IsString()
  @IsOptional()
  guardianName?: string;

  @ApiPropertyOptional({ example: '0712345678', description: 'Guardian number that receives SMS updates' })
  @IsString()
  @IsOptional()
  guardianPhone?: string;

  @ApiPropertyOptional({ example: '0712345678', description: 'Guardian number that receives WhatsApp updates' })
  @IsString()
  @IsOptional()
  guardianWhatsApp?: string;

  @ApiPropertyOptional({ example: 'mary@example.co.ke' })
  @IsEmail()
  @IsOptional()
  guardianEmail?: string;
}

/** Base64 JSON upload so private Supabase storage stays server-side only. */
export class UploadPatientPhotoDto {
  @ApiProperty({ example: 'passport.jpg' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ description: 'Base64-encoded image bytes (data URL prefix is accepted)' })
  @IsString()
  @IsNotEmpty()
  dataBase64!: string;
}

export class UpdatePatientDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  preferredName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  residentialAddress?: string;

  @ApiPropertyOptional({ enum: PatientStatus })
  @IsEnum(PatientStatus)
  @IsOptional()
  status?: PatientStatus;
}
