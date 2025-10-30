import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Status } from 'src/common/enums';

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
  @IsNumber()
  @Min(0)
  tariff_home?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_center?: number;
}
