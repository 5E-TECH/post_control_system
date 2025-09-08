import {
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCustomerDto {
  @IsNotEmpty()
  @IsUUID()
  market_id: string;

  @IsNotEmpty()
  @IsString()
  client_name: string;

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
