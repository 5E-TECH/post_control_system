import { BaseEntity } from "src/common/database/BaseEntity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { MarketEntity } from "./market.entity";

@Entity('product')
@Index(['name', 'market'], { unique: true })
export class ProductEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @ManyToOne(() => MarketEntity, market => market.products)
  @JoinColumn({ name: 'market_id', referencedColumnName: 'id' })
  market: MarketEntity;

  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  image_url: string;
}
