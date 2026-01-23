import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateRegionNameDto {
  @ApiProperty({
    type: String,
    example: 'Toshkent viloyati',
    description: 'Yangi viloyat nomi',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  name: string;
}
