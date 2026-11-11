import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './users.entity';
import { bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * TASHQI YETKAZUVCHI (CARRIER) AKKAUNTI — bitta kompaniya = bitta qator.
 *
 * Tashqi yetkazuvchi BeePost'da BITTA kuryer user sifatida ishlaydi:
 * `X-Api-Key` shu kuryerga bog'langan va har bir `/api/v1/carrier/*` so'rovi
 * o'sha kuryer nomidan mavjud kuryer amallariga (`sellOrder`, `partlySold`,
 * `cancelOrder`, `rollbackOrderToWaiting`, `createCanceledPost`) yo'naltiriladi.
 * Pul oddiy kuryerdagidek kuryerning `FOR_COURIER` kassasiga tushadi.
 *
 * Kontrakt Elchi bilan BIR XIL (`CARRIER_API.md`) — kompaniya bitta
 * integratsiya yozadi, faqat base URL va kalit har tizimda alohida.
 *
 * ⚠️ Kalit OCHIQ saqlanmaydi: faqat SHA-256 xeshi (`api_key_hash`). Kalit
 * yaratilganda yoki almashtirilganda BIR MARTA ko'rsatiladi.
 *
 * Marketplace kalitlari (`marketplace_integration`) bilan aralashmaydi:
 * carrier kaliti `/marketplace/*` ga, marketplace kaliti `/carrier/*` ga
 * kira olmaydi.
 */
@Entity('carrier_account')
@Index('UQ_CARRIER_ACCOUNT_KEY_HASH', ['api_key_hash'], { unique: true })
@Index('IDX_CARRIER_ACCOUNT_ACTIVE', ['is_active'])
/**
 * Bitta kuryerga bitta (o'chirilmagan) carrier akkaunti. O'chirilgan akkaunt
 * kuryerni bo'shatadi — xuddi shu kuryerga yangi akkaunt ochish mumkin.
 */
@Index('UQ_CARRIER_ACCOUNT_COURIER', ['courier_user_id'], {
  unique: true,
  where: '"is_deleted" = false',
})
export class CarrierAccountEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Bog'langan kuryer user (`users.role = courier`, `external_provider = 'carrier'`). */
  @Column({ type: 'uuid' })
  courier_user_id: string;

  /**
   * ⚠️ FK nomi migratsiyadagi bilan AYNAN bir xil (`1751100000000-CarrierApi`).
   * Nom berilmasa TypeORM xesh-nom (`FK_7c8b…`) kutadi va
   * `migration:generate` har safar FK'ni o'chirib qayta qo'shishni taklif qiladi.
   */
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'courier_user_id',
    foreignKeyConstraintName: 'FK_CARRIER_ACCOUNT_COURIER',
  })
  courier?: UserEntity;

  /** `sha256(api_key)` hex (64 belgi). Ochiq kalit hech qayerda saqlanmaydi. */
  @Column({ type: 'varchar', length: 64 })
  api_key_hash: string;

  /** Admin panelda niqoblangan ko'rinish uchun (`bpc_…a1b2`). */
  @Column({ type: 'varchar', length: 4 })
  api_key_last4: string;

  /**
   * Ruxsat etilgan IP'lar: IPv4, IPv4 CIDR yoki aniq IPv6 (kanonik shaklda).
   * `null` yoki bo'sh — cheklov yo'q.
   */
  @Column({ type: 'jsonb', nullable: true })
  ip_allowlist: string[] | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  /** Oxirgi muvaffaqiyatli autentifikatsiya (epoch ms, ~1 daqiqa aniqlik). */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_used_at: number | null;

  /** Akkauntni yaratgan admin. */
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;
}
