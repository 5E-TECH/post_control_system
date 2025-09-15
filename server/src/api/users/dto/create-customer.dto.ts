import {
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsUUID()
  market_id?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @IsNotEmpty()
  @IsUUID()
  district_id: string;

  @IsOptional()
  @IsString()
  address?: string;
}
