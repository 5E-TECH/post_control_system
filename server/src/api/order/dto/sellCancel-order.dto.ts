import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SellCancelOrderDto {
  @ApiPropertyOptional({ example: 'Customer not available', description: 'Reason or note' })
  @IsOptional()
  @IsString()
  comment: string;

  @ApiPropertyOptional({ example: 5000, minimum: 0, description: 'Additional cost if any' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      // "300,000" yoki "300 000" formatlarini to'g'ri parse qilish
      const cleaned = value.replace(/[^\d.-]/g, '');
      return cleaned ? Number(cleaned) : undefined;
    }
    return Number(value);
  })
  @IsNumber()
  @Min(0)
  extraCost: number;
}
