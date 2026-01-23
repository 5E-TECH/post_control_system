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
  @IsOptional()
  @IsUUID(4, { message: 'Market ID noto\'g\'ri formatda' })
  market_id: string;

  @ApiProperty({
    description: 'ID of the customer for the order',
    type: String,
    format: 'uuid',
    example: '2c3f5b7a-1d9e-44f7-8a1b-0a1d2b3c4d5e',
  })
  @IsNotEmpty({ message: 'Mijoz ID kiritilishi shart' })
  @IsUUID(4, { message: 'Mijoz ID noto\'g\'ri formatda' })
  customer_id: string;

  @ApiProperty({
    description: 'Array of order items with product, quantity, price, etc.',
    type: 'array',
    example: [
      {
        product_id: '11111111-2222-3333-4444-555555555555',
        quantity: 2,
        price: 15000,
      },
      {
        product_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        quantity: 1,
        price: 23000,
      },
    ],
  })
  @IsNotEmpty({ message: 'Buyurtma mahsulotlari kiritilishi shart' })
  @IsArray({ message: 'Buyurtma mahsulotlari array formatda bo\'lishi kerak' })
  order_item_info: OrderItems[];

  @ApiProperty({ description: 'Total order price', example: 53000, minimum: 0 })
  @IsNotEmpty({ message: 'Jami narx kiritilishi shart' })
  @IsNumber({}, { message: 'Jami narx raqam bo\'lishi kerak' })
  @Min(0, { message: 'Jami narx 0 dan kichik bo\'lmasligi kerak' })
  total_price: number;

  @ApiPropertyOptional({
    description: 'Where to deliver the order',
    enum: Where_deliver,
    example: 'HOME',
  })
  @IsOptional()
  @IsEnum(Where_deliver)
  where_deliver: Where_deliver;

  @ApiPropertyOptional({
    description: 'Additional comment for the order',
    example: 'Please deliver after 6 PM',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Additional comment for the order',
    example: 'Please deliver after 6 PM',
  })
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiPropertyOptional({
    description: 'District ID for delivery address',
    type: String,
    format: 'uuid',
    example: '2c3f5b7a-1d9e-44f7-8a1b-0a1d2b3c4d5e',
  })
  @IsOptional()
  @IsUUID(4, { message: "Tuman ID noto'g'ri formatda" })
  district_id?: string;

  @ApiPropertyOptional({
    description: 'Delivery address',
    example: 'Navoiy ko\'chasi, 15-uy',
  })
  @IsOptional()
  @IsString()
  address?: string;
}
