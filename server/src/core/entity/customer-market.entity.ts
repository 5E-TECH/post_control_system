import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { CustomerEntity } from './customer.entity';
import { MarketEntity } from './market.entity';
// customer_market.entity.ts
@Entity('customer_market')
export class CustomerMarketEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  market_id: string;

  @ManyToOne(() => CustomerEntity, (customer) => customer.customerMarkets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity;

  @ManyToOne(() => MarketEntity, (market) => market.customerMarkets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'market_id' })
  market: MarketEntity;
}
