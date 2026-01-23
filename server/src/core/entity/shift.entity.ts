import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './users.entity';

export enum ShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('shifts')
@Index('IDX_SHIFT_OPENED_BY', ['opened_by'])
@Index('IDX_SHIFT_STATUS', ['status'])
@Index('IDX_SHIFT_OPENED_AT', ['opened_at'])
@Index('IDX_SHIFT_STATUS_OPENED', ['status', 'opened_at'])
export class ShiftEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  opened_by: string;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string;

  @Column({ type: 'bigint' })
  opened_at: number;

  @Column({ type: 'bigint', nullable: true })
  closed_at: number;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  // Smena boshidagi qoldiqlar
  @Column({ type: 'int', default: 0 })
  opening_balance_cash: number;

  @Column({ type: 'int', default: 0 })
  opening_balance_card: number;

  // Smena oxiridagi qoldiqlar
  @Column({ type: 'int', default: 0 })
  closing_balance_cash: number;

  @Column({ type: 'int', default: 0 })
  closing_balance_card: number;

  // Smena davomidagi kirim/chiqim
  @Column({ type: 'int', default: 0 })
  total_income_cash: number;

  @Column({ type: 'int', default: 0 })
  total_income_card: number;

  @Column({ type: 'int', default: 0 })
  total_expense_cash: number;

  @Column({ type: 'int', default: 0 })
  total_expense_card: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'opened_by' })
  openedByUser: UserEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closed_by' })
  closedByUser: UserEntity;
}
