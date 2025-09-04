import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Operation_type, Source_type } from 'src/common/enums';

export class CreateCashboxHistoryDto {
  // @IsEnum(Operation_type)
  // operation_type: Operation_type;

  // @IsEnum(Source_type)
  // source_type: Source_type;

  @IsOptional()
  @IsString()
  source_id: string | null;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsNumber()
  balance_after: number;

  @IsOptional()
  @IsString()
  comment: string;

  @IsNotEmpty()
  @IsString()
  created_by: string;
}
