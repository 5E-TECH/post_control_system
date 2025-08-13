import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Where_deliver } from 'src/common/enums';
import { OrderItems } from 'src/common/utils/types/order-item.type';

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
  address?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
