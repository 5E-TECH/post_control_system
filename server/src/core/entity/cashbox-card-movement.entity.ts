import { BaseEntity } from 'src/common/database/BaseEntity';
import { CardMovementType } from 'src/common/enums';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CashEntity } from './cash-box.entity';
import { CashboxCardEntity } from './cashbox-card.entity';
import { UserEntity } from './users.entity';
import {
  bigintTransformerNonNull as bigintTransformer,
  bigintTransformer as bigintTransformerNullable,
} from 'src/common/database/bigint.transformer';

/**
 * Asosiy kassa kartalari orasidagi ICHKI ko'chirma/konvertatsiya jurnali.
 *
 * Bu yozuvlar kirim ham, chiqim ham EMAS — kassaning umumiy `balance` ini
 * o'zgartirmaydi (faqat kartalararo yoki naqd↔karta ajratimni o'zgartiradi).
 * Shu sababli ular `cashbox_history` ga yozilmaydi va kirim/chiqim
 * yig'indilariga, moliyaviy taroziga ta'sir qilmaydi.
 *
 *   - CARD_TO_CARD: from_card → to_card (balance_card o'zgarmaydi)
 *   - CARD_TO_CASH: from_card balansi kamayadi, balance_cash oshadi (to_card = null)
 *   - CASH_TO_CARD: balance_cash kamayadi, to_card balansi oshadi (from_card = null)
 */
@Entity('cashbox_card_movement')
@Index('IDX_CARD_MOVEMENT_CASHBOX_ID', ['cashbox_id'])
@Index('IDX_CARD_MOVEMENT_CREATED_AT', ['created_at'])
@Index('IDX_CARD_MOVEMENT_TYPE', ['type'])
export class CashboxCardMovementEntity extends BaseEntity {
  @Column({ type: 'enum', enum: CardMovementType })
  type: CardMovementType;

  @Column({ type: 'uuid' })
  cashbox_id: string;

  @Column({ type: 'uuid', nullable: true })
  from_card_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  to_card_id: string | null;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  // Ko'chirmadan keyingi MANBA karta balansi (CARD_TO_* uchun)
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  balance_after_from: number | null;

  // Ko'chirmadan keyingi MAQSAD karta balansi (*_TO_CARD uchun)
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  balance_after_to: number | null;

  @Column({ type: 'varchar', nullable: true })
  comment: string | null;

  @Column({ type: 'uuid' })
  created_by: string;

  // ========= RELATIONLAR ==========

  @ManyToOne(() => CashEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cashbox_id' })
  cashbox: CashEntity;

  @ManyToOne(() => CashboxCardEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_card_id' })
  fromCard?: CashboxCardEntity;

  @ManyToOne(() => CashboxCardEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_card_id' })
  toCard?: CashboxCardEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: UserEntity;
}
