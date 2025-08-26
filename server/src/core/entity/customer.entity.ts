import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { OrderEntity } from './order.entity';
import { MarketEntity } from './market.entity';
import { CustomerMarketEntity } from './customer-market.entity';

// customer.entity.ts
@Entity('customer')
export class CustomerEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  phone_number: string;

  @Column({ type: 'uuid' })
  district_id: string;

  @Column({ type: 'varchar', nullable: true })
  address: string;

  @Column({ type: 'uuid' })
  market_id: string;

  @OneToMany(() => CustomerMarketEntity, (cm) => cm.customer)
  customerMarkets: CustomerMarketEntity[];

  @OneToMany(() => OrderEntity, (order) => order.customer)
  orders: OrderEntity[];
}
