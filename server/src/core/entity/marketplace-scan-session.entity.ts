import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import { bigintTransformer } from 'src/common/database/bigint.transformer';
import { MarketplaceScanSessionStatus } from 'src/api/marketplace/marketplace.enums';

/**
 * SKAN SESSIYASI — operator qopni skanerlayotgan payt, SERVER tomonda.
 *
 * Bugun skanlar faqat brauzer xotirasida turadi. Sahifa yangilansa,
 * brauzer qulasa yoki tab almashsa — butun qop yo'qoladi va serverda
 * hech qanday iz qolmaydi.
 *
 * ⚠️ `accept_idempotency_key` — «Qabul qilish» ikki marta bosilganda
 * (yoki javob timeout bo'lib qayta yuborilganda) ayni natija qaytadi.
 * Bloker B2 ning ikkinchi qatlami; birinchisi — `marketplace_parcel`
 * dagi unique indeks.
 */
@Entity('marketplace_scan_session')
@Index('IDX_MP_SESSION_OPERATOR', ['operator_id', 'status'])
@Index('IDX_MP_SESSION_INTEGRATION', ['integration_id', 'status'])
@Index('IDX_MP_SESSION_IDEMPOTENCY', ['accept_idempotency_key'], {
  unique: true,
  where: '"accept_idempotency_key" IS NOT NULL',
})
export class MarketplaceScanSessionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  @Column({ type: 'uuid' })
  operator_id: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: MarketplaceScanSessionStatus.OPEN,
  })
  status: MarketplaceScanSessionStatus;

  /** Skanerlangan posilkalar soni (tez o'qish uchun denormalizatsiya). */
  @Column({ type: 'int', default: 0 })
  scanned_count: number;

  @Column({ type: 'int', default: 0 })
  accepted_count: number;

  @Column({ type: 'int', default: 0 })
  rejected_count: number;

  /** Klient yaratadigan kalit — qabulni idempotent qiladi. */
  @Column({ type: 'uuid', nullable: true })
  accept_idempotency_key: string | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  accepted_at: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  closed_at: number | null;
}
