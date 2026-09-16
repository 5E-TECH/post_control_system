import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ExtraCostCategory } from 'src/common/enums';
import { PROOF_MAX_FILES } from 'src/api/extra-cost/proof-storage.const';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SellCancelOrderDto {
  @ApiPropertyOptional({
    example: 'Customer not available',
    description: 'Reason or note',
  })
  @IsOptional()
  @IsString()
  comment: string;

  @ApiPropertyOptional({
    example: 5000,
    minimum: 0,
    description: 'Additional cost if any',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      // "300,000" yoki "300 000" formatlarini to'g'ri parse qilish
      const cleaned = value.replace(/[^\d.-]/g, '');
      return cleaned ? Math.trunc(Number(cleaned)) : undefined;
    }
    return Math.trunc(Number(value));
  })
  // ⚠️ `@IsInt` — `@IsNumber` EMAS. Kassa ustunlari `bigint`: kasrli qiymat
  // (masalan `5000.5`) INSERT xatosi berib BUTUN sotuvni rollback qilardi,
  // ya'ni kuryer mijoz oldida turib "sotildi" tugmasini bosolmay qolardi.
  @IsInt({ message: "Qo'shimcha xarajat butun son bo'lishi kerak" })
  @Min(0)
  extraCost: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'Almashtirish (kafolat-swap) buyurtmasini sotishda kuryer ESKI ' +
      'mahsulotni mijozdan olib marketga qaytarish uchun olganini tasdiqlaydi. ' +
      "Almashtirish buyurtmasi uchun true bo'lishi SHART, aks holda sotuv " +
      "rad etiladi (eski mahsulot yo'qolib ketmasligi uchun).",
  })
  @IsOptional()
  @IsBoolean()
  old_item_collected?: boolean;

  /**
   * QO'SHIMCHA XARAJAT ISBOTI — avval `POST extra-cost/proof` ga yuklangan
   * fayllarning id'lari.
   *
   * ⚠️ FAYL NOMI EMAS, ID. Nom qabul qilinsa, uni taxmin qilib boshqa
   * kuryerning isbotini o'z so'roviga biriktirish mumkin bo'lardi. Server
   * har bir id uchun uch shartni tekshiradi: fayl shu kuryerniki, hali
   * bog'lanmagan, va diskda mavjud.
   */
  @ApiPropertyOptional({
    description: "Avval yuklangan isbot fayllarining id'lari",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  // ⚠️ Qattiq raqam EMAS — chegara `proof-storage.const.ts` da. Ular
  // ajralib ketsa server 4-5-chi isbotni JIMGINA rad etardi.
  @ArrayMaxSize(PROOF_MAX_FILES)
  @IsUUID('4', { each: true })
  extra_cost_proof_ids?: string[];

  /** Xarajat sababi — marketga qaror uchun eng kerakli maydon. */
  @ApiPropertyOptional({
    enum: ExtraCostCategory,
    example: ExtraCostCategory.TAXI,
  })
  @IsOptional()
  @IsEnum(ExtraCostCategory)
  extra_cost_category?: ExtraCostCategory;

  /**
   * "Isbotsiz davom etish" — rasm yuklanmay qoldi (tarmoq uzildi), lekin
   * kuryer mijoz oldida turibdi va sotuvni yopishi kerak.
   *
   * ⚠️ SOTUV HECH QACHON YIQILMASLIGI KERAK. Bu bayroq bilan xarajat so'rovi
   * "isbot kutilmoqda" holatida yaratiladi va kuryerga 24 soat beriladi.
   * Muddat o'tsa so'rov bekor bo'ladi — lekin SOTUV o'z holicha qoladi.
   */
  @ApiPropertyOptional({
    description: 'Isbotsiz davom etish (24 soat ichida biriktiriladi)',
  })
  @IsOptional()
  @IsBoolean()
  extra_cost_proof_deferred?: boolean;
}
