import { ApiPropertyOptional } from '@nestjs/swagger';
import {
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

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ description: 'Integratsiya nomi' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Unikal slug (URL uchun)' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug faqat kichik harflar, raqamlar va tire (-) dan iborat bo'lishi kerak",
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'API URL manzili' })
  @IsOptional()
  @IsUrl({}, { message: "API URL noto'g'ri formatda" })
  api_url?: string;

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
  })
  @IsOptional()
  @IsIn(['api_key', 'login'])
  auth_type?: AuthType;

  @ApiPropertyOptional({ description: 'Login URL (login auth turi uchun)' })
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

  @ApiPropertyOptional({ description: 'Biriktirilgan market ID' })
  @IsOptional()
  @IsUUID(4, { message: "Market ID noto'g'ri formatda" })
  market_id?: string;

  @ApiPropertyOptional({ description: 'Faolmi' })
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
