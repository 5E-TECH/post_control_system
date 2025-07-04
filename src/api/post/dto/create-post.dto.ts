import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    example: 'b7c9e8f2-3a34-4c6e-91fd-d30cce5591f3',
    description: 'Kuryerning ID raqami',
  })
  @IsUUID()
  @IsNotEmpty()
  courier_id: string;

  @ApiProperty({
    type: Number,
    example: 125000.5,
    description: 'Post orqali yetkazilgan buyurtmalarning umumiy summasi',
  })
  @IsNumber()
  @IsNotEmpty()
  post_total_price: number;

  @ApiProperty({
    type: Number,
    example: 3,
    description: 'Ushbu post tarkibidagi buyurtmalar soni',
  })
  @IsInt()
  @IsNotEmpty()
  order_quantity: number;

  @ApiProperty({
    type: String,
    example: 'QR-POST-001',
    description: 'Post uchun QR kod nomi',
  })
  @IsString()
  @IsNotEmpty()
  QR_code_name: string;
}
