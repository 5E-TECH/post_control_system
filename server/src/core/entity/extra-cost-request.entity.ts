import { BaseEntity } from 'src/common/database/BaseEntity';
import {
  ExtraCostAction,
  ExtraCostCategory,
  ExtraCostDecisionMode,
  ExtraCostStatus,
} from 'src/common/enums';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './users.entity';
import { OrderEntity } from './order.entity';
import {
  bigintTransformer as bigintTransformerNullable,
  bigintTransformerNonNull as bigintTransformer,
} from 'src/common/database/bigint.transformer';

/**
 * QO'SHIMCHA XARAJAT SO'ROVI — kuryer yozgan xarajatning market tasdig'igacha
 * bo'lgan "majburiyat" holati.
 *
 * NEGA ALOHIDA JADVAL. Xarajat hozir hech qayerda saqlanmaydi: u to'g'ridan-
 * to'g'ri ikki kassaga yozilib, faqat `cashbox_history` izohida qoladi.
 * Shu sabab marketga "kim, qachon, nega, qaysi buyurtmada" deb ko'rsatib
 * bo'lmaydi va tasdiqlash oqimini qurishning iloji yo'q.
 *
 * ⚠️ ENG MUHIM QOIDA: `PENDING` holatdagi so'rov `cashbox_history` ga BIR
 * QATOR HAM yozmaydi. `OrderService.reverseExtraCostForCashbox` idempotentlikni
 *
 *     net = SUM(EXTRA_COST chiqim) − SUM(CORRECTION kirim)
 *
 * net-hisobi bilan quradi. Tasdiqlanmagan xarajat u yerga tushsa, keyingi
 * rollback YO'QDAN PUL YARATADI (hech qachon berilmagan pulni "qaytaradi").
 *
 * Shu sababdan `REJECTED` ham hech narsa yozmaydi — `CORRECTION + INCOME`
 * juftligi butun kod bazasida faqat teskari qaytarish uchun band.
 */
@Entity('extra_cost_request')
// Pul invarianti KODDA ham e'lon qilinadi, nafaqat migrationda: 0 yoki manfiy
// summali "xarajat" ma'noga ega emas va u kassaga teskari yozuv bo'lib tushardi.
@Check('CHK_ECR_AMOUNT_POSITIVE', '"amount" > 0')
@Index('IDX_ECR_MARKET_STATUS', ['market_id', 'status', 'created_at'])
@Index('IDX_ECR_COURIER_STATUS', ['courier_id', 'status', 'created_at'])
@Index('IDX_ECR_ORDER', ['order_id'])
export class ExtraCostRequestEntity extends BaseEntity {
  // ======================= BOG'LANISHLAR =======================

  @Column({ type: 'uuid' })
  order_id: string;

  /** Qaysi reys — qayta jo'natishda eski so'rovni ajratish uchun. */
  @Column({ type: 'uuid', nullable: true })
  post_id: string | null;

  /** So'rovchi va pulni oluvchi kuryer. */
  @Column({ type: 'uuid' })
  courier_id: string;

  /**
   * Tasdiqlovchi market. So'rov paytida `order.user_id` dan SNAPSHOT olinadi —
   * buyurtma keyin boshqa marketga o'tkazilsa ham qarorni asl market beradi.
   */
  @Column({ type: 'uuid' })
  market_id: string;

  // ======================= SO'ROV MAZMUNI =======================

  @Column({ type: 'enum', enum: ExtraCostAction })
  action_type: ExtraCostAction;

  /**
   * So'ralgan summa (butun so'm). DB darajasida `CHECK > 0`, servisda
   * `Math.trunc()` — kasrli qiymat bigint INSERT xatosi berib BUTUN sotuvni
   * rollback qilardi.
   */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  /**
   * So'rov paytidagi ruxsat etilgan maksimum SNAPSHOT'i.
   *
   * Tasdiqlashda chegara JONLI tarifdan emas, aynan shundan tekshiriladi:
   * kuryer tarifi so'rov bilan qaror orasida o'zgarsa, allaqachon qonuniy
   * bo'lgan so'rov to'satdan "chegaradan oshgan" bo'lib qolmasin.
   */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  limit_max: number;

  /** Nizo/audit uchun — o'sha paytdagi kuryer tarifi. */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  courier_tariff_snapshot: number;

  /**
   * DENORMALIZATSIYA — market sahifasi buyurtma endpointiga tegmasin.
   * `GET order/:id` market egaligini TEKSHIRMAYDI (faqat kuryerni), ya'ni
   * undan foydalanish mavjud IDOR'ni yangi sahifaga ko'chirish bo'lardi.
   */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  order_number: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  order_total_price: number;

  /** `center` | `home` — market qaror uchun ko'radi. */
  @Column({ type: 'varchar', nullable: true })
  where_deliver: string | null;

  /** Kontekst: kuryer qayerga borgan. */
  @Column({ type: 'varchar', nullable: true })
  district_name: string | null;

  // ═══════════ QAROR UCHUN KONTEKST (denormalizatsiya) ═══════════
  //
  // ⚠️ NEGA USTUN, RELATION EMAS. `relations: ['courier','market']` `users`
  // qatorini butunlay tortadi — ichida `password` hashi bor va u API javobiga
  // chiqib ketardi. Bundan tashqari bu qiymatlar SNAPSHOT: mijoz telefoni
  // yoki market nomi keyin o'zgarsa, nizoda o'sha paytdagi holat kerak.

  @Column({ type: 'varchar', nullable: true })
  customer_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  customer_phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  region_name: string | null;

  /** Kuryer uchun: qaysi marketning buyurtmasi. */
  @Column({ type: 'varchar', nullable: true })
  market_name: string | null;

  /** Market uchun: kim so'ragan. */
  @Column({ type: 'varchar', nullable: true })
  courier_name: string | null;

  /**
   * Sotuv/bekor qilish qachon bo'lgan (epoch ms). Tasdiqlashda
   * `cashbox_history.payment_date` ga yoziladi — kassa yozuvi tasdiq kunida
   * tug'ilsa ham, u qaysi kungi buyurtmaga tegishli ekani ko'rinib tursin.
   */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  order_action_at: number;

  /** MAJBURIY — marketga qaror qabul qilish uchun eng kerakli maydon. */
  @Column({ type: 'enum', enum: ExtraCostCategory })
  category: ExtraCostCategory;

  /** `category = OTHER` bo'lsa servis darajasida majburiy. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /**
   * `extra_cost_proof.id` massivi. Xom fayl nomi/URL bu yerda ham, DTO'da ham
   * HECH QACHON chiqmaydi — fayl faqat himoyalangan endpoint orqali beriladi.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  proof_ids: string[];

  // ======================= HOLAT VA QAROR =======================

  @Column({
    type: 'enum',
    enum: ExtraCostStatus,
    default: ExtraCostStatus.PENDING,
  })
  status: ExtraCostStatus;

  @Column({ type: 'enum', enum: ExtraCostDecisionMode, nullable: true })
  decision_mode: ExtraCostDecisionMode | null;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  /**
   * ⚠️ NULL-SAQLOVCHI transformer SHART. `bigintTransformerNonNull` bu yerda
   * null'ni 0 ga aylantirib, "hali ko'rilmagan" so'rovni "1970-yilda ko'rilgan"
   * qilib qo'yadi — bu aynan LDG `mismatch_at` da bo'lgan xato (soxta
   * "Mismatch" kartasi 4557/5379 ko'rsatgan edi).
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  reviewed_at: number | null;

  /** Rad etishda MAJBURIY — kuryer sababni ko'radi. */
  @Column({ type: 'text', nullable: true })
  review_note: string | null;

  // ======================= PUL LANGARLARI =======================

  /** Pul kassaga qachon yozildi. */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  settled_at: number | null;

  /**
   * IDEMPOTENTLIK LANGARLARI. Har biri partial-unique indeks bilan
   * himoyalangan: bitta kassa yozuvi ikki so'rovga bog'lanmaydi. Atomik status
   * darvozasi birinchi to'siq, bular ikkinchi devor.
   */
  @Column({ type: 'uuid', nullable: true })
  market_history_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  courier_history_id: string | null;

  // ======================= MUDDAT VA KUZATUV =======================

  /** Market 7 kun javob bermadi → admin navbatiga tushdi. Status O'ZGARMAYDI. */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  escalated_at: number | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  voided_at: number | null;

  /** Kuryer qarorni ko'rdimi — asosiy ekrandagi bannerni boshqaradi. */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  seen_by_courier_at: number | null;

  /** Rad etilgandan keyin qayta yuborish zanjiri — eng ko'pi 1 halqa. */
  @Column({ type: 'uuid', nullable: true })
  resubmit_of: string | null;

  /**
   * Shu isbot (sha256) yana nechta so'rovda ishlatilgan. Qattiq taqiq YO'Q —
   * bitta reysda bitta taksi cheki bir nechta buyurtmaga tegishli bo'lishi
   * mumkin — lekin market kartasida qizil signal sifatida KO'RINADI.
   */
  @Column({ type: 'int', default: 0 })
  dup_proof_count: number;

  // ======================= RELATIONLAR =======================

  @ManyToOne(() => OrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courier_id' })
  courier: UserEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'market_id' })
  market: UserEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: UserEntity | null;
}
