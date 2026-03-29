import { BaseEntity } from 'src/common/database/BaseEntity';
import { FinancialSource_type } from 'src/common/enums';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './users.entity';
import { OrderEntity } from './order.entity';

@Entity('financial_balance_history')
@Index('IDX_FBH_CREATED_AT', ['created_at'])
@Index('IDX_FBH_SOURCE_TYPE', ['source_type'])
export class FinancialBalanceHistoryEntity extends BaseEntity {
  // Taroziga ta'sir miqdori (+ musbat, - manfiy)
  @Column({ type: 'int' })
  amount: number;

  // O'zgarishdan OLDINGI moliyaviy balans
  @Column({ type: 'int' })
  balance_before: number;

  // O'zgarishdan KEYINGI moliyaviy balans
  @Column({ type: 'int' })
  balance_after: number;

  // Manba turi
  @Column({ type: 'enum', enum: FinancialSource_type })
  source_type: FinancialSource_type;

  // Buyurtma bilan bog'liq bo'lsa (SELL_PROFIT, CORRECTION)
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  // Qaysi user bilan bog'liq (market, courier, hodim)
  @Column({ type: 'uuid', nullable: true })
  related_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  comment: string | null;

  // Kim tomonidan bajarilgan
  @Column({ type: 'uuid' })
  created_by: string;

  // ========= RELATIONLAR ==========

  @ManyToOne(() => OrderEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order?: OrderEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_user_id' })
  relatedUser?: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserEntity;
}
