import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ExternalIntegrationEntity } from './external-integration.entity';
import { OrderEntity } from './order.entity';

// Sync action types
export type SyncAction = 'sold' | 'canceled' | 'paid' | 'rollback' | 'waiting';

// Sync status types
export type SyncStatus = 'pending' | 'processing' | 'success' | 'failed';

@Entity('integration_sync_queue')
@Index('IDX_SYNC_QUEUE_STATUS', ['status'])
@Index('IDX_SYNC_QUEUE_INTEGRATION', ['integration_id'])
@Index('IDX_SYNC_QUEUE_ORDER', ['order_id'])
@Index('IDX_SYNC_QUEUE_NEXT_RETRY', ['next_retry_at'])
@Index('IDX_SYNC_QUEUE_STATUS_RETRY', ['status', 'next_retry_at'])
export class IntegrationSyncQueueEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'uuid' })
  integration_id: string;

  // Qaysi action bajarilishi kerak
  @Column({ type: 'varchar', length: 20 })
  action: SyncAction;

  // Buyurtmaning oldingi holati
  @Column({ type: 'varchar', length: 50, nullable: true })
  old_status: string;

  // Buyurtmaning yangi holati
  @Column({ type: 'varchar', length: 50 })
  new_status: string;

  // Tashqi tizimga yuboriladigan holat (mapped)
  @Column({ type: 'varchar', length: 50, nullable: true })
  external_status: string;

  // API ga yuboriladigan payload
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  // Sync holati
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: SyncStatus;

  // Necha marta urinildi
  @Column({ type: 'int', default: 0 })
  attempts: number;

  // Maksimum urinishlar soni
  @Column({ type: 'int', default: 3 })
  max_attempts: number;

  // Oxirgi xato xabari
  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  // Tashqi API dan kelgan javob
  @Column({ type: 'jsonb', nullable: true })
  last_response: Record<string, any> | null;

  // Keyingi urinish vaqti (milliseconds)
  @Column({ type: 'bigint', nullable: true })
  next_retry_at: number | null;

  // Muvaffaqiyatli sync vaqti (milliseconds)
  @Column({ type: 'bigint', nullable: true })
  synced_at: number | null;

  // Tashqi buyurtma ID si (external_id from order)
  @Column({ type: 'varchar', nullable: true })
  external_order_id: string;

  // Relations
  @ManyToOne(() => ExternalIntegrationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integration_id' })
  integration: ExternalIntegrationEntity;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}
