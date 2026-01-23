import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';

export class MergeDistrictsDto {
  @ApiProperty({
    type: [String],
    example: ['uuid-1', 'uuid-2'],
    description:
      "O'chiriladigan tumanlar ID'lari (buyurtmalar target_district_id ga ko'chiriladi)",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  source_district_ids: string[];

  @ApiProperty({
    type: String,
    example: 'uuid-target',
    description:
      'Maqsadli tuman ID (barcha buyurtmalar shu tumanga biriktiriladi)',
  })
  @IsNotEmpty()
  @IsUUID('4')
  target_district_id: string;
}
