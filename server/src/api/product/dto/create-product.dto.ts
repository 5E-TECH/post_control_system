import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    type: String,
    description: 'Name of product',
    example: 'Pepsi',
  })
  @IsNotEmpty({ message: 'Mahsulot nomi kiritilishi shart' })
  @IsString({ message: 'Mahsulot nomi matn formatida bo\'lishi kerak' })
  name: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    example: 'a79f9f6a-dc32-4fcb-a3c1-8dabc1c51e9b',
    description: 'Market ID',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Market ID noto\'g\'ri formatda' })
  market_id?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    type: String,
    description: 'Image file name',
    example: '17123456789',
  })
  image_url?: string;
}
