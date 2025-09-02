import { BaseEntity } from 'src/common/database/BaseEntity';
import { Cashbox_type } from 'src/common/enums';
import { Column, Entity, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';
import { CashboxHistoryEntity } from './cashbox-history.entity';
import { MarketEntity } from './market.entity';

@Entity('cash_box')
export class CashEntity extends BaseEntity {
  @Column({ type: 'decimal', default: 0 })
  balance: number;

  @Column({ type: 'enum', enum: Cashbox_type })
  cashbox_type: Cashbox_type;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  market_id: string; // 🟢 Market bilan bog‘lash

  // 1-1 Cashbox → User
  @OneToOne(() => UserEntity, (user) => user.cashbox, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  // 1-1 Cashbox → Market
  @OneToOne(() => MarketEntity, (market) => market.cashbox, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'market_id' })
  market: MarketEntity;

  // 1-N Cashbox → CashboxHistory
  @OneToMany(() => CashboxHistoryEntity, (history) => history.cashbox)
  histories: CashboxHistoryEntity[];
}
