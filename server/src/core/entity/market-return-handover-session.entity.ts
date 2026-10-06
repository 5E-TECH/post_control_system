import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import { bigintTransformer } from 'src/common/database/bigint.transformer';
import {
  MarketHandoverChannel,
  MarketHandoverCloseReason,
  MarketHandoverSessionStatus,
} from 'src/api/market-handover/market-handover.enums';

/**
 * MARKET RUXSAT SESSIYASI — bekor qilingan posilkani marketga topshirish.
 *
 * Elchi'ning `market_cancelled_handover_sessions` ekvivalenti. Oqim:
 *
 *   1) market o'z kabinetida «Topshirishga ruxsat beraman» → PENDING
 *      sessiya: QR (`MRC-…`) + 6 xonali PIN, 2 daqiqa amal qiladi;
 *   2) markaz xodimi QR'ni skanerlaydi yoki PIN'ni kiritadi → ACTIVE:
 *      10 daqiqalik ruxsat (`MRA-…`), egasi AYNAN shu xodim;
 *   3) xodim oyna ichida PARTIYA-PARTIYA topshiradi (har partiya alohida
 *      tranzaksiyada saqlanadi — 150 posilkani bir urishda emas);
 *   4) «Yakunlash», sahifadan chiqish, heartbeat uzilishi yoki muddat
 *      tugashi → CLOSED. Yopilgan sessiya qayta ishlatilmaydi.
 *
 * ⚠️ XOM TOKEN SAQLANMAYDI — faqat sha256 hex (`char(64)`). Sabab:
 * BeePost'da QR token avtorizatsiya SIRI EMAS — `GET order/qr-code/:token`
 * da `@UseGuards` kommentga olingan va global APP_GUARD yo'q. Shuning uchun
 * himoya tokenning sirligiga emas, TTL + egalik + sahifaga bog'lanishga
 * tayanadi.
 *
 * ⚠️ Vaqtlar epoch-ms `bigint` + `bigintTransformer` (NULL-saqlovchi
 * varianti). Transformer ulanmasa `pg` ularni SATR qaytaradi va
 * `expires_at <= Date.now()` leksikografik solishtiriladi — ya'ni muddat
 * tekshiruvi JIMGINA buziladi.
 */
@Entity('market_return_handover_session')
@Index('IDX_MRH_SESSION_MARKET_CREATED', ['market_id', 'created_at'])
@Index('IDX_MRH_SESSION_OPEN', ['status', 'authorization_expires_at'])
export class MarketReturnHandoverSessionEntity extends BaseEntity {
  /** Ruxsatni bergan market (users.id, role=market). */
  @Column({ type: 'uuid' })
  market_id: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: MarketHandoverSessionStatus.PENDING,
  })
  status: MarketHandoverSessionStatus;

  @Column({
    type: 'varchar',
    length: 16,
    default: MarketHandoverChannel.WEB,
  })
  channel: MarketHandoverChannel;

  /** sha256(xom QR token). Offline sessiyada NULL. */
  @Column({ type: 'char', length: 64, nullable: true })
  qr_token_hash: string | null;

  /**
   * sha256(market_id + PIN). PIN — QR'ning zaxirasi: market telefoni eski
   * yoki ekrani xira bo'lsa xodim 6 xonani klaviaturadan kiritadi.
   */
  @Column({ type: 'char', length: 64, nullable: true })
  pin_hash: string | null;

  /** QR/PIN eskirish vaqti (yaratilish + 2 daqiqa). */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  qr_expires_at: number | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  scanned_at: number | null;

  /**
   * QR'ni skanerlagan xodim. Ruxsat AYNAN shu xodimga tegishli — boshqa
   * xodim ayni token bilan topshira olmaydi.
   */
  @Column({ type: 'uuid', nullable: true })
  scanned_by_user_id: string | null;

  /** sha256(xom ruxsat token). */
  @Column({ type: 'char', length: 64, nullable: true })
  authorization_token_hash: string | null;

  /** Topshirish oynasining tugash vaqti (skan + 10 daqiqa). */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  authorization_expires_at: number | null;

  /**
   * Topshirish sahifasidan kelgan oxirgi heartbeat. Sahifa har 30 s da
   * yuboradi; 60 s dan uzoq jimlik = brauzer qulagan/tarmoq uzilgan →
   * sessiya o'lik (`HEARTBEAT_LOST`).
   */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_seen_at: number | null;

  /** PIN'ni noto'g'ri kiritish urinishlari (chegaradan oshsa yopiladi). */
  @Column({ type: 'smallint', default: 0 })
  pin_attempts: number;

  /** Shu sessiya orqali topshirilgan posilkalar soni (denormalizatsiya). */
  @Column({ type: 'int', default: 0 })
  handed_over_count: number;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  closed_at: number | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  close_reason: MarketHandoverCloseReason | null;

  // ─────── OFFLINE AKT (channel = 'offline') ───────
  // Market panelga kira olmaganda posilka OMBORDA QOTMASLIGI kerak. Bu
  // yo'lda QR yo'q, lekin DALIL bor: kim olib ketdi, telefoni, nega
  // QR'siz. `order.market_handover_mode` da `offline_signed` /
  // `admin_override` bo'lib qoladi va hisobotda market tasdig'idan ajraladi.

  @Column({ type: 'varchar', length: 120, nullable: true })
  representative_name: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  representative_phone: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  override_reason: string | null;
}
