import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// Admin: investorga kapital hissasini yozish.
export class RecordCapitalDto {
  @ApiProperty({ example: 100_000_000, description: 'UZS, > 0' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    example: 1754300000000,
    description: "Iqtisodiy sana (epoch-ms). Bo'sh bo'lsa — hozir.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  contributed_at?: number;

  @ApiPropertyOptional({ example: "Boshlang'ich sarmoya" })
  @IsOptional()
  @IsString()
  note?: string;
}

// Admin: egalik ulushini o'rnatish / o'zgartirish (basis points).
export class SetOwnershipDto {
  @ApiProperty({ example: 2000, description: 'Basis points (0..10000). 20% = 2000' })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(10000)
  ownership_bps: number;

  @ApiPropertyOptional({
    example: 1754300000000,
    description: "Amal boshi (epoch-ms). Bo'sh bo'lsa — hozir.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  effective_from?: number;

  @ApiPropertyOptional({ example: 'Ulush qayta ko\'rib chiqildi' })
  @IsOptional()
  @IsString()
  note?: string;
}

// Admin: investorga to'langan taqsimotni yozish.
export class RecordDistributionDto {
  @ApiProperty({ example: 5_000_000, description: 'UZS, > 0' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    example: 1754300000000,
    description: "To'lov sanasi (epoch-ms). Bo'sh bo'lsa — hozir.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  distributed_at?: number;

  @ApiPropertyOptional({ example: 1751000000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  period_start?: number;

  @ApiPropertyOptional({ example: 1753600000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  period_end?: number;

  @ApiPropertyOptional({ example: 'Q2 dividend' })
  @IsOptional()
  @IsString()
  note?: string;
}
