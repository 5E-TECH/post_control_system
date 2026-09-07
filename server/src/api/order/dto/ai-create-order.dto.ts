import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Where_deliver } from 'src/common/enums';

// AI matn uzunligi chegarasi — Claude'ga cheksiz matn ketmasligi uchun (DoS/xarajat).
const AI_TEXT_MAX = 4000;
// Rasm base64 uzunlik chegarasi (~5.5MB binar) — Claude limiti va DoS/xarajat
// himoyasi. Bittа so'rovда ko'pi bilan 5 rasm.
const AI_IMAGE_B64_MAX = 7_500_000;
const AI_IMAGE_MAX_COUNT = 5;
const AI_IMAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// Rasm orqali buyurtma (vision) — base64 kodlangan rasm + turi.
export class AiOrderImageDto {
  @IsIn(AI_IMAGE_MEDIA_TYPES)
  media_type: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(AI_IMAGE_B64_MAX)
  data_base64: string;
}

export class AiCreateOrderDto {
  // Erkin matn (mijoz, telefon, tuman, mahsulotlar, narx...)
  @IsNotEmpty()
  @IsString()
  @MaxLength(AI_TEXT_MAX)
  text: string;

  // Admin/registrator uchun — qaysi market nomidan (market/operator o'ziniki)
  @IsOptional()
  @IsUUID()
  market_id?: string;
}

// AI matnni tahlil qilish (bir yoki bir nechta buyurtma) — yaratmaydi, charge yo'q.
// text YOKI images bo'lishi kerak (controller tekshiradi); rasm bo'lsa matn ixtiyoriy.
export class AiParseOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(AI_TEXT_MAX)
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(AI_IMAGE_MAX_COUNT)
  @ValidateNested({ each: true })
  @Type(() => AiOrderImageDto)
  images?: AiOrderImageDto[];

  @IsOptional()
  @IsUUID()
  market_id?: string;
}

class ConfirmedOrderItemDto {
  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class ConfirmedOrderDto {
  @IsNotEmpty()
  @IsString()
  customer_name: string;

  // Telefon +998 + 9 raqam formatida bo'lishi shart (buzuq/typo raqam bilan
  // buyurtma yaratilib qolmasin).
  @IsNotEmpty()
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon +998XXXXXXXXX formatida bo'lishi kerak",
  })
  phone_number: string;

  @IsOptional()
  @IsString()
  extra_number?: string;

  @IsUUID()
  district_id: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConfirmedOrderItemDto)
  order_item_info: ConfirmedOrderItemDto[];

  // Narx: oddiy buyurtma > 0 (servis tekshiradi); almashtirishda 0 bo'lishi mumkin.
  @IsNumber()
  @Min(0)
  total_price: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsOptional()
  @IsEnum(Where_deliver)
  where_deliver?: Where_deliver;

  // Almashtirish: bu yangi buyurtma qaysi eski (sotilgan) buyurtma o'rniga.
  @IsOptional()
  @IsUUID()
  replaced_order_id?: string;
}

// Tasdiqlangan buyurtmalarni yaratish (har biriga alohida charge + create).
export class AiConfirmOrdersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ConfirmedOrderDto)
  orders: ConfirmedOrderDto[];

  @IsOptional()
  @IsUUID()
  market_id?: string;
}
