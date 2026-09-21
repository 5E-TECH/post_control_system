import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, Unique } from 'typeorm';
import { bigintTransformer } from 'src/common/database/bigint.transformer';
import { MarketplaceSettlementMethod } from 'src/api/marketplace/marketplace.enums';

/**
 * MARKETPLACE'GA TO'LOV (hisob-kitob) — sotuvchilar bo'yicha taqsimot bilan.
 *
 * NEGA MAVJUD `paymentsToMarket` YARAMAYDI. U to'lovni market bo'yicha ENG
 * ESKI buyurtmalardan boshlab FIFO taqsimlaydi va ularni `SOLD → PAID`
 * qiladi. 40 sotuvchili marketda bu degani: **A sotuvchi uchun berilgan pul
 * C, D, E sotuvchilarining buyurtmalarini «to'langan» qilib qo'yadi**.
 *
 * Shu bois marketplace marketi uchun umumiy FIFO yo'li BLOKLANADI va
 * hisob-kitob shu jadval orqali, aniq taqsimot bilan yuritiladi (reja §7.8).
 *
 * ⚠️ `settlement.paid` — marketplace uchun sotuvchiga to'lash signali
 * BERADIGAN YAGONA hodisa. Buyurtma statusi (`PAID`) EMAS: PCS'da market
 * balansi manfiy bo'lsa sotuv avtomatik qarzni yopadi va status `PAID`
 * bo'ladi — pul harakat qilmagan holda (reja §6.1).
 */
@Entity('marketplace_settlement')
@Unique('UQ_MP_SETTLEMENT_EXTERNAL', ['integration_id', 'external_settlement_id'])
@Index('IDX_MP_SETTLEMENT_INTEGRATION', ['integration_id', 'created_at'])
export class MarketplaceSettlementEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  /** To'langan umumiy summa. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  @Column({ type: 'varchar', length: 20 })
  method: MarketplaceSettlementMethod;

  /**
   * Sotuvchilar bo'yicha taqsimot: `[{seller_id, amount}]`.
   * Hodisada `settlement.allocation` sifatida yuboriladi — ular shunga
   * qarab o'z sotuvchilariga to'laydi.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  allocation: Array<{ seller_id: string; amount: number }>;

  /** Bank o'tkazmasi raqami / chek — nizoda dalil. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  /** Ularning tomonidagi hisob-kitob ID si (tasdiqlansa to'ladi). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  external_settlement_id: string | null;

  /** Asosiy kassadagi chiqim yozuvi — pul qayerdan chiqqani. */
  @Column({ type: 'uuid', nullable: true })
  cashbox_history_id: string | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  paid_at: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
