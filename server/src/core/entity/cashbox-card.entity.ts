import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CashEntity } from './cash-box.entity';
import { bigintTransformerNonNull as bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * Asosiy (MAIN) kassa ichidagi virtual karta.
 *
 * Asosiy kassaning `balance_card` (umumiy karta summasi) bir nechta real
 * karta/hisobga (Humo, Uzcard, Click va h.k.) bo'linib tushadi. Har bir virtual
 * karta shu real hisoblardan birini ifodalaydi.
 *
 * INVARIANT: bitta MAIN kassaga tegishli barcha kartalarning `balance`
 * yig'indisi shu kassaning `balance_card` ga TENG bo'lishi shart (har doim).
 *
 * `is_default = true` bo'lgan karta — himoyalangan "Asosiy karta": uni o'chirib
 * yoki nomini o'zgartirib, deaktiv qilib bo'lmaydi. `click_to_market` kabi
 * "o'tib ketuvchi" to'lovlar shu kartadan o'tadi. Har bir kassada aynan bitta
 * default karta bo'ladi (partial unique index bilan kafolatlanadi).
 */
@Entity('cashbox_card')
@Index('IDX_CASHBOX_CARD_CASHBOX_ID', ['cashbox_id'])
@Index('IDX_CASHBOX_CARD_ACTIVE', ['is_active'])
export class CashboxCardEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance: number;

  @Column({ type: 'uuid' })
  cashbox_id: string;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  // N-1 Card → Cashbox (MAIN)
  @ManyToOne(() => CashEntity, (cashbox) => cashbox.cards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cashbox_id' })
  cashbox: CashEntity;
}
