import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  is_active: boolean;

  @Column({
    name: 'created_at',
    type: 'bigint',
    default: () => '(EXTRACT(epoch FROM NOW()) * 1000)::bigint',
  })
  created_at: number;

  @Column({
    name: 'updated_at',
    type: 'bigint',
    default: () => '(EXTRACT(epoch FROM NOW()) * 1000)::bigint',
  })
  updated_at: number;
}