import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity('investor_payout')
@Index('IDX_INVESTOR_PAYOUT_INVESTOR', ['investor_id'])
export class InvestorPayoutEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid' })
  paid_by_id: string;
}
