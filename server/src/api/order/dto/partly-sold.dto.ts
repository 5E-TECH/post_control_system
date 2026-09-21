import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ExtraCostCategory } from 'src/common/enums';
import { PROOF_MAX_FILES } from 'src/api/extra-cost/proof-storage.const';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { OrderItems } from 'src/common/utils/types/order-item.type';

// Number formatini parse qilish uchun helper function
const parseFormattedNumber = (value: any): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    // "300,000" yoki "300 000" formatlarini to'g'ri parse qilish
    const cleaned = value.replace(/[^\d.-]/g, '');
    return cleaned ? Number(cleaned) : undefined;
  }
  return Number(value);
};

export class PartlySoldDto {
  @ApiProperty({
    description: 'Items sold partly with updated quantities and prices',
    type: 'array',
    example: [
      {
        product_id: '11111111-2222-3333-4444-555555555555',
        quantity: 1,
        price: 15000,
      },
    ],
  })
  @IsNotEmpty()
  @IsArray()
  order_item_info: OrderItems[];

  @ApiProperty({
    description: 'Total price for sold items',
    example: 15000,
    minimum: 0,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseFormattedNumber(value))
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiPropertyOptional({ description: 'Extra cost if any', example: 2000 })
  @IsOptional()
  @Transform(({ value }) => {
    const n = parseFormattedNumber(value);
    return n === undefined ? undefined : Math.trunc(n);
  })
  // ⚠️ `@IsInt` — kassa ustunlari `bigint`, kasr INSERT xatosi beradi.
  @IsInt({ message: "Qo'shimcha xarajat butun son bo'lishi kerak" })
  @Min(0)
  extraCost?: number;

  @ApiPropertyOptional({
    description: 'Reason or note',
    example: 'Customer bought only 1 unit',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  /** Isbot fayllarining id'lari — `sellCancel-order.dto.ts` bilan bir xil. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  // ⚠️ Qattiq raqam EMAS — chegara `proof-storage.const.ts` da. Ular
  // ajralib ketsa server 4-5-chi isbotni JIMGINA rad etardi.
  @ArrayMaxSize(PROOF_MAX_FILES)
  @IsUUID('4', { each: true })
  extra_cost_proof_ids?: string[];

  /** Xarajat sababi (yoki narx pasaytirish sababi). */
  @ApiPropertyOptional({ enum: ExtraCostCategory })
  @IsOptional()
  @IsEnum(ExtraCostCategory)
  extra_cost_category?: ExtraCostCategory;

  /** "Isbotsiz davom etish" — sotuv yiqilmasin (24 soat muhlat). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  extra_cost_proof_deferred?: boolean;
}
