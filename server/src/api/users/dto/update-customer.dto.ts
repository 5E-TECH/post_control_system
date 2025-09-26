import { IsOptional, IsPhoneNumber, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901112233' })
  @IsOptional()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @ApiProperty({
    format: 'uuid',
    example: '2c3f5b7a-1d9e-44f7-8a1b-0a1d2b3c4d5e',
  })
  @IsOptional()
  @IsUUID()
  district_id?: string;

  @ApiPropertyOptional({ example: '27, Elm street, Apt 4' })
  @IsOptional()
  @IsString()
  address?: string;
}
