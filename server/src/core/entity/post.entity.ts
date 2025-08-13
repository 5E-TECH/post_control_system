import { BaseEntity } from 'src/common/database/BaseEntity';
import { Post_status } from 'src/common/enums';
import { Column, Entity } from 'typeorm';

@Entity('post')
export class PostEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'courier_id', nullable: true })
  courier_id: string;

  @Column({ type: 'decimal', name: 'post_total_price', default: 0 })
  post_total_price: number;

  @Column({ type: 'smallint', name: 'order_quantity', default: 0 })
  order_quantity: number;

  @Column({ type: 'varchar', name: 'qr_code_token' })
  qr_code_token: string;

  @Column({ type: 'uuid' })
  region_id: string;

  @Column({ type: 'enum', enum: Post_status, default: Post_status.NEW })
  status: Post_status;
}
