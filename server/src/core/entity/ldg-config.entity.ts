import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './users.entity';

/**
 * LDG Cargo integratsiya sozlamalari (singleton — doimo bitta qator).
 *
 * API kalitlar va webhook secret encrypted holda saqlanadi (column transformer orqali
 * yoki app darajasida shifrlash). Hozir oddiy varchar — keyinchalik `crypto-transformer`
 * qo'shilishi mumkin.
 */
@Entity('ldg_config')
export class LdgConfigEntity extends BaseEntity {
  // ===== ULANISH =====

  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  @Column({ type: 'boolean', default: true })
  is_sandbox: boolean;

  @Column({ type: 'varchar', default: 'https://api.fcargo.uz/api/client/v1' })
  api_base_url: string;

  // X-API-Key header qiymati (Production live kalit)
  @Column({ type: 'varchar', nullable: true })
  api_key: string | null;

  // X-Tenant-Domain header qiymati
  @Column({ type: 'varchar', nullable: true })
  tenant_domain: string | null;

  // ===== WEBHOOK =====

  // Joriy webhook secret (HMAC-SHA256)
  @Column({ type: 'varchar', nullable: true })
  webhook_secret: string | null;

  // Eski webhook secret (key rotation uchun, v2 imzo tekshirish)
  @Column({ type: 'varchar', nullable: true })
  webhook_secret_previous: string | null;

  // ===== SENDER (markaziy filial) =====

  @Column({ type: 'varchar', nullable: true })
  sender_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  sender_phone: string | null;

  // SOATO viloyat kodi (integer — masalan 1726)
  @Column({ type: 'int', nullable: true })
  sender_region_sato: number | null;

  // SOATO tuman kodi (integer — masalan 1726269)
  @Column({ type: 'int', nullable: true })
  sender_district_sato: number | null;

  @Column({ type: 'text', nullable: true })
  sender_address: string | null;

  // LDG filial ID — buyurtma yaratganda sender.branch_id va receiver.branch_id
  // sifatida yuboriladi. LDG'da xizmat hududlari sozlanmagan tenant'lar uchun
  // shartli — bu yo'q bo'lsa LDG district orqali avtomatik filial topadi.
  @Column({ type: 'int', nullable: true })
  sender_branch_id: number | null;

  // ===== DEFAULT PACKAGE =====

  // Vazn (kg) — barcha buyurtmalar uchun default qiymat
  @Column({ type: 'float', default: 1.0 })
  default_weight: number;

  // Uzunlik (cm)
  @Column({ type: 'int', default: 30 })
  default_length: number;

  // Eni (cm)
  @Column({ type: 'int', default: 20 })
  default_width: number;

  // Balandligi (cm)
  @Column({ type: 'int', default: 15 })
  default_height: number;

  // O'rinlar soni — har doim 1
  @Column({ type: 'int', default: 1 })
  default_seats: number;

  // To'lovchi turi: 'receiver' | 'sender' | 'third_party'
  @Column({ type: 'varchar', default: 'receiver' })
  default_payer_type: string;

  // ===== ENABLED DISTRICTS (DEPRECATED) =====

  // ESKIRGAN — endi ishlatilmaydi. LDG'ga routing tuman bo'yicha avtomatik
  // emas, operatorning qo'lda kuryer tanlashiga qarab ishlaydi. Ustun DB'da
  // dormant qoldirilgan (data yo'qotmaslik uchun); keyinchalik alohida
  // migration bilan o'chirsa bo'ladi. Hech qaysi kod o'qimaydi/yozmaydi.
  @Column({ type: 'jsonb', default: [] })
  enabled_district_sato_codes: number[];

  // ===== LDG KURYER USER =====

  // LDG ni ifodalovchi kuryer-user (role: COURIER, external_provider: 'ldg')
  @Column({ type: 'uuid', nullable: true })
  ldg_courier_user_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ldg_courier_user_id' })
  ldgCourier: UserEntity | null;
}
