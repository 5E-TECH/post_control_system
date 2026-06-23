import { BaseEntity } from 'src/common/database/BaseEntity';
import { Operation_type, Source_type, PaymentMethod } from 'src/common/enums';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CashEntity } from './cash-box.entity';
import { CashboxCardEntity } from './cashbox-card.entity';
import { UserEntity } from './users.entity';
import { OrderEntity } from './order.entity';
import {
  bigintTransformerNonNull as bigintTransformer,
  bigintTransformer as bigintTransformerNullable,
} from 'src/common/database/bigint.transformer';

@Entity('cashbox_history')
@Index('IDX_CASHBOX_HISTORY_CASHBOX_ID', ['cashbox_id'])
@Index('IDX_CASHBOX_HISTORY_CREATED_AT', ['created_at'])
@Index('IDX_CASHBOX_HISTORY_OPERATION', ['operation_type'])
@Index('IDX_CASHBOX_HISTORY_SOURCE', ['source_type'])
@Index('IDX_CASHBOX_HISTORY_CREATED_BY', ['created_by'])
export class CashboxHistoryEntity extends BaseEntity {
  @Column({ type: 'enum', enum: Operation_type })
  operation_type: Operation_type;

  @Column({ type: 'uuid' })
  cashbox_id: string;

  @Column({ type: 'enum', enum: Source_type })
  source_type: Source_type;

  // Order bilan bog'lanish uchun
  @Column({ type: 'uuid', nullable: true })
  source_id: string | null;

  // Kuryer/Market/User bilan bog'lanish uchun (qayerdan/qayerga)
  @Column({ type: 'uuid', nullable: true })
  source_user_id: string | null;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  balance_after: number;

  // Amaldan keyingi NAQD balans — faqat MAIN kassa yozuvlarida to'ldiriladi.
  // Kuryer/market kassalari va eski yozuvlar uchun `null` (ajratim yuritilmaydi).
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  balance_after_cash: number | null;

  // Amaldan keyingi KARTA balans — faqat MAIN kassa yozuvlarida to'ldiriladi.
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformerNullable,
  })
  balance_after_card: number | null;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  payment_method: PaymentMethod | null;

  // Qaysi virtual kartaga tegishli (faqat MAIN kassaning kartali yozuvlarida).
  // NAQD yozuvlar va migratsiyagacha bo'lgan eski yozuvlar uchun `null`.
  @Column({ type: 'uuid', nullable: true })
  card_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  comment: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'date', nullable: true })
  payment_date: string;

  // ========= RELATIONLAR ==========

  @ManyToOne(() => CashEntity, (cashbox) => cashbox.histories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cashbox_id' })
  cashbox: CashEntity;

  @ManyToOne(() => UserEntity, (user) => user.histories, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by' })
  createdByUser: UserEntity;

  // 🔗 Order bilan bog'lanish
  @ManyToOne(() => OrderEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_id' })
  order?: OrderEntity;

  // 🔗 Manba/Maqsad user (kuryer, market, va h.k.)
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_user_id' })
  sourceUser?: UserEntity;

  // 🔗 Virtual karta (kartali yozuvlar uchun)
  @ManyToOne(() => CashboxCardEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'card_id' })
  card?: CashboxCardEntity;
}
