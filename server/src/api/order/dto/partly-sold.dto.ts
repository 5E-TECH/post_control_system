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
import { OrderItems } from 'src/common/utils/types/order-item.type';

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
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiPropertyOptional({ description: 'Extra cost if any', example: 2000 })
  @IsOptional()
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
