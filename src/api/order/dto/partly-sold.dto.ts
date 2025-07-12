import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { OrderItems } from 'src/common/utils/order-item.type';

export class PartlySoldDto {
  @IsNotEmpty()
  @IsObject()
  order_item_info: OrderItems[];

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraCost?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
