import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity('investor_earning')
@Unique('UQ_INVESTOR_EARNING_ORDER', ['investor_id', 'order_id'])
@Index('IDX_INVESTOR_EARNING_INVESTOR', ['investor_id'])
@Index('IDX_INVESTOR_EARNING_ORDER', ['order_id'])
export class InvestorEarningEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'float' })
  effective_percent: number;

  @Column({ type: 'float' })
  profit: number;
}
