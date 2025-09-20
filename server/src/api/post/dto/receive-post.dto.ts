import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReceivePostDto {
  @ApiProperty({
    description: 'Orders included in the post to receive',
    type: [String],
    example: [
      '6b1f3f2a-8c1d-4e2b-9f4a-1234567890ab',
      '7c2e4d3b-9d2e-5f3c-0a5b-abcdefabcdef',
    ],
  })
  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true })
  order_ids: string[];
}
