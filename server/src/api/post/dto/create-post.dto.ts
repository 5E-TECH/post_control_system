import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ArrayNotEmpty,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    example: 'b7c9e8f2-3a34-4c6e-91fd-d30cce5591f3',
    description: 'Kuryerning ID raqami',
  })
  @IsUUID(4, { message: 'Kuryer ID noto\'g\'ri formatda' })
  @IsNotEmpty({ message: 'Kuryer ID kiritilishi shart' })
  courier_id: string;

  @ApiProperty({
    type: String,
    example: 'QR123TOKEN456',
    description: 'QR kod orqali berilgan token',
  })
  @IsString({ message: 'QR kod token matn formatida bo\'lishi kerak' })
  @IsNotEmpty({ message: 'QR kod token kiritilishi shart' })
  qr_code_token: string;

  @ApiProperty({
    type: [String],
    example: [
      'd5f6e1ad-8a5b-4b91-bb5a-9876501a0b15',
      'e8e7a3dc-449e-4e58-95b4-fc94e8c333c7',
    ],
    description: 'Postga boglanadigan buyurtmalar ID lar royxati',
  })
  @IsArray({ message: 'Buyurtmalar array formatida bo\'lishi kerak' })
  @ArrayNotEmpty({ message: 'Kamida bitta buyurtma tanlanishi shart' })
  @IsUUID('all', { each: true, message: 'Buyurtma ID lari noto\'g\'ri formatda' })
  orderIDs: string[];
}
