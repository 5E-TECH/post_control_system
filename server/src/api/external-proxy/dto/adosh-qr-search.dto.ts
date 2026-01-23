import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdoshQrSearchDto {
  @ApiProperty({ description: 'QR code of the order' })
  @IsString()
  @IsNotEmpty()
  qr_code: string;
}
