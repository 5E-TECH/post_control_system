import { BaseEntity } from 'src/common/database/BaseEntity';
import { Operation_type, Source_type, PaymentMethod } from 'src/common/enums';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CashEntity } from './cash-box.entity';
import { UserEntity } from './users.entity';
import { OrderEntity } from './order.entity';

const bigintTransformer = {
  to: (value: number) => value,
  from: (value: string) => (value ? Number(value) : 0),
};

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

  @Column({ type: 'bigint', transformer: bigintTransformer, nullable: true })
  amount: number | null;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  balance_after: number;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  payment_method: PaymentMethod | null;

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
}
