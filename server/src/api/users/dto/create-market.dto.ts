import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMarketDto {
  @ApiProperty({ example: 'Market 1' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @ApiProperty({ example: 10000, minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_home: number;

  @ApiProperty({ example: 8000, minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  tariff_center: number;

  @ApiProperty({ example: 'secret123' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
