import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class SendPostDto {
  @ApiProperty({
    type: [String],
    required: false,
    description: 'Agar kerak bolsa yangilanishi kerak bolgan order ID lar',
  })
  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true })
  orderIds: string[];

  @IsNotEmpty()
  @IsUUID()
  courierId: string;
}
