import { BaseEntity } from 'src/common/database/BaseEntity';
import { Group_type } from 'src/common/enums';
import { Column, Entity, Index } from 'typeorm';

@Entity('telegram-market')
@Index('IDX_TELEGRAM_MARKET_ID', ['market_id'])
@Index('IDX_TELEGRAM_GROUP_TYPE', ['group_type'])
@Index('IDX_TELEGRAM_MARKET_TYPE', ['market_id', 'group_type'])
export class TelegramEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: String })
  group_id: string;

  @Column({ type: 'enum', enum: Group_type, nullable: true })
  group_type: Group_type;

  @Column({ type: 'varchar' })
  token: string;
}
