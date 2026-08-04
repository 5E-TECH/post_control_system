import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';
import { bigintTransformerNonNull } from 'src/common/database/bigint.transformer';

// Investor (ulushdor) kiritgan kapital — faqat qo'shiladigan (append-only) ledger.
@Entity('investor_capital_contribution')
@Index('IDX_ICC_INVESTOR', ['investor_id'])
@Index('IDX_ICC_CONTRIBUTED_AT', ['contributed_at'])
@Index('IDX_ICC_INVESTOR_DATE', ['investor_id', 'contributed_at'])
export class InvestorCapitalContributionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  // UZS, > 0 (DB CHECK migration'da). bigint — float drift yo'q.
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  amount: number;

  // Iqtisodiy sana (epoch-ms) — created_at (yozuv vaqti)dan alohida.
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  contributed_at: number;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  // Kim kiritdi (admin) — audit.
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investor_id' })
  investor?: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserEntity;
}
