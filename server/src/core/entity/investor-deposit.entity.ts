import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity('investor_deposit')
@Index('IDX_INVESTOR_DEPOSIT_INVESTOR', ['investor_id'])
export class InvestorDepositEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  investor_id: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid' })
  recorded_by: string;

  // Foiz qachandan boshlab hisoblanadi (bigint timestamp ms)
  @Column({ type: 'bigint' })
  effective_date: number;
}
