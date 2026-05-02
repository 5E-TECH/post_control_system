import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Bulk operation uchun DTO — kuryer scaner orqali yig'gan order'larni
 * bir martada sotish yoki bekor qilish uchun ishlatiladi.
 *
 * - Bulk sotishda extra_cost qo'llanmaydi (kerak bo'lsa single sotish ishlatiladi)
 * - Telegram xabari yuborilmaydi (per-order o'rniga)
 */
export class BulkOrderActionDto {
  @ApiProperty({
    description: "Bulk amalda qatnashadigan buyurtma ID lari ro'yxati",
    type: [String],
    example: [
      '11111111-2222-3333-4444-555555555555',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    ],
  })
  @IsArray({ message: "order_ids ro'yxat formatida bo'lishi kerak" })
  @ArrayMinSize(1, { message: 'Kamida 1 ta buyurtma tanlash kerak' })
  @ArrayMaxSize(500, {
    message: 'Bir vaqtda 500 tadan ortiq buyurtma bilan ishlash mumkin emas',
  })
  @IsUUID(4, {
    each: true,
    message: "Buyurtma ID UUID formatida bo'lishi kerak",
  })
  order_ids: string[];

  @ApiPropertyOptional({
    description: "Umumiy izoh (har bir buyurtmaga qo'llanadi)",
    example: 'Kun yakunidagi bulk amal',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
