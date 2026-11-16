import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import { bigintTransformer } from 'src/common/database/bigint.transformer';

export type CarrierIdempotencyState = 'in_progress' | 'completed' | 'failed';

/**
 * CARRIER API — `Idempotency-Key` DAFTARI.
 *
 * `POST /api/v1/carrier/orders/:id/status` har chaqiruvda `Idempotency-Key`
 * talab qiladi. Bir xil kalit bilan qayta yuborilgan so'rov pulni IKKINCHI
 * marta yozmasligi kerak (tarmoq uzilishi, timeout, qayta urinish).
 *
 * - `binding` — `<action>:<orderId>:<fingerprint>`: kalit boshqa buyurtma yoki
 *   boshqa tana bilan qayta ishlatilsa 422 `IDEMPOTENCY_KEY_MISMATCH`.
 * - `state = in_progress` + `lease_until` — parallel ikkinchi so'rov 409
 *   `IDEMPOTENCY_IN_PROGRESS` oladi; lease tugasa kalit qayta olinadi.
 * - `failed` — amal bajarilmagan, kalitni qayta ishlatish mumkin.
 * - `completed` — amal bajarilgan; takror so'rov amalni QAYTA bajarmaydi.
 *
 * ⚠️ Qatorlar o'chirilmaydi (TTL yo'q): eskirgan kalitni aniqlash
 * (`CARRIER_IDEMPOTENCY_KEY_STALE`) `completed` qatorlar saqlanishiga tayanadi.
 */
@Entity('carrier_idempotency_key')
@Index('UQ_CARRIER_IDEM_ACCOUNT_KEY', ['carrier_account_id', 'key_hash'], {
  unique: true,
})
@Index('IDX_CARRIER_IDEM_ORDER', ['order_id'])
export class CarrierIdempotencyKeyEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  carrier_account_id: string;

  /** `sha256(Idempotency-Key)` hex — mijoz kaliti ochiq saqlanmaydi. */
  @Column({ type: 'varchar', length: 64 })
  key_hash: string;

  /** `<action>:<orderId>:<fingerprint32>` (proof fayli fingerprintga kirmaydi). */
  @Column({ type: 'varchar', length: 160 })
  binding: string;

  /** `sold` | `partly_sold` | `cancelled` | `rollback`. */
  @Column({ type: 'varchar', length: 32 })
  action: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'varchar', length: 16 })
  state: CarrierIdempotencyState;

  /** `in_progress` lease tugash vaqti (epoch ms). */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  lease_until: number | null;

  /** Yakuniy HTTP holat (diagnostika uchun). */
  @Column({ type: 'int', nullable: true })
  http_status: number | null;
}
