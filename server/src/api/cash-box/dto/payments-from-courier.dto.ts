import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaymentMethod } from 'src/common/enums';

export class CreatePaymentsFromCourierDto {
  @ApiProperty({
    type: String,
  })
  @IsNotEmpty()
  @IsUUID()
  courier_id: string;

  @ApiProperty({
    type: Number,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod, { message: "payment_method noto'g'ri qiymatga ega" })
  payment_method: PaymentMethod;

  @ApiProperty({
    type: String,
  })
  @IsOptional()
  @IsString()
  payment_date: string;

  @ApiPropertyOptional({
    type: String,
  })
  @IsOptional()
  @IsString()
  comment: string;

  @ApiPropertyOptional({
    type: String,
  })
  @IsOptional()
  @IsString()
  market_id: string;
}
