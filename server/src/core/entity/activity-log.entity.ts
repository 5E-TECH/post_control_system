import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './users.entity';

/**
 * Tizimda sodir bo'lgan barcha muhim o'zgarishlarni yozib boruvchi jadval.
 * Buyurtmalar, pochtalar, foydalanuvchilar, kassalar va boshqa
 * resurslarning hayot siklidagi har bir qadamni qayd etadi.
 */
@Entity('activity_logs')
@Index('IDX_ACTIVITY_LOG_ENTITY', ['entity_type', 'entity_id'])
@Index('IDX_ACTIVITY_LOG_ACTION', ['action'])
@Index('IDX_ACTIVITY_LOG_CREATED_AT', ['created_at'])
@Index('IDX_ACTIVITY_LOG_USER', ['user_id'])
@Index('IDX_ACTIVITY_LOG_ENTITY_CREATED', ['entity_type', 'entity_id', 'created_at'])
export class ActivityLogEntity extends BaseEntity {
  // Qaysi resurs turi: 'order', 'post', 'user', 'cashbox', 'shift'
  @Column({ type: 'varchar', length: 50 })
  entity_type: string;

  // Resursning ID si (order_id, post_id, user_id, etc.)
  @Column({ type: 'uuid' })
  entity_id: string;

  // Harakatning qisqa nomi: 'status_change', 'created', 'deleted', 'updated', 'payment', etc.
  @Column({ type: 'varchar', length: 50 })
  action: string;

  // Oldingi qiymat (status, narx va h.k.) — JSON string
  @Column({ type: 'jsonb', nullable: true })
  old_value: Record<string, any>;

  // Yangi qiymat — JSON string
  @Column({ type: 'jsonb', nullable: true })
  new_value: Record<string, any>;

  // Inson o'qiy oladigan tavsif
  @Column({ type: 'text', nullable: true })
  description: string;

  // Kim qildi (null bo'lishi mumkin — tizim avtomatik qilgan bo'lsa)
  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  // Kim qilganining nomi (tez ko'rsatish uchun denormalized)
  @Column({ type: 'varchar', nullable: true })
  user_name: string;

  // Kim qilganining roli
  @Column({ type: 'varchar', nullable: true })
  user_role: string;

  // Qo'shimcha ma'lumot (IP, request context va h.k.)
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Relations
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
