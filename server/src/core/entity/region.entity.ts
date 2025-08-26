import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToMany } from 'typeorm';
import { DistrictEntity } from './district.entity';
import { UserEntity } from './users.entity';
import { PostEntity } from './post.entity';

@Entity('region')
export class RegionEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  // 1-N Region → District
  @OneToMany(() => DistrictEntity, (district) => district.region, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  districts: DistrictEntity[];

  // 1-N Region → Couriers (User table orqali)
  @OneToMany(() => UserEntity, (user) => user.region)
  couriers: UserEntity[];

  // 1-N Region → Assigned Districts (assigned_region orqali)
  @OneToMany(() => DistrictEntity, (district) => district.assignedRegion)
  assignedDistricts: DistrictEntity[];

  // 1-N Region → Posts
  @OneToMany(() => PostEntity, (post) => post.region)
  posts: PostEntity[];
}
