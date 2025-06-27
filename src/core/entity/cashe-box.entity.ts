import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';

@Entity('cashe_box')
export class CasheEntity extends BaseEntity {
  @Column({
    type: 'decimal',
  })
  balance: number;
}
