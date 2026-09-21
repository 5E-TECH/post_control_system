import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  Max,
  Min,
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



export class SettlementPayDto {
  @ApiProperty({ description: "Umumiy to'lov summasi (so'm)" })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: MarketplaceSettlementMethod })
  @IsEnum(MarketplaceSettlementMethod)
  method: MarketplaceSettlementMethod;

  /**
   * ⚠️ TAQSIMOT YO'Q — ataylab.
   *
   * Marketplace pulni oladi va o'z sotuvchilariga O'ZI tarqatadi
   * (qaror 2026-09-17). Kim qancha ishlab topgani ularga har posilka
   * hodisasidagi `seller_id` orqali allaqachon ma'lum. Har to'lovda
   * jadval to'ldirish — admin uchun bekorga ish edi.
   *
   * `forbidNonWhitelisted: true` sabab eski `allocation` maydoni bilan
   * kelgan so'rov 422 oladi — bu ham ataylab: chaqiruvchi eskirgan
   * kontraktda ekanini DARHOL biladi.
   */

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

export class SetMarketplaceStatusMapDto {
  /**
   * `{ "<bizning kanonik status>": "<ularning qiymati>" }`
   *
   * ⚠️ Qiymat SATR sifatida keladi — hamkorda raqam (`7`) bo'lsa ham
   * `"7"` deb yuboriladi. Sabab: `7` va `"7"` ni JSON'da ajratib
   * bo'lmaydi-yu, taqqoslashda ular TENG EMAS.
   */
  @ApiProperty({
    example: { DELIVERED: '7', CANCELLED: 'otmenen' },
    description: "Bizning status -> ularning qiymati",
  })
  @IsObject({ message: "Status xaritasi obyekt bo'lishi kerak" })
  status_map: Record<string, string>;
}
