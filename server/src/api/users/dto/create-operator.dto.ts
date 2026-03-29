import { IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class CreateOperatorDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
