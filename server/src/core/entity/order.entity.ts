import { BaseEntity } from 'src/common/database/BaseEntity';
import { Order_status, Where_deliver, Replacement_state } from 'src/common/enums';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { OrderItemEntity } from './order-item.entity';
import { PostEntity } from './post.entity';
import { UserEntity } from './users.entity';
import { DistrictEntity } from './district.entity';
import {
  bigintTransformer as bigintTransformerNullable,
  bigintTransformerNonNull as bigintTransformer,
  bigintTransformerDefault,
} from 'src/common/database/bigint.transformer';

@Entity('order')
@Index('IDX_ORDER_STATUS', ['status'])
@Index('IDX_ORDER_USER_ID', ['user_id'])
@Index('IDX_ORDER_CUSTOMER_ID', ['customer_id'])
@Index('IDX_ORDER_POST_ID', ['post_id'])
@Index('IDX_ORDER_CREATED_AT', ['created_at'])
@Index('IDX_ORDER_STATUS_USER', ['status', 'user_id'])
@Index('IDX_ORDER_STATUS_CREATED', ['status', 'created_at'])
// Dashboard statistika uchun indexlar
@Index('IDX_ORDER_SOLD_AT', ['sold_at'])
@Index('IDX_ORDER_STATUS_SOLD', ['status', 'sold_at'])
@Index('IDX_ORDER_CANCELLED_AT', ['cancelled_at'])
@Index('IDX_ORDER_STATUS_CANCELLED', ['status', 'cancelled_at'])
@Index('IDX_ORDER_USER_CREATED', ['user_id', 'created_at'])
@Index('IDX_ORDER_USER_SOLD', ['user_id', 'sold_at'])
@Index('IDX_ORDER_DISTRICT_ID', ['district_id'])
@Index('IDX_ORDER_OPERATOR_ID', ['operator_id'])
@Index('IDX_ORDER_NUMBER', ['order_number'], { unique: true })
@Index('IDX_ORDER_REPLACEMENT_OF', ['replacement_of_order_id'])
// QR skaner qidiruvi (checkPost / kuryer qabul) qr_code_token bo'yicha izlaydi —
// indekssiz har skan sequential scan edi. Non-unique (tokenlar amalda noyob,
// lekin DB darajasida majburlanmagan; dublikat bo'lsa migration buzilmasin).
@Index('IDX_ORDER_QR_TOKEN', ['qr_code_token'])
export class OrderEntity extends BaseEntity {
  // O'qiladigan global buyurtma raqami (#100042). UUID `id` qoladi — bu faqat
  // ko'rsatish/qidiruv/chek uchun qulay, ketma-ket raqam. DB sequence orqali
  // avtomatik to'ladi (migration: `order_number_seq`, 100000 dan boshlanadi),
  // shuning uchun barcha insert yo'llari (operator, bot, tashqi) avtomatik
  // raqam oladi — kodda alohida o'rnatish shart emas.
  @Column({
    type: 'bigint',
    default: () => "nextval('order_number_seq')",
    transformer: bigintTransformerDefault,
  })
  order_number: number;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'int', default: 0 })
  product_quantity: number;

  @Column({ type: 'enum', enum: Where_deliver, default: Where_deliver.CENTER })
  where_deliver: Where_deliver;

  @Column({ type: 'float' })
  total_price: number;

  // Qisman sotishdan (partlySold) OLDINGI asl summa. partlySold paytida bir
  // marta yoziladi; rollback'da total_price aynan shu qiymatdan tiklanadi —
  // dona o'zgarmay faqat narx tushirilgan holatda ham asl narx qaytariladi.
  // Rollback yakunida null'ga qaytariladi. Eski buyurtmalarda NULL (xavfsiz).
  @Column({ type: 'float', nullable: true })
  original_total_price: number | null;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  to_be_paid: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  paid_amount: number;

  @Column({ type: 'enum', enum: Order_status })
  status: Order_status;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'text', nullable: true })
  operator: string;

  @Column({ type: 'varchar', nullable: true })
  operator_phone: string | null;

  // Ixtiyoriy 2-operator telefon raqami (market sozlamasidan snapshot)
  @Column({ type: 'varchar', nullable: true })
  secondary_operator_phone: string | null;

  // Buyurtmani yaratgan operatorning user ID si
  @Column({ type: 'uuid', nullable: true })
  operator_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  post_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  canceled_post_id: string | null;

  @Column({ type: 'varchar' })
  qr_code_token: string;

  @Column({ type: 'uuid', nullable: true })
  parent_order_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  // Buyurtma uchun yetkazib berish manzili
  @Column({ type: 'uuid', nullable: true })
  district_id: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  sold_at: number | null;

  // Buyurtma bekor qilingan vaqt (statistikani harakat sanasi bo'yicha sanash
  // uchun — xuddi sold_at kabi). Bekor qilinganda yoziladi, qayta sotilsa yoki
  // kutishga qaytarilsa tozalanadi (null).
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  cancelled_at: number | null;

  // Sotilgan paytdagi tariflar (tarix uchun saqlanadi)
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  market_tariff: number | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  courier_tariff: number | null;

  // Soft delete — TypeORM avtomatik filter qiladi (find/findOne/QueryBuilder).
  // Yo'qotilgan ma'lumotni qaytarish uchun `withDeleted()` chaqirig'i kerak.
  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  // Courier buyurtmani qaytarish so'rovi yuborgan
  @Column({ type: 'boolean', default: false })
  return_requested: boolean;

  // ====================== ALMASHTIRISH (kafolat-swap) ======================
  // Bu YANGI buyurtma qaysi ESKI (avval yetkazilgan) buyurtma o'rniga
  // ketayotganini ko'rsatadi. Faqat almashtirish buyurtmasida to'ladi.
  // parent_order_id'dan ATAYLAB ALOHIDA — u partlySold bola-buyurtmasiniki.
  @Column({ type: 'uuid', nullable: true })
  replacement_of_order_id: string | null;

  // Almashtirishning jismoniy qaytarish holati (kuryer "Sotildi" gate'ini
  // boshqaradi). YANGI buyurtmada to'ladi. NULL = oddiy buyurtma.
  @Column({ type: 'enum', enum: Replacement_state, nullable: true })
  replacement_state: Replacement_state | null;

  // ESKI (almashtirilayotgan) buyurtmada true bo'ladi — statusini
  // O'ZGARTIRMASDAN qaytarish ro'yxatida ko'rsatish uchun. Eski buyurtma
  // SOTILGAN holatda qoladi, puli muzlatiladi (moliyaviy reversal YO'Q).
  @Column({ type: 'boolean', default: false })
  is_replacement_return: boolean;

  // Kuryer eski mahsulotni mijozdan OLGAN vaqt (epoch ms).
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  old_product_collected_at: number | null;

  // Eski mahsulot MARKETGA QAYTARILGAN (bekor pochta qabul qilingan) vaqt (epoch ms).
  // "Marketga topshirildi" dalili — status SOLD qolgani uchun shu maydon isbotlaydi.
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  old_product_returned_at: number | null;

  // Eski mahsulotni marketga qabul qilgan admin/registrator ID si (audit).
  @Column({ type: 'uuid', nullable: true })
  old_returned_by: string | null;

  @Column({ type: 'jsonb', nullable: true })
  create_bot_messages: { chatId: number; messageId: number }[];

  // Tashqi saytlardan kelgan buyurtma ID si (Adosh, etc.)
  @Column({ type: 'varchar', nullable: true })
  external_id: string;

  // 🟢 One Order → Many OrderItems
  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items: OrderItemEntity[];

  // 🟢 Many Orders → One Post
  @ManyToOne(() => PostEntity, (post) => post.orders, {
    onDelete: 'SET NULL', // order o‘chsa post qoladi
  })
  @JoinColumn({ name: 'post_id' })
  post: PostEntity;

  // order.entity.ts
  @ManyToOne(() => UserEntity, (user) => user.marketOrders, {
    onDelete: 'CASCADE', // user o‘chsa order o‘chadi
  })
  @JoinColumn({ name: 'user_id' })
  market: UserEntity; // Market egasi

  @ManyToOne(() => UserEntity, (user) => user.customerOrders, {
    onDelete: 'CASCADE', // user o'chsa order o'chadi
  })
  @JoinColumn({ name: 'customer_id' })
  customer: UserEntity; // Buyurtma beruvchi

  // 🟢 Many Orders → One District (yetkazib berish manzili)
  @ManyToOne(() => DistrictEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'district_id' })
  district: DistrictEntity;

  // 🔁 Almashtirish: YANGI buyurtma → o'rniga ketayotgan ESKI buyurtma
  // (o'ziga-o'zi ManyToOne). Eski buyurtma o'chsa havola NULL bo'ladi —
  // buyurtmaning o'zi qolaveradi.
  @ManyToOne(() => OrderEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replacement_of_order_id' })
  replacementOf: OrderEntity | null;
}
