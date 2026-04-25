import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Commission_type } from 'src/common/enums';

export class UpdateOperatorCommissionDto {
  @IsOptional()
  @IsEnum(Commission_type)
  commission_type?: Commission_type | null;

  // PERCENT 0-100, FIXED 0-1_000_000 — aniq tekshiruv service ichida (commission_type bilan birga).
  // Bu yerda umumiy yuqori chegara — absurd qiymatlarni darhol bloklaydi.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  commission_value?: number | null;

  @IsOptional()
  @IsBoolean()
  show_earnings?: boolean;
}
