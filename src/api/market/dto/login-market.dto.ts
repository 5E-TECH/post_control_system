import { IsNotEmpty, IsString } from 'class-validator';

export class LoginMarketDto {
  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
