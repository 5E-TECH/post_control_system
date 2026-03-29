import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity('operator_earning')
@Unique('UQ_OPERATOR_EARNING_ORDER', ['order_id'])
@Index('IDX_OPERATOR_EARNING_OPERATOR', ['operator_id'])
@Index('IDX_OPERATOR_EARNING_MARKET', ['market_id'])
export class OperatorEarningEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  operator_id: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: 'float' })
  amount: number;
}
