import { ApiProperty } from '@nestjs/swagger';
import { Operation_type, Source_type } from 'src/common/enums';

export class UpdateCashBoxDto {
  @ApiProperty({
    type: Number,
    example: 1_000_000,
  })
  balance: number;

  @ApiProperty({
    enum: Source_type,
    example: Source_type.BILLS,
  })
  type: Source_type;

  @ApiProperty({
    type: String,
    example: 'Xodimlar kechki ovqati uchun',
  })
  comment: string;
}
