import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SalaryDto {
  @ApiProperty({
    type: Number,
    example: 1_000_000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    type: String,
    example: 'Avans berildi',
  })
  @IsOptional()
  @IsString()
  comment: string;
}
