import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MarketplaceRejectReason,
  MarketplaceSettlementMethod,
} from '../marketplace.enums';

/**
 * ⚠️ HAR MAYDON SHU YERDA E'LON QILINISHI SHART.
 * `app.service.ts` da `forbidNonWhitelisted: true` — ro'yxatda yo'q maydon
 * bilan kelgan so'rov BUTUNLAY 422 bo'ladi. Elchi ishida aynan shu tuzoqqa
 * tushilgan: `label_token` DTO'ga yozilmagani uchun skan hech qachon mos
 * kelmasdi va xato «skaner buzuq» kabi ko'rinardi.
 */

export class ScanParcelDto {
  @ApiProperty({ description: 'Ochiq skan sessiyasi ID si' })
  @IsUUID()
  session_id: string;

  @ApiProperty({ description: 'Yorliqdagi QR qiymati', example: 'UZM-8842-1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  qr_token: string;
}

export class AcceptParcelsDto {
  @ApiProperty({ description: 'Qabul qilinadigan sessiya' })
  @IsUUID()
  session_id: string;

  /**
   * Klient yaratadigan kalit — «Qabul qilish» ikki marta bosilsa (yoki javob
   * timeout bo'lib qayta yuborilsa) AYNI natija qaytadi, ikkinchi qop
   * yaratilmaydi.
   */
  @ApiProperty({ description: 'Idempotentlik kaliti (klient yaratadi)' })
  @IsUUID()
  idempotency_key: string;
}

export class RejectParcelDto {
  @ApiProperty({ description: 'Rad etiladigan posilka (bizning ID)' })
  @IsUUID()
  parcel_id: string;

  @ApiProperty({ enum: MarketplaceRejectReason })
  @IsEnum(MarketplaceRejectReason)
  reason: MarketplaceRejectReason;

  @ApiPropertyOptional({ description: 'Qo\'shimcha izoh' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}


export class SettlementAllocationItemDto {
  @ApiProperty({ description: 'Marketplace ichidagi sotuvchi ID si' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  seller_id: string;

  @ApiProperty({ description: "Shu sotuvchiga tegishli summa (so'm)" })
  @IsInt()
  @Min(1)
  amount: number;
}

export class SettlementPayDto {
  @ApiProperty({ description: "Umumiy to'lov summasi (so'm)" })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: MarketplaceSettlementMethod })
  @IsEnum(MarketplaceSettlementMethod)
  method: MarketplaceSettlementMethod;

  /**
   * ⚠️ MAJBURIY va yig'indisi `amount` ga TENG bo'lishi shart.
   * Marketplace o'z sotuvchilariga shu ro'yxat bo'yicha to'laydi — mos
   * kelmasa farq hech qayerda ko'rinmaydi.
   */
  @ApiProperty({ type: [SettlementAllocationItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SettlementAllocationItemDto)
  allocation: SettlementAllocationItemDto[];

  @ApiPropertyOptional({ description: "Bank o'tkazmasi raqami / chek" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ═══════════════════════ SOZLASH (admin) ═══════════════════════

export class CreateMarketplaceDto {
  @ApiProperty({ example: 'UzMarket' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /**
   * ⚠️ Ommaviy URL'ning bir qismi (`/marketplace/{slug}/ledger`) va u
   * O'ZGARMAYDI — tahrirlashda bu maydon yo'q. Band so'zlar
   * (`scan-session`, `scan`, ...) servisda rad etiladi.
   */
  @ApiProperty({ example: 'uzmarket', description: "Kichik harf, raqam, `-`" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(49)
  slug: string;

  @ApiProperty({ description: 'Biriktiriladigan PCS market foydalanuvchisi' })
  @IsUUID()
  market_id: string;

  @ApiPropertyOptional({ example: 'https://api.uzmarket.uz' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  api_base_url?: string;

  @ApiProperty({ example: 50000, description: "Markazgacha tarif (so'm)" })
  @IsInt()
  @Min(1)
  tariff_center: number;

  @ApiProperty({ example: 70000, description: "Uygacha tarif (so'm)" })
  @IsInt()
  @Min(1)
  tariff_home: number;

  @ApiPropertyOptional({ description: 'Sinov rejimi' })
  @IsOptional()
  @IsBoolean()
  is_sandbox?: boolean;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  settlement_period_days?: number;

  @ApiPropertyOptional({ type: [String], description: 'Ularning IP manzillari' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ip_allowlist?: string[];
}

/**
 * ⚠️ `slug` va `market_id` ATAYLAB YO'Q — birinchisi ommaviy URL'da,
 * ikkinchisi butun daftar tarixida ishlatiladi.
 */
export class UpdateMarketplaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  api_base_url?: string;

  /** Ular bergan kalit — biz ularga so'rov yuborganda ishlatiladi. */
  @ApiPropertyOptional({ description: "Faqat yozish — javobda qaytmaydi" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  api_key?: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  request_timeout_ms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  settlement_period_days?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ip_allowlist?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_sandbox?: boolean;
}

export class SetMarketplaceTariffDto {
  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(1)
  tariff_center: number;

  @ApiProperty({ example: 70000 })
  @IsInt()
  @Min(1)
  tariff_home: number;

  @ApiPropertyOptional({ description: "Nima uchun o'zgartirilgani" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class SetMarketplaceActiveDto {
  @ApiProperty({ description: 'MASTER kalit — o\'chirilsa skan ham to\'xtaydi' })
  @IsBoolean()
  is_active: boolean;
}
