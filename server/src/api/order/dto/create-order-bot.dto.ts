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

export class CreateOrderByBotDto {
  // User yaratish uchun
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @IsNotEmpty()
  @IsUUID()
  district_id: string;

  @IsOptional()
  @IsString()
  extra_number?: string;

  @IsOptional()
  @IsString()
  address?: string;

  // Order yaratish uchun
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

  @IsOptional()
  @IsString()
  operator?: string;
}
