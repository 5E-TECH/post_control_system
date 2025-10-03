// district.entity.ts
import { BaseEntity } from 'src/common/database/BaseEntity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
} from 'typeorm';
import { RegionEntity } from './region.entity';
import { UserEntity } from './users.entity';

@Entity('district')
export class DistrictEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'uuid' })
  region_id: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_region: string;

  // N-1 District → Region
  @ManyToOne(() => RegionEntity, (region) => region.districts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;

  // N-1 District → Assigned Region
  @ManyToOne(() => RegionEntity, (region) => region.assignedDistricts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assigned_region' })
  assignedToRegion: RegionEntity;

  @RelationId((district: DistrictEntity) => district.assignedToRegion)
  assignedToRegionId: string;

  @OneToMany(() => UserEntity, (user) => user.district)
  users: UserEntity[];
}
