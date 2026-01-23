import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsUUID,
  ArrayNotEmpty,
} from 'class-validator';

// Tashqi buyurtmalarni qabul qilish uchun DTO
// Integratsiya ID orqali market va field_mapping avtomatik olinadi
export class ReceiveExternalOrdersDto {
  @ApiProperty({
    description: 'Integratsiya ID (external_integration jadvalidan)',
  })
  @IsNotEmpty({ message: 'Integratsiya ID kiritilishi shart' })
  @IsUUID(4, { message: "Integratsiya ID noto'g'ri formatda" })
  integration_id: string;

  @ApiProperty({
    description:
      "Tashqi buyurtmalar ro'yxati (struktura field_mapping ga bog'liq)",
    type: [Object],
    example: [
      {
        id: 12345,
        qrCode: 'ABC123',
        full_name: 'Test Mijoz',
        phone: '+998901234567',
        district: '1101',
        total_price: 50000,
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty({ message: "Buyurtmalar ro'yxati bo'sh bo'lmasligi kerak" })
  orders: any[];
}
