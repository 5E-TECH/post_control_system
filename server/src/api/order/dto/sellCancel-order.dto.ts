import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SellCancelOrderDto {
  @IsOptional()
  @IsString()
  comment: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraCost: number;
}
