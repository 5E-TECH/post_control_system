import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateMarketDto {
  @IsNotEmpty()
  @IsString()
  market_name: string;

  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_home: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_center: number;

  @IsNotEmpty()
  @IsString()
  password: string;
}
