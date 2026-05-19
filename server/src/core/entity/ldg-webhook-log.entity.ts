import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { bigintTransformerNonNull as bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * LDG webhook qabul qilish jurnali — replay protection + audit trail.
 *
 * `delivery_id` PRIMARY KEY: LDG ning `X-FCargo-Delivery-ID` headerini ishlatadi.
 * Takrorlangan webhook (replay) avtomatik unique violation berib, biz 200 qaytaramiz.
 *
 * 30 kunlik eski yozuvlar `@Cron` orqali tozalanadi.
 *
 * Bu BaseEntity dan meros olmaydi — chunki bizga UUID generated id kerak emas,
 * delivery_id ning o'zi PK.
 */
@Entity('ldg_webhook_log')
@Index('IDX_LDG_WEBHOOK_LOG_RECEIVED_AT', ['received_at'])
@Index('IDX_LDG_WEBHOOK_LOG_EVENT_TYPE', ['event_type'])
export class LdgWebhookLogEntity {
  // LDG `whd_<uuid>` formatida yuboradi, bizda tozalanmasdan saqlanadi
  // (debugging uchun LDG dashboard bilan to'g'ridan-to'g'ri solishtirish mumkin)
  @PrimaryColumn({ type: 'varchar' })
  delivery_id: string;

  // Event ID (X-FCargo-Event-ID) — `evt_<uuid>` formatida
  @Column({ type: 'varchar', nullable: true })
  event_id: string | null;

  // Event turi: 'package.delivered', 'webhook.test', va h.k.
  @Column({ type: 'varchar' })
  event_type: string;

  // Imzo to'g'rilik holati
  @Column({ type: 'boolean' })
  signature_valid: boolean;

  // Qayta ishlash holati: 'success' | 'failed' | 'skipped' | 'invalid_signature'
  @Column({ type: 'varchar' })
  status: string;

  // Xato xabari (status='failed' bo'lsa)
  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  // To'liq payload (audit uchun)
  @Column({ type: 'jsonb' })
  raw_payload: Record<string, unknown>;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
  })
  received_at: number;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  processed_at: number | null;
}
