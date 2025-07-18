import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity()
export class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'created_at',
    type: 'bigint',
  })
  created_at: number;

  @Column({
    name: 'updated_at',
    type: 'bigint',
  })
  updated_at: number;

  @BeforeInsert()
  setCreationTimestamps() {
    const now = Date.now();
    this.created_at = now;
    this.updated_at = now;
  }

  @BeforeUpdate()
  setUpdateTimestamp() {
    this.updated_at = Date.now();
  }
}
