import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { CardMovementType } from 'src/common/enums';

export class CreateCardDto {
  @ApiProperty({ type: String, example: 'Humo 8600' })
  @IsNotEmpty({ message: 'Karta nomi majburiy' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ type: Number, example: 0 })
  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class RenameCardDto {
  @ApiProperty({ type: String, example: 'Uzcard 5614' })
  @IsNotEmpty({ message: 'Karta nomi majburiy' })
  @IsString()
  name: string;
}

export class SetCardActiveDto {
  @ApiProperty({ type: Boolean, example: false })
  @IsNotEmpty()
  is_active: boolean;
}

export class TransferCardDto {
  @ApiProperty({ type: String, description: 'Manba karta ID' })
  @IsNotEmpty()
  @IsUUID()
  from_card_id: string;

  @ApiProperty({ type: String, description: 'Maqsad karta ID' })
  @IsNotEmpty()
  @IsUUID()
  to_card_id: string;

  @ApiProperty({ type: Number, example: 500_000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ type: String, description: 'Sabab (majburiy)' })
  @IsNotEmpty({ message: "O'tkazma uchun izoh (sabab) majburiy" })
  @IsString()
  comment: string;
}

export class ConvertCardDto {
  @ApiProperty({
    enum: [CardMovementType.CARD_TO_CASH, CardMovementType.CASH_TO_CARD],
    example: CardMovementType.CARD_TO_CASH,
    description: 'Konvertatsiya yo‘nalishi (faqat karta↔naqd)',
  })
  @IsEnum(CardMovementType, { message: "type noto'g'ri qiymatga ega" })
  type: CardMovementType;

  @ApiProperty({ type: String, description: 'Karta ID' })
  @IsNotEmpty()
  @IsUUID()
  card_id: string;

  @ApiProperty({ type: Number, example: 500_000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ type: String, description: 'Sabab (majburiy)' })
  @IsNotEmpty({ message: 'Konvertatsiya uchun izoh (sabab) majburiy' })
  @IsString()
  comment: string;
}
