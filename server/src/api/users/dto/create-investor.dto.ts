import { IsNotEmpty, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Investor (ulushdor) akkaunti — faqat login uchun. Kapital/ulush/taqsimot
// ma'lumotlari alohida equity-ledger orqali (Faza 3) kiritiladi, bu DTO'da emas.
export class CreateInvestorDto {
  @ApiProperty({ example: 'Investor Ismi' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @ApiProperty({ example: 'strongPassword123', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
