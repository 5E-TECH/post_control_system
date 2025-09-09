import {
  IsNotEmpty,
  IsNumber,
  IsPhoneNumber,
  IsString,
  Min,
} from 'class-validator';

export class CreateCourierDto {
  @IsNotEmpty()
  @IsString()
  region_id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_home: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_center: number;
}
