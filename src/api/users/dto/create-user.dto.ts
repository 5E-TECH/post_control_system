import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
} from 'class-validator';
import { Roles } from 'src/common/enums';

export class CreateUserDto {
  @ApiProperty({
    type: String,
    example: 'Dilshod',
  })
  @IsNotEmpty()
  @IsString()
  first_name: string;

  @ApiProperty({
    type: String,
    example: 'Urozov',
  })
  @IsNotEmpty()
  @IsString()
  last_name: string;

  @ApiProperty({
    type: String,
    example: 'courier',
  })
  @IsNotEmpty()
  @IsIn([Roles.ADMIN, Roles.COURIER, Roles.REGISTRATOR])
  role: Roles;

  @IsOptional()
  @IsString()
  region_id?: string;

  @ApiProperty({
    type: String,
    example: '+998905234382',
  })
  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @ApiProperty({
    type: String,
    example: '0990',
  })
  @IsOptional()
  @IsString()
  password: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_home?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tariff_center?: number;
}
