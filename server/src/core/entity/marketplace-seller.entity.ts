import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, Unique } from 'typeorm';
import { bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * MARKETPLACE ICHIDAGI SOTUVCHI — reestr ko'zgusi.
 *
 * `GET /bp/v1/sellers` orqali kuniga bir marta tortib olinadi. Bu jadval
 * PUL YURITMAYDI — pul `marketplace_ledger_entry` da. Bu yerda faqat nom va
 * holat, ya'ni panelda «SLR-77» o'rniga «Rustam Savdo MChJ» ko'rsatish uchun.
 *
 * ⚠️ Reestrda yo'q sotuvchi posilkasi baribir QABUL QILINADI — lekin
 * `is_unknown` bilan belgilanadi va panelda ko'rinadi. Sabab: ombordagi
 * operatorni ularning reestr kechikishi uchun to'xtatib qo'yish noto'g'ri.
 */
@Entity('marketplace_seller')
@Unique('UQ_MP_SELLER_EXTERNAL', ['integration_id', 'external_seller_id'])
@Index('IDX_MP_SELLER_INTEGRATION', ['integration_id'])
export class MarketplaceSellerEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  /** Ularning sotuvchi ID si — pul attributsiyasining kaliti. */
  @Column({ type: 'varchar', length: 120 })
  external_seller_id: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /**
   * `true` — reestrda topilmadi, posilkadan bilib olindi. Panelda
   * «noma'lum sotuvchi» deb ko'rinadi va reestr sinxronidan keyin tozalanadi.
   */
  @Column({ type: 'boolean', default: false })
  is_unknown: boolean;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  synced_at: number | null;
}
