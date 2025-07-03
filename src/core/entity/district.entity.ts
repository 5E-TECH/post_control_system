import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { RegionEntity } from './region.entity';
import { CourierDistrict } from './courier_district.entity';

@Entity('district')
export class DistrictEntity extends BaseEntity {
  @Column({
    type: 'varchar',
  })
  name: string;

  @Column({type:String})
  region_id:string

  @ManyToOne(() => RegionEntity, (region) => region.districts, {})
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;

  @OneToMany(() => CourierDistrict, (cd) => cd.district)
  courierDistricts: CourierDistrict[];
}
