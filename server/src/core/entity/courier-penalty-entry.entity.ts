import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/database/BaseEntity';
import { bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * SHTRAF DAFTARI — AMALDA qo'llangan har tuzatish.
 *
 * ⚠️ `amount` NAZARIY emas, AMALDA qo'llangan summa (tarif chegarasidan
 * keyin). Aks holda daftar yig'indisi kassadagi yozuvlar yig'indisiga
 * mos kelmay qolardi va invariant yiqilardi.
 */
@Index('IDX_CP_ENTRY_ORDER', ['order_id'])
@Index('IDX_CP_ENTRY_COURIER_CREATED', ['courier_id', 'created_at'])
@Entity('courier_penalty_entry')
export class CourierPenaltyEntryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'uuid' })
  courier_id: string;

  @Column({ type: 'uuid', nullable: true })
  rule_id: string | null;

  /** `penalty` | `bonus` | `waiver` */
  @Column({ type: 'varchar', length: 10 })
  kind: string;

  /** Hodisa turi yoki bekor qilish sababi. */
  @Column({ type: 'varchar', length: 32 })
  reason: string;

  /** ISHORALI: kuryer qarzini oshirsa musbat, kamaytirsa manfiy. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  @Column({ type: 'int', nullable: true })
  late_days: number | null;

  /** Hisob paytidagi tarif — chegara shundan olingan (dalil). */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  base_tariff: number | null;

  /** `true` = SOYA: pulga tegilmagan, faqat qayd etilgan. */
  @Column({ type: 'boolean', default: false })
  shadow: boolean;

  @Column({ type: 'uuid', nullable: true })
  cashbox_history_id: string | null;

  /** Bekor qilish qatori asl yozuvga ishora qiladi. */
  @Column({ type: 'uuid', nullable: true })
  waives_entry_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  applied_by: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  note: string | null;
}
