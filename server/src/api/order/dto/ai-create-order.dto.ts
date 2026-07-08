import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AiCreateOrderDto {
  // Erkin matn (mijoz, telefon, tuman, mahsulotlar, narx...)
  @IsNotEmpty()
  @IsString()
  text: string;

  // Admin/registrator uchun — qaysi market nomidan (market/operator o'ziniki)
  @IsOptional()
  @IsUUID()
  market_id?: string;
}
