import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  Max,
} from 'class-validator';

export class TriggerMpesaStkDto {
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  /** Accepts 0712345678, 254712345678 or +254712345678. */
  @IsString()
  @Matches(/^(?:\+?254|0)[17]\d{8}$/, {
    message: 'phoneNumber must be a valid Kenyan M-Pesa number',
  })
  phoneNumber: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000)
  amountKES: number;
}
