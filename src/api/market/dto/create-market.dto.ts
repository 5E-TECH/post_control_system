import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMarketDto {
  @IsNotEmpty()
  @IsString()
  market_name: string;

  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @IsNotEmpty()
  @IsNumber()
  tariff: number

  @IsNotEmpty()
  @IsString()
  password: string;
}
