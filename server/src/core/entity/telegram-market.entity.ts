import { BaseEntity } from 'src/common/database/BaseEntity';
import { Group_type } from 'src/common/enums';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity('telegram-market')
export class TelegramEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: String })
  group_id: string;

  // @Column({ type: 'enum', enum: Group_type })
  // group_type: Group_type;

  @Column({ type: 'varchar' })
  token: string;
}
