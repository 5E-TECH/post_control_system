import { Order_status } from 'src/common/enums';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateStatusDto {
  @IsNotEmpty()
  @IsIn([Order_status.SOLD, Order_status.CANCELLED])
  status: Order_status;

  @IsOptional()
  @IsString()
  comment: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraCost: number;
}
