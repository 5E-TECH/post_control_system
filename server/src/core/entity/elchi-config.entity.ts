import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity } from 'typeorm';
import { bigintTransformer } from 'src/common/database/bigint.transformer';

/**
 * Elchi Pochta integratsiya sozlamalari (singleton — doimo bitta qator).
 *
 * MODEL. Elchi — yetkazish pudratchisi: buyurtma BIZDA tug'iladi va bizda o'ladi,
 * Elchi faqat yetkazish bosqichini bajaradi. Bizning tizimda u bitta VIRTUAL
 * KURYER bo'lib ko'rinadi (`users.external_provider = 'elchi'`) — operator shu
 * kuryerni tanlasa, pochta Elchi'ga uzatiladi. LDG bilan bir xil naqsh.
 *
 * MUNOSABATNING IKKI TOMONI. Biz uchun Elchi = yetkazuvchi; Elchi uchun biz =
 * buyurtma manbai (ularning "hamkor" API'si). Shu sababli biz Elchi'ning
 * `/partner/*` API'sidan foydalanamiz va u bizga API kalit beradi.
 *
 * Batafsil: docs/integrations/07-pilot.md
 */
@Entity('elchi_config')
export class ElchiConfigEntity extends BaseEntity {
  // ===== KILL-SWITCH IERARXIYASI =====

  /**
   * MASTER kalit. `false` bo'lsa Elchi'ga hech narsa jo'natilmaydi va kiruvchi
   * webhook ham ishlanmaydi. Sozlash tugagunga qadar `false` — ya'ni tasodifan
   * jonli buyurtma ketib qolmaydi.
   */
  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  /** Kiruvchi webhookni qabul qilish (master yoqilgan bo'lsa ham o'chirish mumkin). */
  @Column({ type: 'boolean', default: true })
  webhook_enabled: boolean;

  /** Holat solishtiruvchi CRON (yo'qolgan webhookni tutadi). */
  @Column({ type: 'boolean', default: true })
  reconcile_enabled: boolean;

  // ===== ELCHI PARTNER API =====

  /** Elchi api-gateway manzili (masalan `https://api.elchi.uz`). */
  @Column({ type: 'varchar', nullable: true })
  api_base_url: string | null;

  /**
   * Elchi bergan hamkor kaliti — har so'rovda `X-Api-Key` header sifatida
   * yuboriladi. Admin panelda QAYTARILMAYDI (faqat `api_key_set` bayrog'i).
   */
  @Column({ type: 'varchar', nullable: true })
  api_key: string | null;

  // ===== KIRUVCHI WEBHOOK (Elchi → biz) =====

  /**
   * Elchi chiquvchi webhookni HMAC-SHA256 bilan imzolaydi va `X-Elchi-Signature`
   * headerida yuboradi. Imzo XOM tana ustidan hisoblanadi.
   */
  @Column({ type: 'varchar', nullable: true })
  webhook_secret: string | null;

  /** Kalit rotatsiyasi oynasida qabul qilinadigan oldingi sekret. */
  @Column({ type: 'varchar', nullable: true })
  webhook_secret_previous: string | null;

  // ===== BOG'LANISHLAR =====

  /**
   * Elchi tomonidagi "BeePost" market akkaunti id'si
   * (`POST /partner/markets` javobidagi `elchi_market_id`).
   *
   * BITTA akkaunt ishlatiladi, har market uchun alohida EMAS: pul avtoriteti
   * bizda qoladi va mavjud kassa/market hisobimiz o'zgarmaydi. Elchi yig'gan
   * naqd shu akkauntda to'planadi, keyin davriy o'tkazma bilan yopiladi.
   */
  @Column({ type: 'varchar', nullable: true })
  elchi_market_id: string | null;

  /**
   * Elchi'ni ifodalovchi virtual kuryer-user (role=COURIER,
   * `external_provider='elchi'`). Uning tarifi = biz Elchi'ga to'laydigan
   * yetkazish haqi.
   *
   * ⚠️ INVARIANT: bu kuryerning tarifi Elchi tomonidagi "BeePost" market
   * tarifiga TENG bo'lishi shart. Aks holda biz bir summani xarajat deb
   * yozamiz, Elchi esa boshqasini ushlab qoladi — ikki daftar ajraladi.
   */
  @Column({ type: 'uuid', nullable: true })
  elchi_courier_user_id: string | null;

  // ===== TELEMETRIYA =====

  /** Oxirgi muvaffaqiyatli ulanish tekshiruvi (`GET /partner/ping`). */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_ping_at: number | null;

  /** Holat solishtirish oxirgi marta to'liq aylanib chiqqan vaqt. */
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  last_reconcile_at: number | null;
}
