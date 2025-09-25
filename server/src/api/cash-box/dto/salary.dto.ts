import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentMethod } from 'src/common/enums';

export class SalaryDto {
  @ApiProperty({
    type: String,
  })
  @IsNotEmpty()
  @IsUUID()
  user_id: string;

  @ApiProperty({
    type: Number,
    example: 1_000_000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsOptional()
  @IsIn(Object.values([PaymentMethod.CASH, PaymentMethod.CLICK]))
  type: PaymentMethod;

  @ApiProperty({
    type: String,
    example: 'Avans berildi',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
