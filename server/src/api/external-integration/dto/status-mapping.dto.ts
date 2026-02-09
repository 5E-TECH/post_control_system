import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Status mapping DTO - bizning statuslarni tashqi tizim statuslariga moslashtirish
export class StatusMappingDto {
  @ApiPropertyOptional({
    description: 'Sotildi holatiga mos tashqi status',
    example: 'completed',
  })
  @IsOptional()
  @IsString()
  sold?: string;

  @ApiPropertyOptional({
    description: 'Bekor qilindi holatiga mos tashqi status',
    example: 'cancelled',
  })
  @IsOptional()
  @IsString()
  canceled?: string;

  @ApiPropertyOptional({
    description: "To'landi holatiga mos tashqi status",
    example: 'paid',
  })
  @IsOptional()
  @IsString()
  paid?: string;

  @ApiPropertyOptional({
    description: 'Qaytarildi (rollback) holatiga mos tashqi status',
    example: 'returned',
  })
  @IsOptional()
  @IsString()
  rollback?: string;

  @ApiPropertyOptional({
    description: 'Kutilmoqda (waiting) holatiga mos tashqi status',
    example: 'pending',
  })
  @IsOptional()
  @IsString()
  waiting?: string;
}

// Status sync configuration DTO
export class StatusSyncConfigDto {
  @ApiPropertyOptional({
    description: 'Status sinxronlash yoqilganmi',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Status yangilash uchun API endpoint',
    example: '/orders/{id}/status',
  })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'HTTP method',
    enum: ['PUT', 'PATCH', 'POST'],
    default: 'PUT',
  })
  @IsOptional()
  @IsIn(['PUT', 'PATCH', 'POST'])
  method?: 'PUT' | 'PATCH' | 'POST';

  @ApiPropertyOptional({
    description: 'Request body dagi status field nomi',
    example: 'status',
    default: 'status',
  })
  @IsOptional()
  @IsString()
  status_field?: string;

  @ApiPropertyOptional({
    description: 'Authorization header ishlatilsinmi',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  use_auth?: boolean;

  @ApiPropertyOptional({
    description: 'Order ID ni request body ga qo\'shish kerakmi',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  include_order_id_in_body?: boolean;

  @ApiPropertyOptional({
    description: 'Request body dagi order ID field nomi',
    example: 'order_id',
    default: 'order_id',
  })
  @IsOptional()
  @IsString()
  order_id_field?: string;
}
