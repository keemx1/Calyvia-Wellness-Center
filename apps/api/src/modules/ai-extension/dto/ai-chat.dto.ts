import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AiChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsIn(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timestamp?: string;
}

export class AiChatRequestDto {
  @ApiProperty({ description: 'The user question or request for the institutional copilot' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ type: [AiChatMessageDto], description: 'Recent conversation history for conversational context' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  conversationHistory?: AiChatMessageDto[];

  @ApiPropertyOptional({ description: 'The active module context if initiated from a specific screen' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contextModule?: string;
}

export class AiChatResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  reply: string;

  @ApiProperty({ type: [String] })
  suggestedFollowUps: string[];

  @ApiProperty({ type: [String] })
  referencedModules: string[];

  @ApiProperty()
  timestamp: string;

  @ApiPropertyOptional()
  meta?: {
    modelUsed: string;
    toolsExecuted: string[];
    roleAuthorized: string;
    contextModule?: string | null;
    generatedAt?: string;
    groundedInLiveData?: boolean;
    intent?: string;
    confidence?: number;
  };
}
