import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class SendPostDto {
  @ApiProperty({
    type: [String],
    required: false,
    description: 'Agar kerak bolsa yangilanishi kerak bolgan order ID lar',
  })
  @IsNotEmpty({ message: 'Buyurtmalar ro\'yxati kiritilishi shart' })
  @IsArray({ message: 'Buyurtmalar array formatida bo\'lishi kerak' })
  @IsUUID('all', { each: true, message: 'Buyurtma ID lari noto\'g\'ri formatda' })
  orderIds: string[];

  @IsNotEmpty({ message: 'Kuryer ID kiritilishi shart' })
  @IsUUID(4, { message: 'Kuryer ID noto\'g\'ri formatda' })
  courierId: string;
}
