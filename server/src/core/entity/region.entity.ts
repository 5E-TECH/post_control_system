// region.entity.ts
import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
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

  // N-1 Region → Logist (bitta logist ko'p regionga biriktirilishi mumkin)
  @Column({ type: 'uuid', nullable: true })
  logist_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'logist_id' })
  logist: UserEntity;

  // N-1 Region → Main Courier (viloyatning asosiy kuryeri)
  @Column({ type: 'uuid', nullable: true })
  main_courier_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'main_courier_id' })
  mainCourier: UserEntity;
}
