import { BaseEntity } from 'src/common/database/BaseEntity';
import { Cashbox_type } from 'src/common/enums';
import { Column, Entity } from 'typeorm';

@Entity('cash_box')
export class CashEntity extends BaseEntity {
  @Column({
    type: 'decimal',
    default: 0,
  })
  balance: number;

  @Column({ type: 'enum', enum: Cashbox_type })
  cashbox_type: Cashbox_type;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;
}
