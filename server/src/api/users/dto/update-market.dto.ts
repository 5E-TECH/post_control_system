import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Status, Where_deliver } from 'src/common/enums';

export class UpdateMarketDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsBoolean()
  add_order?: boolean;

  @IsOptional()
  @IsBoolean()
  require_operator_phone?: boolean;

  @IsOptional()
  @IsString()
  default_operator_phone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_home?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_center?: number;

  @IsOptional()
  @IsEnum(Where_deliver, {
    message: 'default_tariff must be either center or address',
  })
  default_tariff?: Where_deliver;
}
