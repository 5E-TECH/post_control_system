import { IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OrdersArrayDto {
  @ApiProperty({
    description: 'Array of order IDs',
    type: [String],
    example: [
      '6b1f3f2a-8c1d-4e2b-9f4a-1234567890ab',
      '7c2e4d3b-9d2e-5f3c-0a5b-abcdefabcdef',
    ],
  })
  @ArrayNotEmpty()
  @IsArray()
  order_ids: string[];

  // @IsNotEmpty()
  // @IsEnum(Order_status)
  // status: Order_status;
}
