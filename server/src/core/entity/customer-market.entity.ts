// customer-market.entity.ts
import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './users.entity';

@Entity('customer_market')
@Index('IDX_CUSTOMER_MARKET_CUSTOMER_ID', ['customer_id'])
@Index('IDX_CUSTOMER_MARKET_MARKET_ID', ['market_id'])
@Index('IDX_CUSTOMER_MARKET_BIDIRECTIONAL', ['market_id', 'customer_id'])
export class CustomerMarketEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  market_id: string;

  // Customer → User (role = CUSTOMER bo‘lishi kerak)
  @ManyToOne(() => UserEntity, (user) => user.customerLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: UserEntity;

  // Market → User (role = MARKET bo‘lishi kerak)
  @ManyToOne(() => UserEntity, (user) => user.marketLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'market_id' })
  market: UserEntity;
}
