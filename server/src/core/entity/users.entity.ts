import { BaseEntity } from 'src/common/database/BaseEntity';
import { Commission_type, Roles, Status, Where_deliver } from 'src/common/enums';
import {
  Column,
  Entity,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
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
@Index('IDX_USERS_ROLE', ['role'])
@Index('IDX_USERS_STATUS', ['status'])
@Index('IDX_USERS_ROLE_STATUS', ['role', 'status'])
@Index('IDX_USERS_REGION_ID', ['region_id'])
@Index('IDX_USERS_DISTRICT_ID', ['district_id'])
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Index()
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

  @Column({ type: 'varchar', nullable: true })
  extra_number: string;

  @Column({ type: 'uuid', nullable: true })
  market_id: string;

  @Column({ type: 'bigint', nullable: true })
  telegram_id: number;

  @Column({ type: 'varchar', nullable: true })
  avatar_id: string;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  // Market uchun: operator telefon raqamini majburiy kiritish
  @Column({ type: 'boolean', default: false })
  require_operator_phone: boolean;

  // Market uchun: standart operator telefon raqami (avtomatik to'ldiriladi)
  @Column({ type: 'varchar', nullable: true })
  default_operator_phone: string;

  // Market uchun: ixtiyoriy 2-operator telefon raqami (chekda ham chiqadi)
  @Column({ type: 'varchar', nullable: true })
  secondary_operator_phone: string | null;

  // Operator uchun komissiya sozlamalari
  @Column({ type: 'enum', enum: Commission_type, nullable: true })
  commission_type: Commission_type | null;

  @Column({ type: 'float', nullable: true })
  commission_value: number | null;

  // Operatorga uning daromadlarini ko'rsatish/yashirish
  @Column({ type: 'boolean', default: false })
  show_earnings: boolean;

  @Column({
    type: 'enum',
    name: 'default_tariff',
    enum: Where_deliver,
    default: Where_deliver.CENTER,
  })
  default_tariff: Where_deliver;

  // 1-1 User → Salary (inverse side, FK yo‘q)
  @OneToOne(() => UserSalaryEntity, (userSalary) => userSalary.user, {
    cascade: true,
  })
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

  @OneToMany(() => CustomerMarketEntity, (cm) => cm.customer)
  customerLinks: CustomerMarketEntity[];

  @OneToMany(() => CustomerMarketEntity, (cm) => cm.market)
  marketLinks: CustomerMarketEntity[];

  @OneToMany(() => ProductEntity, (product) => product.user)
  products: ProductEntity[];

  @OneToMany(() => OrderEntity, (order) => order.market)
  marketOrders: OrderEntity[];

  @OneToMany(() => OrderEntity, (order) => order.customer)
  customerOrders: OrderEntity[];

  @ManyToOne(() => DistrictEntity, (district) => district.users, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'district_id' }) // 🔑 aynan shu kerak
  district: DistrictEntity;

  @ManyToOne(() => UserEntity, (market) => market.operators, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'market_id' })
  market: UserEntity;

  // Inverse side: Market has many Operators
  @OneToMany(() => UserEntity, (operator) => operator.market)
  operators: UserEntity[];
}
