import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './users.entity';

export enum ShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

const bigintTransformer = {
  to: (value: number) => value,
  from: (value: string) => (value ? Number(value) : 0),
};

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

  @Column({ type: 'bigint', transformer: bigintTransformer })
  opened_at: number;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  closed_at: number;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  // Smena boshidagi qoldiqlar
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  opening_balance_cash: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  opening_balance_card: number;

  // Smena oxiridagi qoldiqlar
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  closing_balance_cash: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  closing_balance_card: number;

  // Smena davomidagi kirim/chiqim
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  total_income_cash: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  total_income_card: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  total_expense_cash: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
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
