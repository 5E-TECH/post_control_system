import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity('operator_payment')
@Index('IDX_OPERATOR_PAYMENT_OPERATOR', ['operator_id'])
@Index('IDX_OPERATOR_PAYMENT_MARKET', ['market_id'])
export class OperatorPaymentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  operator_id: string;

  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: 'uuid' })
  paid_by_id: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
