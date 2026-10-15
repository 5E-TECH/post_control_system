import { BaseEntity } from 'src/common/database/BaseEntity';
import { bigintTransformer } from 'src/common/database/bigint.transformer';
import { Post_status } from 'src/common/enums';
import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserEntity } from './users.entity';
import { RegionEntity } from './region.entity';
import { OrderEntity } from './order.entity';

@Entity('post')
@Index('IDX_POST_STATUS', ['status'])
@Index('IDX_POST_COURIER_ID', ['courier_id'])
@Index('IDX_POST_REGION_ID', ['region_id'])
@Index('IDX_POST_CREATED_AT', ['created_at'])
export class PostEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'courier_id', nullable: true })
  courier_id: string;

  @Column({ type: 'decimal', name: 'post_total_price', default: 0 })
  post_total_price: number;

  @Column({ type: 'smallint', name: 'order_quantity', default: 0 })
  order_quantity: number;

  @Column({ type: 'varchar', name: 'qr_code_token' })
  qr_code_token: string;

  /**
   * Pochta viloyati — YETKAZISH pochtasida majburiy ma'no tashiydi, BEKOR
   * (qaytarish) pochtasida esa faqat qo'shimcha ma'lumot.
   *
   * ⚠️ NULLABLE qilindi. Avval ustun NOT NULL edi, lekin uni yozuvchi uch
   * joy (`attachOrdersToCanceledPost`, `attachReplacementToCanceledPost`,
   * rollback) `courier.region_id` ni beradi — tashqi provayderlarning
   * (Elchi) virtual vakil-kuryerida esa viloyat YO'Q. Ya'ni Elchi posilkasi
   * bekor pochtaga biriktirilganda NOT NULL buzilib, amal xato bilan
   * yiqilardi. Iste'molchilar allaqachon null'ga tayyor
   * (region.service.ts: `if (!p.region_id) continue`).
   */
  @Column({ type: 'uuid', nullable: true })
  region_id: string | null;

  @Column({ type: 'enum', enum: Post_status, default: Post_status.NEW })
  status: Post_status;

  /**
   * Pochta KURYERGA biriktirilgan payt (ms) — SHTRAF SOATINING LANGARI.
   *
   * ⚠️ `created_at` DAN FARQ QILADI. Jo'natish odatda yangi pochta qatori
   * yaratadi, ya'ni ikkisi ayni bo'ladi; LEKIN pochta boshqa kuryerga
   * o'tkazilsa (`changeCourier`) faqat shu ustun yangilanadi. Shusiz
   * yangi kuryer avvalgi kuryerning kechikishini meros qilib olardi.
   *
   * `created_at` ataylab TEGILMAYDI: u hisobot va sana filtrlarida
   * ishlatiladi, uni surish tarixni jimgina siljitardi.
   *
   * NULL = hali kuryerga biriktirilmagan (NEW pochta).
   */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  courier_assigned_at: number | null;

  // N-1 Post → Courier (User)
  @ManyToOne(() => UserEntity, (user) => user.posts, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'courier_id' })
  courier: UserEntity;

  // N-1 Post → Region
  @ManyToOne(() => RegionEntity, (region) => region.posts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'region_id' })
  region: RegionEntity;

  // 1-N Post → Orders
  @OneToMany(() => OrderEntity, (order) => order.post)
  orders: OrderEntity[];
}
