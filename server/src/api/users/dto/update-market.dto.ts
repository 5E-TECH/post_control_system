import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Status, Where_deliver } from 'src/common/enums';

export class UpdateMarketDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsBoolean()
  add_order?: boolean;

  @IsOptional()
  @IsBoolean()
  require_operator_phone?: boolean;

  @IsOptional()
  @IsString()
  default_operator_phone?: string | null;

  @IsOptional()
  @IsString()
  secondary_operator_phone?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_home?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_center?: number;

  @IsOptional()
  @IsEnum(Where_deliver, {
    message: 'default_tariff must be either center or address',
  })
  default_tariff?: Where_deliver;

  /**
   * QO'SHIMCHA XARAJAT ISBOT + TASDIQ rejimi.
   *
   * ⚠️ Bu maydon DTO'da BO'LISHI SHART: `forbidNonWhitelisted` yoqilgan
   * (`app.service.ts`), ya'ni ro'yxatda yo'q maydon bilan kelgan so'rov
   * butunlay 422 bo'ladi — frontend uni yuborsa, market tahriri umuman
   * ishlamay qolardi.
   */
  @IsOptional()
  @IsBoolean()
  extra_cost_proof_required?: boolean;

  /** Shu summadan kichik so'rovlar avtomatik tasdiqlanadi (0 = o'chiq). */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      // "5 000" / "5,000" formatlari telefon brauzeridan kelishi mumkin
      const cleaned = value.replace(/[^\d]/g, '');
      return cleaned ? Number(cleaned) : undefined;
    }
    return Number(value);
  })
  // Butun so'm — kasrli qiymat bigint ustunga INSERT xatosi beradi.
  @IsInt()
  @Min(0)
  extra_cost_auto_approve_under?: number;
}
