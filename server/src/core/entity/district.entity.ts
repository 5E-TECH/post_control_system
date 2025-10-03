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

  // N-1 District → Region (asosiy region_id orqali)
  @ManyToOne(() => RegionEntity, (region) => region.districts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;

  // N-1 District → Assigned Region (bog‘langan region)
  @ManyToOne(() => RegionEntity, (region) => region.assigned_districts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assigned_region' })
  assignedRegion: RegionEntity;

  // faqat id kerak bo‘lganda
  @RelationId((district: DistrictEntity) => district.assignedRegion)
  assigned_region: string;

  // District → Users (1-N)
  @OneToMany(() => UserEntity, (user) => user.district)
  users: UserEntity[];
}
