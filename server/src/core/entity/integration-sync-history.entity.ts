import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ExternalIntegrationEntity } from './external-integration.entity';

@Entity('integration_sync_history')
@Index('IDX_SYNC_HISTORY_INTEGRATION', ['integration_id'])
@Index('IDX_SYNC_HISTORY_DATE', ['sync_date'])
export class IntegrationSyncHistoryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  @Column({ type: 'varchar', length: 100 })
  integration_name: string;

  @Column({ type: 'int', default: 0 })
  synced_orders: number;

  @Column({ type: 'bigint' })
  sync_date: number; // Millisekund formatda (loyiha standarti)

  // Relation - Integratsiya
  @ManyToOne(() => ExternalIntegrationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integration_id' })
  integration: ExternalIntegrationEntity;
}
