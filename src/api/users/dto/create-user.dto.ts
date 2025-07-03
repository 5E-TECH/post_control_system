import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
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
  @IsNotEmpty()
  @IsString()
  password: string;
}
