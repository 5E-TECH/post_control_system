import { BaseEntity } from 'src/common/database/BaseEntity';
import { Column, Entity, Index } from 'typeorm';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';

/**
 * KELISHILGAN TARIF — VERSIYALANGAN.
 *
 * NEGA ALOHIDA JADVAL, `users.tariff_center` YETMAYDI. Uch sabab (reja §7.2,
 * blokerlar B7–B9):
 *
 *   B7 — `sellOrder` tarifni SOTUV paytida jonli o'qiydi. Dushanba qabul
 *        qilingan posilka chorshanba sotilsa va seshanba tarif o'zgargan
 *        bo'lsa, YANGI tarif qo'llanadi. Yo'ldagi barcha posilka siljiydi.
 *   B8 — `PATCH order/:id` da tarifni qo'lda o'zgartirish ochiq → kelishuv
 *        jimgina buziladi.
 *   B9 — qabulda `where_deliver` ularning payload'idan emas, market
 *        sozlamasidan olinadi → har «uyga» posilkada 20 000 farq.
 *
 * Yechim: tarif QABUL paytida `order.market_tariff` ga MUZLATILADI va
 * hodisada `tariff_version` bilan birga yuboriladi. Shunda «qaysi tarif
 * qo'llandi» savoli hech qachon bahsli bo'lmaydi.
 *
 * ⚠️ HAMKORLIK KOMISSIYASI BU YERDA YO'Q. Qaror P12: tarif TO'LIQ yoziladi
 * (50 000 / 70 000), komissiya BeePost va marketplace o'rtasida ALOHIDA
 * to'lanadi va tizimga umuman kirmaydi.
 */
@Entity('marketplace_tariff')
@Index('IDX_MP_TARIFF_INTEGRATION', ['integration_id'])
@Index('IDX_MP_TARIFF_ACTIVE', ['integration_id', 'effective_to'])
export class MarketplaceTariffEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  integration_id: string;

  /** 1 dan boshlanadi, har o'zgarishda +1. Hodisada `tariff_version`. */
  @Column({ type: 'int', default: 1 })
  version: number;

  /** Markazga yetkazish — kelishilgan TO'LIQ tarif. */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  tariff_center: number;

  /** Uyga yetkazish — kelishilgan TO'LIQ tarif. */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformerNonNull })
  tariff_home: number;

  /** Amal qilish boshlanishi (epoch ms). */
  @Column({ type: 'bigint', transformer: bigintTransformerNonNull })
  effective_from: number;

  /**
   * Amal qilish tugashi. `null` = HOZIRGI amaldagi versiya.
   * Yangi versiya qo'shilganda eskisiga sana qo'yiladi.
   */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  effective_to: number | null;

  /** Kim o'zgartirdi (audit). */
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  /** Nega o'zgartirildi — kelishuv hujjati raqami va h.k. */
  @Column({ type: 'text', nullable: true })
  note: string | null;
}
