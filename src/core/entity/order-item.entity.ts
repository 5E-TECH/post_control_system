import { BaseEntity, Column, Entity } from 'typeorm';

@Entity('order_item')
export class OrderItemEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'int' })
  quantity: number;
}
