import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Where_deliver } from 'src/common/enums';
import { OrderItems } from 'src/common/utils/order-item.type';

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(Where_deliver)
  where_deliver?: Where_deliver;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_price?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  district_id?: string;

  @IsOptional()
  @IsObject()
  order_item_info?: OrderItems[];
}
