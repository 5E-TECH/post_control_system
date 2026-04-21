import { BaseEntity } from 'src/common/database/BaseEntity';
import { Order_status, Where_deliver } from 'src/common/enums';
import { Column, Entity, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { OrderItemEntity } from './order-item.entity';
import { PostEntity } from './post.entity';
import { UserEntity } from './users.entity';
import { DistrictEntity } from './district.entity';
import {
  bigintTransformer as bigintTransformerNullable,
  bigintTransformerNonNull as bigintTransformer,
} from 'src/common/database/bigint.transformer';

@Entity('order')
@Index('IDX_ORDER_STATUS', ['status'])
@Index('IDX_ORDER_USER_ID', ['user_id'])
@Index('IDX_ORDER_CUSTOMER_ID', ['customer_id'])
@Index('IDX_ORDER_POST_ID', ['post_id'])
@Index('IDX_ORDER_CREATED_AT', ['created_at'])
@Index('IDX_ORDER_STATUS_USER', ['status', 'user_id'])
@Index('IDX_ORDER_STATUS_CREATED', ['status', 'created_at'])
// Dashboard statistika uchun indexlar
@Index('IDX_ORDER_SOLD_AT', ['sold_at'])
@Index('IDX_ORDER_STATUS_SOLD', ['status', 'sold_at'])
@Index('IDX_ORDER_USER_CREATED', ['user_id', 'created_at'])
@Index('IDX_ORDER_USER_SOLD', ['user_id', 'sold_at'])
@Index('IDX_ORDER_DISTRICT_ID', ['district_id'])
@Index('IDX_ORDER_OPERATOR_ID', ['operator_id'])
export class OrderEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'int', default: 0 })
  product_quantity: number;

  @Column({ type: 'enum', enum: Where_deliver, default: Where_deliver.CENTER })
  where_deliver: Where_deliver;

  @Column({ type: 'float' })
  total_price: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  to_be_paid: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  paid_amount: number;

  @Column({ type: 'enum', enum: Order_status })
  status: Order_status;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'text', nullable: true })
  operator: string;

  @Column({ type: 'varchar', nullable: true })
  operator_phone: string | null;

  // Buyurtmani yaratgan operatorning user ID si
  @Column({ type: 'uuid', nullable: true })
  operator_id: string | null;

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

  // Buyurtma uchun yetkazib berish manzili
  @Column({ type: 'uuid', nullable: true })
  district_id: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformerNullable })
  sold_at: number | null;

  // Sotilgan paytdagi tariflar (tarix uchun saqlanadi)
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformerNullable })
  market_tariff: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformerNullable })
  courier_tariff: number | null;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  // Courier buyurtmani qaytarish so'rovi yuborgan
  @Column({ type: 'boolean', default: false })
  return_requested: boolean;

  @Column({ type: 'jsonb', nullable: true })
  create_bot_messages: { chatId: number; messageId: number }[];

  // Tashqi saytlardan kelgan buyurtma ID si (Adosh, etc.)
  @Column({ type: 'varchar', nullable: true })
  external_id: string;

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
    onDelete: 'CASCADE', // user o'chsa order o'chadi
  })
  @JoinColumn({ name: 'customer_id' })
  customer: UserEntity; // Buyurtma beruvchi

  // 🟢 Many Orders → One District (yetkazib berish manzili)
  @ManyToOne(() => DistrictEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'district_id' })
  district: DistrictEntity;
}
