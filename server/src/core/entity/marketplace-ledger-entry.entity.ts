import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, Unique } from 'typeorm';
import { bigintTransformer } from 'src/common/database/bigint.transformer';
import { MarketplaceLedgerEntryType } from 'src/api/marketplace/marketplace.enums';

/**
 * HAR-SOTUVCHI YORDAMCHI DAFTAR (qaror P1).
 *
 * Siz «bitta market ochib biriktiramiz» dedingiz — shunday qilingan. Lekin
 * bitta market = `cash_box.balance` = BITTA SON. 40 sotuvchi savdo qilgandan
 * keyin u 42 350 000 bo'lib turadi va uni bo'lib bo'lmaydi.
 *
 * Bu jadval o'sha sonni sotuvchilar bo'yicha AJRATADI — kassani ikkiga
 * bo'lmasdan.
 *
 * ⚠️ INVARIANT: `SUM(amount) WHERE integration_id = X` == o'sha marketplace
 * marketining `cash_box.balance`. Bu PCS'da allaqachon isbotlangan naqsh:
 * asosiy kassada `SUM(cashbox_card) == balance_card` (`applyCardDelta`).
 * Solishtiruv CRON buni har kuni tekshiradi.
 *
 * ⚠️ MUHIM ANIQLIK: daftar BIZNING tarifimiz bo'yicha attributsiya qiladi
 * (`COD − beepost_fee`), marketplace'ning sotuvchiga to'lovini EMAS. Ikkalasi
 * hech qachon teng bo'lmaydi va bu TO'G'RI — farq ularning marjasi (reja §7.1).
 */
@Entity('marketplace_ledger_entry')
// IDEMPOTENTLIK LANGARI: bitta kassa yozuvi bitta daftar qatoriga.
// Qayta ishlov yoki poyga ikkinchi qator yarata olmaydi.
@Unique('UQ_MP_LEDGER_CASHBOX_HISTORY', ['cashbox_history_id'])
@Index('IDX_MP_LEDGER_INTEGRATION', ['integration_id', 'created_at'])
@Index('IDX_MP_LEDGER_SELLER', ['integration_id', 'seller_id', 'created_at'])
@Index('IDX_MP_LEDGER_ORDER', ['order_id'])
@Index('IDX_MP_LEDGER_SEQ', ['integration_id', 'seq'])
export class MarketplaceLedgerEntryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  /** `null` — taqsimlanmagan (masalan umumiy korreksiya). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  seller_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  external_parcel_id: string | null;

  /**
   * Bog'langan kassa yozuvi — invariantni tekshirish va idempotentlik uchun.
   * `null` faqat kassaga tegmaydigan texnik qatorlarda.
   */
  @Column({ type: 'uuid', nullable: true })
  cashbox_history_id: string | null;

  @Column({ type: 'varchar', length: 20 })
  entry_type: MarketplaceLedgerEntryType;

  /**
   * ISHORALI summa.
   * ⚠️ MANFIY BO'LISHI MUMKIN VA BU NORMAL: prepaid posilkada (`COD = 0`)
   * tarif baribir olinadi, ya'ni marketplace BIZGA qarzdor bo'ladi
   * (reja §7.10). `amount > 0` cheklovi QO'YILMAYDI.
   */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  /** Shu yozuvdan keyingi UMUMIY balans — hodisada `ledger.balance_after`. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  balance_after: number;

  /** Shu SOTUVCHI bo'yicha yozuvdan keyingi jamlanma. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  seller_balance_after: number;

  /** Integratsiya bo'yicha monoton raqam — uzilishni aniqlash uchun. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  seq: number;

  /**
   * Teskari yozuv aynan qaysi qatorni qaytargani (rollback, korreksiya).
   * ⚠️ Faqat `source_type` bo'yicha hisoblash YETARLI EMAS: `CORRECTION`
   * juftligi ham sotuv reversali, ham ortiqcha xarajat reversali uchun
   * ishlatiladi va sodda so'rov ikki marta sanardi.
   */
  @Column({ type: 'uuid', nullable: true })
  reverses_entry_id: string | null;

  /** Qo'llangan tarif versiyasi — nizoda «qaysi tarif» savoli uchun. */
  @Column({ type: 'int', nullable: true })
  tariff_version: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
