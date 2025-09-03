import { IsNotEmpty, IsString } from 'class-validator';

export class LoginMarketDto {
  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
