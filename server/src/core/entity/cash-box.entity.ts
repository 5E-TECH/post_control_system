import { BaseEntity } from 'src/common/database/BaseEntity';
import { Cashbox_type } from 'src/common/enums';
import { Column, Entity, OneToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './users.entity';
import { CashboxHistoryEntity } from './cashbox-history.entity';
import { bigintTransformerNonNull as bigintTransformer } from 'src/common/database/bigint.transformer';

@Entity('cash_box')
@Index('IDX_CASH_BOX_USER_ID', ['user_id'])
@Index('IDX_CASH_BOX_TYPE', ['cashbox_type'])
@Index('IDX_CASH_BOX_USER_TYPE', ['user_id', 'cashbox_type'])
export class CashEntity extends BaseEntity {
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance_cash: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance_card: number;

  @Column({ type: 'enum', enum: Cashbox_type })
  cashbox_type: Cashbox_type;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  // 1-1 Cashbox → User
  @OneToOne(() => UserEntity, (user) => user.cashbox, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  // 1-N Cashbox → CashboxHistory
  @OneToMany(() => CashboxHistoryEntity, (history) => history.cashbox)
  histories: CashboxHistoryEntity[];
}
