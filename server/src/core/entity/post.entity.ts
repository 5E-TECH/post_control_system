import { BaseEntity } from 'src/common/database/BaseEntity';
import { Post_status } from 'src/common/enums';
import { Column, Entity, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { UserEntity } from './users.entity';
import { RegionEntity } from './region.entity';
import { OrderEntity } from './order.entity';

@Entity('post')
@Index('IDX_POST_STATUS', ['status'])
@Index('IDX_POST_COURIER_ID', ['courier_id'])
@Index('IDX_POST_REGION_ID', ['region_id'])
@Index('IDX_POST_CREATED_AT', ['created_at'])
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

  // N-1 Post → Courier (User)
  @ManyToOne(() => UserEntity, (user) => user.posts, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'courier_id' })
  courier: UserEntity;

  // N-1 Post → Region
  @ManyToOne(() => RegionEntity, (region) => region.posts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;

  // 1-N Post → Orders
  @OneToMany(() => OrderEntity, (order) => order.post)
  orders: OrderEntity[];
}
