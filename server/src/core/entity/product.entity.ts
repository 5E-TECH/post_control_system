import { BaseEntity } from 'src/common/database/BaseEntity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './users.entity';
import { OrderItemEntity } from './order-item.entity';

// 🟢 ProductEntity
@Entity('product')
@Index(['name', 'user_id'], { unique: true }) // endi name + user_id unique
@Index('IDX_PRODUCT_USER_ID', ['user_id'])
@Index('IDX_PRODUCT_DELETED', ['isDeleted'])
export class ProductEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  image_url: string | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  // Many Products → One User (Market owner)
  @ManyToOne(() => UserEntity, (user) => user.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  // One Product → Many OrderItems
  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.product)
  orderItems: OrderItemEntity[];
}
