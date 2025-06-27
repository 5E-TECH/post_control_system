import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    type: String,
    description: 'Name of product',
    example: 'Pepsi',
  })
  name: string;

  @IsNotEmpty()
  @IsUUID()
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    example: 'a79f9f6a-dc32-4fcb-a3c1-8dabc1c51e9b',
    description: 'Market ID',
  })
  market_id: string;

  @IsOptional()
  image_url: string;
}
