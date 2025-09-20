// customer-market.entity.ts
import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';

@Entity('customer_market')
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
