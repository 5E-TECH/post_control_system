import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ExtraCostStatus } from 'src/common/enums';
import { PROOF_MAX_FILES } from '../proof-storage.const';

/** Ro'yxat so'rovlari uchun umumiy filtr. */
export class ListExtraCostDto {
  @ApiPropertyOptional({ enum: ExtraCostStatus })
  @IsOptional()
  @IsEnum(ExtraCostStatus)
  status?: ExtraCostStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // Chegara: bitta so'rov butun jadvalni tortib olmasin.
  @Max(100)
  limit?: number;

  /**
   * Faqat admin navbati uchun. Query parametrlar SATR bo'lib keladi,
   * shuning uchun bu yerda ham satr — `'true'` bilan solishtiriladi.
   */
  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @IsIn(['true', 'false'])
  escalated?: string;
}

/**
 * RAD ETISH — sabab MAJBURIY.
 *
 * ⚠️ Nega majburiy: kuryer nega rad etilganini bilmasa, xuddi shu xatoni
 * takrorlaydi va nizo hal bo'lmaydi. Bo'sh sabab "shunchaki rad etaman"
 * xulqini rag'batlantirardi.
 */
export class RejectExtraCostDto {
  @ApiProperty({ example: "Chek rasmida summa ko'rinmayapti" })
  @IsString()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value ?? ''),
  )
  @MinLength(3, { message: 'Rad etish sababini yozing (kamida 3 belgi)' })
  review_note: string;
}

/** Bir nechta so'rovni birdan tasdiqlash. */
export class BulkApproveDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  // Serverda KETMA-KET bajariladi (har biri o'z tranzaksiyasi bilan),
  // shuning uchun juda katta partiya so'rovni cho'zib yuborardi.
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  ids: string[];
}

/**
 * KEYINCHALIK ISBOT BIRIKTIRISH — `awaiting_proof` dan chiqish.
 *
 * Busiz o'sha holat TUGAB QOLGAN edi: tasdiqlash faqat `pending` ni qabul
 * qiladi, ya'ni isbotsiz so'rov 24 soatdan keyin bekor bo'lib, kuryer pulini
 * butunlay yo'qotardi.
 */
export class AttachProofDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(PROOF_MAX_FILES)
  @IsUUID('4', { each: true })
  proof_ids: string[];
}
