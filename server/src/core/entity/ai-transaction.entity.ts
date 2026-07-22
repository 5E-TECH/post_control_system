import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import { bigintTransformerNonNull } from 'src/common/database/bigint.transformer';

export type AiTxType = 'topup' | 'usage' | 'refund';

/**
 * Market AI-balansi tranzaksiyalari (audit + tarix).
 * amount: har doim musbat; type yo'nalishni bildiradi.
 */
@Entity('ai-transaction')
@Index('IDX_AI_TX_MARKET', ['market_id', 'created_at'])
export class AiTransactionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: 'varchar' })
  type: AiTxType;

  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  amount: number;

  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  balance_after: number;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  actor: string | null;

  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;
}
