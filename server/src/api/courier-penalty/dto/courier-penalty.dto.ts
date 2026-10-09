import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CourierPenaltyCalc,
  CourierPenaltyEvent,
  CourierPenaltyScope,
} from '../../order/utils/courier-penalty.util';
import { WAIVER_REASONS } from '../waiver-reasons.const';

export class OverdueQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  regionId?: string;

  /**
   * Eng kam kechikish (kun). Standart 1 — ya'ni muddat o'tganlar.
   * `0` berilsa muddat ichidagilar ham ko'rinadi.
   */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDays?: number;
}

export class EntriesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courierId?: string;

  @ApiPropertyOptional({ enum: ['penalty', 'bonus', 'waiver'] })
  @IsOptional()
  @IsIn(['penalty', 'bonus', 'waiver'])
  kind?: string;

  @ApiPropertyOptional({ description: 'ms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  from?: number;

  @ApiPropertyOptional({ description: 'ms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  to?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SummaryQueryDto {
  @ApiPropertyOptional({ description: 'ms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  from?: number;

  @ApiPropertyOptional({ description: 'ms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  to?: number;
}

/**
 * QOIDA YARATISH / O'ZGARTIRISH.
 *
 * ⚠️ `amount` ISHORALI: shtraf MANFIY, bonus MUSBAT. DTO buni
 * tekshirmaydi (ishora `event` ga bog'liq) — mantiqiy tekshiruv
 * `CourierPenaltyAdminService.assertRule` da, bitta joyda.
 */
export class UpsertRuleDto {
  @ApiProperty({ enum: CourierPenaltyScope })
  @IsEnum(CourierPenaltyScope)
  scope_type: CourierPenaltyScope;

  @ApiPropertyOptional({ description: 'kuryer yoki viloyat id' })
  @IsOptional()
  @IsUUID()
  scope_id?: string | null;

  @ApiProperty({ enum: CourierPenaltyEvent })
  @IsEnum(CourierPenaltyEvent)
  event: CourierPenaltyEvent;

  @ApiProperty({ example: 4, description: 'muddat (kun) yoki bonus darajasi' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold_days: number;

  @ApiProperty({ enum: CourierPenaltyCalc })
  @IsEnum(CourierPenaltyCalc)
  calc: CourierPenaltyCalc;

  @ApiProperty({ example: -2000, description: 'ISHORALI: shtraf manfiy' })
  @Type(() => Number)
  @IsInt()
  amount: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_amount?: number | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: 'ms; berilmasa hozirdan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  active_from?: number;

  @ApiPropertyOptional({ description: 'ms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  active_to?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/**
 * SHTRAFNI BEKOR QILISH.
 *
 * ⚠️ `reason` YOPIQ RO'YXATDAN va MAJBURIY — qulflangan qaror.
 * `note` ixtiyoriy va sababning O'RNINI BOSMAYDI.
 */
export class WaiveEntryDto {
  @ApiProperty({ enum: WAIVER_REASONS })
  @IsIn(WAIVER_REASONS as unknown as string[])
  reason: (typeof WAIVER_REASONS)[number];

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  note?: string;
}

/**
 * MODULNI YOQISH / O'CHIRISH.
 *
 * ⚠️ Yagona maydon ATAYLAB: `activated_at` ni mijoz BERMAYDI, uni server
 * qo'yadi. Aks holda langarni orqaga surib, o'tgan davr uchun pul
 * yechish mumkin bo'lardi.
 */
export class SetActiveDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  active: boolean;
}

export class SetExemptDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  exempt: boolean;
}
