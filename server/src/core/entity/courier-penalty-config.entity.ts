import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/database/BaseEntity';
import { bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * KURYER SHTRAF MODULI — KALITLAR (yagona qator).
 *
 * Naqsh: `elchi_config` — bitta qator, yo'q bo'lsa yaratiladi.
 */
@Entity('courier_penalty_config')
export class CourierPenaltyConfigEntity extends BaseEntity {
  /**
   * `false` = SOYA REJIMI.
   *
   * Hisob to'liq ishlaydi va daftarga yoziladi, LEKIN kuryer kassasiga
   * TEGILMAYDI. Raqamlar ko'rilgach `true` qilinadi — shunda hech kim
   * noto'g'ri sozlama tufayli jazolanmaydi.
   */
  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  /**
   * ⚠️ GRANDFATHERING LANGARI.
   *
   * Modul faqat shu paytdan KEYIN JO'NATILGAN buyurtmalarga tegadi.
   * Darvoza `post.created_at >= activated_at` — `sold_at` ga EMAS:
   * yoqilishdan oldin jo'natilib keyin belgilangan buyurtma
   * jazolanmasligi kerak, kuryer uni qoida yo'q paytda olgan.
   */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  activated_at: number | null;

  /** Soya qachon boshlangani — «qancha yig'ilardi» hisoboti uchun. */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  shadow_since: number | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;
}
