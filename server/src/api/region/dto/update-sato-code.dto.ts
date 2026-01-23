import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateRegionSatoCodeDto {
  @ApiProperty({
    type: String,
    example: '1726',
    description: 'SATO (CATO) code for region',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+$/, { message: 'SATO code faqat raqamlardan iborat bo\'lishi kerak' })
  sato_code: string;
}
