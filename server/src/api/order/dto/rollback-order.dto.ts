import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum RollbackTarget {
  WAITING = 'waiting',
  CANCELLED = 'cancelled',
  CANCELLED_SENT = 'cancelled_sent',
}

export class RollbackOrderDto {
  @ApiPropertyOptional({
    enum: RollbackTarget,
    default: RollbackTarget.WAITING,
    description: 'Target status for rollback',
  })
  @IsOptional()
  @IsEnum(RollbackTarget)
  target_status?: RollbackTarget;
}
