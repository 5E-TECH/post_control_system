import { BaseEntity } from 'src/common/database/BaseEntity';
import { Order_status, Where_deliver } from 'src/common/enums';
import { Column, Entity } from 'typeorm';

@Entity('order')
export class OrderEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  market_id: string;

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

  @Column({ type: 'uuid', nullable: true })
  post_id: string | null;

  @Column({ type: 'varchar' })
  qr_code_token: string;

  @Column({ type: 'uuid', nullable: true })
  parent_order_id: string;
}
