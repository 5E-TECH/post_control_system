import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AddOrder, Status } from 'src/common/enums';

export class UpdateMarketDto {
  @IsOptional()
  @IsString()
  market_name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsEnum(AddOrder)
  add_order?: AddOrder;
}
