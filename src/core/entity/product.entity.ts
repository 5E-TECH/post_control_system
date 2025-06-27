<<<<<<< HEAD
import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';
=======
import { BaseEntity } from "src/common/database/BaseEntity";
import { Column, Entity, Index } from "typeorm";
>>>>>>> a0f423e (Product table Crudi deyarli full tugadi hali market_id ga relation qilingani yoq)

@Entity('product')
@Index(['name', 'market_id'], { unique: true })
export class ProductEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'varchar', name: 'market_id' })
  market_id: string;

  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  image_url: string;
}
