import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsUrl,
  Matches,
  ValidateNested,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldMappingDto } from './field-mapping.dto';
import { StatusMappingDto, StatusSyncConfigDto } from './status-mapping.dto';
import { AuthType } from 'src/core/entity/external-integration.entity';

export class CreateIntegrationDto {
  @ApiProperty({ description: 'Integratsiya nomi', example: 'Adosh' })
  @IsNotEmpty({ message: 'Nom kiritilishi shart' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Unikal slug (URL uchun)',
    example: 'adosh',
  })
  @IsNotEmpty({ message: 'Slug kiritilishi shart' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug faqat kichik harflar, raqamlar va tire (-) dan iborat bo'lishi kerak",
  })
  slug: string;

  @ApiProperty({
    description: 'API URL manzili',
    example: 'https://api.adosh.uz/orders',
  })
  @IsNotEmpty({ message: 'API URL kiritilishi shart' })
  @IsUrl({}, { message: "API URL noto'g'ri formatda" })
  api_url: string;

  @ApiPropertyOptional({ description: 'API kaliti (token)' })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiPropertyOptional({ description: 'API secret (ixtiyoriy)' })
  @IsOptional()
  @IsString()
  api_secret?: string;

  @ApiPropertyOptional({
    description: 'Autentifikatsiya turi',
    enum: ['api_key', 'login'],
    default: 'api_key',
  })
  @IsOptional()
  @IsIn(['api_key', 'login'])
  auth_type?: AuthType;

  @ApiPropertyOptional({
    description: 'Login URL (login auth turi uchun)',
    example: 'https://api.adosh.uz/auth/token',
  })
  @IsOptional()
  @IsString()
  auth_url?: string;

  @ApiPropertyOptional({ description: 'Login username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Login password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ description: 'Biriktirilgan market ID' })
  @IsNotEmpty({ message: 'Market ID kiritilishi shart' })
  @IsUUID(4, { message: "Market ID noto'g'ri formatda" })
  market_id: string;

  @ApiPropertyOptional({ description: 'Faolmi', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Field mapping sozlamalari' })
  @IsOptional()
  @ValidateNested()
  @Type(() => FieldMappingDto)
  field_mapping?: FieldMappingDto;

  @ApiPropertyOptional({ description: 'Status mapping sozlamalari' })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatusMappingDto)
  status_mapping?: StatusMappingDto;

  @ApiPropertyOptional({ description: 'Status sync konfiguratsiyasi' })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatusSyncConfigDto)
  status_sync_config?: StatusSyncConfigDto;
}
