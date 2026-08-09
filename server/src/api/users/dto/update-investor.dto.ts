import {
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from 'src/common/enums';

// Investor akkauntini tahrirlash — ism/telefon/parol/status. Kapital/ulush
// o'zgarishlari bu yerda emas, investor equity-ledger orqali boshqariladi.
export class UpdateInvestorDto {
  @ApiPropertyOptional({ example: 'Investor Ismi' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsPhoneNumber('UZ')
  phone_number?: string;

  @ApiPropertyOptional({ example: 'strongPassword123', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ enum: Status, example: Status.ACTIVE })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
