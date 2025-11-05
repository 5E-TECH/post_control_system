import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDistrictNameDto {
  @ApiProperty({ type: String, example: 'Yangi Namangan' })
  @IsNotEmpty()
  @IsString()
  name: string;
}
