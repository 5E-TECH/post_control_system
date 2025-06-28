import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Operation_type, Source_type } from 'src/common/enums';

export class CreateCashboxHistoryDto {
  @ApiProperty({
    enum: Operation_type,
    description: 'Transaction turi: INCOME yoki OUTCOME',
  })
  @IsEnum(Operation_type)
  operation_type: Operation_type;

  @ApiProperty({
    enum: Source_type,
    description: 'Qaysi manba orqali kiritilgan: PAYMENT_FROM_COURIER va h.k.',
  })
  @IsEnum(Source_type)
  source_type: Source_type;

  @ApiProperty({
    type: String,
    description: 'Manba ID (optional, masalan: payment_id)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  source_id: string | null;

  @ApiProperty({
    type: Number,
    description: 'Pul miqdori',
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    type: Number,
    description: 'Amaliyotdan keyingi balansi',
  })
  @IsNotEmpty()
  @IsNumber()
  balance_after: number;

  @ApiProperty({
    type: String,
    description: 'Izoh (optional)',
  })
  @IsOptional()
  @IsString()
  comment: string;

  @ApiProperty({
    type: String,
    description: 'Kim tomonidan kiritilgan',
  })
  @IsNotEmpty()
  @IsString()
  created_by: string;
}
