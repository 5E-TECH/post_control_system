import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MARKET_HANDOVER_MANUAL_REASONS,
  MARKET_HANDOVER_MANUAL_REASON_MAX_LENGTH,
} from '../market-handover.enums';

/**
 * ⚠️ Global `ValidationPipe` `whitelist` + `forbidNonWhitelisted` bilan
 * ishlaydi (api/app.service.ts): DTO'da E'LON QILINMAGAN maydon 422 beradi.
 * Shuning uchun ichma-ich obyektlarda `@ValidateNested` + `@Type` MAJBURIY —
 * aks holda ular tekshirilmasdan jimgina o'tib ketadi.
 */

/** Xodim market QR'ini skanerladi yoki PIN'ni kiritdi. */
export class ScanHandoverDto {
  @ApiPropertyOptional({ description: 'Market ko‘rsatgan QR token (MRC-…)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  qr_token?: string;

  @ApiPropertyOptional({
    description:
      'PIN yo‘li uchun market ID si. PIN 6 xonali bo‘lgani uchun qidiruv ' +
      'HAR DOIM market bilan birga bo‘ladi — aks holda brute-force maydoni ' +
      'butun bazaga yoyilardi.',
  })
  @IsOptional()
  @IsUUID()
  market_id?: string;

  @ApiPropertyOptional({ description: '6 xonali PIN (QR zaxirasi)' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'PIN 6 xonali raqam bo‘lishi kerak' })
  pin?: string;
}

/** Shikastlangan posilka yorlig'i — sessiya ICHIDA qo'lda tasdiqlash. */
export class ManualOverrideDto {
  @ApiProperty()
  @IsUUID()
  order_id!: string;

  @ApiProperty({
    description: 'YOPIQ ro‘yxatdan sabab (aynan shu matn yuboriladi)',
    enum: MARKET_HANDOVER_MANUAL_REASONS as unknown as string[],
  })
  @IsString()
  @MaxLength(MARKET_HANDOVER_MANUAL_REASON_MAX_LENGTH)
  @IsIn(MARKET_HANDOVER_MANUAL_REASONS as unknown as string[], {
    message: 'manual_overrides.reason yopiq ro‘yxatdan bo‘lishi kerak',
  })
  reason!: string;
}

/** Bir partiya posilkani marketga topshirish. */
export class CompleteHandoverDto {
  @ApiProperty()
  @IsUUID()
  market_id!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Kamida bitta buyurtma tanlanishi kerak' })
  @IsUUID('4', { each: true })
  order_ids!: string[];

  @ApiProperty({ description: 'Skan natijasida olingan ruxsat (MRA-…)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  authorization_token!: string;

  @ApiPropertyOptional({ type: [ManualOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualOverrideDto)
  manual_overrides?: ManualOverrideDto[];
}

/** Sahifa tirikligi / ruxsatni yopish. */
export class HandoverSessionTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  authorization_token!: string;
}

/**
 * OFFLINE AKT — market panelga kira olmaganda.
 *
 * Vakil ismi, telefoni va sabab MAJBURIY: QR bo'lmaganda yagona dalil shu.
 * `order.market_handover_mode` da `offline_signed` bo'lib qoladi va
 * hisobotda market tasdig'idan ajraladi.
 */
export class OfflineHandoverDto {
  @ApiProperty()
  @IsUUID()
  market_id!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Kamida bitta buyurtma tanlanishi kerak' })
  @IsUUID('4', { each: true })
  order_ids!: string[];

  @ApiProperty({ description: 'Posilkani olib ketgan vakilning ismi' })
  @IsString()
  @Length(3, 120)
  representative_name!: string;

  @ApiProperty({ description: 'Vakilning telefon raqami' })
  @IsString()
  @Length(7, 32)
  representative_phone!: string;

  @ApiProperty({ description: 'Nega QR‘siz topshirildi' })
  @IsString()
  @Length(5, 200)
  reason!: string;
}

/** Navbat/ro'yxat so'rovlari uchun umumiy sahifalash. */
export class AwaitingQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Buyurtma raqami yoki QR token bo‘yicha qidiruv',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;
}

/** Market uchun ruxsat majburiyligini yoqish/o'chirish. */
export class HandoverConsentFlagDto {
  @ApiProperty()
  @IsIn([true, false])
  cancel_handover_consent_required!: boolean;
}
