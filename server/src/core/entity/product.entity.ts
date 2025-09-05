import { BaseEntity } from 'src/common/database/BaseEntity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { MarketEntity } from './market.entity';
import { OrderItemEntity } from './order-item.entity';

// 🟢 ProductEntity
@Entity('product')
@Index(['name', 'market_id'], { unique: true })
export class ProductEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  image_url: string;

  // Many Products → One Market
  @ManyToOne(() => MarketEntity, (market) => market.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'market_id' })
  market: MarketEntity;

  // One Product → Many OrderItems
  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.product)
  orderItems: OrderItemEntity[];
}
