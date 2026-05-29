import { BaseEntity } from 'src/common/database/BaseEntity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { bigintTransformerNonNull as bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * LDG Cargo dagi paketning bizning order bilan bog'lanishi.
 * Har order uchun maksimum bitta shipment yoziladi (Order_id unique).
 *
 * LDG javobidan kelgan ma'lumotlar:
 *   - ldg_order_id (integer): LDG ichki ID, kelgusi API chaqiriqlarda ishlatiladi
 *   - tracking_number: mijoz/operatorga ko'rsatiladigan kuzatuv kodi
 *   - ldg_status: oxirgi ko'rilgan LDG status code (created/RECEIVED/.../DELIVERED)
 */
@Entity('ldg_shipment')
@Unique('UQ_LDG_SHIPMENT_ORDER', ['order_id'])
@Index('IDX_LDG_SHIPMENT_LDG_ORDER_ID', ['ldg_order_id'])
@Index('IDX_LDG_SHIPMENT_TRACKING', ['tracking_number'])
@Index('IDX_LDG_SHIPMENT_STATUS', ['ldg_status'])
export class LdgShipmentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  order_id: string;

  // Oxirgi jo'natish urinishidagi post ID. Buyurtma qaytarilib qayta
  // jo'natilganda yangi post bilan keladi — post_id farqi "yangi urinish"
  // belgisi (qayta dispatch uchun).
  @Column({ type: 'uuid', nullable: true })
  post_id: string | null;

  // LDG ichki integer ID (POST /orders javobining data.order_id)
  @Column({ type: 'int', nullable: true })
  ldg_order_id: number | null;

  // LDG kuzatuv kodi (PKGPY18N0YR ko'rinishida)
  @Column({ type: 'varchar', nullable: true })
  tracking_number: string | null;

  // LDG ning oxirgi qayd etilgan statusi (kichik harfli yoki UPPERCASE — LDG bizga shunday yuboradi)
  @Column({ type: 'varchar', nullable: true })
  ldg_status: string | null;

  // LDG status oxirgi marta o'zgargan vaqt (LDG webhookdan)
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  ldg_status_changed_at: number | null;

  // LDG da paket yaratilgan vaqt (POST /orders javobidan)
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  ldg_created_at: number | null;

  // LDG ga so'nggi muvaffaqiyatli so'rov (idempotency check uchun)
  @Column({ type: 'varchar', nullable: true })
  last_request_id: string | null;

  // Yuborish urinishlari soni (retry uchun)
  @Column({ type: 'int', default: 0 })
  send_attempts: number;

  // Oxirgi xato xabari (debug uchun)
  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  // ===== RELATIONS =====

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}
