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

// Kassadan investorga foyda taqsimoti to'lash.
export class PayInvestorDto {
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsUUID()
  investor_id: string;

  @ApiProperty({ type: Number, example: 5_000_000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsOptional()
  @IsIn([PaymentMethod.CASH, PaymentMethod.CLICK])
  type: PaymentMethod;

  @ApiPropertyOptional({ type: String, description: 'Karta (CLICK bo\'lsa)' })
  @IsOptional()
  @IsUUID()
  card_id?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  note?: string;
}
