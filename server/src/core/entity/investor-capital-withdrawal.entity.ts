import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';
import { bigintTransformerNonNull } from 'src/common/database/bigint.transformer';

// Investor tikkan asosiy KAPITALdan qaytarib olingan summa (append-only).
// Jami kapital = Σ hissalar − Σ qaytarishlar. Bu FOYDA taqsimoti (dividend)dan
// ALOHIDA — u investor_distribution jadvalida.
@Entity('investor_capital_withdrawal')
@Index('IDX_ICW_INVESTOR', ['investor_id'])
@Index('IDX_ICW_WITHDRAWN_AT', ['withdrawn_at'])
@Index('IDX_ICW_INVESTOR_DATE', ['investor_id', 'withdrawn_at'])
export class InvestorCapitalWithdrawalEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  // UZS qaytarilgan, > 0 (DB CHECK migration'da).
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  amount: number;

  // Iqtisodiy sana (epoch-ms).
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  withdrawn_at: number;

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
