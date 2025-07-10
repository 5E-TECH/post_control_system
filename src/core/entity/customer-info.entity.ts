import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';

@Entity('cutomer-info')
export class CustomerInfoEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  phone_number: string;

  @Column({ type: 'varchar' })
  address: string;

  @Column({ type: 'uuid' })
  district_id: string;
}
