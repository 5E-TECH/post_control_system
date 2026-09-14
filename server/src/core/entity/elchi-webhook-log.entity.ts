import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
// DIQQAT: ikki xil transformer ATAYLAB ishlatiladi.
//   `received_at`  — NOT NULL  -> bigintTransformerNonNull
//   `processed_at` — nullable  -> bigintTransformer (null'ni SAQLAYDI)
// LDG webhook jurnalida nonNull variant nullable ustunga ham qo'llangan; bu
// null -> 0 yozib "IS NOT NULL" filtrlarini buzadigan tuzoq (LDG'da `mismatch_at`
// da aynan shu xato yuz bergan). Shu naqshni takrorlamaymiz.
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';

/**
 * Elchi webhook qabul jurnali — takror himoyasi (replay) + audit izi.
 *
 * `event_id` PRIMARY KEY. Elchi hodisa id'sini **tanada** yuboradi
 * (`payload.event_id`), LDG'dagi kabi headerda EMAS. Shu sababli tartib muhim:
 *   1. imzo XOM tana ustidan tekshiriladi;
 *   2. keyin tana parse qilinadi va `event_id` olinadi;
 *   3. shundan keyin bu jadvalga insert — takror bo'lsa unique violation
 *      chiqadi va biz 200 qaytaramiz (idempotent).
 *
 * NEGA STATUS BO'YICHA DEDUP QILMAYMIZ. Bir status QAYTA yuz berishi mumkin:
 * `sold` → operator rollback qildi → `waiting` → kuryer qayta sotdi → `sold`.
 * Ikkinchi `sold` — haqiqiy yangi hodisa, takror emas. Shu bois
 * `(shipment_id, status)` juftligi dedup kaliti bo'la OLMAYDI, faqat `event_id`.
 *
 * `event_id` bo'lmagan holat (eski Elchi versiyasi) — `synthesized_key` ga
 * qarang.
 *
 * BaseEntity'dan meros olmaydi: UUID generated id kerak emas, `event_id` o'zi PK.
 */
@Entity('elchi_webhook_log')
@Index('IDX_ELCHI_WEBHOOK_LOG_RECEIVED_AT', ['received_at'])
@Index('IDX_ELCHI_WEBHOOK_LOG_STATUS', ['status'])
@Index('IDX_ELCHI_WEBHOOK_LOG_SHIPMENT', ['elchi_shipment_id'])
export class ElchiWebhookLogEntity {
  /**
   * Elchi payloadidagi `event_id` (UUID).
   *
   * Agar Elchi uni yubormasa (eski versiya), biz determinatsiyalangan zaxira
   * kalit yasaymiz: `syn_<sha256(shipment_id|status|occurred_at)>`. Bu ayni
   * webhookning qayta yuborilishini hamon to'sadi, lekin `occurred_at` bir xil
   * bo'lgan ikki HAR XIL hodisani ajratmaydi — shu bois zaxira, yechim emas.
   */
  @PrimaryColumn({ type: 'varchar' })
  event_id: string;

  /** `true` bo'lsa yuqoridagi zaxira kalit ishlatilgan (Elchi `event_id` yubormagan). */
  @Column({ type: 'boolean', default: false })
  synthesized_key: boolean;

  /** Hodisa turi — hozircha `shipment.status_changed`. */
  @Column({ type: 'varchar', nullable: true })
  event_type: string | null;

  /** Elchi posilka id'si (tez qidiruv uchun payloaddan ko'chirilgan). */
  @Column({ type: 'varchar', nullable: true })
  elchi_shipment_id: string | null;

  /** Bizning buyurtma id'si (Elchi tomonda `external_order_id`). */
  @Column({ type: 'varchar', nullable: true })
  external_order_id: string | null;

  /** Elchi yuborgan status (xom qiymat). */
  @Column({ type: 'varchar', nullable: true })
  elchi_status: string | null;

  @Column({ type: 'boolean' })
  signature_valid: boolean;

  /** `success` | `failed` | `skipped` | `invalid_signature` | `replay` */
  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  /**
   * To'liq payload (audit va qayta ishlash uchun).
   *
   * ⚠️ Headerlar SAQLANMAYDI — imzo headeri bu jadvalni kredensial oqishiga
   * aylantirmasligi kerak.
   */
  @Column({ type: 'jsonb' })
  raw_payload: Record<string, unknown>;

  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  received_at: number;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  processed_at: number | null;
}
