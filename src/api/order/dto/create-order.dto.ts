import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Where_deliver } from 'src/common/enums';
import { OrderItems } from 'src/common/utils/order-item.type';

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  market_id: string;

  @IsNotEmpty()
  @IsUUID()
  district_id: string;

  @IsNotEmpty()
  @IsString()
  client_name: string;

  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  client_phone_number: string;

  @IsOptional()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  comment: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  total_price: number;

  @IsOptional()
  @IsEnum(Where_deliver)
  where_deliver: Where_deliver;

  @IsNotEmpty()
  @IsObject()
  order_item_info: OrderItems[];
}
