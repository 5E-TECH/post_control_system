import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToMany } from 'typeorm';
import { DistrictEntity } from './district.entity';

@Entity('region')
export class RegionEntity extends BaseEntity {
  @Column({
    type: 'varchar',
  })
  name: string;

  @OneToMany(() => DistrictEntity, district => district.region)
  districts: DistrictEntity[];
}
