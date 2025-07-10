import { IsArray, IsEnum, IsNotEmpty, ArrayNotEmpty } from 'class-validator';
import { Order_status } from 'src/common/enums';

export class UpdateManyStatusesDto {
  @IsArray()
  @ArrayNotEmpty()
  order_ids: string[];

  @IsNotEmpty()
  @IsEnum(Order_status)
  status: Order_status;
}
