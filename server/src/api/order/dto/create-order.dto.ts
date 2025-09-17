import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Where_deliver } from 'src/common/enums';
import { OrderItems } from 'src/common/utils/types/order-item.type';

export class CreateOrderDto {
  @ApiProperty({
    description: 'ID of the market placing the order',
    type: String,
    format: 'uuid',
    example: '8b2c1a8e-3b6f-4a6e-9a2f-71d8a5c9d123',
  })
  @IsNotEmpty()
  @IsUUID()
  market_id: string;

  @ApiProperty({
    description: 'ID of the customer for the order',
    type: String,
    format: 'uuid',
    example: '2c3f5b7a-1d9e-44f7-8a1b-0a1d2b3c4d5e',
  })
  @IsNotEmpty()
  @IsUUID()
  customer_id: string;

  @ApiProperty({
    description: 'Array of order items with product, quantity, price, etc.',
    type: 'array',
    example: [
      { product_id: '11111111-2222-3333-4444-555555555555', quantity: 2, price: 15000 },
      { product_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', quantity: 1, price: 23000 },
    ],
  })
  @IsNotEmpty()
  @IsArray()
  order_item_info: OrderItems[];

  @ApiProperty({ description: 'Total order price', example: 53000, minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  total_price: number;

  @ApiPropertyOptional({
    description: 'Where to deliver the order',
    enum: Where_deliver,
    example: 'HOME',
  })
  @IsOptional()
  @IsEnum(Where_deliver)
  where_deliver: Where_deliver;

  @ApiPropertyOptional({ description: 'Additional comment for the order', example: 'Please deliver after 6 PM' })
  @IsOptional()
  @IsString()
  comment?: string;
}
