import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignInUserDto {
  @ApiProperty({
    type: String,
    example: '+998905234382',
  })
  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @ApiProperty({
    type: String,
    example: '0990',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}
