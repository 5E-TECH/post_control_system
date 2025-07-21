import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { MarketEntity } from './market.entity';

@Entity('product')
@Index(['name', 'market_id'], { unique: true })
export class ProductEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  image_url: string;
}
