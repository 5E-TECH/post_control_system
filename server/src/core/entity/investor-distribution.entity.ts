import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';

// Investorga TO'LANGAN taqsimotlar (dividend) — append-only. Hisoblangan
// ulushdan alohida kuzatiladi (real to'lov vs accrued share).
@Entity('investor_distribution')
@Index('IDX_IDIST_INVESTOR', ['investor_id'])
@Index('IDX_IDIST_DISTRIBUTED_AT', ['distributed_at'])
@Index('IDX_IDIST_INVESTOR_DATE', ['investor_id', 'distributed_at'])
export class InvestorDistributionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  // UZS to'langan, > 0 (DB CHECK migration'da).
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  amount: number;

  // To'lov iqtisodiy sanasi (epoch-ms).
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  distributed_at: number;

  // Ixtiyoriy: qaysi accrual davri uchun.
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  period_start: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  period_end: number | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investor_id' })
  investor?: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserEntity;
}
