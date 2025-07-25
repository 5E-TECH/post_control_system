import { BaseEntity } from 'src/common/database/BaseEntity';
import { Roles, Status } from 'src/common/enums';
import { Column, Entity } from 'typeorm';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  first_name: string;

  @Column({ type: 'varchar' })
  last_name: string;

  @Column({ type: 'varchar', unique: true })
  phone_number: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'uuid', nullable: true })
  region_id: string;

  @Column({ type: 'int', nullable: true })
  tariff_home: number;

  @Column({ type: 'int', nullable: true })
  tariff_center: number;

  @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
  status: Status;

  @Column({ type: 'enum', enum: Roles, default: Roles.ADMIN })
  role: Roles;
}
