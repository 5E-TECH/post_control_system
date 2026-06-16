import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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
  @Min(1, { message: "To'lov summasi 0 dan katta bo'lishi kerak" })
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

  @ApiPropertyOptional({
    type: String,
    description:
      'Click usulida qaysi virtual kartaga. Bo‘sh bo‘lsa default karta. Click_to_market doim default karta orqali o‘tadi.',
  })
  @IsOptional()
  @IsUUID()
  card_id?: string;
}
