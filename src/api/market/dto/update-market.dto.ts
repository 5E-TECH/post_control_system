import { IsOptional, IsString } from 'class-validator';

export class UpdateMarketDto {
  @IsString()
  @IsOptional()
  market_name: string;

  @IsString()
  @IsOptional()
  phone_number: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  @IsOptional()
  status: string;

  @IsString()
  @IsOptional()
  add_order: string;
}
