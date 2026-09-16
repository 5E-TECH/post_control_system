import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './users.entity';
import { encryptedTransformer } from 'src/common/database/encrypted.transformer';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';

/**
 * MARKETPLACE ULANISHI — bitta marketplace = bitta qator.
 *
 * Kontrakt BIZNIKI (SPEC rejimi), shuning uchun bu yerda `field_mapping` YO'Q:
 * maydon nomlari kontraktda qat'iy belgilangan va qattiq DTO bilan tekshiriladi.
 * Aynan shu sabab ikkinchi marketplace KODSIZ ulanadi — faqat yangi qator.
 *
 * Reja: `docs/integrations/14-marketplace-beepost.md` §4.1
 */
@Entity('marketplace_integration')
@Index('IDX_MP_INTEGRATION_SLUG', ['slug'], { unique: true })
@Index('IDX_MP_INTEGRATION_ACTIVE', ['is_active'])
@Index('IDX_MP_INTEGRATION_MARKET', ['market_id'])
export class MarketplaceIntegrationEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** URL va `operator` matnida ishlatiladi — o'zgartirilmasligi kerak. */
  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  /** Masalan `https://api.uzum.uz` — oxirida `/` bo'lmasin. */
  @Column({ type: 'varchar', nullable: true })
  api_base_url: string | null;

  /**
   * Ular bergan kalit — BIZ ularga yuborganda `X-Api-Key` sifatida ketadi.
   * ⚠️ Bazada SHIFRLANGAN (AES-256-GCM).
   */
  @Column({ type: 'varchar', nullable: true, transformer: encryptedTransformer })
  api_key: string | null;

  /**
   * BIZ chiquvchi so'rovlarni shu bilan imzolaymiz (`X-BeePost-Signature`).
   * ⚠️ Bazada SHIFRLANGAN.
   */
  @Column({ type: 'varchar', nullable: true, transformer: encryptedTransformer })
  signing_secret: string | null;

  /**
   * Eski imzo sekreti — ikki kalitli aylantirish oynasi uchun (`v2`).
   * Aylantirish: yangi kalit qo'yiladi → eski shu yerga ko'chadi → 24 soatdan
   * keyin tozalanadi. Uzilish bo'lmaydi (kontrakt §3.4).
   */
  @Column({ type: 'varchar', nullable: true, transformer: encryptedTransformer })
  signing_secret_previous: string | null;

  /**
   * ULAR bizning o'qish endpointlarimizga kelganda ishlatadigan kalit.
   * ⚠️ `api_key` dan ATAYLAB ajratilgan — bu ikki yo'nalish, ikki sir.
   * Bittasi sizib chiqsa ikkinchisi ishlayveradi.
   */
  @Column({ type: 'varchar', nullable: true, transformer: encryptedTransformer })
  inbound_api_key: string | null;

  /** Ularning o'qish so'rovlari uchun IP oq ro'yxati (bo'sh = cheklov yo'q). */
  @Column({ type: 'jsonb', nullable: true })
  ip_allowlist: string[] | null;

  /**
   * Shu marketplace biriktirilgan PCS marketi. Kassa, buyurtma egaligi va
   * hisob-kitob shu foydalanuvchi orqali yuritiladi (reja §7.1).
   */
  @Column({ type: 'uuid' })
  market_id: string;

  /**
   * MASTER KALIT. `false` — na skan, na hodisa yuborish ishlaydi.
   * ⚠️ Navbatdagi hodisalarni ham to'xtatadi (reja §12: hozirgi kill-switch'lar
   * faqat yangi hodisani to'sadi, navbatdagilar baribir ketaveradi).
   */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Chiquvchi HTTP timeout (ms). Kontrakt: 15 soniya. */
  @Column({ type: 'int', default: 15000 })
  request_timeout_ms: number;

  /** Sandbox rejimi — panelda aniq belgi ko'rsatiladi. */
  @Column({ type: 'boolean', default: false })
  is_sandbox: boolean;

  /**
   * Hisob-kitob davri (kun). Panel «oxirgi to'lovdan N kun o'tdi» kartasini
   * shunga qarab ko'rsatadi. Avtomatik to'lov YO'Q — qaror P9.
   */
  @Column({ type: 'int', default: 7 })
  settlement_period_days: number;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_ping_at: number | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_reconcile_at: number | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_settlement_at: number | null;

  /**
   * DAFTAR yozuvlari uchun keyingi `seq`.
   *
   * ⚠️ IKKI VAZIFASI BOR:
   *   1. Yozuvlarga monoton raqam beradi — marketplace uzilishni aniqlaydi.
   *   2. Ajratish `UPDATE ... RETURNING` bilan bo'lgani uchun integratsiya
   *      qatoriga QULF qo'yadi va shu tranzaksiya davomida ushlab turadi.
   *      Natijada `seller_balance_after` ni oldingi yozuvdan hisoblash
   *      POYGASIZ bo'ladi — aks holda ikki parallel sotuv bir xil
   *      «oldingi balans» ni o'qib, ikkalasi ham noto'g'ri jamlanma yozardi.
   */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  next_ledger_seq: number;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'market_id' })
  market: UserEntity;
}
