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
import { Where_deliver } from 'src/common/enums';
import { OrderItems } from 'src/common/utils/types/order-item.type';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  market_id: string;

  @IsNotEmpty()
  @IsUUID()
  customer_id: string;

  @IsNotEmpty()
  @IsNotEmpty()
  @IsArray()
  order_item_info: OrderItems[];

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  total_price: number;

  @IsOptional()
  @IsEnum(Where_deliver)
  where_deliver: Where_deliver;

  @IsOptional()
  @IsString()
  comment?: string;
}
