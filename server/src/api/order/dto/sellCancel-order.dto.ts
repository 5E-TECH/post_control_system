import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SellCancelOrderDto {
  @ApiPropertyOptional({ example: 'Customer not available', description: 'Reason or note' })
  @IsOptional()
  @IsString()
  comment: string;

  @ApiPropertyOptional({ example: 5000, minimum: 0, description: 'Additional cost if any' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraCost: number;
}
