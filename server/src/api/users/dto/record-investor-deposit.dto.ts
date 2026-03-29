import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordInvestorDepositDto {
  @ApiProperty({ example: 10000000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Birinchi qism' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: '2026-03-17', description: 'Foiz boshlanish sanasi (YYYY-MM-DD). Bo\'sh qolsa bugungi sana ishlatiladi' })
  @IsOptional()
  @IsString()
  effective_date?: string;
}
