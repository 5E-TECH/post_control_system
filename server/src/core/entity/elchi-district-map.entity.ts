import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DistrictEntity } from './district.entity';

/**
 * Bizning tuman ↔ Elchi tumani moslamasi VA pilot darvozasi.
 *
 * ── MOSLASH ──
 * Ikki tizim ham SOATO klassifikatoridan foydalanadi, shu bois `sato_code`
 * ikki tomon orasidagi TABIIY KALIT: `GET /partner/districts` javobidan
 * kelgan `sato_code` bizning `district.sato_code` bilan solishtiriladi va
 * moslama avtomatik yaratiladi. Mos kelmaganlari qo'lda to'ldiriladi.
 *
 * ── DARVOZA (nega shu yerda, config'da EMAS) ──
 * Buyurtma Elchi'ga jo'natilishi mumkin FAQAT: (a) tumani uchun moslama bor VA
 * (b) `is_enabled = true`. Moslama jadvali bo'sh bo'lsa — HAMMASI bloklangan
 * (xavfsiz standart holat).
 *
 * Ruxsat ro'yxatini config'da alohida SOATO massivi qilib saqlash ko'rib
 * chiqildi va RAD ETILDI: LDG'da aynan shunday qilingan
 * (`ldg_config.enabled_district_sato_codes`) va u ikki joyda ikki xil haqiqat
 * yaratib, oxirida butunlay olib tashlangan — ustun esa DORMANT qolib ketgan.
 * Moslama va ruxsat bitta qatorda bo'lsa: bitta ekran, bitta haqiqat manbai.
 *
 * ⚠️ BU ROUTER EMAS, DARVOZA. Tizim buyurtmani tumaniga qarab O'ZI
 * yo'naltirmaydi — operator baribir qo'lda "Elchi" kuryerini tanlaydi. Darvoza
 * faqat ruxsat berilmagan tumandagi buyurtmani BLOKLAYDI (ochiq xato bilan).
 * Tuman bo'yicha avtomatik routing 2026-06-04 da ataylab olib tashlangan
 * (yetim `ON_THE_ROAD` buyurtmalar + ikki mexanizm chalkashligi) — takrorlamaymiz.
 */
@Entity('elchi_district_map')
@Unique('UQ_ELCHI_DISTRICT_MAP_DISTRICT', ['district_id'])
@Index('IDX_ELCHI_DISTRICT_MAP_ENABLED', ['is_enabled'])
@Index('IDX_ELCHI_DISTRICT_MAP_SATO', ['sato_code'])
export class ElchiDistrictMapEntity extends BaseEntity {
  /** Bizning tuman. */
  @Column({ type: 'uuid' })
  district_id: string;

  /**
   * Elchi tomonidagi tuman id'si (ularda bigint, bizda VARCHAR).
   * `null` — moslama hali topilmagan, jo'natish bloklanadi.
   */
  @Column({ type: 'varchar', nullable: true })
  elchi_district_id: string | null;

  /** Elchi tomonidagi viloyat id'si (posilka yaratishda uzatiladi). */
  @Column({ type: 'varchar', nullable: true })
  elchi_region_id: string | null;

  /**
   * Moslash paytida ishlatilgan SOATO kodi (audit uchun ko'chirilgan).
   * Bizning tumandagi kod keyinchalik o'zgarsa, nomuvofiqlik shu orqali ko'rinadi.
   */
  @Column({ type: 'varchar', nullable: true })
  sato_code: string | null;

  /**
   * `true` — SOATO bo'yicha AVTOMATIK moslangan; `false` — operator qo'lda
   * tanlagan. Avtomatik moslashni qayta ishga tushirganda qo'lda kiritilganlar
   * ustidan yozilmasligi uchun kerak.
   */
  @Column({ type: 'boolean', default: false })
  matched_automatically: boolean;

  /**
   * DARVOZA. `false` — bu tumandagi buyurtma Elchi'ga jo'natilmaydi.
   * Standart `false`: moslama yaratilishi jo'natishga ruxsat bermaydi —
   * ruxsat operator tomonidan ATAYLAB berilishi kerak.
   */
  @Column({ type: 'boolean', default: false })
  is_enabled: boolean;

  @ManyToOne(() => DistrictEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'district_id' })
  district: DistrictEntity;
}
