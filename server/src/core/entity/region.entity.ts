// region.entity.ts
import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToMany, Index } from 'typeorm';
import { DistrictEntity } from './district.entity';
import { UserEntity } from './users.entity';
import { PostEntity } from './post.entity';

@Entity('region')
@Index('IDX_REGION_SATO_CODE', ['sato_code'])
@Index('IDX_REGION_NAME', ['name'])
export class RegionEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  sato_code: string;

  // 1-N Region → District
  @OneToMany(() => DistrictEntity, (district) => district.region, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  districts: DistrictEntity[];

  // 1-N Region → Couriers (User orqali)
  @OneToMany(() => UserEntity, (user) => user.region)
  couriers: UserEntity[];

  // 1-N Region → Assigned Districts
  @OneToMany(() => DistrictEntity, (district) => district.assignedToRegion)
  assignedDistricts: DistrictEntity[];

  // 1-N Region → Posts
  @OneToMany(() => PostEntity, (post) => post.region)
  posts: PostEntity[];
}
