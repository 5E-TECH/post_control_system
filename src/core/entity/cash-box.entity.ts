import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';

@Entity('cash_box')
export class CashEntity extends BaseEntity {
  @Column({
    type: 'decimal',
  })
  balance: number;
}
