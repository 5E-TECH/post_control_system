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
import { CustomerMarketEntity } from './customer-market.entity';
import { ProductEntity } from './product.entity';
import { OrderEntity } from './order.entity';
import { DistrictEntity } from './district.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  phone_number: string;

  @Column({ type: 'varchar', nullable: true })
  password: string;

  @Column({ type: 'uuid', nullable: true })
  region_id: string;

  @Column({ type: 'uuid', nullable: true })
  district_id: string;

  @Column({ type: 'int', nullable: true })
  tariff_home: number;

  @Column({ type: 'int', nullable: true })
  tariff_center: number;

  @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
  status: Status;

  @Column({ type: 'enum', enum: Roles })
  role: Roles;

  @Column({ type: 'boolean', default: false, nullable: true })
  add_order: boolean;

  @Column({ type: 'varchar', nullable: true })
  market_tg_token: string;

  @Column({ type: 'varchar', nullable: true })
  address: string;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

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

  // users.entity.ts
  @OneToMany(() => CustomerMarketEntity, (cm) => cm.customer)
  customerLinks: CustomerMarketEntity[];

  @OneToMany(() => CustomerMarketEntity, (cm) => cm.market)
  marketLinks: CustomerMarketEntity[];

  // ...
  @OneToMany(() => ProductEntity, (product) => product.user)
  products: ProductEntity[];

  // users.entity.ts ichida

  // ...
  // users.entity.ts

  @OneToMany(() => OrderEntity, (order) => order.market)
  marketOrders: OrderEntity[];

  @OneToMany(() => OrderEntity, (order) => order.customer)
  customerOrders: OrderEntity[];

  // User → District (N-1)
  @ManyToOne(() => DistrictEntity, (district) => district.users, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'district_id' })
  district: DistrictEntity;
}
