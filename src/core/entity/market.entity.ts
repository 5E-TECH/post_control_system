import { BaseEntity } from 'src/common/database/BaseEntity';
import { AddOrder, Status } from 'src/common/enums';
import { Column, Entity, OneToMany } from 'typeorm';
import { ProductEntity } from './product.entity';

@Entity('market')
export class MarketEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  market_name: string;

  @Column({ type: 'varchar' })
  phone_number: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'int' })
  tariff_home: number;

  @Column({ type: 'int' })
  tariff_center: number;

  @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
  status: Status;

  @Column({ type: 'enum', enum: AddOrder, default: AddOrder.FORBID })
  add_order: AddOrder;

  @Column({ type: 'varchar' })
  telegram_token: string;
}
