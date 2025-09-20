import {
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiPropertyOptional({ format: 'uuid', example: '8b2c1a8e-3b6f-4a6e-9a2f-71d8a5c9d123' })
  @IsOptional()
  @IsUUID()
  market_id?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901112233' })
  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @ApiProperty({ format: 'uuid', example: '2c3f5b7a-1d9e-44f7-8a1b-0a1d2b3c4d5e' })
  @IsNotEmpty()
  @IsUUID()
  district_id: string;

  @ApiPropertyOptional({ example: '27, Elm street, Apt 4' })
  @IsOptional()
  @IsString()
  address?: string;
}
