import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/database/BaseEntity';
import { bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * SHTRAF / BONUS QOIDASI.
 *
 * Barcha kombinatsiyalar shu jadvalda: «4 kundan keyin har kun −2 000»,
 * «1 kun ichida +2 000», «uzoq viloyatga 7 kun», «zarar uchun −N».
 * Yangi tur kerak bo'lsa yangi QATOR qo'shiladi, kod o'zgarmaydi.
 */
@Index('IDX_CP_RULE_LOOKUP', ['event', 'scope_type', 'scope_id'])
@Entity('courier_penalty_rule')
export class CourierPenaltyRuleEntity extends BaseEntity {
  /** `global` | `courier` | `region` — aniqrog'i ustun keladi. */
  @Column({ type: 'varchar', length: 10, default: 'global' })
  scope_type: string;

  @Column({ type: 'uuid', nullable: true })
  scope_id: string | null;

  /** `late_mark` | `early_mark` | `damage` */
  @Column({ type: 'varchar', length: 16 })
  event: string;

  /** `late_mark` — muddat; `early_mark` — bonus darajasi (shu kun ichida). */
  @Column({ type: 'int', default: 0 })
  threshold_days: number;

  /** `per_day` | `once` */
  @Column({ type: 'varchar', length: 8, default: 'per_day' })
  calc: string;

  /**
   * ⚠️ ISHORALI: shtraf MANFIY, bonus MUSBAT.
   *
   * Ikki alohida ustun qilinmadi — ular doim bir-birini istisno qiladi
   * va har hisobda «qaysi biri to'ldirilgan» ni tekshirish kerak bo'lardi.
   */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  /** Bitta buyurtma uchun eng ko'pi (null = faqat tarif chegarasi). */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  max_amount: number | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  active_from: number;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  active_to: number | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;
}
