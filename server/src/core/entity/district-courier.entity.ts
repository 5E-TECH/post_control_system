// district-courier.entity.ts
import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { DistrictEntity } from './district.entity';

@Entity('district_courier')
export class DistrictCourierEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  phone_number: string;

  @Column({ type: 'uuid' })
  district_id: string;

  @ManyToOne(() => DistrictEntity, (district) => district.couriers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'district_id' })
  district: DistrictEntity;
}
