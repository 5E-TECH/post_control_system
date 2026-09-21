import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { OrderEntity } from './order.entity';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';
import {
  MarketplaceParcelStatus,
  MarketplaceRejectReason,
  MarketplaceScanState,
} from 'src/api/marketplace/marketplace.enums';

/**
 * POSILKA KO'ZGUSI + SKAN STAGING — modulning eng muhim jadvali.
 *
 * NEGA KERAK. Bugungi tashqi-sayt oqimida skan natijasi HECH QAYERDA
 * saqlanmaydi: `external-proxy` ularning javobini brauzerga qaytaradi,
 * brauzer uni React state'da ushlab turadi va «Qabul qilish»da serverga
 * QAYTA yuboradi. Natijada:
 *
 *   · sahifa yangilansa — butun qop yo'qoladi, izsiz;
 *   · operator nimani skanerlagani va marketplace nima javob berganini
 *     keyin hech kim bila olmaydi;
 *   · ikki operator bir posilkani skanerlasa ikkalasi ham muvaffaqiyatli.
 *
 * Bu jadval bir vaqtning o'zida TO'RT vazifani bajaradi:
 *   1. staging   — skanerlandi, hali qabul qilinmadi;
 *   2. audit     — `raw_payload` da ularning asl javobi;
 *   3. ko'zgu    — ularning oxirgi ma'lum statusi;
 *   4. solishtiruv manbai — `last_sent_seq`, `mismatch_at`.
 *
 * Reja: `docs/integrations/14-marketplace-beepost.md` §4.2
 */
@Entity('marketplace_parcel')
// Dublikat himoyasining ASOSIY devori (bloker B2): ayni posilka ikki marta
// qabul qilinmaydi. Ilova darajasidagi tekshiruv YETARLI EMAS — qabul
// timeout bo'lib qayta bosilganda poyga aynan shu yerda to'siladi.
@Unique('UQ_MP_PARCEL_EXTERNAL', ['integration_id', 'external_parcel_id'])
// Bitta QR — bitta posilka. Aralash registr muammosi `qr_token_norm` bilan
// yopiladi (asl qiymat `qr_token_raw` da qoladi).
@Unique('UQ_MP_PARCEL_TOKEN', ['integration_id', 'qr_token_norm'])
@Index('IDX_MP_PARCEL_ORDER', ['order_id'], {
  unique: true,
  where: '"order_id" IS NOT NULL',
})
@Index('IDX_MP_PARCEL_SESSION', ['scan_session_id'])
@Index('IDX_MP_PARCEL_STATE', ['integration_id', 'scan_state'])
@Index('IDX_MP_PARCEL_ORDER_GROUP', ['integration_id', 'external_order_id'])
@Index('IDX_MP_PARCEL_MISMATCH', ['mismatch_at'], {
  where: '"mismatch_at" IS NOT NULL',
})
@Index('IDX_MP_PARCEL_SYNCED', ['last_synced_at'])
export class MarketplaceParcelEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  /**
   * ULARNING POSILKA id'si — jismoniy quti.
   * ⚠️ `external_order_id` DAN AJRATILGAN (qaror O1): bitta buyurtma bir
   * nechta qutidan iborat bo'lishi mumkin va pul faqat BIR MARTA hisoblanadi.
   */
  @Column({ type: 'varchar', length: 120 })
  external_parcel_id: string;

  /** Ularning BUYURTMA id'si — ko'p qutili holatda bir nechta qatorda bir xil. */
  @Column({ type: 'varchar', length: 120 })
  external_order_id: string;

  /** `2/3` — uchtadan ikkinchisi. Barchasi skanerlanmaguncha qabul tugallanmaydi. */
  @Column({ type: 'int', default: 1 })
  parcel_index: number;

  @Column({ type: 'int', default: 1 })
  parcel_count: number;

  /**
   * Yorliqdagi ASL qiymat — ularga qaytarilganda aynan shu yuboriladi.
   * O'zgartirilmaydi (qaror O6: yorliq ularniki).
   */
  @Column({ type: 'varchar', length: 128 })
  qr_token_raw: string;

  /**
   * Normalizatsiyalangan token — PCS skanerlari shu bo'yicha qidiradi.
   * ⚠️ Bu ustun bo'lmasa: aralash registrli QR (`UZM-9600-AbCdEf`) verbatim
   * saqlanardi, keyingi skanerlar esa lowercase qidirib TOPA OLMAS edi —
   * posilka abadiy skanerlanmaydigan bo'lib qolardi (reja §15 #5).
   */
  @Column({ type: 'varchar', length: 128 })
  qr_token_norm: string;

  /** Ularning sotuvchi ID si — pul attributsiyasi shunga bog'lanadi. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  seller_id: string | null;

  /**
   * `/parcels/lookup` javobi TO'LIQ. Nizo va qayta tiklash uchun.
   * Bugungi oqimda bu ma'lumot umuman saqlanmaydi.
   */
  @Column({ type: 'jsonb', nullable: true })
  raw_payload: Record<string, unknown> | null;

  // ── Skan paytidagi PUL SNAPSHOT'i ─────────────────────────────────────
  // Skandan qabulgacha narx o'zgarsa, farq ko'rinsin (reja §15 #10).

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  declared_product_amount: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  declared_delivery_amount: number;

  /** Mijozdan olinadigan summa. `0` = oldindan to'langan (prepaid). */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  cod_amount: number;

  @Column({ type: 'boolean', default: false })
  prepaid: boolean;

  // ── SKAN JARAYONI ─────────────────────────────────────────────────────

  @Column({
    type: 'varchar',
    length: 16,
    default: MarketplaceScanState.SCANNED,
  })
  scan_state: MarketplaceScanState;

  @Column({ type: 'uuid', nullable: true })
  scan_session_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  scanned_by: string | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  scanned_at: number | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  reject_reason: MarketplaceRejectReason | null;

  @Column({ type: 'text', nullable: true })
  reject_note: string | null;

  // ── QABULDAN KEYIN ────────────────────────────────────────────────────

  /** Yaratilgan PCS buyurtmasi. `null` — hali qabul qilinmagan. */
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  accepted_at: number | null;

  /** Qabul partiyasi — `batch_id` idempotentligi uchun. */
  @Column({ type: 'uuid', nullable: true })
  accept_batch_id: string | null;

  // ── ULARNING TOMONIDAGI HOLAT (ko'zgu) ────────────────────────────────

  @Column({ type: 'varchar', length: 32, nullable: true })
  remote_status: MarketplaceParcelStatus | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  remote_status_at: number | null;

  /**
   * Ularga yuborilgan oxirgi `seq`.
   * ⚠️ TARTIB QO'RIQCHISI: bundan PAST `seq` li hodisa yuborilmaydi va
   * `superseded` deb belgilanadi. Bu bo'lmasa eskirgan `sold` muvaffaqiyatli
   * `rollback` dan KEYIN yetib borib, marketplace'ni noto'g'ri terminal
   * holatda qoldirardi (reja §6.2).
   */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  last_sent_seq: number;

  /**
   * KEYINGI AJRATILADIGAN `seq` — hodisa navbatga qo'yilganda oshiriladi.
   *
   * ⚠️ NEGA `last_sent_seq` DAN ALOHIDA. Ular ikki xil narsa: biri
   * YUBORILGAN oxirgi raqam, ikkinchisi AJRATILGAN oxirgi raqam. Hodisa
   * navbatda 2 soat turishi mumkin — o'sha vaqtda yangi hodisa kelsa unga
   * KATTAROQ raqam kerak, aks holda ikkalasi bir xil `seq` oladi va
   * `UQ_MP_OUTBOX_SEQ` ni buzadi.
   *
   * Ajratish ATOMIK:
   *   UPDATE marketplace_parcel SET next_seq = next_seq + 1
   *     WHERE id = $1 RETURNING next_seq
   *
   * Bu poygasiz. `MAX(seq)+1` yondashuvi tranzaksiya ichida XAVFLI bo'lardi:
   * unique buzilishi Postgres'da butun tranzaksiyani «aborted» holatiga
   * o'tkazadi va qayta urinib bo'lmaydi.
   */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  next_seq: number;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  last_synced_at: number | null;

  /**
   * Solishtiruvda nomuvofiqlik topilgan payt.
   * ⚠️ null-SAQLOVCHI transformer SHART. `bigintTransformerNonNull` bu yerda
   * `null` ni `0` ga aylantirib, `IS NOT NULL` filtrini buzardi — LDG'da
   * aynan shu tuzoq har shipmentni «nomuvofiq» deb ko'rsatgan edi.
   */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  mismatch_at: number | null;

  @Column({ type: 'text', nullable: true })
  mismatch_reason: string | null;

  @ManyToOne(() => OrderEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity | null;
}
