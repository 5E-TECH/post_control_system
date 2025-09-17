import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Where_deliver } from 'src/common/enums';
import { OrderItems } from 'src/common/utils/types/order-item.type';

export class UpdateOrderDto {
  @ApiPropertyOptional({ enum: Where_deliver, example: 'CENTER', description: 'Updated delivery destination' })
  @IsOptional()
  @IsEnum(Where_deliver)
  where_deliver?: Where_deliver;

  @ApiPropertyOptional({ example: 42000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_price?: number;

  @ApiPropertyOptional({ example: 'Please call when you arrive' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  client_name?: string;

  @ApiPropertyOptional({ example: '+998901112233' })
  @IsOptional()
  @IsString()
  client_phone_number?: string;

  @ApiPropertyOptional({ example: '27, Elm street, Apt 4' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'd1b2c3a4-5678-90ab-cdef-1234567890ab' })
  @IsOptional()
  @IsString()
  district_id?: string;

  @ApiPropertyOptional({
    description: 'Updated order items',
    type: 'array',
    example: [
      { product_id: '11111111-2222-3333-4444-555555555555', quantity: 1, price: 15000 },
    ],
  })
  @IsOptional()
  @IsArray()
  order_item_info?: OrderItems[];
}
