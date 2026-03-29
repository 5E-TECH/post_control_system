import { IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvestorDto {
  @ApiProperty({ example: 'Investor Name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @IsNotEmpty()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @ApiProperty({ example: 'password123' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ example: 100000000, description: '0 = sherik (partner)' })
  @IsNumber()
  @Min(0)
  committed_amount: number;

  @ApiProperty({ example: 20, description: 'Foiz ulushi (0.01 - 100)' })
  @IsNumber()
  @Min(0.01)
  @Max(100)
  share_percent: number;

  @ApiPropertyOptional({
    example: -500000,
    description: 'Boshlangich balans. Manfiy = qarz (avval ko\'p to\'langan). Musbat = ajratilmagan foyda.',
  })
  @IsOptional()
  @IsNumber()
  initial_balance?: number;
}
