import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateCashBoxDto {
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
    example: 'Xodimlar kechki ovqati uchun',
  })
  @IsNotEmpty({ message: 'Izoh kiritish majburiy' })
  @IsString()
  comment: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Kartali (click) operatsiyada qaysi virtual kartaga. Bo‘sh bo‘lsa default karta.',
  })
  @IsOptional()
  @IsUUID()
  card_id?: string;
}
