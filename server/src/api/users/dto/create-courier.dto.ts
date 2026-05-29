import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Super kuryerga biriktiriladigan viloyat + (ixtiyoriy) per-region tarif.
 * Tarif berilmasa, kuryerning umumiy `tariff_home`/`tariff_center` (flat) ishlatiladi.
 */
export class CourierRegionInputDto {
  @ApiProperty({ example: 'f3b2c1d4-5678-90ab-cdef-1234567890ab' })
  @IsString()
  region_id: string;

  @ApiProperty({ required: false, example: 12000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_home?: number;

  @ApiProperty({ required: false, example: 9000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_center?: number;
}

export class CreateCourierDto {
  @ApiProperty({
    description: 'Region ID (oddiy kuryer uchun majburiy, super kuryer uchun ixtiyoriy)',
    example: 'f3b2c1d4-5678-90ab-cdef-1234567890ab',
    required: false,
  })
  @IsOptional()
  @IsString()
  region_id?: string;

  @ApiProperty({ example: 'Akmal Abdullaev' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @ApiProperty({ example: 'secret123' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ example: 10000, minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_home: number;

  @ApiProperty({ example: 8000, minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_center: number;

  // ===== SUPER KURYER (multi-region) =====

  @ApiProperty({
    required: false,
    description: 'Super kuryer — bir nechta viloyatga xizmat qiladi',
  })
  @IsOptional()
  @IsBoolean()
  is_super_courier?: boolean;

  @ApiProperty({
    required: false,
    description: 'Barcha viloyatlarga xizmat qiladi (LDG kabi)',
  })
  @IsOptional()
  @IsBoolean()
  serves_all_regions?: boolean;

  @ApiProperty({
    required: false,
    type: [CourierRegionInputDto],
    description: 'Super kuryerga biriktiriladigan viloyatlar (per-region tarif bilan)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourierRegionInputDto)
  regions?: CourierRegionInputDto[];
}
