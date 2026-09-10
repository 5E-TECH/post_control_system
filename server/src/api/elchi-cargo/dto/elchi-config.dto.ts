import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

/**
 * Elchi sozlamalarini yangilash.
 *
 * `elchi_courier_user_id` bu yerda YO'Q — virtual kuryer alohida
 * `bind-courier` amali bilan biriktiriladi (bir vaqtda faqat bitta Elchi
 * vakili bo'lishi kafolatlanishi kerak).
 */
export class UpdateElchiConfigDto {
  @ApiPropertyOptional({
    description:
      "MASTER kalit. false bo'lsa Elchi'ga hech narsa jo'natilmaydi va " +
      'kiruvchi webhook ishlanmaydi.',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Kiruvchi webhookni qabul qilish' })
  @IsOptional()
  @IsBoolean()
  webhook_enabled?: boolean;

  @ApiPropertyOptional({
    description: "Holat solishtiruvchi CRON (yo'qolgan webhookni tutadi)",
  })
  @IsOptional()
  @IsBoolean()
  reconcile_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Elchi api-gateway manzili',
    example: 'https://api.elchi.uz',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  api_base_url?: string;

  @ApiPropertyOptional({
    description:
      "Elchi bergan hamkor kaliti (X-Api-Key). Javoblarda QAYTARILMAYDI — " +
      "faqat `api_key_set` bayrog'i ko'rsatiladi.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  api_key?: string;

  @ApiPropertyOptional({
    description:
      'Kiruvchi webhook HMAC sekreti. Javoblarda QAYTARILMAYDI.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  webhook_secret?: string;

  @ApiPropertyOptional({
    description: "Kalit rotatsiyasi oynasida qabul qilinadigan oldingi sekret",
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  webhook_secret_previous?: string;

  @ApiPropertyOptional({
    description:
      "Elchi tomonidagi \"BeePost\" market akkaunti id'si " +
      '(POST /partner/markets javobidan)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  elchi_market_id?: string;
}
