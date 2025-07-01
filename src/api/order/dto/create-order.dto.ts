import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
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

  @IsNotEmpty()
  @IsObject()
  order_item_info: OrderItems[];
}
