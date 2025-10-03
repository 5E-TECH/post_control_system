import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity('telegram-market')
export class TelegramEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: String })
  group_id: string;

  @Column({ type: 'varchar' })
  token: string;
}
