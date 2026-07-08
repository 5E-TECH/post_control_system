import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// AI matn uzunligi chegarasi — Claude'ga cheksiz matn ketmasligi uchun (DoS/xarajat).
const AI_TEXT_MAX = 4000;

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
export class AiParseOrderDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(AI_TEXT_MAX)
  text: string;

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

  @IsNotEmpty()
  @IsString()
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

  @IsNumber()
  @Min(1)
  total_price: number;

  @IsOptional()
  @IsString()
  comment?: string;
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
