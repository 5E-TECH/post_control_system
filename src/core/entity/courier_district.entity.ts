import { BaseEntity } from "src/common/database/BaseEntity";
import { Entity, JoinColumn, ManyToOne } from "typeorm";
import { UserEntity } from "./users.entity";
import { DistrictEntity } from "./district.entity";

@Entity('courier_district')
export class CourierDistrict extends BaseEntity{
    
  @ManyToOne(() => UserEntity, (courier) => courier.courierDistricts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courier_id' })
  courier: UserEntity;

  @ManyToOne(() => DistrictEntity, (district) => district.courierDistricts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'district_id' })
  district: DistrictEntity;
}