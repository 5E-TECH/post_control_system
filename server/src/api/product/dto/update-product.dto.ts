import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Pepsi Max 1L' })
  @IsOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '17123456789' })
  @IsOptional()
  @IsString()
  image_url: string;
}
