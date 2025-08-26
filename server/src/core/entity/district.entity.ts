import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { RegionEntity } from './region.entity';

@Entity('district')
export class DistrictEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'uuid' })
  region_id: string;

  @Column({ type: 'uuid' })
  assigned_region: string; // ❌ nullable yo‘q

  // N-1 District → Region
  @ManyToOne(() => RegionEntity, (region) => region.districts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;

  // N-1 District → Assigned Region (always required)
  @ManyToOne(() => RegionEntity, (region) => region.assignedDistricts, {
    onDelete: 'CASCADE', // agar parent region o‘chsa, shu district ham o‘chadi
  })
  @JoinColumn({ name: 'assigned_region' })
  assignedRegion: RegionEntity;
}
