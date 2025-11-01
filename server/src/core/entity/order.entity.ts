import { BaseEntity } from 'src/common/database/BaseEntity';
import { Order_status, Where_deliver } from 'src/common/enums';
import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { OrderItemEntity } from './order-item.entity';
import { PostEntity } from './post.entity';
import { UserEntity } from './users.entity';

@Entity('order')
export class OrderEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'int', default: 0 })
  product_quantity: number;

  @Column({ type: 'enum', enum: Where_deliver, default: Where_deliver.CENTER })
  where_deliver: Where_deliver;

  @Column({ type: 'float' })
  total_price: number;

  @Column({ type: 'int', default: 0 })
  to_be_paid: number;

  @Column({ type: 'int', default: 0 })
  paid_amount: number;

  @Column({ type: 'enum', enum: Order_status })
  status: Order_status;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'text', nullable: true })
  operator: string;

  @Column({ type: 'uuid', nullable: true })
  post_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  canceled_post_id: string | null;

  @Column({ type: 'varchar' })
  qr_code_token: string;

  @Column({ type: 'uuid', nullable: true })
  parent_order_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'bigint', nullable: true })
  sold_at: number | null;

  @Column({ type: 'boolean', default: true })
  deleted: boolean;

  // 🟢 One Order → Many OrderItems
  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items: OrderItemEntity[];

  // 🟢 Many Orders → One Post
  @ManyToOne(() => PostEntity, (post) => post.orders, {
    onDelete: 'SET NULL', // order o‘chsa post qoladi
  })
  @JoinColumn({ name: 'post_id' })
  post: PostEntity;

  // order.entity.ts
  @ManyToOne(() => UserEntity, (user) => user.marketOrders, {
    onDelete: 'CASCADE', // user o‘chsa order o‘chadi
  })
  @JoinColumn({ name: 'user_id' })
  market: UserEntity; // Market egasi

  @ManyToOne(() => UserEntity, (user) => user.customerOrders, {
    onDelete: 'CASCADE', // user o‘chsa order o‘chadi
  })
  @JoinColumn({ name: 'customer_id' })
  customer: UserEntity; // Buyurtma beruvchi
}
