import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { OrderEntity } from './order.entity';
// MUHIM: null-SAQLOVCHI transformer (`bigintTransformer`), `bigintTransformerNonNull`
// EMAS. nonNull variant null → 0 yozadi va bu "IS NOT NULL" filtrlarini buzadi —
// LDG'da aynan shu tuzoq `mismatch_at` ustunida har shipmentni "nomuvofiq" deb
// ko'rsatgan edi. Shu xatoni takrorlamaymiz.
import { bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * Elchi'dagi posilkaning bizning buyurtma bilan bog'lanishi.
 * Har buyurtma uchun ko'pi bilan bitta yozuv (`order_id` unique).
 */
@Entity('elchi_shipment')
@Unique('UQ_ELCHI_SHIPMENT_ORDER', ['order_id'])
@Index('IDX_ELCHI_SHIPMENT_REMOTE_ID', ['elchi_shipment_id'])
@Index('IDX_ELCHI_SHIPMENT_STATUS', ['elchi_status'])
@Index('IDX_ELCHI_SHIPMENT_LAST_SYNCED', ['last_synced_at'])
export class ElchiShipmentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  order_id: string;

  /**
   * Oxirgi jo'natish urinishidagi pochta id'si. Buyurtma qaytarilib qayta
   * jo'natilsa yangi post bilan keladi — post farqi "yangi urinish" belgisi.
   */
  @Column({ type: 'uuid', nullable: true })
  post_id: string | null;

  /**
   * Elchi tomonidagi posilka id'si (`POST /partner/shipments` javobidagi
   * `shipment_id`). Elchi'da bu bigint, bizda VARCHAR sifatida saqlanadi —
   * keyingi chaqiruvlar (`GET /partner/shipments/:id`, `.../cancel`) aynan shu
   * id bilan ishlaydi, `external_order_id` bilan EMAS.
   */
  @Column({ type: 'varchar', nullable: true })
  elchi_shipment_id: string | null;

  /** Elchi bergan QR token (kuzatuv/solishtirish uchun). */
  @Column({ type: 'varchar', nullable: true })
  qr_code_token: string | null;

  /** Elchi'ning oxirgi qayd etilgan statusi (ularning `Order_status` qiymati). */
  @Column({ type: 'varchar', nullable: true })
  elchi_status: string | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  elchi_status_changed_at: number | null;

  // ===== PUL =====

  /**
   * Biz Elchi'ga "shu summani yig'" deb aytgan qiymat (`cod_amount`).
   * Solishtirish uchun saqlanadi.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  cod_amount_sent: string;

  /**
   * Elchi webhookida qaytgan summa.
   *
   * ⚠️ DIQQAT (M2). Elchi buni "yig'ilgan pul" deb ataydi, lekin amalda u
   * O'ZINING TARIFINI AYIRGANDAN KEYINGI summa (`total_price − marketTariff`),
   * ya'ni market balansiga tushadigan NET qiymat — kuryer mijozdan olgan
   * GROSS pul EMAS. Shu bois `cod_amount_sent` bilan ayirmasi Elchi tarifiga
   * teng bo'lishi kutiladi. Hisob-kitob paneli aynan shuni ko'rsatadi va
   * pilotning asosiy tekshiruvi shu (qabul mezoni №12).
   */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  cod_collected_reported: string | null;

  // ===== JO'NATISH HOLATI =====

  @Column({ type: 'int', default: 0 })
  send_attempts: number;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  /** Idempotentlik uchun oxirgi so'rov kaliti (Elchi tomonda `external_order_id`). */
  @Column({ type: 'varchar', nullable: true })
  last_request_id: string | null;

  // ===== NOMUVOFIQLIK =====

  /**
   * Elchi terminal status yubordi-yu, bizda buyurtma boshqa terminal holatda
   * edi (masalan Elchi "yetkazildi", bizda allaqachon "bekor qilingan").
   * Bu real biznes nomuvofiqligi — admin panel shu maydon orqali topadi.
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  mismatch_at: number | null;

  @Column({ type: 'text', nullable: true })
  mismatch_reason: string | null;

  /**
   * Solishtiruvchi CRON bu posilkani Elchi bilan oxirgi marta tekshirgan vaqt.
   * Status o'zgarmasa ham yangilanadi — shu orqali CRON eng eski tekshirilganini
   * birinchi olib, hamma posilkani navbatma-navbat qamrab oladi va hech biri
   * "qolib ketmaydi".
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_synced_at: number | null;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}
