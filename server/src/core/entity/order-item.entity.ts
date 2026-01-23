import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OrderEntity } from './order.entity';
import { ProductEntity } from './product.entity';

// 🟢 OrderItemEntity
@Entity('order_item')
@Index('IDX_ORDER_ITEM_ORDER_ID', ['orderId'])
@Index('IDX_ORDER_ITEM_PRODUCT_ID', ['productId'])
@Index('IDX_ORDER_ITEM_ORDER_PRODUCT', ['orderId', 'productId'])
export class OrderItemEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'int' })
  quantity: number;

  // Many OrderItems → One Order
  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  // Many OrderItems → One Product
  @ManyToOne(() => ProductEntity, (product) => product.orderItems)
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;
}
