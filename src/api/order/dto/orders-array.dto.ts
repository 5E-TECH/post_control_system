import { IsArray, ArrayNotEmpty } from 'class-validator';

export class OrdersArrayDto {
  @ArrayNotEmpty()
  @IsArray()
  order_ids: string[];

  // @IsNotEmpty()
  // @IsEnum(Order_status)
  // status: Order_status;
}
