import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, Unique } from 'typeorm';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';
import {
  MarketplaceAggregateType,
  MarketplaceEventType,
  MarketplaceOutboxStatus,
} from 'src/api/marketplace/marketplace.enums';

/**
 * TRANZAKSION OUTBOX — barcha chiquvchi hodisalar.
 *
 * NEGA MAVJUD NAVBAT YARAMAYDI. `integration_sync_queue` uchta jihatdan
 * yetarli emas:
 *   · `order_id` NOT NULL — kassa/hisob-kitob hodisasini ifodalay olmaydi;
 *   · `action` yopiq 5 qiymatli ro'yxat — `accepted`, `partly_sold`,
 *     `extra_cost` yo'q;
 *   · `event_id` va `seq` yo'q — idempotentlik va tartib kafolati yo'q.
 *
 * ⚠️ ENG MUHIM FARQ: qator PUL BILAN BITTA TRANZAKSIYADA yoziladi.
 * Bugungi `queueStatusSync` `commitTransaction()` DAN KEYIN, `await`siz,
 * hamma narsani yutuvchi `try/catch` ichida chaqiriladi — deploy o'sha
 * lahzada bo'lsa hodisa UMUMAN TUG'ILMAYDI va buni hech narsa sezmaydi
 * (bloker B3).
 */
@Entity('marketplace_outbox')
// Idempotentlik kaliti — qayta urinishlarda O'ZGARMAYDI. Ular shu bo'yicha
// dublikatni tashlaydi (kontrakt §4.4 MUST #1).
@Unique('UQ_MP_OUTBOX_EVENT', ['event_id'])
// Bir obyekt uchun bir `seq` — ikki marta yozilmaydi.
@Unique('UQ_MP_OUTBOX_SEQ', ['aggregate_type', 'aggregate_id', 'seq'])
@Index('IDX_MP_OUTBOX_CLAIM', ['status', 'next_retry_at'])
@Index('IDX_MP_OUTBOX_INTEGRATION', ['integration_id', 'status'])
@Index('IDX_MP_OUTBOX_AGGREGATE', ['aggregate_type', 'aggregate_id'])
@Index('IDX_MP_OUTBOX_STALE', ['status', 'processing_started_at'])
export class MarketplaceOutboxEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  /** Ularga yuboriladigan `event_id` — barqaror, qayta urinishda o'zgarmaydi. */
  @Column({ type: 'uuid' })
  event_id: string;

  @Column({ type: 'varchar', length: 40 })
  event_type: MarketplaceEventType;

  @Column({ type: 'varchar', length: 16 })
  aggregate_type: MarketplaceAggregateType;

  /** `parcel` uchun — `marketplace_parcel.id`; `ledger` uchun — daftar yozuvi. */
  @Column({ type: 'uuid' })
  aggregate_id: string;

  /**
   * Obyekt bo'yicha MONOTON raqam. Ular eskirgan hodisani shu bo'yicha rad
   * etadi, biz esa `parcel.last_sent_seq` dan past `seq` ni umuman yubormaymiz.
   */
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  seq: number;

  /** Attributsiya — qaysi sotuvchining posilkasi (pul uchun emas, belgi uchun). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  seller_id: string | null;

  /** Yuboriladigan to'liq konvert (kontrakt §4.4). */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 16,
    default: MarketplaceOutboxStatus.PENDING,
  })
  status: MarketplaceOutboxStatus;

  /** `skipped` / `superseded` sababi — jimgina yo'qolish bo'lmasin. */
  @Column({ type: 'text', nullable: true })
  status_reason: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /**
   * ⚠️ 8 ta urinish — mavjud navbatdagi 3 EMAS. Hozirgi jadval 1m/5m/15m
   * beradi, ya'ni jami ~6 daqiqa: marketplace deployi shundan uzoq bo'lsa
   * BUTUN OYNA yo'qolardi. Yangi jadval ~4 soatgacha cho'ziladi (reja §12).
   */
  @Column({ type: 'int', default: 8 })
  max_attempts: number;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  next_retry_at: number | null;

  /** Crash'dan keyin qotib qolgan qatorlarni tiklash uchun. */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  processing_started_at: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  sent_at: number | null;

  @Column({ type: 'int', nullable: true })
  last_http_status: number | null;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @Column({ type: 'jsonb', nullable: true })
  last_response: Record<string, unknown> | null;
}
