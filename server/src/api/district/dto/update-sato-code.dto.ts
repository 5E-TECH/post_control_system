import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateDistrictSatoCodeDto {
  @ApiProperty({
    type: String,
    example: '1726201',
    description: 'SATO (CATO) code for district',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+$/, { message: 'SATO code faqat raqamlardan iborat bo\'lishi kerak' })
  sato_code: string;
}
