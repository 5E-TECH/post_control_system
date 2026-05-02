import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLogistDto {
  @ApiPropertyOptional({ example: 'Logist User' })
  @IsOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsPhoneNumber('UZ')
  phone_number: string;

  @ApiPropertyOptional({ example: 'newPassword123' })
  @IsOptional()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 3000000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  payment_day: number;

  @ApiPropertyOptional({
    example: -2000000,
    description: "Boshlang'ich oylik qoldiq (manfiy = qarz)",
  })
  @IsOptional()
  @IsNumber()
  have_to_pay: number;
}
