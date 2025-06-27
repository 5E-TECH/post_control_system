import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMarketDto {
  @IsNotEmpty()
  @IsString()
  market_name: string;

  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
