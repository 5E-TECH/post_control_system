import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Manual_payment_methods } from 'src/common/enums';

export class UpdateCashBoxDto {
  @ApiProperty({
    type: Number,
    example: 1_000_000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  balance: number;

  @ApiProperty({
    enum: Manual_payment_methods,
    example: Manual_payment_methods.CASH,
  })
  @IsNotEmpty()
  @IsIn(Object.values(Manual_payment_methods))
  type: Manual_payment_methods;

  @ApiProperty({
    type: String,
    example: 'Xodimlar kechki ovqati uchun',
  })
  @IsOptional()
  @IsString()
  comment: string;
}
