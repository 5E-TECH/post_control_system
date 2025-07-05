import { BaseEntity } from 'src/common/database/BaseEntity';
import { Order_status } from 'src/common/enums';
import { Column, Entity } from 'typeorm';

@Entity('order')
export class OrderEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: 'uuid' })
  district_id: string;

  @Column({ type: 'varchar' })
  client_name: string;

  @Column({ type: 'varchar' })
  client_phone_number: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'float' })
  total_price: number;

  @Column({ type: 'int', default: 0 })
  product_quantity: number;

  @Column({ type: 'enum', enum: Order_status })
  status: Order_status;

  @Column({ type: 'uuid', nullable: true })
  parent_order_id: string;

  @Column({ type: 'uuid', nullable: true })
  post_id: string | null;

  @Column({ type: 'varchar' })
  qr_code_token: string;
}
