import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FieldMappingDto {
  @ApiPropertyOptional({ description: 'Tashqi ID field nomi', default: 'id' })
  @IsOptional()
  @IsString()
  id_field?: string;

  @ApiPropertyOptional({
    description: 'QR kod field nomi',
    default: 'qrCode',
  })
  @IsOptional()
  @IsString()
  qr_code_field?: string;

  @ApiPropertyOptional({
    description: 'Mijoz ismi field nomi',
    default: 'full_name',
  })
  @IsOptional()
  @IsString()
  customer_name_field?: string;

  @ApiPropertyOptional({
    description: 'Telefon raqam field nomi',
    default: 'phone',
  })
  @IsOptional()
  @IsString()
  phone_field?: string;

  @ApiPropertyOptional({
    description: "Qo'shimcha telefon field nomi",
    default: 'additional_phone',
  })
  @IsOptional()
  @IsString()
  extra_phone_field?: string;

  @ApiPropertyOptional({
    description: 'Viloyat kodi field nomi',
    default: 'region',
  })
  @IsOptional()
  @IsString()
  region_code_field?: string;

  @ApiPropertyOptional({
    description: 'Tuman kodi field nomi',
    default: 'district',
  })
  @IsOptional()
  @IsString()
  district_code_field?: string;

  @ApiPropertyOptional({ description: 'Manzil field nomi', default: 'address' })
  @IsOptional()
  @IsString()
  address_field?: string;

  @ApiPropertyOptional({ description: 'Izoh field nomi', default: 'comment' })
  @IsOptional()
  @IsString()
  comment_field?: string;

  @ApiPropertyOptional({
    description: 'Umumiy narx field nomi',
    default: 'total_price',
  })
  @IsOptional()
  @IsString()
  total_price_field?: string;

  @ApiPropertyOptional({
    description: 'Yetkazib berish narxi field nomi',
    default: 'delivery_price',
  })
  @IsOptional()
  @IsString()
  delivery_price_field?: string;

  @ApiPropertyOptional({
    description: 'Mahsulotlar soni field nomi',
    default: 'total_count',
  })
  @IsOptional()
  @IsString()
  total_count_field?: string;

  @ApiPropertyOptional({
    description: 'Mahsulotlar field nomi',
    default: 'items',
  })
  @IsOptional()
  @IsString()
  items_field?: string;

  @ApiPropertyOptional({
    description: 'Yaratilgan vaqt field nomi',
    default: 'created_at',
  })
  @IsOptional()
  @IsString()
  created_at_field?: string;
}
