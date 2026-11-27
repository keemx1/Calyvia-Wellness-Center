import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CmsPostStatus, CmsPostType } from '@calyvia/shared';

export class CmsBlockDto {
  @IsIn(['heading', 'paragraph', 'list', 'quote'])
  type: 'heading' | 'paragraph' | 'list' | 'quote';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  items?: string[];
}

export class CreateCmsPostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @IsEnum(CmsPostType)
  type: CmsPostType;

  @IsOptional()
  @IsEnum(CmsPostStatus)
  status?: CmsPostStatus;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers and single hyphens',
  })
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CmsBlockDto)
  content?: CmsBlockDto[];

  @IsOptional()
  @Matches(/^https:\/\//i, { message: 'coverImageUrl must be an https URL' })
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  embedUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  employmentType?: string;

  @IsOptional()
  @IsEmail()
  applicationEmail?: string;

  @IsOptional()
  @Matches(/^https:\/\//i, { message: 'applicationUrl must be an https URL' })
  @MaxLength(500)
  applicationUrl?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdateCmsPostDto extends PartialType(CreateCmsPostDto) {
  @ApiPropertyOptional({ enum: CmsPostStatus })
  declare status?: CmsPostStatus;
}
