import { BaseEntity } from 'src/common/database/BaseEntity';
import { AddOrder, Status } from 'src/common/enums';
import { Column, Entity, OneToOne, OneToMany } from 'typeorm';
import { ProductEntity } from './product.entity';
import { CustomerMarketEntity } from './customer-market.entity';
import { OrderEntity } from './order.entity';
import { CashEntity } from './cash-box.entity';

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

  @OneToMany(() => CustomerMarketEntity, (cm) => cm.market)
  customerMarkets: CustomerMarketEntity[];

  @OneToMany(() => ProductEntity, (product) => product.market)
  products: ProductEntity[];

  @OneToMany(() => OrderEntity, (order) => order.market)
  orders: OrderEntity[];
}
