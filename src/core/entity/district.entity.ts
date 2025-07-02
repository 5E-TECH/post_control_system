import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { RegionEntity } from './region.entity';

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
}
