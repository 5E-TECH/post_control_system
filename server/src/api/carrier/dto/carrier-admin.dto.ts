import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IP_ALLOWLIST_MAX_ENTRIES } from '../utils/ip-allowlist';

/**
 * Carrier akkauntlarini boshqarish (admin, JWT) — `/api/v1/carrier-accounts`.
 * Tashqi kompaniyaning `/carrier/*` DTO'lari bilan aralashmaydi.
 *
 * DTO faqat SHAKLNI tekshiradi; IP yozuvlarining MA'NOSI (kanonik shakl,
 * host bitli CIDR, IPv6 diapazon) `CarrierAccountService` da tekshiriladi —
 * tushunilmagan yozuv 400 bilan rad etiladi.
 */
const IP_ALLOWLIST_DOC =
  'Ruxsat etilgan manzillar: IPv4 (203.0.113.10), IPv4 diapazon (203.0.113.0/24) yoki ' +
  "IPv6 manzil (2001:db8::1). IPv6 diapazon qo'llab-quvvatlanmaydi. Tushunilmagan yozuv — 400. " +
  "Bo'sh — cheklov yo'q.";

export class CreateCarrierAccountDto {
  @ApiProperty({ example: 'BTS Express', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    example: '3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c',
    description:
      "Bog'lanadigan KURIER user id. Kuryer YANGI bo'lishi shart: faol, pochtasiz, " +
      "kassasi 0, boshqa provayderga (Elchi/LDG) bog'lanmagan. Uning paroli tasodifiy " +
      'qilinadi — barcha amallar faqat API kalit orqali.',
  })
  @IsUUID()
  courier_id!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['203.0.113.10', '203.0.113.0/24', '2001:db8::1'],
    description: IP_ALLOWLIST_DOC,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IP_ALLOWLIST_MAX_ENTRIES)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  ip_allowlist?: string[];
}

export class UpdateCarrierAccountDto {
  @ApiPropertyOptional({ example: 'BTS Express', maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['203.0.113.10'],
    description: `${IP_ALLOWLIST_DOC} Bo'sh massiv — IP cheklovi olib tashlanadi.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IP_ALLOWLIST_MAX_ENTRIES)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  ip_allowlist?: string[];
}

export class SetCarrierActiveDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  is_active!: boolean;
}
