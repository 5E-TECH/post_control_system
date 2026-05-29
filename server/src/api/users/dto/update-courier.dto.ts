import { Status } from 'src/common/enums';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CourierRegionInputDto } from './create-courier.dto';

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

  // ===== SUPER KURYER (multi-region) =====

  @IsOptional()
  @IsBoolean()
  is_super_courier?: boolean;

  @IsOptional()
  @IsBoolean()
  serves_all_regions?: boolean;

  // Berilsa — kuryerning viloyatlar ro'yxati to'liq shu bilan almashtiriladi
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourierRegionInputDto)
  regions?: CourierRegionInputDto[];
}
