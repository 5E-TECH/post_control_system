import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Commission_type } from 'src/common/enums';

export class UpdateOperatorCommissionDto {
  @IsOptional()
  @IsEnum(Commission_type)
  commission_type?: Commission_type | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission_value?: number | null;

  @IsOptional()
  @IsBoolean()
  show_earnings?: boolean;
}
