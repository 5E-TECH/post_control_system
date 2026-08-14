import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import { bigintTransformerNonNull } from 'src/common/database/bigint.transformer';

/**
 * AI xarajat hisobotining OLDINDAN HISOBLANGAN snapshoti (davr bo'yicha).
 * Kunlik cron + startup barcha davrlarni (daily/weekly/monthly/yearly) bir marta
 * hisoblab shu yerga saqlaydi; foydalanuvchi ko'rganda AI QAYTA chaqirilmaydi —
 * saqlangan payload qaytariladi (xarajat kamayadi, javob tez). Har davrда bitta
 * qator (period unique).
 */
@Entity('ai_finance_report_snapshot')
export class AiFinanceReportSnapshotEntity extends BaseEntity {
  @Index('UQ_AFRS_PERIOD', { unique: true })
  @Column({ type: 'varchar' })
  period: string; // daily | weekly | monthly | yearly

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  computed_at: number;
}
