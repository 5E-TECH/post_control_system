import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignInUserDto {
  @ApiProperty({
    type: String,
    example: '+998905234382',
  })
  @IsNotEmpty({ message: 'Telefon raqam kiritilishi shart' })
  @IsString({ message: 'Telefon raqam matn formatida bo\'lishi kerak' })
  phone_number: string;

  @ApiProperty({
    type: String,
    example: '0990',
  })
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  @IsString({ message: 'Parol matn formatida bo\'lishi kerak' })
  password: string;
}
