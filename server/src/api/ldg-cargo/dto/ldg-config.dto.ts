import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLdgConfigDto {
  // ===== ULANISH =====

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_sandbox?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  api_base_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tenant_domain?: string;

  // ===== WEBHOOK =====

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  webhook_secret?: string;

  @ApiProperty({ required: false, description: 'Key rotation davrida eski secret' })
  @IsOptional()
  @IsString()
  webhook_secret_previous?: string;

  // ===== SENDER =====

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sender_name?: string;

  @ApiProperty({ required: false, example: '+998901234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'sender_phone +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  sender_phone?: string;

  @ApiProperty({ required: false, description: 'SOATO viloyat kodi (integer)' })
  @IsOptional()
  @IsInt()
  sender_region_sato?: number;

  @ApiProperty({ required: false, description: 'SOATO tuman kodi (integer)' })
  @IsOptional()
  @IsInt()
  sender_district_sato?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sender_address?: string;

  @ApiProperty({
    required: false,
    description:
      'LDG filial ID (sender.branch_id va receiver.branch_id sifatida yuboriladi)',
  })
  @IsOptional()
  @IsInt()
  sender_branch_id?: number;

  // ===== DEFAULT PACKAGE =====

  @ApiProperty({ required: false, description: 'Default vazn (kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  default_weight?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  default_length?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  default_width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  default_height?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  default_payer_type?: 'receiver' | 'sender' | 'third_party';

  // ===== ENABLED DISTRICTS =====

  @ApiProperty({
    required: false,
    description: 'Qaysi tumanlar LDG orqali yetkaziladi (SOATO kodlar)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  enabled_district_sato_codes?: number[];

  // ===== LDG KURYER =====

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(36, 36)
  ldg_courier_user_id?: string;
}
