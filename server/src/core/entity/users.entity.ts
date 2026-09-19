import { BaseEntity } from 'src/common/database/BaseEntity';
import {
  Commission_type,
  Roles,
  Status,
  Where_deliver,
} from 'src/common/enums';
import {
  Column,
  Entity,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';
import { UserSalaryEntity } from './user-salary.entity';
import { CashEntity } from './cash-box.entity';
import { CashboxHistoryEntity } from './cashbox-history.entity';
import { RegionEntity } from './region.entity';
import { PostEntity } from './post.entity';
import { CustomerMarketEntity } from './customer-market.entity';
import { ProductEntity } from './product.entity';
import { OrderEntity } from './order.entity';
import { DistrictEntity } from './district.entity';
import { CourierRegionEntity } from './courier-region.entity';

@Entity('users')
@Index('IDX_USERS_ROLE', ['role'])
@Index('IDX_USERS_STATUS', ['status'])
@Index('IDX_USERS_ROLE_STATUS', ['role', 'status'])
@Index('IDX_USERS_REGION_ID', ['region_id'])
@Index('IDX_USERS_DISTRICT_ID', ['district_id'])
@Index('IDX_USERS_EXTERNAL_PROVIDER', ['external_provider'])
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Index()
  @Column({ type: 'varchar' })
  phone_number: string;

  // Tashqi yetkazib berish provayderi (kuryer-user uchun): 'ldg' va h.k.
  // null = oddiy ichki kuryer
  @Column({ type: 'varchar', nullable: true })
  external_provider: string | null;

  /**
   * ⚠️ `select: false` — ATAYLAB.
   *
   * Parol hash'i har bir `userRepo.find*` natijasida kelardi va u yerdan
   * `successRes(user)` orqali API javobiga chiqib ketardi: `GET /user`,
   * `GET /user/:id`, `GET /user/logists`, `PATCH /user/self`,
   * `POST /user/operator` va boshqalar. Har bir joyni qo'lda tozalash bir
   * necha marta urinilgan va baribir yangi joyda qaytib paydo bo'lgan —
   * shu bois to'siq ORM qatlamiga ko'chirildi: endi ustun SELECT ga
   * umuman qo'shilmaydi.
   *
   * Hash butun serverda FAQAT bitta joyda o'qiladi — `signIn`
   * (`bcrypt.compare`), u yerda `addSelect('user.password')` bilan
   * ATAYLAB so'raladi.
   *
   * ⚠️ YOZISHGA ta'sir qilmaydi: `user.password = ...` + `save()`
   * avvalgidek ishlaydi. Yuklanganda `undefined` bo'lgan maydonni TypeORM
   * UPDATE ga kiritmaydi, ya'ni mavjud parol ustiga NULL yozilmaydi.
   */
  @Column({ type: 'varchar', nullable: true, select: false })
  password: string;

  @Column({ type: 'uuid', nullable: true })
  region_id: string;

  @Column({ type: 'uuid', nullable: true })
  district_id: string;

  @Column({ type: 'int', nullable: true })
  tariff_home: number;

  @Column({ type: 'int', nullable: true })
  tariff_center: number;

  // Super kuryer: bir nechta viloyatga xizmat qiladi (courier_regions jadvali orqali).
  // Oddiy kuryerlar uchun false (default) — mavjud xatti-harakat o'zgarmaydi.
  @Column({ type: 'boolean', default: false })
  is_super_courier: boolean;

  // Super kuryer barcha viloyatlarga xizmat qiladi (LDG kabi). True bo'lsa,
  // courier_regions qatorlaridan qat'i nazar, har bir region pochtasida chiqadi.
  @Column({ type: 'boolean', default: false })
  serves_all_regions: boolean;

  @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
  status: Status;

  @Column({ type: 'enum', enum: Roles })
  role: Roles;

  @Column({ type: 'boolean', default: false, nullable: true })
  add_order: boolean;

  // ─── AI-balans (prepaid hamyon) — faqat MARKET uchun ma'noli ───
  @Column({ type: 'boolean', default: false })
  ai_enabled: boolean;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  ai_balance: number;

  // null bo'lsa global default (config.AI_PRICE_PER_ORDER) ishlatiladi
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  ai_price_per_order: number | null;

  /**
   * ⚠️ `select: false` — bu BIR MARTALIK operator-qo'shish kaliti.
   *
   * Order-botga yuborilsa o'sha marketga YANGI OPERATOR qo'shiladi va
   * token aylantiriladi. Ya'ni token = imtiyoz, lekin u `GET /user`
   * (admin ro'yxati), `GET /user/:id` va `POST /user/market` javoblarida
   * butun qator bilan chiqib ketardi.
   *
   * ⚠️ QIDIRISH ishlashda davom etadi — `select: false` faqat SELECT
   * ro'yxatiga ta'sir qiladi, WHERE ga emas (bot `where: { market_tg_token }`
   * bilan qidiradi). YOZISH ham tegilmaydi (`save()` / `update()`).
   * Egasiga ko'rsatish uchun `profile()` da ATAYLAB `addSelect` bor.
   */
  @Column({ type: 'varchar', nullable: true, select: false })
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

  /**
   * Market uchun: QO'SHIMCHA XARAJAT ISBOT + TASDIQ rejimi.
   *
   * `false` (default) — bugungi xulq: kuryer yozgan xarajat DARHOL ikki
   * kassaga yoziladi, market hech narsani ko'rmaydi va tasdiqlamaydi.
   *
   * `true` — xarajat kassaga UMUMAN yozilmaydi: `extra_cost_request` ga foto
   * isbot bilan `PENDING` qator tushadi va pul faqat market tasdiqlaganda
   * yoziladi. Bayroqni ADMIN yoqadi (market o'zi emas).
   *
   * ⚠️ Tashqi kargo (Elchi/LDG) orqali yetkazilgan buyurtmalarga
   * QO'LLANMAYDI — u kuryerlar bizning UI'dan foydalanmaydi va foto
   * biriktira olmaydi; gate ularni qamrasa yetkazilgan posilkalar
   * `WAITING` da qotib qolardi.
   */
  @Column({ type: 'boolean', default: false })
  extra_cost_proof_required: boolean;

  /**
   * Market uchun: shu summadan KICHIK so'rovlar avtomatik tasdiqlanadi
   * (`0` = o'chiq). Marketning kunlik ish yukini keskin kamaytiradi —
   * u faqat shubhali summalarni ko'radi. Isbot baribir talab qilinadi va
   * so'rov tarixda `auto_rule` bilan qoladi.
   */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  extra_cost_auto_approve_under: number;

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

  // 1-N Super courier → biriktirilgan viloyatlar (multi-region)
  @OneToMany(() => CourierRegionEntity, (cr) => cr.courier)
  courierRegions: CourierRegionEntity[];

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
