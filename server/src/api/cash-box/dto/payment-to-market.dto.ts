import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentMethod } from 'src/common/enums';

export class PaymentsToMarketDto {
  @ApiProperty({
    type: String,
  })
  @IsNotEmpty()
  @IsUUID()
  market_id: string;

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

  @ApiPropertyOptional({
    type: String,
  })
  @IsOptional()
  @IsString()
  payment_date?: string;

  @ApiPropertyOptional({
    type: String,
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Kartali (click) to‘lovda qaysi virtual kartadan. Bo‘sh bo‘lsa default karta.',
  })
  @IsOptional()
  @IsUUID()
  card_id?: string;
}
