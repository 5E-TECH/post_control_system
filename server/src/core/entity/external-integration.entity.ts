import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from './users.entity';

// Auth type enum
export type AuthType = 'api_key' | 'login';

// Field mapping interfeysi
export interface FieldMapping {
  id_field: string;
  qr_code_field: string;
  customer_name_field: string;
  phone_field: string;
  extra_phone_field: string;
  region_code_field: string;
  district_code_field: string;
  address_field: string;
  comment_field: string;
  total_price_field: string;
  delivery_price_field: string;
  total_count_field: string;
  items_field: string;
  created_at_field: string;
}

// Status mapping interfeysi - bizning statuslarni tashqi tizim statuslariga moslashtirish
export interface StatusMapping {
  sold: string;        // Sotildi → tashqi tizimdagi status
  canceled: string;    // Bekor qilindi → tashqi tizimdagi status
  paid: string;        // To'landi → tashqi tizimdagi status
  rollback: string;    // Qaytarildi → tashqi tizimdagi status
  waiting: string;     // Kutilmoqda → tashqi tizimdagi status
}

// Default status mapping
export const DEFAULT_STATUS_MAPPING: StatusMapping = {
  sold: 'completed',
  canceled: 'cancelled',
  paid: 'paid',
  rollback: 'returned',
  waiting: 'pending',
};

// Status sync configuration interfeysi
export interface StatusSyncConfig {
  enabled: boolean;              // Sync yoqilganmi
  endpoint: string;              // API endpoint (e.g., '/orders/{id}/status' yoki '/orderstatus/update')
  method: 'PUT' | 'PATCH' | 'POST';  // HTTP method
  status_field: string;          // Request body dagi status field nomi
  use_auth: boolean;             // Authorization header ishlatilsinmi
  include_order_id_in_body: boolean;  // Order ID ni body ga qo'shish kerakmi
  order_id_field: string;        // Body dagi order ID field nomi (masalan: 'order_id')
}

// Default status sync config
export const DEFAULT_STATUS_SYNC_CONFIG: StatusSyncConfig = {
  enabled: false,
  endpoint: '/orders/{id}/status',
  method: 'PUT',
  status_field: 'status',
  use_auth: true,
  include_order_id_in_body: false,
  order_id_field: 'order_id',
};

// Default field mapping (Adosh formatiga mos)
export const DEFAULT_FIELD_MAPPING: FieldMapping = {
  id_field: 'id',
  qr_code_field: 'qrCode',
  customer_name_field: 'full_name',
  phone_field: 'phone',
  extra_phone_field: 'additional_phone',
  region_code_field: 'region',
  district_code_field: 'district',
  address_field: 'address',
  comment_field: 'comment',
  total_price_field: 'total_price',
  delivery_price_field: 'delivery_price',
  total_count_field: 'total_count',
  items_field: 'items',
  created_at_field: 'created_at',
};

@Entity('external_integration')
@Index('IDX_EXT_INT_SLUG', ['slug'], { unique: true })
@Index('IDX_EXT_INT_ACTIVE', ['is_active'])
@Index('IDX_EXT_INT_MARKET', ['market_id'])
export class ExternalIntegrationEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  @Column({ type: 'varchar' })
  api_url: string;

  @Column({ type: 'varchar', nullable: true })
  api_key: string;

  @Column({ type: 'varchar', nullable: true })
  api_secret: string;

  // Authentication configuration
  @Column({ type: 'varchar', length: 20, default: 'api_key' })
  auth_type: AuthType;

  @Column({ type: 'varchar', nullable: true })
  auth_url: string; // Login endpoint URL (for login-based auth)

  @Column({ type: 'varchar', nullable: true })
  username: string;

  @Column({ type: 'varchar', nullable: true })
  password: string;

  @Column({ type: 'uuid' })
  market_id: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', default: DEFAULT_FIELD_MAPPING })
  field_mapping: FieldMapping;

  // Status mapping - bizning statuslarni tashqi tizim statuslariga moslashtirish
  @Column({ type: 'jsonb', default: DEFAULT_STATUS_MAPPING })
  status_mapping: StatusMapping;

  // Status sync configuration
  @Column({ type: 'jsonb', default: DEFAULT_STATUS_SYNC_CONFIG })
  status_sync_config: StatusSyncConfig;

  @Column({ type: 'bigint', nullable: true })
  last_sync_at: number | null;

  @Column({ type: 'int', default: 0 })
  total_synced_orders: number;

  // Relation - Biriktirilgan market
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'market_id' })
  market: UserEntity;
}
