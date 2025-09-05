import { BaseEntity } from 'src/common/database/BaseEntity';
import { Roles, Status } from 'src/common/enums';
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { UserSalaryEntity } from './user-salary.entity';
import { CashEntity } from './cash-box.entity';
import { CashboxHistoryEntity } from './cashbox-history.entity';
import { RegionEntity } from './region.entity';
import { PostEntity } from './post.entity';

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

  // 1-1 User → Salary
  @OneToOne(() => UserSalaryEntity, (userSalary) => userSalary.user, {
    cascade: true,
  })
  @JoinColumn()
  salary: UserSalaryEntity;

  // 1-1 User → Cashbox
  @OneToOne(() => CashEntity, (cashbox) => cashbox.user, { cascade: true })
  cashbox: CashEntity;

  // 1-N User → CashboxHistory (created_by)
  @OneToMany(() => CashboxHistoryEntity, (history) => history.createdByUser)
  histories: CashboxHistoryEntity[];

  // N-1 User (courier) → Region
  @ManyToOne(() => RegionEntity, (region) => region.couriers, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;

  // 1-N Courier (User) → Posts
  @OneToMany(() => PostEntity, (post) => post.courier)
  posts: PostEntity[];
}
