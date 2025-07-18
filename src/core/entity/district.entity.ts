import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { RegionEntity } from './region.entity';

@Entity('district')
export class DistrictEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'uuid' })
  region_id: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_region: string;

  @ManyToOne(() => RegionEntity, (region) => region.districts, {})
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;
}
