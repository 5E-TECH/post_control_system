import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';

@Entity('courier-region')
export class CourierRegionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  courier_id: string;

  @Column({ type: 'uuid' })
  region_id: string;
}
