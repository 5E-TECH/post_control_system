import { Status } from 'src/common/enums';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCourierDto {
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
  @IsNumber()
  @Min(0)
  tariff_home?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_center?: number;

  @IsOptional()
  @IsString()
  region_id?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
