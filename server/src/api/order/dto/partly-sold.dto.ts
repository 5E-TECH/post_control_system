import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
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
  @Transform(({ value }) => parseFormattedNumber(value))
  @IsNumber()
  @Min(0)
  extraCost?: number;

  @ApiPropertyOptional({
    description: 'Reason or note',
    example: 'Customer bought only 1 unit',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
