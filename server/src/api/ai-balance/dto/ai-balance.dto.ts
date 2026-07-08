import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class TopupDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ToggleAiDto {
  @IsBoolean()
  enabled: boolean;
}

export class SetPriceDto {
  // null = global default'ga qaytarish
  @ValidateIf((o) => o.price !== null)
  @IsInt()
  @Min(0)
  price: number | null;
}
